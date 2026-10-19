import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LISTING_FORM, listingStrength, nextStrengthTip, validateListing } from './listingState.js';

const validProduct = {
  ...DEFAULT_LISTING_FORM,
  title: 'Handmade leather bag',
  category: 'Fashion',
  description: 'A durable handmade leather bag, carefully finished and ready for everyday use.',
  price: '12000',
};
const photo = { url: 'https://images.example.test/cover.jpg' };

test('listing validation requires common fields and product photos', () => {
  assert.deepEqual(validateListing(DEFAULT_LISTING_FORM), {
    title: 'Use at least 5 characters for the title.',
    category: 'Choose a category.',
    description: 'Add at least 20 characters to the description.',
    price: 'Enter a price above ₦0 using digits only.',
    photos: 'Add at least one photo before publishing.',
  });
  assert.deepEqual(validateListing(validProduct, [photo]), {});
});

test('service and course have their own publish requirements', () => {
  const service = { ...validProduct, type: 'service', deliveryTime: '' };
  assert.equal(validateListing(service).deliveryTime, 'Add an estimated delivery time.');
  assert.equal(validateListing({ ...service, deliveryTime: '3 days' }).photos, undefined);
  const course = { ...validProduct, type: 'course', duration: '' };
  assert.equal(validateListing(course).duration, 'Add a duration or number of lessons.');
  assert.equal(validateListing({ ...course, duration: '8 lessons' }).duration, undefined);
  assert.equal(validateListing({ ...validProduct, quantity: '' }).quantity, 'Quantity must be at least 1.');
});

test('strength score awards exactly the requested point values', () => {
  assert.equal(listingStrength(DEFAULT_LISTING_FORM), 0);
  assert.equal(listingStrength(validProduct, [photo]), 75);
  const full = { ...validProduct, description: `${validProduct.description} ${'Useful detail. '.repeat(5)}` };
  assert.equal(listingStrength(full, [photo, photo, photo]), 100);
  assert.equal(nextStrengthTip(full, [photo, photo, photo]), 'Your listing has everything buyers need.');
});
