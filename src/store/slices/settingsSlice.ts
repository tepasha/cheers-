import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppLanguage, PushNotificationSettings } from '../../types';
import { detectLanguageFromGeo, ph } from '../../services/i18nService';
import { INITIAL_USER_LOCATION } from '../../services/geoService';
import { personalDataReset } from '../actions';

interface SettingsState {
  language: AppLanguage;
  languageHint: string;
  /** true once the user picked a language themselves; auto-detection then stops */
  languageIsManual: boolean;
  batterySaver: boolean;
  shareLocation: boolean;
  simulateRuBlock: boolean;
  push: PushNotificationSettings;
  onboardingSeen: boolean;
}

const detected = detectLanguageFromGeo(INITIAL_USER_LOCATION);

const initialState: SettingsState = {
  language: detected.lang,
  languageHint: detected.locationHint,
  languageIsManual: false,
  batterySaver: false,
  shareLocation: false,
  simulateRuBlock: false,
  push: {
    soundEnabled: true,
    bannerEnabled: true,
    // Gates OS-level (system tray) notifications
    webPushEnabled: false,
    vibrateEnabled: true,
  },
  onboardingSeen: false,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    locationSharingSet(state, action: PayloadAction<boolean>) { state.shareLocation = action.payload; },
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
    onboardingSeenSet(state, action: PayloadAction<boolean>) {
      state.onboardingSeen = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(personalDataReset, (state) => {
      state.push = { ...initialState.push };
      state.onboardingSeen = false;
      state.shareLocation = false;
    });
  },
});

export const {
  locationSharingSet,
  languageChosen,
  languageAutoDetected,
  batterySaverSet,
  ruBlockSimulationSet,
  pushSettingsUpdated,
  onboardingSeenSet,
} = settingsSlice.actions;
export default settingsSlice.reducer;
