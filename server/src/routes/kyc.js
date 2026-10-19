import { Router } from 'express';
import Joi from 'joi';
import multer from 'multer';
import { KycSubmission } from '../models/KycSubmission.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { deletePrivateKycFile, privateKycAssetUrl, uploadPrivateKycFile } from '../services/privateKycStorage.js';

export const kycRouter = Router();
kycRouter.use(requireAuth);

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const allowedImageTypes = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'image/avif', 'image/gif', 'image/bmp', 'image/tiff',
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 3, fields: 5, parts: 8 },
  fileFilter(_req, file, callback) {
    const allowed = file.fieldname === 'idFront' || file.fieldname === 'idBack'
      ? allowedImageTypes.has(file.mimetype) || file.mimetype === 'application/pdf'
      : file.fieldname === 'selfie' && allowedImageTypes.has(file.mimetype);
    callback(allowed ? null : new AppError(400, 'Choose an image or PDF for the ID and an image for the selfie.'), allowed);
  },
});

function receiveKycFiles(req, res, next) {
  upload.fields([
    { name: 'idFront', maxCount: 1 },
    { name: 'idBack', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
  ])(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(413, 'Each document must be 5 MB or smaller.'));
    }
    if (error instanceof multer.MulterError) {
      return next(new AppError(400, 'Choose one file for each document and try again.'));
    }
    return next(error);
  });
}

function fileSignatureMatches(file) {
  const bytes = file.buffer;
  if (file.mimetype === 'application/pdf') return bytes.subarray(0, 5).toString() === '%PDF-';
  if (file.mimetype === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.mimetype === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (file.mimetype === 'image/webp') return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (file.mimetype === 'image/gif') return ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString());
  if (file.mimetype === 'image/bmp') return bytes.subarray(0, 2).toString() === 'BM';
  if (file.mimetype === 'image/tiff') return ['II*\u0000', 'MM\u0000*'].includes(bytes.subarray(0, 4).toString());
  if (file.mimetype === 'image/avif') {
    return bytes.subarray(4, 12).toString().includes('ftyp') && /avif|avis/.test(bytes.subarray(8, 16).toString());
  }
  if (file.mimetype === 'image/heic' || file.mimetype === 'image/heif') {
    return bytes.subarray(4, 12).toString().includes('ftyp');
  }
  return false;
}

const fieldsSchema = Joi.object({
  legalName: Joi.string().trim().min(3).max(120).required(),
  dob: Joi.date().iso().max('now').required(),
  idType: Joi.string().valid('nin', 'drivers-license', 'passport', 'voters-card').required(),
  idNumber: Joi.string().trim().min(1).max(40).required().when('idType', {
    is: 'nin',
    then: Joi.string().trim().pattern(/^\d{11}$/).required(),
    otherwise: Joi.string().trim().min(6).max(40).required(),
  }),
  consent: Joi.string().valid('true').required(),
});

function fileAsset(asset, prefix) {
  return {
    [`${prefix}PublicId`]: asset?.publicId || null,
    [`${prefix}ResourceType`]: asset?.resourceType || null,
    [`${prefix}Format`]: asset?.format || null,
  };
}

function assetsFromSubmission(submission) {
  return [
    { publicId: submission.idFrontPublicId, resourceType: submission.idFrontResourceType },
    { publicId: submission.idBackPublicId, resourceType: submission.idBackResourceType },
    { publicId: submission.selfiePublicId, resourceType: submission.selfieResourceType },
  ].filter((asset) => asset.publicId);
}

kycRouter.get('/', asyncHandler(async (req, res) => {
  const [seller, submission] = await Promise.all([
    User.findById(req.sellerId).select('kycStatus kycReviewNote fullName businessName'),
    KycSubmission.findOne({ userId: req.sellerId }).select('+idNumber'),
  ]);
  if (!seller) throw new AppError(404, 'Seller not found');
  if (!submission) {
    const status = ['verified', 'rejected'].includes(seller.kycStatus) ? seller.kycStatus : 'none';
    return res.json({ kyc: { status, legalName: '', dob: '', idType: '', idNumber: '', idFrontUrl: '', idBackUrl: '', selfieUrl: '', reviewReason: seller.kycReviewNote || '' } });
  }
  res.json({
    kyc: {
      legalName: submission.legalName,
      dob: submission.dob.toISOString().slice(0, 10),
      idType: submission.idType,
      idNumber: submission.idNumber,
      idFrontUrl: privateKycAssetUrl(submission.idFrontPublicId, submission.idFrontResourceType, submission.idFrontFormat),
      idBackUrl: submission.idBackPublicId
        ? privateKycAssetUrl(submission.idBackPublicId, submission.idBackResourceType, submission.idBackFormat)
        : '',
      selfieUrl: privateKycAssetUrl(submission.selfiePublicId, submission.selfieResourceType, submission.selfieFormat),
      status: submission.status,
      reviewReason: submission.reviewReason || '',
    },
  });
}));

kycRouter.post('/', uploadLimiter, receiveKycFiles, asyncHandler(async (req, res) => {
  const { error, value } = fieldsSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new AppError(400, 'Check the identity details and try again.');
  }
  const files = req.files || {};
  const front = files.idFront?.[0];
  const back = files.idBack?.[0];
  const selfie = files.selfie?.[0];
  if (!front || !selfie) throw new AppError(400, 'Upload the front of your ID and a selfie before submitting.');
  for (const file of [front, back, selfie].filter(Boolean)) {
    if (!fileSignatureMatches(file)) throw new AppError(400, 'A file does not match its selected image or PDF type.');
  }

  const seller = await User.findById(req.sellerId).select('kycStatus');
  if (!seller) throw new AppError(404, 'Seller not found');
  if (seller.kycStatus === 'verified') throw new AppError(409, 'Your identity is already verified.');

  let storedAssets = [];
  let prior;
  let submissionPersisted = false;
  try {
    const uploads = await Promise.allSettled([
      uploadPrivateKycFile(front),
      back ? uploadPrivateKycFile(back) : Promise.resolve(null),
      uploadPrivateKycFile(selfie),
    ]);
    storedAssets = uploads.filter((result) => result.status === 'fulfilled' && result.value).map((result) => result.value);
    const failedUpload = uploads.find((result) => result.status === 'rejected');
    if (failedUpload) throw failedUpload.reason;
    const [frontAsset, backAsset, selfieAsset] = uploads.map((result) => result.status === 'fulfilled' ? result.value : null);

    prior = await KycSubmission.findOne({ userId: req.sellerId }).select('+idNumber');
    const documentUrls = {
      idFrontUrl: privateKycAssetUrl(frontAsset.publicId, frontAsset.resourceType, frontAsset.format),
      idBackUrl: backAsset
        ? privateKycAssetUrl(backAsset.publicId, backAsset.resourceType, backAsset.format)
        : '',
      selfieUrl: privateKycAssetUrl(selfieAsset.publicId, selfieAsset.resourceType, selfieAsset.format),
    };
    const submission = await KycSubmission.findOneAndUpdate(
      { userId: req.sellerId },
      {
        userId: req.sellerId,
        legalName: value.legalName,
        dob: value.dob,
        idType: value.idType,
        idNumber: value.idNumber,
        ...fileAsset(frontAsset, 'idFront'),
        ...fileAsset(backAsset, 'idBack'),
        ...fileAsset(selfieAsset, 'selfie'),
        status: 'pending',
        reviewReason: '',
        reviewedAt: null,
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).select('+idNumber');
    submissionPersisted = true;
    const updatedSeller = await User.findByIdAndUpdate(req.sellerId, { kycStatus: 'pending', kycReviewNote: '' });
    if (!updatedSeller) throw new AppError(404, 'Seller not found');
    if (prior) {
      const oldAssets = assetsFromSubmission(prior);
      const cleanup = await Promise.allSettled(oldAssets.map((asset) => deletePrivateKycFile(asset)));
      if (cleanup.some((result) => result.status === 'rejected')) {
        console.error('[kyc] a replaced private document could not be removed');
      }
    }
    res.status(201).json({
      kyc: {
        legalName: submission.legalName,
        dob: submission.dob.toISOString().slice(0, 10),
        idType: submission.idType,
        idNumber: submission.idNumber,
        ...documentUrls,
        status: submission.status,
        reviewReason: '',
      },
    });
  } catch (cause) {
    let safeToDeleteAssets = true;
    if (submissionPersisted) {
      try {
        if (prior) {
          const rollback = await KycSubmission.replaceOne(
            { userId: req.sellerId },
            prior.toObject(),
            { timestamps: false }
          );
          if (!rollback.matchedCount) throw new Error('KYC submission rollback did not match');
        } else {
          const rollback = await KycSubmission.deleteOne({ userId: req.sellerId });
          if (!rollback.deletedCount) throw new Error('KYC submission rollback did not match');
        }
      } catch {
        safeToDeleteAssets = false;
        console.error('[kyc] a failed submission could not be rolled back');
      }
    }
    if (safeToDeleteAssets) {
      const cleanup = await Promise.allSettled(storedAssets.map((asset) => deletePrivateKycFile(asset)));
      if (cleanup.some((result) => result.status === 'rejected')) {
        console.error('[kyc] an incomplete private upload could not be removed');
      }
    }
    if (cause instanceof AppError) throw cause;
    throw new AppError(502, 'Your documents could not be submitted securely. Please retry.');
  }
}));

export { assetsFromSubmission };
