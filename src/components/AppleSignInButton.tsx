import React from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { spacing } from '../theme';

/**
 * Apple's own "Sign in with Apple" button: the Human Interface Guidelines require it (App Review checks), and iOS
 * draws it in the phone's language. The web build replaces this file with a no-op.
 */
export const AppleSignInButton = ({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) => (
  <AppleAuthentication.AppleAuthenticationButton
    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
    cornerRadius={12}
    style={{ height: 48, width: '100%', marginTop: spacing.sm, opacity: disabled ? 0.5 : 1 }}
    onPress={() => {
      if (!disabled) onPress();
    }}
  />
);
