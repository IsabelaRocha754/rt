import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { authClient } from "../../src/auth/client";
import { Button } from "../../src/components/Button";
import { useTheme } from "../../src/theme/tokens";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  async function signOutThisDevice() {
    await authClient.signOut();
  }

  async function signOutAllDevices() {
    // Revokes every session server-side, including this one, then clears
    // the local SecureStore token so this device doesn't keep presenting
    // an already-revoked one.
    await authClient.revokeSessions();
    await authClient.signOut();
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.background,
        justifyContent: "center",
        alignItems: "center",
        gap: 16,
        padding: 24,
      }}
    >
      <Text style={{ color: theme.text }}>{t("profile.placeholder")}</Text>
      <Button label={t("profile.signOut")} variant="secondary" onPress={signOutThisDevice} />
      <Button
        label={t("profile.signOutAllDevices")}
        variant="secondary"
        onPress={signOutAllDevices}
      />
    </View>
  );
}
