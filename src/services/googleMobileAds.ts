import { isRunningInExpoGo } from 'expo';

/**
 * react-native-google-mobile-ads, or null in Expo Go. Expo Go has no AdMob native module, and the library looks its
 * modules up the moment it is imported, so a static import would crash the whole app there. Without it the app simply
 * shows no ads (services/ads, components/AdBanner).
 */
export const googleMobileAds: typeof import('react-native-google-mobile-ads') | null = isRunningInExpoGo()
  ? null
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react-native-google-mobile-ads');
