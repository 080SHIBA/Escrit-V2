// Browser-side helpers for item photos hosted on Cloudinary.
import { api } from './api.js';

export const MAX_PHOTO_MB = 8;
export const MAX_VIDEO_MB = 25;

// Uploads straight to Cloudinary using a short-lived signature from our
// API. XMLHttpRequest is used because fetch cannot report upload progress.
// Resolves with the permanent HTTPS URL of the stored image.
export async function uploadItemPhoto(file, onProgress) {
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }
  if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
    throw new Error(`That photo is over ${MAX_PHOTO_MB} MB. Choose a smaller one.`);
  }

  const { cloudName, apiKey, timestamp, signature, folder } = await api.getUploadSignature();

  const body = new FormData();
  body.append('file', file);
  body.append('api_key', apiKey);
  body.append('timestamp', timestamp);
  body.append('signature', signature);
  body.append('folder', folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let result = {};
      try {
        result = JSON.parse(xhr.responseText);
      } catch {
        /* handled below */
      }
      if (xhr.status >= 200 && xhr.status < 300 && result.secure_url) {
        resolve(result.secure_url);
      } else {
        console.error('[upload] Cloudinary rejected the upload:', result.error?.message);
        reject(new Error('The upload failed. Please try again.'));
      }
    };
    xhr.onerror = () => reject(new Error('Network error. Check your connection and try again.'));
    xhr.send(body);
  });
}

export async function uploadItemVideo(file, onProgress) {
  if (!file?.type?.startsWith('video/')) throw new Error('Please choose a video file.');
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) throw new Error(`That video is over ${MAX_VIDEO_MB} MB. Choose a shorter clip.`);
  const { cloudName, apiKey, timestamp, signature, folder } = await api.getUploadSignature();
  const body = new FormData();
  body.append('file', file);
  body.append('api_key', apiKey);
  body.append('timestamp', timestamp);
  body.append('signature', signature);
  body.append('folder', folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let result = {};
      try { result = JSON.parse(xhr.responseText); } catch { /* handled below */ }
      if (xhr.status >= 200 && xhr.status < 300 && result.secure_url) resolve(result.secure_url);
      else reject(new Error('The video upload failed. Please try again.'));
    };
    xhr.onerror = () => reject(new Error('Network error. Check your connection and try again.'));
    xhr.send(body);
  });
}

// Serves a right-sized, modern-format copy of Cloudinary images (WebP/AVIF,
// capped width) so photos load fast on mobile data. Other URLs pass through.
export function optimizeImageUrl(url, width = 1000) {
  const marker = '/image/upload/';
  if (!url || !url.includes('res.cloudinary.com') || !url.includes(marker)) return url;
  return url.replace(marker, `${marker}f_auto,q_auto,c_limit,w_${width}/`);
}

// WHAT: upload a lesson attachment (PDF, Word, text) to Cloudinary as a "raw" file.
// WHY raw: Cloudinary's image and video endpoints reject documents; raw storage keeps them as-is for download.
export const MAX_DOCUMENT_MB = 15;
export async function uploadItemDocument(file, onProgress) {
  if (file.size > MAX_DOCUMENT_MB * 1024 * 1024) throw new Error(`That file is over ${MAX_DOCUMENT_MB} MB.`);
  const { cloudName, apiKey, timestamp, signature, folder } = await api.getUploadSignature();
  const body = new FormData();
  body.append('file', file);
  body.append('api_key', apiKey);
  body.append('timestamp', timestamp);
  body.append('signature', signature);
  body.append('folder', folder);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`);
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100)); };
    xhr.onload = () => {
      let result = {};
      try { result = JSON.parse(xhr.responseText); } catch { /* handled below */ }
      if (xhr.status >= 200 && xhr.status < 300 && result.secure_url) resolve(result.secure_url);
      else reject(new Error('The file upload failed. Please try again.'));
    };
    xhr.onerror = () => reject(new Error('Network error. Check your connection and try again.'));
    xhr.send(body);
  });
}
