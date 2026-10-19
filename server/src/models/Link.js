// The shareable payment link: one item, one URL. It has no buyer or
// escrow status of its own. Each checkout creates a Transaction, which
// holds all per-purchase state, so one link can serve many buyers.
import mongoose from 'mongoose';

const scheduledDiscountSchema = new mongoose.Schema(
  {
    percent: { type: Number, min: 1, max: 90, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
  },
  { _id: false }
);

const linkSchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    itemName: { type: String, required: true, trim: true },
    itemDescription: { type: String, trim: true, default: '' },
    termsSnapshot: { type: String, trim: true, default: '' },
    fulfillmentType: { type: String, enum: ['product', 'course', 'service'], default: 'product' },
    listingType: { type: String, enum: ['product', 'course', 'service'], default: null },
    listingId: { type: mongoose.Schema.Types.ObjectId, default: null },
    refundable: { type: Boolean, default: false },
    // HTTPS URL of the item photo, hosted on Cloudinary (or pasted by the seller).
    itemPhotoUrl: { type: String, default: null },
    priceKobo: { type: Number, required: true, min: 10000 }, // ₦100 minimum, keeps test transfers sane
    scheduledDiscount: { type: scheduledDiscountSchema, default: null },
    checkoutPriceKobo: { type: Number, default: null },
    checkoutBasePriceKobo: { type: Number, default: null },
    checkoutProvider: { type: String, enum: ['paystack', 'flutterwave'], default: null },

    // Off stops new checkouts; orders already in progress are unaffected.
    active: { type: Boolean, default: true, index: true },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Link = mongoose.model('Link', linkSchema);
