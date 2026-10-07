import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import { persistor, store } from './src/store';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/ref';
import { EndedTableModal, PushBanner } from './src/components/shell';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { useAppLifecycle, usePendingChatOpen } from './src/hooks/useAppLifecycle';
import { useAppSelector } from './src/store/hooks';
import { analyticsService } from './src/services/analyticsService';
import { colors } from './src/theme';
import { ModalHost } from './src/components/ModalLayer';
import { DialogHost } from './src/components/DialogHost';
import { wrapWithMonitoring } from './src/services/telemetry';

SplashScreen.preventAutoHideAsync().catch(() => {});

const navTheme: Theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, border: colors.border, primary: colors.amber, text: colors.text },
};

/** Mounted under the store + persist gate so every hook sees rehydrated state */
const AppShell = () => {
  useAppLifecycle();
  const [navReady, setNavReady] = useState(false);
  usePendingChatOpen(navReady);

  // The navigator only mounts after sign-in, so a signed-out launch would otherwise wait for the safety timer
  const authReady = useAppSelector((s) => s.ui.authReady);
  const generation = useAppSelector((s) => s.ui.sessionGeneration);
  useEffect(() => {
    if (authReady) SplashScreen.hideAsync().catch(() => {});
  }, [authReady]);

  // Persistence is throttled; write everything out before the OS may kill the backgrounded app
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void persistor.flush();
    });
    return () => sub.remove();
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onReady={() => {
        setNavReady(true);
        SplashScreen.hideAsync().catch(() => {});
      }}
      onStateChange={() => {
        const route = navigationRef.getCurrentRoute();
        if (route?.name) analyticsService.trackScreenView(route.name);
      }}
    >
      <RootNavigator />
      <PushBanner />
      <EndedTableModal />
      <DialogHost key={generation} />
      <ModalHost />
    </NavigationContainer>
  );
};

function App() {
  useEffect(() => {
    // Safety net: never leave the splash screen up if navigation fails to report ready
    const timer = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 8000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.root}>
      <SafeAreaProvider>
        <Provider store={store}>
          <PersistGate
            persistor={persistor}
            loading={
              <View style={styles.loading}>
                <ActivityIndicator color={colors.amber} />
              </View>
            }
          >
            <StatusBar style="light" />
            {/* Outside the navigator: a retry mounts a fresh one, so a screen that crashed is not reopened */}
            <ErrorBoundary>
              <AppShell />
            </ErrorBoundary>
          </PersistGate>
        </Provider>
      </SafeAreaProvider>
    </View>
  );
}

export default wrapWithMonitoring(App);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
