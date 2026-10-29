import test from 'node:test';
import assert from 'node:assert/strict';
import { listingMockHandlers } from './listingMocks.js';

test('service listing mocks save edits, pause and archive without deleting the listing', async () => {
  const { item } = await listingMockHandlers.publish({
    type: 'service',
    title: 'Mock service listing',
    category: 'Design services',
    serviceData: {
      title: 'Mock service listing',
      serviceModel: 'appointment',
      basePrice: 30000,
      availability: [{ day: 'monday', startTime: '09:00', endTime: '17:00' }],
    },
  });
  const updated = await listingMockHandlers.updateService(item._id, {
    title: 'Updated service listing',
    serviceModel: 'custom_quote',
    startingPrice: 0,
  });
  assert.equal(updated.item.title, 'Updated service listing');

  const paused = await listingMockHandlers.setActive('service', item._id, false);
  assert.equal(paused.item.isActive, false);
  const reactivated = await listingMockHandlers.setActive('service', item._id, true);
  assert.equal(reactivated.item.isActive, true);

  const archived = await listingMockHandlers.archiveService(item._id, true);
  assert.equal(archived.item.isActive, false);
  assert.ok(archived.item.archivedAt);
  const restored = await listingMockHandlers.archiveService(item._id, false);
  assert.equal(restored.item.isActive, true);
  assert.equal(restored.item.archivedAt, null);
  assert.equal((await listingMockHandlers.getMyListings()).listings.some((listing) => listing._id === item._id), true);
});
