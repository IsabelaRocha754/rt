import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const apiUrl: string = Constants.expoConfig?.extra?.apiUrl ?? "http://localhost:3000";

// CLAUDE.md: "mobile app ... expo-secure-store (tokens)" — the Expo client
// plugin stores the session cookie/token in the device Keychain/Keystore
// via `storage`, never AsyncStorage.
export const authClient = createAuthClient({
  // Must match the API's actual mount path (apps/api/src/auth/auth.ts),
  // not the library default `/api/auth`.
  baseURL: `${apiUrl}/v1/auth`,
  plugins: [
    expoClient({
      scheme: "plate",
      storagePrefix: "plate",
      storage: SecureStore,
    }),
  ],
});
