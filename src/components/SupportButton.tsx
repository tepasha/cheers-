import React from 'react';
import { Linking, type StyleProp, type ViewStyle } from 'react-native';
import { Button } from './ui';
import { spacing } from '../theme';
import { supportContactUri } from '../services/support';
import { useTr } from '../hooks/useT';

/** Contact support from the sign-in flow, before the profile screen is reachable; renders nothing until a contact is configured */
export const SupportButton = ({ style }: { style?: StyleProp<ViewStyle> }) => {
  const tr = useTr();
  if (!supportContactUri) return null;
  const uri = supportContactUri;
  return <Button label={tr('Технічна підтримка')} icon="help-circle" variant="ghost" small onPress={() => Linking.openURL(uri)} style={[{ marginTop: spacing.sm }, style]} />;
};
