import type { ExpoConfig } from "expo/config";

// No secrets here — only the public API base URL, Sentry DSN, and the
// codename-able app name (CLAUDE.md: "Plate" is a codename).
const APP_NAME = process.env.APP_NAME ?? "Plate";

const config: ExpoConfig = {
  name: APP_NAME,
  slug: "plate",
  scheme: "plate",
  version: "0.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  plugins: ["expo-router"],
  extra: {
    apiUrl: process.env.API_URL ?? "http://localhost:3000",
    sentryDsn: process.env.SENTRY_DSN ?? "",
    appName: APP_NAME,
  },
};

export default config;
