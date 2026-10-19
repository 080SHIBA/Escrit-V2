const delay = (milliseconds = 180) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export const kycMocksEnabled = import.meta.env.DEV && import.meta.env.VITE_KYC_MOCK !== 'false';

let mockKyc = {
  legalName: '',
  dob: '',
  idType: '',
  idNumber: '',
  idFrontUrl: '',
  idBackUrl: '',
  selfieUrl: '',
  status: 'none',
  reviewReason: '',
};
let mockProfile = {
  displayName: 'Demo seller',
  businessName: 'Demo store',
  phone: '',
  city: '',
  email: 'seller@example.test',
};

export const kycMockHandlers = {
  async get() {
    await delay();
    return { kyc: { ...mockKyc } };
  },
  async getProfile() {
    await delay();
    return { seller: { ...mockProfile } };
  },
  async submit(formData, onProgress) {
    onProgress?.(12);
    await delay(240);
    onProgress?.(72);
    const front = formData.get('idFront');
    const back = formData.get('idBack');
    const selfie = formData.get('selfie');
    mockKyc = {
      legalName: String(formData.get('legalName') || ''),
      dob: String(formData.get('dob') || ''),
      idType: String(formData.get('idType') || ''),
      idNumber: String(formData.get('idNumber') || ''),
      idFrontUrl: front?.name || '',
      idBackUrl: back?.name || '',
      selfieUrl: selfie?.name || '',
      status: 'pending',
      reviewReason: '',
    };
    await delay(180);
    onProgress?.(100);
    return { kyc: { ...mockKyc } };
  },
  async approve() {
    await delay();
    mockKyc = { ...mockKyc, status: 'verified', reviewReason: '' };
    return { kyc: { ...mockKyc } };
  },
  async updateProfile(payload) {
    await delay();
    mockProfile = { ...mockProfile, ...payload };
    return { seller: { ...mockProfile } };
  },
  setProfile(profile) {
    mockProfile = { ...mockProfile, ...profile };
  },
};
