import type { ConfigContext, ExpoConfig } from 'expo/config';

const PRIMARY = '#9854B3';
const ACCENT = '#FFEC4E';
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const SENTRY_ORG = process.env.EXPO_PUBLIC_SENTRY_ORG || process.env.SENTRY_ORG;
const SENTRY_PROJECT = process.env.EXPO_PUBLIC_SENTRY_PROJECT || process.env.SENTRY_PROJECT;
const SENTRY_UPLOAD_CONFIGURED = Boolean(
  SENTRY_ORG && SENTRY_PROJECT && process.env.SENTRY_AUTH_TOKEN,
);

const sentryPlugin: [string, { organization: string; project: string }] | null =
  SENTRY_UPLOAD_CONFIGURED && SENTRY_ORG && SENTRY_PROJECT
    ? [
        '@sentry/react-native',
        {
          organization: SENTRY_ORG,
          project: SENTRY_PROJECT,
        },
      ]
    : null;

if (!SENTRY_UPLOAD_CONFIGURED) {
  console.warn(
    'Sentry source map upload is disabled for this build. Configure SENTRY_ORG, SENTRY_PROJECT, and SENTRY_AUTH_TOKEN in EAS to enable it.',
  );
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Control Electoral ADN',
  slug: 'control-electoral-adn',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'controlectoraladn',
  userInterfaceStyle: 'light',
  backgroundColor: '#FFFFFF',
  primaryColor: PRIMARY,
  platforms: ['android', 'ios', 'web'],
  ios: {
    ...config.ios,
    icon: './assets/expo.icon',
    supportsTablet: true,
  },
  android: {
    ...config.android,
    package: 'ec.com.adn.controlectoral',
    versionCode: 1,
    config: {
      ...config.android?.config,
      googleMaps: GOOGLE_MAPS_API_KEY ? { apiKey: GOOGLE_MAPS_API_KEY } : undefined,
    },
    adaptiveIcon: {
      backgroundColor: PRIMARY,
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    permissions: [
      'android.permission.CAMERA',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
    ],
    allowBackup: false,
    predictiveBackGestureEnabled: false,
  },
  web: {
    ...config.web,
    output: 'single',
    favicon: './assets/images/favicon.png',
    themeColor: PRIMARY,
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    ...(sentryPlugin ? [sentryPlugin] : []),
    'expo-maps',
    [
      'expo-camera',
      {
        cameraPermission: 'Permita el acceso a la cámara para fotografiar actas de escrutinio.',
        microphonePermission: 'Permita el acceso al micrófono para grabar videos.',
        recordAudioAndroid: false,
        barcodeScannerEnabled: false,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Permita el acceso a la ubicación para registrar el lugar donde se captura el acta.',
        locationAlwaysAndWhenInUsePermission:
          'Permita el acceso a la ubicación para registrar el lugar donde se captura el acta.',
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: PRIMARY,
        image: './assets/images/splash-icon.png',
        imageWidth: 96,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
    tsconfigPaths: true,
  },
  extra: {
    eas: {
      projectId: '14a2b130-3161-4773-8309-60722e5a2bfe',
    },
    province: 'Pichincha',
    canton: 'Quito',
    politicalOrganization: 'ADN',
    primaryColor: PRIMARY,
    accentColor: ACCENT,
  },
});
