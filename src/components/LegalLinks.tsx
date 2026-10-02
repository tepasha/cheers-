import React from 'react';
import { Linking, View } from 'react-native';
import { Button } from './ui';
import { spacing } from '../theme';
import { legalLinks } from '../services/legal';
import { useTr } from '../hooks/useT';

/** Terms of use and privacy policy links (required by both stores); renders nothing until the URLs are configured */
export const LegalLinks = () => {
  const tr = useTr();
  const items = [
    { url: legalLinks.terms, label: tr('Умови користування'), icon: 'file-text' as const },
    { url: legalLinks.privacyPolicy, label: tr('Політика конфіденційності'), icon: 'lock' as const },
  ].filter((i): i is { url: string; label: string; icon: 'file-text' | 'lock' } => !!i.url);

  if (items.length === 0) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      {items.map((i) => (
        <Button key={i.url} label={i.label} icon={i.icon} variant="secondary" small onPress={() => Linking.openURL(i.url)} />
      ))}
    </View>
  );
};
