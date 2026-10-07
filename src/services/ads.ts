import { Platform } from 'react-native';
import Constants from 'expo-constants';
import mobileAds, { AdsConsent, AdsConsentPrivacyOptionsRequirementStatus, TestIds } from 'react-native-google-mobile-ads';
import { captureException } from './telemetry';

/**
 * Google AdMob: a small banner above the tab bar and sparse slots inside the Hangouts lists (components/AdBanner).
 * Ads are requested non-personalised only: no ad tracking, no App Tracking Transparency prompt, which keeps the
 * store privacy declarations close to what the app does without ads. Google's consent form (UMP) appears only where
 * the law asks for it (EEA/UK); it is set up in AdMob > Privacy & messaging.
 * Development builds always use Google's test units, and so does any build without ADMOB_*_BANNER_ID / _INLINE_ID
 * (preview): AdMob suspends accounts whose own team clicks live ads.
 */
export interface AdsState {
  /** Consent is settled and the SDK is initialised: banners may be requested */
  canRequestAds: boolean;
  /** UMP requires a way to change the consent choice later (Profile shows a button) */
  privacyOptionsRequired: boolean;
}

type UnitIds = { android?: string; ios?: string };
const units = (Constants.expoConfig?.extra?.ads ?? {}) as { banner?: UnitIds; inline?: UnitIds };
const unit = (ids: UnitIds | undefined, test: string): string => {
  const id = Platform.OS === 'ios' ? ids?.ios : ids?.android;
  return !__DEV__ && id ? id : test;
};

let state: AdsState = { canRequestAds: false, privacyOptionsRequired: false };
let starting: Promise<void> | null = null;
const listeners = new Set<() => void>();

const publish = (info: { canRequestAds: boolean; privacyOptionsRequirementStatus: AdsConsentPrivacyOptionsRequirementStatus }) => {
  state = {
    canRequestAds: info.canRequestAds,
    privacyOptionsRequired: info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
  };
  listeners.forEach((listener) => listener());
};

async function start() {
  // gatherConsent fails offline or while no consent message is published; a choice saved earlier still counts then
  const info = await AdsConsent.gatherConsent().catch(() => AdsConsent.getConsentInfo());
  if (info.canRequestAds) await mobileAds().initialize();
  publish(info);
}

export const adsService = {
  /** The 320x50 strip above the tab bar */
  bannerUnitId: unit(units.banner, TestIds.BANNER),
  /** The 320x100 slots inside lists */
  inlineUnitId: unit(units.inline, TestIds.BANNER),

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getState: (): AdsState => state,

  /** Idempotent; a failed attempt (offline) is retried on the next call */
  start(): Promise<void> {
    starting ??= start().catch((error: unknown) => {
      starting = null;
      if (error instanceof Error) captureException(error);
    });
    return starting;
  },

  async showPrivacyOptions(): Promise<void> {
    publish(await AdsConsent.showPrivacyOptionsForm());
  },
};
