import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { cartCheckoutRouter } from './cartCheckout.js';
import { errorHandler } from '../middleware/errorHandler.js';

async function withTestServer(run) {
  const app = express();
  app.use('/api', cartCheckoutRouter);
  app.get('/api/listings', (_req, res) => res.json({ items: [] }));
  app.use(errorHandler);

  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('public listing requests bypass cart authentication while cart access remains protected', async () => {
  await withTestServer(async (baseUrl) => {
    const listingsResponse = await fetch(`${baseUrl}/api/listings?limit=100`, { headers: { connection: 'close' } });
    assert.equal(listingsResponse.status, 200);
    assert.deepEqual(await listingsResponse.json(), { items: [] });

    const cartResponse = await fetch(`${baseUrl}/api/cart`, { headers: { connection: 'close' } });
    assert.equal(cartResponse.status, 401);
    assert.deepEqual(await cartResponse.json(), { error: 'Missing access token' });
  });
});
