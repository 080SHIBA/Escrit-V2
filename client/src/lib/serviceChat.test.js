import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canActOnOffer,
  chatNowUrl,
  containsContactDetails,
  getConversationRole,
  getConversationStage,
  mergeMessages,
  paymentOptionCopy,
} from './serviceChat.js';

test('conversation stages follow server payment and order state', () => {
  assert.equal(getConversationStage({ status: 'REQUESTED' }), 'Inquiry');
  assert.equal(getConversationStage({ status: 'QUOTED' }), 'Offer');
  assert.equal(getConversationStage({ status: 'ACCEPTED' }, { paymentStatus: 'processing' }), 'Payment pending');
  assert.equal(getConversationStage({ status: 'ACCEPTED' }, { status: 'in_progress', paymentStatus: 'paid' }), 'In progress');
  assert.equal(getConversationStage({}, { status: 'delivered' }), 'Delivered');
  assert.equal(getConversationStage({}, { status: 'completed' }), 'Completed');
  assert.equal(getConversationStage({}, { status: 'disputed' }), 'Disputed');
});

test('offer actions are limited by conversation role and offer state', () => {
  assert.equal(canActOnOffer({ status: 'REQUESTED' }, 'seller', 'send-offer'), true);
  assert.equal(canActOnOffer({ status: 'REQUESTED' }, 'buyer', 'send-offer'), false);
  assert.equal(canActOnOffer({ status: 'QUOTED' }, 'buyer', 'accept'), true);
  assert.equal(canActOnOffer({ status: 'QUOTED' }, 'seller', 'accept'), false);
  assert.equal(canActOnOffer({ status: 'QUOTED', counterCount: 0 }, 'buyer', 'counter'), true);
  assert.equal(canActOnOffer({ status: 'QUOTED', counterCount: 1 }, 'buyer', 'counter'), false);
  assert.equal(canActOnOffer({ status: 'PROPOSED' }, 'seller', 'accept'), true);
});

test('participants are determined from the correct buyer and seller ids', () => {
  const conversation = { buyerId: { _id: 'buyer-1' }, sellerId: { _id: 'seller-1' } };
  assert.equal(getConversationRole(conversation, 'buyer-1'), 'buyer');
  assert.equal(getConversationRole(conversation, 'seller-1'), 'seller');
  assert.equal(getConversationRole(conversation, 'other'), null);
});

test('payment copy distinguishes optional direct payment from escrow', () => {
  assert.match(paymentOptionCopy('direct'), /paid directly/);
  assert.match(paymentOptionCopy('direct'), /cannot hold or recover/);
  assert.match(paymentOptionCopy('direct'), /reporting is available/);
  assert.match(paymentOptionCopy('escrow'), /under the terms saved with this order/);
  assert.doesNotMatch(paymentOptionCopy('escrow'), /guaranteed escrow/i);
});

test('contact details are detected before a message is sent', () => {
  assert.equal(containsContactDetails('Email me at seller@example.com'), true);
  assert.equal(containsContactDetails('Call +234 801 234 5678'), true);
  assert.equal(containsContactDetails('Let’s discuss the project scope here.'), false);
});

test('cart and listing chat entry points resolve to the same conversation route', () => {
  const fromCart = new URL(chatNowUrl({ sellerId: 'seller-1', listingId: 'service-1' }), 'https://escrit.test');
  const fromListing = new URL(chatNowUrl({ sellerId: 'seller-1', listingId: 'service-1', listingType: 'service' }), 'https://escrit.test');
  assert.equal(fromCart.pathname, '/account/chats');
  assert.equal(fromListing.pathname, '/account/chats');
  assert.equal(fromCart.searchParams.get('listingId'), fromListing.searchParams.get('listingId'));
});

test('optimistic and socket messages merge without duplicates', () => {
  const optimistic = { clientMessageId: 'client-1', body: 'Hello', createdAt: '2026-01-01T00:00:00Z' };
  const persisted = { _id: 'db-1', clientMessageId: 'client-1', body: 'Hello', createdAt: '2026-01-01T00:00:00Z' };
  const merged = mergeMessages([optimistic], [persisted]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]._id, 'db-1');
  assert.equal(merged[0].optimistic, false);
  assert.equal(merged[0].failed, false);
});
