import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ucore.app',
  appName: 'U Core',
  webDir: 'dist/public',
  server: {
    // En producción apunta al bundle local, no a Railway
    // Para desarrollo puedes descomentar la línea de abajo:
    // url: 'https://u-scout-production.up.railway.app',
    // allowNavigation: ['u-scout-production.up.railway.app']
  },
  ios: {
    contentInset: 'always',        // respeta safe area (notch)
    scrollEnabled: false,          // la app gestiona su propio scroll
    backgroundColor: '#ffffff',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,       // sin splash genérico de Capacitor
    },
  },
};

export default config;
