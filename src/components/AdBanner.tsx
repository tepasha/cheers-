import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { adsService } from '../services/ads';
import { colors, radius, spacing, typography } from '../theme';
import { useTr } from '../hooks/useT';

const REQUEST = { requestNonPersonalizedAdsOnly: true };

/** True once consent is settled and the SDK is ready; lists add ad slots only then */
export const useCanRequestAds = () => useSyncExternalStore(adsService.subscribe, adsService.getState).canRequestAds;

/**
 * The 320x50 strip between the screen and the tab bar. It takes no room until an ad has loaded (no empty slot when
 * there is no fill), and is unmounted, not hidden, where it is not wanted: AdMob counts a hidden banner's refreshes
 * as impressions nobody saw, which is against its policy. Mounting it starts consent and the SDK. The web build
 * replaces this file with no-ops.
 */
export const AdBanner = ({ visible }: { visible: boolean }) => {
  const canRequestAds = useCanRequestAds();

  useEffect(() => {
    void adsService.start();
  }, []);

  return visible && canRequestAds ? <BannerStrip /> : null;
};

/** Remounted on every return to a tab with a banner, so a stale border never frames an empty slot */
const BannerStrip = () => {
  const [loaded, setLoaded] = useState(false);
  return (
    <View style={[styles.strip, loaded && styles.stripLoaded]}>
      <BannerAd unitId={adsService.bannerUnitId} size={BannerAdSize.BANNER} requestOptions={REQUEST} onAdLoaded={() => setLoaded(true)} onAdFailedToLoad={() => setLoaded(false)} />
    </View>
  );
};

/** A 320x100 ad in a list, framed like the cards around it and labelled, so nobody mistakes it for a real table */
export const InlineAd = () => {
  const tr = useTr();
  const [loaded, setLoaded] = useState(false);
  return (
    <View style={loaded ? styles.card : undefined}>
      {loaded && <Text style={[typography.tiny, styles.label]}>{tr('Реклама')}</Text>}
      <BannerAd unitId={adsService.inlineUnitId} size={BannerAdSize.LARGE_BANNER} requestOptions={REQUEST} onAdLoaded={() => setLoaded(true)} onAdFailedToLoad={() => setLoaded(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  strip: { alignItems: 'center', backgroundColor: colors.bg },
  stripLoaded: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  card: { alignItems: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  label: { alignSelf: 'flex-start' },
});
