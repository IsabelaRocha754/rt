import type { ExpoConfig } from "expo/config";

// No secrets here — only the public API base URL, Sentry DSN, and the
// codename-able app name/bundle id (CLAUDE.md: "Plate" is a codename).
const APP_NAME = process.env.APP_NAME ?? "Plate";

// One constant for both platforms so renaming the product before store
// launch only means changing this value.
const BUNDLE_ID = "dev.plate.app";

// Set by `eas init` (https://expo.dev/accounts/isamrocha/projects/plate) —
// see apps/mobile/README.md § Running on a phone.
const EAS_PROJECT_ID = "e79ec9d1-7927-40dc-a952-a438eed9eae3";

const config: ExpoConfig = {
  name: APP_NAME,
  slug: "plate",
  owner: "isamrocha",
  scheme: "plate",
  version: "0.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  plugins: ["expo-router", "expo-localization"],
  ios: {
    bundleIdentifier: BUNDLE_ID,
  },
  android: {
    package: BUNDLE_ID,
  },
  extra: {
    apiUrl: process.env.API_URL ?? "http://localhost:3000",
    sentryDsn: process.env.SENTRY_DSN ?? "",
    appName: APP_NAME,
    eas: {
      // The one place this ID lives — `eas init` writes it here, nowhere
      // else reads or stores a copy. Until `eas init` runs, this is empty
      // and `eas build`/`eas update` will fail with a clear message.
      projectId: EAS_PROJECT_ID,
    },
  },
};

export default config;
