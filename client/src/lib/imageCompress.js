// WHAT: shrink a photo before we hold it in memory or upload it.
// WHY: a modern phone photo is 4-12 MB and 4000+ pixels wide. Decoding several of those at
// once is what runs low-memory phones out of RAM and makes the browser reload the page. An ID
// is perfectly readable at 1600px, so we scale down once, right after picking, and keep only the
// small copy. PDFs and non-images are passed through untouched.
const MAX_SIDE = 1600;

export async function compressImage(file, { maxSide = MAX_SIDE, quality = 0.85 } = {}) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    // WHY createImageBitmap with image orientation: phone photos carry a rotation tag; applying
    // it here means the ID is never saved sideways.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    // WHY the size check: if "compressing" somehow made it bigger (tiny PNG), keep the original.
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    // HEIC and a few other formats cannot be decoded by every browser. The server accepts them,
    // so send the original rather than blocking the person.
    return file;
  }
}
