import crypto from 'node:crypto';
import { User } from '../models/User.js';
import { CreditPurchase } from '../models/CreditPurchase.js';
import { PromotionCampaign } from '../models/PromotionCampaign.js';
import { PlatformCreditEntry } from '../models/PlatformCreditEntry.js';
import { Referral } from '../models/Referral.js';
import { Product } from '../models/Product.js';
import { Course } from '../models/Course.js';
import { Service } from '../models/Service.js';
import { getPlatformSettings } from './platformSettings.js';
import * as paymentProvider from './paymentProvider.js';
import { ensureUserReferralCode } from '../utils/referralCode.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

const TYPE_CONFIG = {
  product: { Model: Product, label: 'Product' },
  course: { Model: Course, label: 'Course' },
  service: { Model: Service, label: 'Service' },
};

export function maskEmail(email = '') {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

export async function getPromotionPricing() {
  const settings = await getPlatformSettings();
  return (
    settings.promotionPricing?.length
      ? settings.promotionPricing
      : [
          { days: 3, label: '3 days', promoteCredits: 15, featureCredits: 25 },
          { days: 7, label: '7 days', promoteCredits: 30, featureCredits: 50 },
          { days: 14, label: '14 days', promoteCredits: 55, featureCredits: 90 },
          { days: 30, label: '30 days', promoteCredits: 100, featureCredits: 160 },
        ]
  );
}

export async function getCreditPackages() {
  const settings = await getPlatformSettings();
  return (
    settings.creditPackages?.length
      ? settings.creditPackages
      : [
          { id: 'starter', name: 'Starter', credits: 50, priceKobo: 500000, bonusText: 'Standard rate', popular: false },
          { id: 'growth', name: 'Growth', credits: 120, priceKobo: 1000000, bonusText: 'Save 17% · 20 bonus credits', popular: true },
          { id: 'business', name: 'Business', credits: 300, priceKobo: 2250000, bonusText: 'Save 25% · Best value', popular: false },
        ]
  );
}

export async function getUserCreditSummary(userId) {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, 'User not found');

  const referralCode = await ensureUserReferralCode(user);
  const [packages, pricing, entries, referrals, rawCampaigns] = await Promise.all([
    getCreditPackages(),
    getPromotionPricing(),
    PlatformCreditEntry.find({ userId }).sort({ createdAt: -1 }).limit(100),
    Referral.find({ referrerId: userId }).sort({ createdAt: -1 }),
    PromotionCampaign.find({ sellerId: userId }).sort({ createdAt: -1 }),
  ]);

  const now = new Date();
  const campaigns = rawCampaigns.map((camp) => {
    const item = camp.toObject();
    if (item.status !== 'cancelled') {
      if (new Date(item.startDate) > now) {
        item.status = 'scheduled';
      } else if (new Date(item.endDate) <= now) {
        item.status = 'completed';
      } else {
        item.status = 'active';
      }
    }
    return item;
  });

  const availableCredits = user.promoCredits ?? Math.floor((user.promoCreditsKobo || 0) / 10000);
  const availableKobo = user.promoCreditsKobo ?? availableCredits * 10000;

  const purchasedCredits = entries
    .filter((e) => e.type === 'purchased')
    .reduce((sum, e) => sum + (e.credits || Math.round((e.amountKobo || 0) / 10000)), 0);

  const earnedCredits = entries
    .filter((e) => e.type === 'earned')
    .reduce((sum, e) => sum + (e.credits || Math.round((e.amountKobo || 0) / 10000)), 0);

  const spentCredits = entries
    .filter((e) => e.type === 'spent')
    .reduce((sum, e) => sum + Math.abs(e.credits || Math.round((e.amountKobo || 0) / 10000)), 0);

  return {
    balanceCredits: availableCredits,
    balanceKobo: availableKobo,
    stats: {
      availableCredits,
      purchasedCredits,
      earnedCredits,
      spentCredits,
    },
    entries: entries.map((entry) => ({
      _id: entry._id,
      type: entry.type,
      credits: entry.credits || Math.round((entry.amountKobo || 0) / 10000),
      amountKobo: entry.amountKobo,
      reason: entry.reason,
      balanceAfter: entry.balanceAfter,
      listingId: entry.listingId,
      listingType: entry.listingType,
      createdAt: entry.createdAt,
    })),
    referral: {
      code: referralCode,
      link: `${env.clientUrl}/register?ref=${referralCode}`,
      rewardCredits: 25,
      totalEarnedCredits: referrals.filter((r) => r.status === 'rewarded').reduce((acc, r) => acc + (r.rewardCredits || 25), 0),
      referrals: referrals.map((r) => ({
        _id: r._id,
        name: r.referredName || 'Escrit seller',
        emailMasked: maskEmail(r.referredEmail),
        status: r.status,
        rewardCredits: r.rewardCredits || 25,
        createdAt: r.createdAt,
        awardedAt: r.awardedAt,
      })),
    },
    packages,
    promotionPricing: pricing,
    campaigns,
    activeCampaignsCount: campaigns.filter((c) => c.status === 'active').length,
  };
}

export async function initializeCreditPurchase({ userId, packageId, paymentProviderName }) {
  const packages = await getCreditPackages();
  const pkg = packages.find((p) => p.id === packageId);
  if (!pkg) throw new AppError(400, 'Invalid credit package selected');

  const user = await User.findById(userId);
  if (!user) throw new AppError(404, 'User not found');

  const provider = paymentProviderName || (await paymentProvider.getPaymentProviderName()) || 'paystack';
  const reference = `promo_${crypto.randomBytes(12).toString('hex')}`;

  const purchase = await CreditPurchase.create({
    userId,
    packageId: pkg.id,
    packageName: pkg.name,
    credits: pkg.credits,
    amountKobo: pkg.priceKobo,
    paymentProvider: provider,
    paymentReference: reference,
    status: 'pending',
  });

  const callbackUrl = `${env.clientUrl}/account/credits?verify_ref=${encodeURIComponent(reference)}`;

  const initResult = await paymentProvider.initializeTransaction({
    email: user.email,
    amountKobo: pkg.priceKobo,
    reference,
    callbackUrl,
    metadata: {
      kind: 'credit_purchase',
      userId: String(userId),
      packageId: pkg.id,
      credits: pkg.credits,
    },
  });

  return {
    authorizationUrl: initResult.authorization_url,
    reference,
    purchaseId: purchase._id,
    package: pkg,
  };
}

export async function reconcileCreditPurchase({ reference, providerTransactionId = null }) {
  const purchase = await CreditPurchase.findOne({ paymentReference: reference });
  if (!purchase) throw new AppError(404, 'Credit purchase order not found');

  if (purchase.status === 'completed') {
    const user = await User.findById(purchase.userId).select('promoCredits promoCreditsKobo');
    return {
      status: 'completed',
      alreadyCompleted: true,
      credits: purchase.credits,
      balanceCredits: user?.promoCredits || 0,
    };
  }

  const verified = await paymentProvider.verifyTransactionById(purchase.paymentReference);
  if (
    verified.status !== 'successful' ||
    (verified.tx_ref && verified.tx_ref !== purchase.paymentReference) ||
    verified.currency !== 'NGN' ||
    Math.round(Number(verified.amount) * 100) !== purchase.amountKobo
  ) {
    throw new AppError(400, 'Payment verification failed or payment is not completed.');
  }

  const completedPurchase = await CreditPurchase.findOneAndUpdate(
    { _id: purchase._id, status: 'pending' },
    {
      $set: {
        status: 'completed',
        paymentProviderTransactionId: String(providerTransactionId || verified.id || reference),
        completedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!completedPurchase) {
    const current = await User.findById(purchase.userId).select('promoCredits promoCreditsKobo');
    return {
      status: 'completed',
      alreadyCompleted: true,
      credits: purchase.credits,
      balanceCredits: current?.promoCredits || 0,
    };
  }

  const updatedUser = await User.findByIdAndUpdate(
    purchase.userId,
    {
      $inc: {
        promoCredits: purchase.credits,
        promoCreditsKobo: purchase.amountKobo,
      },
    },
    { new: true }
  );

  await PlatformCreditEntry.create({
    userId: purchase.userId,
    type: 'purchased',
    credits: purchase.credits,
    amountKobo: purchase.amountKobo,
    reason: `Purchased ${purchase.packageName} package (${purchase.credits} credits)`,
    balanceAfter: updatedUser.promoCredits,
    paymentReference: purchase.paymentReference,
  });

  // Check referral eligibility: Award credits on FIRST successful credit purchase
  const totalCompleted = await CreditPurchase.countDocuments({
    userId: purchase.userId,
    status: 'completed',
  });

  if (totalCompleted === 1 && updatedUser.referredBy) {
    const referral = await Referral.findOneAndUpdate(
      {
        referredUserId: purchase.userId,
        status: 'registered',
      },
      {
        $set: {
          status: 'rewarded',
          awardedAt: new Date(),
          firstPurchaseId: purchase._id,
        },
      },
      { new: true }
    );

    if (referral) {
      const rewardCredits = referral.rewardCredits || 25;
      const rewardKobo = rewardCredits * 10000;
      const referrer = await User.findByIdAndUpdate(
        referral.referrerId,
        {
          $inc: {
            promoCredits: rewardCredits,
            promoCreditsKobo: rewardKobo,
          },
        },
        { new: true }
      );

      await PlatformCreditEntry.create({
        userId: referral.referrerId,
        type: 'earned',
        credits: rewardCredits,
        amountKobo: rewardKobo,
        reason: `Referral reward for ${updatedUser.businessName || 'referred seller'}'s first credit purchase`,
        balanceAfter: referrer?.promoCredits,
      });
    }
  }

  return {
    status: 'completed',
    alreadyCompleted: false,
    credits: purchase.credits,
    balanceCredits: updatedUser.promoCredits,
  };
}

export async function createPromotionCampaign({
  sellerId,
  listingType,
  listingId,
  packageType = 'promote',
  durationDays = 7,
  startDate = null,
}) {
  const config = TYPE_CONFIG[listingType];
  if (!config) throw new AppError(400, 'Invalid listing type');

  const listing = await config.Model.findOne({ _id: listingId, seller: sellerId, isVerified: true });
  if (!listing) throw new AppError(404, 'Verified listing not found or not owned by you');

  const pricing = await getPromotionPricing();
  const pricingOption = pricing.find((p) => p.days === Number(durationDays));
  let creditsCost;
  if (pricingOption) {
    creditsCost = packageType === 'feature' ? pricingOption.featureCredits : pricingOption.promoteCredits;
  } else {
    creditsCost = packageType === 'feature' ? durationDays * 8 : durationDays * 5;
  }

  const costKobo = creditsCost * 10000;

  // Deduct credits atomically only after checks pass
  const user = await User.findOneAndUpdate(
    {
      _id: sellerId,
      $or: [
        { promoCredits: { $gte: creditsCost } },
        { promoCreditsKobo: { $gte: costKobo } },
      ],
    },
    {
      $inc: {
        promoCredits: -creditsCost,
        promoCreditsKobo: -costKobo,
      },
    },
    { new: true }
  );

  if (!user) throw new AppError(409, 'Insufficient promotion credits to create this campaign');

  const now = new Date();
  const start = startDate && new Date(startDate) > now ? new Date(startDate) : now;
  const end = new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const status = start > now ? 'scheduled' : 'active';

  const campaign = await PromotionCampaign.create({
    sellerId,
    listingId: listing._id,
    listingType,
    listingTitle: listing.title,
    listingCoverUrl: listing.images?.[0] || listing.coverImage || listing.thumbnailUrl || '',
    packageType,
    durationDays,
    creditsCost,
    startDate: start,
    endDate: end,
    status,
  });

  if (status === 'active') {
    if (packageType === 'feature') listing.isFeatured = true;
    if (!listing.promotionUntil || new Date(listing.promotionUntil) < end) {
      listing.promotionUntil = end;
    }
    await listing.save();
  }

  await PlatformCreditEntry.create({
    userId: sellerId,
    type: 'spent',
    credits: -creditsCost,
    amountKobo: -costKobo,
    reason: `${packageType === 'feature' ? 'Featured placement' : 'Marketplace boost'} (${durationDays} days) for "${listing.title}"`,
    balanceAfter: user.promoCredits,
    listingId: listing._id,
    listingType,
    campaignId: campaign._id,
  });

  return {
    campaign,
    balanceCredits: user.promoCredits,
  };
}

