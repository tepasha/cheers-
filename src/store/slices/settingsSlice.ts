import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppLanguage, PushNotificationSettings } from '../../types';
import { detectLanguageFromGeo, ph } from '../../services/i18nService';
import { INITIAL_USER_LOCATION } from '../../services/geoService';

interface SettingsState {
  language: AppLanguage;
  languageHint: string;
  /** true once the user picked a language themselves; auto-detection then stops */
  languageIsManual: boolean;
  batterySaver: boolean;
  simulateRuBlock: boolean;
  push: PushNotificationSettings;
  gamificationTourSeen: boolean;
}

const detected = detectLanguageFromGeo(INITIAL_USER_LOCATION);

const initialState: SettingsState = {
  language: detected.lang,
  languageHint: detected.locationHint,
  languageIsManual: false,
  batterySaver: false,
  simulateRuBlock: false,
  push: {
    soundEnabled: true,
    bannerEnabled: true,
    // Gates OS-level (system tray) notifications
    webPushEnabled: false,
    vibrateEnabled: true,
  },
  gamificationTourSeen: false,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    languageChosen(state, action: PayloadAction<AppLanguage>) {
      state.language = action.payload;
      state.languageIsManual = true;
      state.languageHint = ph('Обрано вручну користувачем');
    },
    languageAutoDetected(state, action: PayloadAction<{ lang: AppLanguage; hint: string }>) {
      if (state.languageIsManual) return;
      state.language = action.payload.lang;
      state.languageHint = action.payload.hint;
    },
    batterySaverSet(state, action: PayloadAction<boolean>) {
      state.batterySaver = action.payload;
    },
    ruBlockSimulationSet(state, action: PayloadAction<boolean>) {
      state.simulateRuBlock = action.payload;
    },
    pushSettingsUpdated(state, action: PayloadAction<Partial<PushNotificationSettings>>) {
      state.push = { ...state.push, ...action.payload };
    },
    gamificationTourSeenSet(state, action: PayloadAction<boolean>) {
      state.gamificationTourSeen = action.payload;
    },
  },
});

export const {
  languageChosen,
  languageAutoDetected,
  batterySaverSet,
  ruBlockSimulationSet,
  pushSettingsUpdated,
  gamificationTourSeenSet,
} = settingsSlice.actions;
export default settingsSlice.reducer;
