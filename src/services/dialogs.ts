import { Alert, Platform, type AlertButton, type AlertOptions } from 'react-native';

export interface DialogRequest { title: string; message?: string; buttons: AlertButton[]; options?: AlertOptions }
let present: ((request: DialogRequest) => void) | null = null;
export function bindDialogs(handler: (request: DialogRequest) => void) { present = handler; return () => { if (present === handler) present = null; }; }

export const dialogs = {
  alert(title: string, message?: string, buttons: AlertButton[] = [{ text: 'OK' }], options?: AlertOptions) {
    if (Platform.OS !== 'web') { Alert.alert(title, message, buttons, options); return; }
    if (present) present({ title, message, buttons, options });
  },
};
