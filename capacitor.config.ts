import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ucore.app',
  appName: 'U Core',
  webDir: 'dist/public',
  server: {
    url: 'https://u-scout-production.up.railway.app',
    allowNavigation: ['u-scout-production.up.railway.app'],
    cleartext: false,
  },
  ios: {
    contentInset: 'always',        // respeta safe area (notch)
    scrollEnabled: true,
    backgroundColor: '#ffffff',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,       // sin splash genérico de Capacitor
    },
  },
};

export default config;
