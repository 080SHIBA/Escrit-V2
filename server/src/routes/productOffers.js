import { Router } from 'express';
import Joi from 'joi';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Product } from '../models/Product.js';
import { ProductOffer } from '../models/ProductOffer.js';
import { Link } from '../models/Link.js';

export const productOffersRouter = Router();
productOffersRouter.use(requireAuth);

productOffersRouter.get('/', asyncHandler(async (req, res) => {
  const offers = await ProductOffer.find({ $or: [{ buyerId: req.sellerId }, { sellerId: req.sellerId }] })
    .sort({ updatedAt: -1 })
    .populate('productId', 'title images price')
    .populate('buyerId', 'businessName displayName profilePictureUrl')
    .populate('sellerId', 'businessName displayName profilePictureUrl');
  res.json({ offers });
}));

const createOfferSchema = Joi.object({
  productId: Joi.string().hex().length(24).required(),
  priceNaira: Joi.number().min(100).max(100000000).required(),
});

productOffersRouter.post('/', validate(createOfferSchema), asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.body.productId, isActive: true, isVerified: true, negotiable: true });
  if (!product) throw new AppError(409, 'This product is not currently accepting price offers');
  if (String(product.seller) === String(req.sellerId)) throw new AppError(409, 'You cannot make an offer on your own product');
  const offer = await ProductOffer.create({
    productId: product._id,
    buyerId: req.sellerId,
    sellerId: product.seller,
    proposedPriceKobo: Math.round(req.body.priceNaira * 100),
  });
  res.status(201).json({ offer });
}));

const respondSchema = Joi.object({ decision: Joi.string().valid('accept', 'reject').required() });
productOffersRouter.post('/:id/respond', validate(respondSchema), asyncHandler(async (req, res) => {
  const offer = await ProductOffer.findById(req.params.id);
  if (!offer) throw new AppError(404, 'Price offer not found');
  if (String(offer.sellerId) !== String(req.sellerId)) throw new AppError(403, 'Only the seller can respond to this price offer');
  if (offer.status !== 'PROPOSED') throw new AppError(409, 'This price offer has already been answered');

  if (req.body.decision === 'accept') {
    const product = await Product.findById(offer.productId);
    if (!product?.isActive || !product.isVerified || !product.negotiable) throw new AppError(409, 'This product is no longer available for negotiation');
    const link = await Link.create({
      sellerId: offer.sellerId,
      itemName: product.title,
      itemDescription: product.description,
      itemPhotoUrl: product.images[0] || null,
      priceKobo: offer.proposedPriceKobo,
      fulfillmentType: 'product',
      listingType: 'product',
      listingId: product._id,
      refundable: product.refundable,
    });
    offer.linkId = link._id;
    offer.status = 'ACCEPTED';
  } else {
    offer.status = 'REJECTED';
  }
  offer.respondedAt = new Date();
  await offer.save();
  res.json({ offer });
}));