const delay = (milliseconds = 180) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export const listingMocksEnabled = import.meta.env.DEV && import.meta.env.VITE_LISTING_MOCK !== 'false';

let draft = null;
let listings = [];

export const listingMockHandlers = {
  async getDraft() {
    await delay();
    return { draft: draft ? { ...draft } : null };
  },
  async saveDraft(payload) {
    await delay();
    draft = { ...payload, _id: draft?._id || 'mock-listing-draft', updatedAt: new Date().toISOString() };
    return { draft: { ...draft } };
  },
  async publish(payload) {
    await delay(300);
    const item = {
      ...payload,
      _id: `mock-listing-${Date.now()}`,
      listingType: payload.type,
      isActive: true,
      isVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    listings = [item, ...listings];
    draft = null;
    return { item, listingType: payload.type };
  },
  async getMyListings() {
    await delay();
    return { listings: listings.map((listing) => ({ ...listing })) };
  },
  async uploadPhoto(file, onProgress) {
    onProgress?.(25);
    const secure_url = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not preview that image. Please retry.'));
      reader.readAsDataURL(file);
    });
    await delay(100);
    onProgress?.(100);
    return { secure_url };
  },
};
