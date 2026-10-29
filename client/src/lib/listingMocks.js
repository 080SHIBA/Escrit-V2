const delay = (milliseconds = 180) => new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));

export const listingMocksEnabled = Boolean(import.meta.env?.DEV && import.meta.env.VITE_LISTING_MOCK !== 'false');

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
      ...(payload.type === 'service' ? payload.serviceData || {} : {}),
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
  async setActive(type, id, active) {
    await delay();
    const current = listings.find((listing) => String(listing._id) === String(id) && listing.listingType === type);
    if (!current) throw new Error('Listing not found.');
    current.isActive = Boolean(active);
    if (type === 'service' && active) current.archivedAt = null;
    return { item: { ...current } };
  },
  async updateService(id, serviceData) {
    await delay();
    const current = listings.find((listing) => String(listing._id) === String(id) && listing.listingType === 'service');
    if (!current) throw new Error('Service listing not found.');
    Object.assign(current, serviceData, {
      basePrice: serviceData.serviceModel === 'fixed_scope'
        ? Math.min(...(serviceData.packages || []).map((servicePackage) => Number(servicePackage.priceNaira)))
        : Number(serviceData.basePrice || 0),
      startingPrice: serviceData.serviceModel === 'custom_quote' ? Number(serviceData.startingPrice || 0) : 0,
      updatedAt: new Date().toISOString(),
    });
    return { item: { ...current } };
  },
  async archiveService(id, archived) {
    await delay();
    const current = listings.find((listing) => String(listing._id) === String(id) && listing.listingType === 'service');
    if (!current) throw new Error('Service listing not found.');
    current.archivedAt = archived ? new Date().toISOString() : null;
    current.isActive = !archived;
    return { item: { ...current } };
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
