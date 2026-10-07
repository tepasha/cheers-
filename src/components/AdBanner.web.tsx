/** AdMob is native only: the browser preview shows no banners and its lists get no ad slots */
export const useCanRequestAds = () => false;
export const AdBanner = (_props: { visible: boolean }) => null;
export const InlineAd = () => null;
