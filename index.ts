import './src/polyfills'; // 必须最先：Hermes 缺 Web Streams
import { registerRootComponent } from 'expo';
import App from './src/App';

registerRootComponent(App);
