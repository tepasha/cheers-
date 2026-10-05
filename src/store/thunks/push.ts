import type { AppThunk } from '../hooks';
import { pushSettingsUpdated } from '../slices/settingsSlice';
import { chatOpenRequested } from '../slices/uiSlice';
import { firestoreSyncService } from '../../services/firestoreSyncService';
import { registerForPush, type PushRegistration } from '../../services/systemNotifications';
import { selectCanUseApp } from '../selectors';

/** Signing out must not hang on a flaky network; a device that could not be removed is cleaned up server-side later */
const RELEASE_TIMEOUT_MS = 3000;

/**
 * Registers this phone to receive chat pushes for the signed-in account. Safe to call repeatedly: the device
 * document is keyed by the token, so it only refreshes the language and the timestamp.
 * With `ask` the system permission dialog may appear.
 */
export const registerPush =
  (options: { ask: boolean }): AppThunk<Promise<PushRegistration['status']>> =>
  async (dispatch, getState) => {
    const { user } = getState().auth;
    if (!selectCanUseApp(getState())) return 'unavailable';

    const registration = await registerForPush(options.ask);
    if (registration.status !== 'registered') {
      // Permission was withdrawn in the system settings: reflect that in the app's own switch
      if (registration.status === 'denied') dispatch(pushSettingsUpdated({ webPushEnabled: false }));
      return registration.status;
    }

    // Someone else may have signed in while the permission dialog was open
    if (getState().auth.user.id !== user.id) return 'unavailable';

    try {
      await firestoreSyncService.saveDevice(user.id, registration.token, registration.platform, getState().settings.language);
    } catch (err) {
      console.warn('Saving the push device failed:', err);
      return 'unavailable';
    }
    dispatch(pushSettingsUpdated({ webPushEnabled: true, deviceToken: registration.token }));
    return 'registered';
  };

/**
 * Stops pushes for the current account on this phone: removes the device from Firestore while the user is
 * still signed in. The switch itself (`webPushEnabled`) is left alone so signing back in restores pushes.
 */
export const releaseDevice =
  (): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const token = getState().settings.push.deviceToken;
    if (!token) return;
    dispatch(pushSettingsUpdated({ deviceToken: undefined }));
    try {
      await Promise.race([
        firestoreSyncService.removeDevice(token),
        new Promise<void>((resolve) => setTimeout(resolve, RELEASE_TIMEOUT_MS)),
      ]);
    } catch (err) {
      console.warn('Removing the push device failed:', err);
    }
  };

/** The user turned notifications off in the app */
export const disablePush = (): AppThunk<Promise<void>> => async (dispatch) => {
  dispatch(pushSettingsUpdated({ webPushEnabled: false }));
  await dispatch(releaseDevice());
};

/** A tapped notification asks for a chat; the navigator opens it as soon as it can */
export const openChatFromPush =
  (chatId: string): AppThunk =>
  (dispatch) => {
    dispatch(chatOpenRequested(chatId));
  };
