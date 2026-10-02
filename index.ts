// Must be the first import: React Navigation's stack/gestures rely on it being initialised before anything renders
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);
