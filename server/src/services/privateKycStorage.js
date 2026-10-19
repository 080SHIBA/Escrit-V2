import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

function configure() {
  const { cloudName, apiKey, apiSecret } = env.cloudinary;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError(503, 'Private identity uploads are unavailable right now. Please try again later.');
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
}

export function uploadPrivateKycFile(file) {
  configure();
  const resourceType = file.mimetype === 'application/pdf' ? 'raw' : 'image';
  const publicId = `escrit/kyc/${randomUUID()}`;
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      public_id: publicId,
      resource_type: resourceType,
      type: 'authenticated',
      overwrite: false,
      use_filename: false,
      unique_filename: false,
      format: file.mimetype === 'application/pdf' ? 'pdf' : undefined,
    }, (error, result) => {
      if (error || !result) {
        reject(new AppError(502, 'A document could not be stored securely. Please retry your submission.'));
        return;
      }
      resolve({ publicId: result.public_id, resourceType, format: result.format });
    });
    stream.end(file.buffer);
  });
}

export async function deletePrivateKycFile(asset) {
  if (!asset?.publicId || !asset?.resourceType) return;
  configure();
  await cloudinary.uploader.destroy(asset.publicId, {
    resource_type: asset.resourceType,
    type: 'authenticated',
    invalidate: true,
  });
}

export function privateKycAssetUrl(publicId, resourceType, format) {
  configure();
  return cloudinary.utils.private_download_url(publicId, format, {
    resource_type: resourceType,
    type: 'authenticated',
    secure: true,
    expires_at: Math.floor(Date.now() / 1000) + 300,
  });
}
