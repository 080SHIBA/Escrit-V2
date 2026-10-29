import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { applyTrustProxy } from './config/trustProxy.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { enforceHttps, hstsHeader } from './middleware/enforceHttps.js';

import { authRouter } from './routes/auth.js';
import { sellerRouter, bankResolverRouter, profileRouter } from './routes/seller.js';
import { kycRouter } from './routes/kyc.js';
import { linksRouter } from './routes/links.js';
import { publicRouter } from './routes/public.js';
import { webhooksRouter } from './routes/webhooks.js';
import { adminRouter } from './routes/admin.js';
import { listingWorkflowRouter, marketplaceRouter } from './routes/marketplace.js';
import { uploadsRouter } from './routes/uploads.js';
import { shopifyRouter } from './routes/shopify.js';
import { serviceOffersRouter } from './routes/serviceOffers.js';
import { servicesRouter } from './routes/services.js';
import { productOffersRouter } from './routes/productOffers.js';
import { ordersRouter } from './routes/orders.js';
import { onboardingRouter } from './routes/onboarding.js';
import { escrowLinksRouter } from './routes/escrowLinks.js';
import { funnelEventsRouter } from './routes/funnelEvents.js';
import { notificationsRouter } from './routes/notifications.js';
import { cartCheckoutRouter } from './routes/cartCheckout.js';
import { getPlatformSettings } from './services/platformSettings.js';
import { asyncHandler } from './middleware/asyncHandler.js';

export function createApp() {
  const app = express();

  applyTrustProxy(app);
  app.use(enforceHttps);
  app.use(hstsHeader);
  app.use(
    cors({
      origin(origin, callback) {
        // Requests with no Origin (server-to-server webhooks) pass;
        // browsers must come from a configured client origin.
        if (!origin || env.clientOrigins.includes(origin)) callback(null, true);
        else callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    })
  );
  app.use(cookieParser());

  // Payment webhooks use the raw body parser, so they are mounted before JSON parsing.
  app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhooksRouter);

  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // Non-sensitive runtime flags the client needs before login (e.g. the Test/Live ribbon).
  app.get('/api/public-config', asyncHandler(async (_req, res) => {
    const settings = await getPlatformSettings();
    res.json({ paymentMode: settings.paymentMode === 'live' ? 'live' : 'test', paymentProvider: settings.paymentProvider || 'paystack' });
  }));

  app.use('/api/auth', authRouter);
  app.use('/api/me', onboardingRouter);
  app.use('/api/escrow-links', escrowLinksRouter);
  app.use('/api/funnel-events', funnelEventsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api', cartCheckoutRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/kyc', kycRouter);
  app.use('/api/seller', sellerRouter);
  app.use('/api/banks', bankResolverRouter);
  app.use('/api/links', linksRouter);
  app.use('/api/shopify', shopifyRouter);
  app.use('/api/marketplace', marketplaceRouter);
  app.use('/api/listings', listingWorkflowRouter);
  app.use('/api/uploads', uploadsRouter);
  app.use('/api/service-offers', serviceOffersRouter);
  app.use('/api/conversations', serviceOffersRouter);
  app.use('/api/offers', serviceOffersRouter);
  app.use('/api/services', servicesRouter);
  app.use('/api/product-offers', productOffersRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/r', publicRouter); // buyer-facing, no auth
  app.use('/api/admin', adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
