/**
 * The map pieces MapScreen needs. On iOS / Android they are react-native-maps; in the browser (Expo web, the AI Studio
 * preview) index.web.tsx supplies a list-based stand-in, because react-native-maps needs native modules and crashes
 * the whole bundle on web. Metro picks the file by platform.
 */
export { default as MapView, Circle, Marker } from 'react-native-maps';
export type { Region } from 'react-native-maps';
