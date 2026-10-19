import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { startNoShowSettlementJob } from './services/noShowSettlement.js';
import { startDeliveryReleaseJob } from './services/deliveryRelease.js';
import { configureSocketServer } from './services/socketServer.js';

// Routes are wrapped in asyncHandler, but the cron job runs outside a
// request. Log stray failures instead of letting one bad tick kill the server.
process.on('unhandledRejection', (err) => {
  console.error('[server] unhandled rejection', err);
});
process.on('uncaughtException', (err) => {
  console.error('[server] uncaught exception', err);
});

async function main() {
  await connectDB();

  const app = createApp();
  const server = createServer(app);
  const io = new Server(server, { cors: { origin: env.clientOrigins, credentials: true } });
  app.set('io', io);
  configureSocketServer(io);
  server.listen(env.port, () => {
    console.log(`[server] listening on :${env.port} (${env.nodeEnv})`);
  });

  startNoShowSettlementJob();
  startDeliveryReleaseJob();

}

main().catch((err) => {
  console.error('[server] fatal startup error', err);
  process.exit(1);
});
