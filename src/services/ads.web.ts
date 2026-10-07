import type { AdsState } from './ads';

/** The browser preview shows no ads: AdMob is a native SDK */
const state: AdsState = { canRequestAds: false, privacyOptionsRequired: false };

export const adsService = {
  bannerUnitId: '',
  inlineUnitId: '',
  subscribe: (_listener: () => void) => () => {},
  getState: (): AdsState => state,
  start: async (): Promise<void> => {},
  showPrivacyOptions: async (): Promise<void> => {},
};
