import crypto from 'node:crypto';
import { Router } from 'express';
import Joi from 'joi';
import { env } from '../config/env.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { Link } from '../models/Link.js';
import { Product } from '../models/Product.js';
import { ProductCategory } from '../models/ListingCategory.js';
import { ShopifyConnection } from '../models/ShopifyConnection.js';
import { ShopifyOAuthState } from '../models/ShopifyOAuthState.js';
import { User } from '../models/User.js';
import {
  exchangeAuthorizationCode,
  hashOAuthState,
  isValidShopDomain,
  makeShopifyAuthorizationUrl,
  makeShopifyReturnUrl,
  parseShopifyPrice,
  publicShopifyConnection,
  randomOAuthState,
  shopifyGraphql,
  shopifyTokenFields,
  verifyShopifyHmac,
} from '../services/shopify.js';

export const shopifyRouter = Router();

const PRODUCT_SYNC_QUERY = `#graphql
  query EscritProductSync($after: String) {
    productVariants(first: 250, after: $after) {
      nodes {
        id
        title
        price
        inventoryQuantity
        product {
          id
          title
          description
          productType
          featuredImage { url }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const ORDERS_QUERY = `#graphql
  query EscritRecentOrders {
    orders(first: 50, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        name
        createdAt
        displayFinancialStatus
        displayFulfillmentStatus
        totalPriceSet { shopMoney { amount currencyCode } }
        lineItems(first: 10) { nodes { title quantity } }
      }
    }
  }
`;
const connectSchema = Joi.object({
  shopDomain: Joi.string().trim().lowercase().pattern(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/).required(),
});

function oauthSignatureValid(query) {
  if (!verifyShopifyHmac(query)) return false;
  const timestamp = Number(query.timestamp);
  return Number.isFinite(timestamp) && Math.abs(Date.now() / 1000 - timestamp) <= 300;
}

async function loadSellerConnection(sellerId) {
  const connection = await ShopifyConnection.findOne({ sellerId });
  if (!connection) throw new AppError(404, 'Connect a Shopify store before using this feature.');
  return connection;
}

shopifyRouter.get('/connection', requireAuth, asyncHandler(async (req, res) => {
  const connection = await ShopifyConnection.findOne({ sellerId: req.sellerId });
  res.json({ connection: publicShopifyConnection(connection) });
}));

shopifyRouter.post('/connect', requireAuth, authLimiter, validate(connectSchema), asyncHandler(async (req, res) => {
  const shopDomain = req.body.shopDomain;
  if (!isValidShopDomain(shopDomain)) throw new AppError(400, 'Enter a valid Shopify store domain ending in .myshopify.com.');
  if (await ShopifyConnection.exists({ shopDomain, sellerId: { $ne: req.sellerId } })) {
    throw new AppError(409, 'This Shopify store is already connected to another Escrit account.');
  }
  const state = randomOAuthState();
  await ShopifyOAuthState.create({
    stateHash: hashOAuthState(state),
    sellerId: req.sellerId,
    shopDomain,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  res.json({ authorizationUrl: makeShopifyAuthorizationUrl(shopDomain, state) });
}));

shopifyRouter.get('/callback', asyncHandler(async (req, res) => {
  if (!oauthSignatureValid(req.query)) {
    throw new AppError(400, 'Shopify authorization could not be verified. Start the connection again.');
  }
  const { shop, code, state } = req.query;
  if (!isValidShopDomain(shop) || typeof code !== 'string' || typeof state !== 'string') {
    throw new AppError(400, 'Shopify returned an incomplete authorization response.');
  }

  const stateHash = hashOAuthState(state);
  const pending = await ShopifyOAuthState.findOneAndDelete({
    stateHash,
    shopDomain: shop,
    expiresAt: { $gt: new Date() },
  });
  if (!pending) throw new AppError(403, 'The Shopify connection request expired. Start the connection again.');

  const tokens = await exchangeAuthorizationCode(shop, code);
  const grantedScopes = new Set(String(tokens.scope || '').split(',').map((scope) => scope.trim()));
  if (!grantedScopes.has('read_products') || !grantedScopes.has('read_orders')) {
    throw new AppError(403, 'Shopify did not grant the product and order permissions required by Escrit.');
  }
  if (await ShopifyConnection.exists({ shopDomain: shop, sellerId: { $ne: pending.sellerId } })) {
    throw new AppError(409, 'This Shopify store is already connected to another Escrit account.');
  }
  const tokenFields = shopifyTokenFields(tokens);
  await ShopifyConnection.findOneAndUpdate(
    { sellerId: pending.sellerId },
    {
      $set: {
        sellerId: pending.sellerId,
        shopDomain: shop,
        ...tokenFields,
        productCursor: null,
        lastProductSyncAt: null,
      },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.redirect(makeShopifyReturnUrl('connected'));
}));

shopifyRouter.delete('/connection', requireAuth, asyncHandler(async (req, res) => {
  const connection = await ShopifyConnection.findOneAndDelete({ sellerId: req.sellerId });
  if (!connection) throw new AppError(404, 'No Shopify store is connected.');
  await ShopifyOAuthState.deleteMany({ sellerId: req.sellerId });
  res.json({ ok: true });
}));

shopifyRouter.post('/products/sync', requireAuth, authLimiter, asyncHandler(async (req, res) => {
  const connection = await loadSellerConnection(req.sellerId);
  const data = await shopifyGraphql(connection, PRODUCT_SYNC_QUERY, { after: connection.productCursor });
  const result = data.productVariants;
  const variants = result.nodes.map((variant) => ({ product: variant.product, variant }));
  const externalVariantIds = variants.map(({ variant }) => variant.id);
  const existing = await Product.find({
    externalShopDomain: connection.shopDomain,
    externalVariantId: { $in: externalVariantIds },
  }).select('externalVariantId');
  const existingIds = new Set(existing.map((item) => item.externalVariantId));
  const operations = variants
    .filter(({ variant }) => !existingIds.has(variant.id))
    .map(({ product, variant }) => {
      const title = variant.title && variant.title !== 'Default Title'
        ? `${product.title} — ${variant.title}`
        : product.title;
      const price = parseShopifyPrice(variant.price);
      return {
        updateOne: {
          filter: { externalShopDomain: connection.shopDomain, externalVariantId: variant.id },
          update: {
            $setOnInsert: {
              seller: req.sellerId,
              title: title.slice(0, 160),
              description: product.description.slice(0, 5000),
              images: product.featuredImage?.url ? [product.featuredImage.url] : [],
              category: product.productType.trim().slice(0, 80) || 'General',
              isActive: false,
              isVerified: false,
              price: price ?? 0,
              stock: Math.max(0, variant.inventoryQuantity || 0),
              condition: 'new',
              externalSource: 'shopify',
              externalShopDomain: connection.shopDomain,
              externalProductId: product.id,
              externalVariantId: variant.id,
            },
          },
          upsert: true,
        },
      };
    });
  if (operations.length) await Product.bulkWrite(operations, { ordered: false });

  connection.productCursor = result.pageInfo.hasNextPage ? result.pageInfo.endCursor : null;
  connection.lastProductSyncAt = new Date();
  await connection.save();
  res.json({
    imported: operations.length,
    skipped: variants.length - operations.length,
    hasMore: Boolean(connection.productCursor),
    shopDomain: connection.shopDomain,
  });
}));

shopifyRouter.get('/drafts', requireAuth, asyncHandler(async (req, res) => {
  const drafts = await Product.find({
    seller: req.sellerId,
    externalSource: 'shopify',
    isActive: false,
    isVerified: false,
  }).sort({ createdAt: -1 }).limit(100);
  res.json({ drafts });
}));

const submitDraftSchema = Joi.object({
  title: Joi.string().trim().min(2).max(160).required(),
  description: Joi.string().trim().max(5000).allow('').required(),
  category: Joi.string().trim().max(80).allow('').required(),
  price: Joi.number().min(100).max(100000000).required(),
  stock: Joi.number().integer().min(0).max(1000000).required(),
  imageUrl: Joi.string().uri({ scheme: ['http', 'https'] }).allow('').required(),
});

shopifyRouter.post('/drafts/:id/submit', requireAuth, validate(submitDraftSchema), asyncHandler(async (req, res) => {
  const [seller, product] = await Promise.all([
    User.findById(req.sellerId),
    Product.findOne({
      _id: req.params.id,
      seller: req.sellerId,
      externalSource: 'shopify',
      isActive: false,
      isVerified: false,
    }),
  ]);
  if (!seller) throw new AppError(404, 'Seller account not found.');
  if (!product) throw new AppError(404, 'Shopify draft not found.');
  if (seller.kycStatus !== 'verified') throw new AppError(422, 'Complete identity verification in Profile & KYC before submitting a listing.');
  if (!seller.bankAccount) throw new AppError(422, 'Add a verified payout account before submitting a listing.');

  const categoryName = req.body.category.trim() || 'General';
  const categorySlug = categoryName.toLowerCase();
  let category = await ProductCategory.findOne({ slug: categorySlug });
  if (category?.approvalStatus === 'rejected') {
    category.approvalStatus = 'pending';
    category.requestedBy = seller._id;
    await category.save();
  }
  if (!category && categorySlug !== 'general') {
    category = await ProductCategory.create({
      name: categoryName,
      slug: categorySlug,
      approvalStatus: 'pending',
      requestedBy: seller._id,
    });
  }
  const listingCategory = category?.name || 'General';
  let link;
  let createdLink = false;
  try {
    link = product.escrowLinkId
      ? await Link.findOne({ _id: product.escrowLinkId, sellerId: seller._id })
      : null;
    if (link) {
      link.itemName = req.body.title;
      link.itemDescription = req.body.description;
      link.itemPhotoUrl = req.body.imageUrl || null;
      link.priceKobo = Math.round(req.body.price * 100);
      await link.save();
    } else {
      link = await Link.create({
        sellerId: seller._id,
        itemName: req.body.title,
        itemDescription: req.body.description,
        fulfillmentType: 'product',
        listingType: 'product',
        listingId: product._id,
        itemPhotoUrl: req.body.imageUrl || null,
        priceKobo: Math.round(req.body.price * 100),
      });
      createdLink = true;
    }
    product.title = req.body.title;
    product.description = req.body.description;
    product.category = listingCategory;
    product.categoryReviewStatus = category ? 'approved' : 'pending';
    product.price = req.body.price;
    product.stock = req.body.stock;
    product.images = req.body.imageUrl ? [req.body.imageUrl] : [];
    product.escrowLinkId = link._id;
    product.isActive = true;
    await product.save();
  } catch (error) {
    if (createdLink && link) await Link.deleteOne({ _id: link._id });
    throw error;
  }
  res.status(202).json({ listing: product, message: 'Submitted for Escrit review. It is not visible to buyers until approved.' });
}));

shopifyRouter.get('/orders', requireAuth, authLimiter, asyncHandler(async (req, res) => {
  const connection = await loadSellerConnection(req.sellerId);
  const data = await shopifyGraphql(connection, ORDERS_QUERY);
  res.json({
    orders: data.orders.nodes.map((order) => ({
      id: order.id,
      name: order.name,
      createdAt: order.createdAt,
      financialStatus: order.displayFinancialStatus,
      fulfillmentStatus: order.displayFulfillmentStatus,
      total: order.totalPriceSet.shopMoney,
      items: order.lineItems.nodes,
      channel: 'Shopify',
    })),
    shopDomain: connection.shopDomain,
  });
}));
