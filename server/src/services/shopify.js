import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { ShopifyConnection } from '../models/ShopifyConnection.js';

const API_TIMEOUT_MS = 20_000;
const tokenRefreshes = new Map();

export function isValidShopDomain(shopDomain) {
  return typeof shopDomain === 'string' &&
    /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shopDomain);
}

export function verifyShopifyHmac(query) {
  if (!env.shopify.apiSecret || typeof query.hmac !== 'string') return false;
  const entries = Object.entries(query)
    .filter(([key, value]) => key !== 'hmac' && key !== 'signature' && typeof value === 'string')
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  if (entries.length !== Object.keys(query).filter((key) => key !== 'hmac' && key !== 'signature').length) return false;

  const message = entries.map(([key, value]) => `${key}=${value}`).join('&');
  const expected = crypto.createHmac('sha256', env.shopify.apiSecret).update(message).digest();
  let actual;
  try {
    actual = Buffer.from(query.hmac, 'hex');
  } catch {
    return false;
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function getEncryptionKey() {
  const configured = env.shopify.tokenEncryptionKey;
  if (!configured) throw new AppError(503, 'Shopify token encryption is not configured on the server.');
  const key = /^[a-f0-9]{64}$/i.test(configured)
    ? Buffer.from(configured, 'hex')
    : Buffer.from(configured, 'base64');
  if (key.length !== 32) throw new AppError(503, 'SHOPIFY_TOKEN_ENCRYPTION_KEY must encode exactly 32 bytes.');
  return key;
}

export function encryptShopifyToken(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

function decryptShopifyToken(encrypted) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(encrypted.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function getShopifyConfiguration() {
  const { apiKey, apiSecret, redirectUri, tokenEncryptionKey } = env.shopify;
  if (!apiKey || !apiSecret || !redirectUri || !tokenEncryptionKey) {
    throw new AppError(503, 'Shopify integration is not configured. Add its app credentials and token encryption key to the server environment.');
  }
  let callback;
  try {
    callback = new URL(redirectUri);
  } catch {
    throw new AppError(503, 'SHOPIFY_REDIRECT_URI must be the public API callback URL ending in /api/shopify/callback.');
  }
  const isLocalDevelopment = env.nodeEnv !== 'production' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(callback.hostname) &&
    callback.protocol === 'http:';
  if ((!isLocalDevelopment && callback.protocol !== 'https:') ||
      callback.pathname !== '/api/shopify/callback' ||
      callback.search ||
      callback.hash ||
      callback.username ||
      callback.password) {
    throw new AppError(
      503,
      'SHOPIFY_REDIRECT_URI must be the public API URL ending exactly in /api/shopify/callback, and must match the redirect URL allowed in your Shopify app.'
    );
  }
  getEncryptionKey();
  return env.shopify;
}

async function shopifyFetch(url, options) {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(API_TIMEOUT_MS) });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new AppError(504, 'Shopify did not respond in time. Please try again.');
    }
    throw new AppError(502, 'Unable to reach Shopify. Please try again.');
  }
}

export async function exchangeAuthorizationCode(shopDomain, code) {
  const { apiKey, apiSecret } = getShopifyConfiguration();
  const response = await shopifyFetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: apiKey, client_secret: apiSecret, code }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.access_token) {
    throw new AppError(502, 'Shopify could not authorize this store. Check the app configuration and try again.');
  }
  return result;
}

async function refreshShopifyToken(connection) {
  const { apiKey, apiSecret } = getShopifyConfiguration();
  if (!connection.refreshTokenCiphertext || !connection.refreshTokenIv || !connection.refreshTokenTag) {
    throw new AppError(401, 'The Shopify connection has expired. Disconnect it and connect the store again.');
  }
  if (connection.refreshTokenExpiresAt && connection.refreshTokenExpiresAt <= new Date()) {
    throw new AppError(401, 'The Shopify connection has expired. Disconnect it and connect the store again.');
  }

  const oldRefreshToken = decryptShopifyToken({
    ciphertext: connection.refreshTokenCiphertext,
    iv: connection.refreshTokenIv,
    tag: connection.refreshTokenTag,
  });
  const response = await shopifyFetch(`https://${connection.shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      grant_type: 'refresh_token',
      refresh_token: oldRefreshToken,
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.access_token) {
    throw new AppError(401, 'Shopify could not refresh the connection. Disconnect it and connect the store again.');
  }

  const access = encryptShopifyToken(result.access_token);
  const refresh = encryptShopifyToken(result.refresh_token || oldRefreshToken);
  connection.accessTokenCiphertext = access.ciphertext;
  connection.accessTokenIv = access.iv;
  connection.accessTokenTag = access.tag;
  connection.accessTokenExpiresAt = result.expires_in ? new Date(Date.now() + result.expires_in * 1000) : null;
  connection.refreshTokenCiphertext = refresh.ciphertext;
  connection.refreshTokenIv = refresh.iv;
  connection.refreshTokenTag = refresh.tag;
  connection.refreshTokenExpiresAt = result.refresh_token_expires_in
    ? new Date(Date.now() + result.refresh_token_expires_in * 1000)
    : connection.refreshTokenExpiresAt;
  await connection.save();
}

async function accessTokenFor(connection) {
  if (connection.accessTokenExpiresAt && connection.accessTokenExpiresAt <= new Date(Date.now() + 60_000)) {
    let refresh = tokenRefreshes.get(String(connection._id));
    if (!refresh) {
      refresh = refreshShopifyToken(connection).finally(() => tokenRefreshes.delete(String(connection._id)));
      tokenRefreshes.set(String(connection._id), refresh);
    }
    await refresh;
  }
  return decryptShopifyToken({
    ciphertext: connection.accessTokenCiphertext,
    iv: connection.accessTokenIv,
    tag: connection.accessTokenTag,
  });
}

export async function shopifyGraphql(connection, query, variables = {}) {
  const token = await accessTokenFor(connection);
  const response = await shopifyFetch(`https://${connection.shopDomain}/admin/api/${env.shopify.apiVersion}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AppError(401, 'Shopify denied access. Reconnect the store and check its approved permissions.');
    }
    throw new AppError(502, `Shopify returned HTTP ${response.status}. Please try again.`);
  }
  if (result?.errors?.length) {
    const accessDenied = result.errors.some((error) => error.extensions?.code === 'ACCESS_DENIED');
    if (accessDenied) throw new AppError(403, 'Shopify denied the requested data access. Reconnect the store with the required permissions.');
    throw new AppError(502, 'Shopify could not complete that data request.');
  }
  if (!result?.data) throw new AppError(502, 'Shopify returned an invalid API response.');
  return result.data;
}

export function publicShopifyConnection(connection) {
  if (!connection) return null;
  return {
    shopDomain: connection.shopDomain,
    connectedAt: connection.createdAt,
    lastProductSyncAt: connection.lastProductSyncAt,
    hasMoreProducts: Boolean(connection.productCursor),
  };
}

export function makeShopifyAuthorizationUrl(shopDomain, state) {
  const { apiKey, redirectUri } = getShopifyConfiguration();
  const url = new URL(`https://${shopDomain}/admin/oauth/authorize`);
  url.search = new URLSearchParams({
    client_id: apiKey,
    scope: 'read_products,read_orders',
    redirect_uri: redirectUri,
    state,
  }).toString();
  return url.toString();
}

export function makeShopifyReturnUrl(status) {
  const url = new URL('/settings', env.clientUrl);
  url.searchParams.set('shopify', status);
  return url.toString();
}

export function randomOAuthState() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashOAuthState(state) {
  return crypto.createHash('sha256').update(state).digest('hex');
}

export function shopifyTokenFields(tokens) {
  const access = encryptShopifyToken(tokens.access_token);
  const refresh = tokens.refresh_token ? encryptShopifyToken(tokens.refresh_token) : null;
  return {
    accessTokenCiphertext: access.ciphertext,
    accessTokenIv: access.iv,
    accessTokenTag: access.tag,
    accessTokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
    refreshTokenCiphertext: refresh?.ciphertext || null,
    refreshTokenIv: refresh?.iv || null,
    refreshTokenTag: refresh?.tag || null,
    refreshTokenExpiresAt: tokens.refresh_token_expires_in
      ? new Date(Date.now() + tokens.refresh_token_expires_in * 1000)
      : null,
  };
}

export function parseShopifyPrice(price) {
  const parsed = Number(price);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
