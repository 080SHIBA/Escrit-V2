import { api } from './api.js';
import { listingMocksEnabled, listingMockHandlers } from './listingMocks.js';

export const MAX_LISTING_PHOTO_BYTES = 5 * 1024 * 1024;

export async function uploadListingPhoto(file, onProgress) {
  if (!file?.type?.startsWith('image/')) throw new Error('Choose an image file.');
  if (file.size > MAX_LISTING_PHOTO_BYTES) throw new Error('Choose an image that is 5 MB or smaller.');
  if (listingMocksEnabled) return (await listingMockHandlers.uploadPhoto(file, onProgress)).secure_url;

  const { cloudName, apiKey, timestamp, signature, folder } = await api.getListingUploadSignature();
  const body = new FormData();
  body.append('file', file);
  body.append('api_key', apiKey);
  body.append('timestamp', timestamp);
  body.append('signature', signature);
  body.append('folder', folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and retry.'));
    xhr.onload = () => {
      let result = {};
      try { result = JSON.parse(xhr.responseText); } catch { /* friendly fallback below */ }
      if (xhr.status >= 200 && xhr.status < 300 && result.secure_url) {
        resolve(result.secure_url);
      } else {
        reject(new Error('We couldn’t upload that image. Please retry.'));
      }
    };
    xhr.send(body);
  });
}
