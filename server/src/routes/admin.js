// Internal admin routes for manual dispute resolution. Restricted to
// the ADMIN_EMAILS allowlist.
import { Router } from 'express';
import Joi from 'joi';
import { Transaction, TX_STATUS } from '../models/Transaction.js';
import { Link } from '../models/Link.js';
import { User } from '../models/User.js';
import { requireAuth, requireAdmin, requireOwner } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { resolveDispute } from '../services/escrow.js';
import { Product } from '../models/Product.js';
import { Course } from '../models/Course.js';
import { Service } from '../models/Service.js';
import { Review } from '../models/Review.js';
import { ProductCategory, CourseCategory, ServiceCategory } from '../models/ListingCategory.js';
import { getPlatformSettings } from '../services/platformSettings.js';
import { getConfiguredModes } from '../services/paymentMode.js';
import { env } from '../config/env.js';
import { KycSubmission } from '../models/KycSubmission.js';
import { privateKycAssetUrl } from '../services/privateKycStorage.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

// Open disputes, oldest first, with the link and seller for context.
adminRouter.get('/disputes', asyncHandler(async (_req, res) => {
  const transactions = await Transaction.find({ status: TX_STATUS.DISPUTED }).sort({ disputeRaisedAt: 1 });

  const linkIds = [...new Set(transactions.map((t) => String(t.linkId)))];
  const links = await Link.find({ _id: { $in: linkIds } });
  const linkById = Object.fromEntries(links.map((l) => [String(l._id), l]));

  const sellerIds = [...new Set(links.map((l) => String(l.sellerId)))];
  const sellers = await User.find({ _id: { $in: sellerIds } }).select('email businessName');
  const sellerById = Object.fromEntries(sellers.map((s) => [String(s._id), s]));

  res.json({
    disputes: transactions.map((tx) => {
      const link = linkById[String(tx.linkId)] || null;
      return {
        transaction: tx,
        link,
        seller: link ? sellerById[String(link.sellerId)] || null : null,
      };
    }),
  });
}));

adminRouter.get('/complaints', asyncHandler(async (_req, res) => {
  const transactions = await Transaction.find({ complaintLogged: true }).sort({ disputeRaisedAt: -1 });
  const links = await Link.find({ _id: { $in: transactions.map((transaction) => transaction.linkId) } });
  const linkById = new Map(links.map((link) => [String(link._id), link]));
  res.json({ complaints: transactions.map((transaction) => ({ transaction, link: linkById.get(String(transaction.linkId)) || null })) });
}));

const resolveSchema = Joi.object({
  outcome: Joi.string().valid('release', 'refund').required(),
  // Required: both parties see this note on their order.
  note: Joi.string().trim().min(10).max(500).required(),
});

adminRouter.post('/disputes/:id/resolve', validate(resolveSchema), asyncHandler(async (req, res) => {
  const tx = await Transaction.findById(req.params.id);
  if (!tx) throw new AppError(404, 'Transaction not found');

  const updated = await resolveDispute(tx, req.body.outcome, req.body.note);
  res.json({ transaction: updated });
}));

adminRouter.get('/kyc', asyncHandler(async (_req, res) => {
  const submissions = await KycSubmission.find({ status: 'pending' })
    .select('+idNumber +idFrontPublicId +idFrontResourceType +idFrontFormat +idBackPublicId +idBackResourceType +idBackFormat +selfiePublicId +selfieResourceType +selfieFormat')
    .populate('userId', 'email businessName')
    .sort({ createdAt: 1 });
  const submissionUserIds = submissions.map((submission) => submission.userId?._id).filter(Boolean);
  const legacyUsers = await User.find({
    kycStatus: 'pending',
    isDemoSeed: { $ne: true },
    _id: { $nin: submissionUserIds },
  })
    .select('email businessName fullName nin idDocumentUrl kycStatus createdAt')
    .sort({ createdAt: 1 })
    .lean();
  res.json({
    users: [
      ...submissions.filter((submission) => submission.userId).map((submission) => ({
        _id: String(submission.userId._id),
        email: submission.userId.email,
        businessName: submission.userId.businessName,
        fullName: submission.legalName,
        dob: submission.dob,
        idType: submission.idType,
        idNumber: submission.idNumber,
        idFrontUrl: privateKycAssetUrl(submission.idFrontPublicId, submission.idFrontResourceType, submission.idFrontFormat),
        idBackUrl: submission.idBackPublicId
          ? privateKycAssetUrl(submission.idBackPublicId, submission.idBackResourceType, submission.idBackFormat)
          : '',
        selfieUrl: privateKycAssetUrl(submission.selfiePublicId, submission.selfieResourceType, submission.selfieFormat),
        createdAt: submission.createdAt,
      })),
      ...legacyUsers,
    ],
  });
}));

const kycReviewSchema = Joi.object({
  status: Joi.string().valid('verified', 'rejected').required(),
  note: Joi.string().trim().max(500).allow('').default(''),
});

adminRouter.post('/kyc/:userId/review', validate(kycReviewSchema), asyncHandler(async (req, res) => {
  const submission = await KycSubmission.findOne({ userId: req.params.userId });
  if (submission) {
    submission.status = req.body.status;
    submission.reviewReason = req.body.status === 'rejected' ? req.body.note : '';
    submission.reviewedAt = new Date();
    await submission.save();
  }
  const user = await User.findByIdAndUpdate(req.params.userId, {
    kycStatus: req.body.status,
    kycReviewNote: req.body.note,
    kycReviewedAt: new Date(),
  }, { new: true });
  if (!user) throw new AppError(404, 'Account not found');
  res.json({ user });
}));

const listingModels = { product: Product, course: Course, service: Service };
adminRouter.get('/listings', asyncHandler(async (_req, res) => {
  const groups = await Promise.all(Object.entries(listingModels).map(async ([listingType, Model]) => {
    const items = await Model.find({ isActive: true, isVerified: false })
      .populate('seller', 'businessName email')
      .sort({ createdAt: 1 });
    return items.map((item) => ({ ...item.toObject(), listingType }));
  }));
  res.json({ listings: groups.flat() });
}));

const categoryModels = { product: ProductCategory, course: CourseCategory, service: ServiceCategory };
adminRouter.get('/categories', asyncHandler(async (_req, res) => {
  const requests = await Promise.all(Object.entries(categoryModels).map(async ([listingType, Model]) => {
    const categories = await Model.find({ approvalStatus: 'pending' }).populate('requestedBy', 'businessName email').sort({ createdAt: 1 });
    return categories.map((category) => ({ ...category.toObject(), listingType }));
  }));
  res.json({ requests: requests.flat() });
}));

const categoryDecisionSchema = Joi.object({
  decision: Joi.string().valid('approve', 'assign', 'reject').required(),
  assignedCategoryId: Joi.string().hex().length(24).when('decision', { is: 'assign', then: Joi.required(), otherwise: Joi.optional() }),
});

adminRouter.post('/categories/:type/:id/review', validate(categoryDecisionSchema), asyncHandler(async (req, res) => {
  const Category = categoryModels[req.params.type];
  const Listing = listingModels[req.params.type];
  if (!Category || !Listing) throw new AppError(400, 'Unsupported listing type');
  const requested = await Category.findById(req.params.id);
  if (!requested || requested.approvalStatus !== 'pending') throw new AppError(404, 'Pending category request not found');

  if (req.body.decision === 'approve') {
    requested.approvalStatus = 'approved';
    await Listing.updateMany({ category: requested.name }, { $set: { categoryReviewStatus: 'approved' } });
  } else if (req.body.decision === 'assign') {
    const assigned = await Category.findOne({ _id: req.body.assignedCategoryId, approvalStatus: 'approved' });
    if (!assigned) throw new AppError(404, 'Approved destination category not found');
    await Listing.updateMany({ category: requested.name }, { $set: { category: assigned.name, categoryReviewStatus: 'approved' } });
    requested.approvalStatus = 'assigned';
  } else {
    await Listing.updateMany({ category: requested.name }, { $set: { category: 'General', categoryReviewStatus: 'approved' } });
    requested.approvalStatus = 'rejected';
  }
  await requested.save();
  res.json({ category: requested });
}));

adminRouter.get('/categories/:type/approved', asyncHandler(async (req, res) => {
  const Category = categoryModels[req.params.type];
  if (!Category) throw new AppError(400, 'Unsupported listing type');
  const categories = await Category.find({ approvalStatus: 'approved' }).sort({ name: 1 }).select('name slug');
  res.json({ categories });
}));

const listingReviewSchema = Joi.object({
  approved: Joi.boolean().required(),
  note: Joi.string().trim().max(500).allow('').default(''),
});

adminRouter.post('/listings/:type/:id/review', validate(listingReviewSchema), asyncHandler(async (req, res) => {
  const Model = listingModels[req.params.type];
  if (!Model) throw new AppError(400, 'Unsupported listing type');
  const listing = await Model.findByIdAndUpdate(req.params.id, {
    isVerified: req.body.approved,
    isActive: req.body.approved,
    verificationNote: req.body.note,
    verifiedAt: req.body.approved ? new Date() : null,
  }, { new: true });
  if (!listing) throw new AppError(404, 'Listing not found');
  if (req.body.approved && listing.categoryReviewStatus === 'pending') {
    listing.isVerified = false;
    await listing.save();
    throw new AppError(409, 'Resolve the pending category request before approving this listing');
  }
  res.json({ listing });
}));

const roleSchema = Joi.object({ role: Joi.string().valid('user', 'admin').required() });
adminRouter.patch('/users/:userId/role', requireOwner, validate(roleSchema), asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) throw new AppError(404, 'Account not found');
  if (user.role === 'owner') throw new AppError(409, 'Owner accounts cannot be changed from this screen');
  user.role = req.body.role;
  await user.save();
  res.json({ user });
}));

adminRouter.get('/users', requireOwner, asyncHandler(async (_req, res) => {
  const users = await User.find({ role: { $ne: 'owner' } })
    .select('email businessName role createdAt')
    .sort({ createdAt: -1 })
    .limit(100);
  res.json({ users });
}));

adminRouter.get('/settings', asyncHandler(async (_req, res) => {
  const settings = await getPlatformSettings();
  res.json({ settings, configuredModes: getConfiguredModes() });
}));

const settingsSchema = Joi.object({
  commissionPercent: Joi.number().min(0).max(25).required(),
  paymentProvider: Joi.string().valid('paystack', 'flutterwave').required(),
  // Optional so admins can still tune commission/provider; changing it is owner-only (checked in the handler).
  paymentMode: Joi.string().valid('live', 'test'),
});
adminRouter.patch('/settings', validate(settingsSchema), asyncHandler(async (req, res) => {
  const settings = await getPlatformSettings();
  const modeChanging = req.body.paymentMode && req.body.paymentMode !== settings.paymentMode;
  if (modeChanging) {
    const user = await User.findById(req.sellerId);
    const isOwner = user && (user.role === 'owner' || env.ownerEmails.includes(user.email.toLowerCase()));
    if (!isOwner) throw new AppError(403, 'Only the platform owner can switch between live and test payments');
    if (req.body.paymentMode === 'live') {
      const modes = getConfiguredModes()[req.body.paymentProvider];
      if (!modes.live) throw new AppError(409, 'Live keys for this provider are not set in the server environment');
    }
  }
  settings.commissionPercent = req.body.commissionPercent;
  settings.paymentProvider = req.body.paymentProvider;
  if (modeChanging) settings.paymentMode = req.body.paymentMode;
  settings.updatedBy = req.sellerId;
  await settings.save();
  res.json({ settings, configuredModes: getConfiguredModes() });
}));

// Demo cleanup is deliberately owner-only and keyed by the seed marker so a
// real seller or listing cannot be removed by this convenience action.
adminRouter.delete('/demo-data', requireOwner, asyncHandler(async (_req, res) => {
  const demoSellers = await User.find({ isDemoSeed: true }).select('_id');
  const sellerIds = demoSellers.map((seller) => seller._id);
  const [products, courses, services, links] = await Promise.all([
    Product.find({ seller: { $in: sellerIds } }).select('_id'),
    Course.find({ seller: { $in: sellerIds } }).select('_id'),
    Service.find({ seller: { $in: sellerIds } }).select('_id'),
    Link.find({ sellerId: { $in: sellerIds } }).select('_id'),
  ]);
  const listingIds = [...products, ...courses, ...services].map((listing) => listing._id);
  const linkIds = links.map((link) => link._id);

  const [transactions, reviews] = await Promise.all([
    Transaction.deleteMany({ linkId: { $in: linkIds } }),
    Review.deleteMany({ $or: [{ sellerId: { $in: sellerIds } }, { listingId: { $in: listingIds } }] }),
  ]);
  await User.updateMany({}, {
    $pull: {
      cartItems: { listingId: { $in: listingIds } },
      favoriteListings: { listingId: { $in: listingIds } },
    },
  });
  const [deletedLinks, deletedProducts, deletedCourses, deletedServices, deletedSellers] = await Promise.all([
    Link.deleteMany({ _id: { $in: linkIds } }),
    Product.deleteMany({ _id: { $in: products.map((listing) => listing._id) } }),
    Course.deleteMany({ _id: { $in: courses.map((listing) => listing._id) } }),
    Service.deleteMany({ _id: { $in: services.map((listing) => listing._id) } }),
    User.deleteMany({ _id: { $in: sellerIds } }),
  ]);

  res.json({
    removed: {
      sellers: deletedSellers.deletedCount,
      products: deletedProducts.deletedCount,
      courses: deletedCourses.deletedCount,
      services: deletedServices.deletedCount,
      links: deletedLinks.deletedCount,
      transactions: transactions.deletedCount,
      reviews: reviews.deletedCount,
    },
  });
}));
