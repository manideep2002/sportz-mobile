import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';

import { registerRootComponent } from 'expo';

import App from './src/bootstrap/App';
import { initializeMonitoring } from './src/lib/monitoring';

initializeMonitoring();
registerRootComponent(App);
