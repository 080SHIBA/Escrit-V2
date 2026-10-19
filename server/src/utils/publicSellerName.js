export function publicSellerName(seller) {
  const legalName = seller?.fullName?.trim().toLocaleLowerCase();
  return [seller?.displayName, seller?.businessName]
    .find((name) => name?.trim() && name.trim().toLocaleLowerCase() !== legalName)
    || 'Escrit seller';
}

export function sanitizePublicSeller(seller) {
  if (!seller) return seller;
  const name = publicSellerName(seller);
  seller.displayName = name;
  seller.businessName = name;
  seller.fullName = undefined;
  return seller;
}
