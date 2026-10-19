// Single place where environment variables are read and validated.
// Nothing else should touch `process.env`, so missing config fails
// loudly at startup instead of mid-request.
import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const clientOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  noShowResponseDays: Number(process.env.NO_SHOW_RESPONSE_DAYS) || 7,

  // Comma-separated so production and preview deployments can both call the API.
  clientOrigins,
  // Used to build links inside emails. Defaults to the first allowed origin.
  clientUrl: process.env.CLIENT_URL || clientOrigins[0],

  mongodbUri: required('MONGODB_URI'),

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL || '7d',
  },

  // Both processors ship live AND test credentials. Which pair is actually
  // used is an owner-controlled runtime setting (PlatformSettings.paymentMode),
  // not a redeploy — see services/paystack.js / flutterwave.js. `secretKey`/
  // `webhookSecret` below default to the test pair so anything that hasn't
  // been updated to the mode-aware lookup still fails safely towards test.
  flutterwave: {
    secretKeyLive: process.env.FLW_SECRET_KEY_LIVE || null,
    secretKeyTest: process.env.FLW_SECRET_KEY_TEST || process.env.FLW_SECRET_KEY || null,
    webhookSecretLive: process.env.FLW_SECRET_HASH_LIVE || process.env.FLW_SECRET_HASH || null,
    webhookSecretTest: process.env.FLW_SECRET_HASH_TEST || process.env.FLW_SECRET_HASH || null,
    get secretKey() { return this.secretKeyTest; },
    get webhookSecret() { return this.webhookSecretTest; },
    baseUrl: process.env.FLW_BASE_URL || 'https://api.flutterwave.com/v3',
  },
  paystack: {
    secretKeyLive: process.env.PAYSTACK_SECRET_KEY_LIVE || null,
    secretKeyTest: process.env.PAYSTACK_SECRET_KEY_TEST || process.env.PAYSTACK_SECRET_KEY || null,
    // Paystack signs webhooks with the secret key of whichever mode sent the
    // event, so the live/test webhook "secret" IS that mode's secret key.
    webhookSecretLive: process.env.PAYSTACK_WEBHOOK_SECRET_LIVE || process.env.PAYSTACK_SECRET_KEY_LIVE || null,
    webhookSecretTest:
      process.env.PAYSTACK_WEBHOOK_SECRET_TEST ||
      process.env.PAYSTACK_WEBHOOK_SECRET ||
      process.env.PAYSTACK_SECRET_KEY_TEST ||
      process.env.PAYSTACK_SECRET_KEY ||
      null,
    get secretKey() { return this.secretKeyTest; },
    get webhookSecret() { return this.webhookSecretTest; },
    baseUrl: process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co',
  },
  // Seller emails allowed to resolve disputes. Empty means nobody (fails closed).
  ownerEmails: (process.env.OWNER_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  adminEmails: (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),

  // Optional integrations: the app boots without them and the related
  // feature is switched off.
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || null,
  },

  shopify: {
    apiKey: process.env.SHOPIFY_API_KEY || null,
    apiSecret: process.env.SHOPIFY_API_SECRET || null,
    redirectUri: process.env.SHOPIFY_REDIRECT_URI || null,
    tokenEncryptionKey: process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY || null,
    apiVersion: process.env.SHOPIFY_API_VERSION || '2026-10',
  },

  // Transactional email over Brevo's HTTPS API (Render's free tier blocks SMTP).
  brevo: {
    apiKey: process.env.BREVO_API_KEY || null,
    fromAddress: process.env.BREVO_FROM_ADDRESS || null,
    fromName: process.env.BREVO_FROM_NAME || 'Escrit',
  },

  // Item photo hosting. Without these, sellers can still paste an image link.
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || null,
    apiKey: process.env.CLOUDINARY_API_KEY || null,
    apiSecret: process.env.CLOUDINARY_API_SECRET || null,
  },
};
