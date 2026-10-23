import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../src/components/Button";
import { useTheme } from "../../src/theme/tokens";

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, justifyContent: "space-between", padding: 24 }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: theme.text, fontSize: 28, fontWeight: "700" }}>Plate</Text>
          <Text style={{ color: theme.textMuted, fontSize: 16, marginTop: 8 }}>
            {t("auth.welcome.tagline")}
          </Text>
        </View>
        <View style={{ gap: 12 }}>
          <Button
            label={t("auth.welcome.createAccount")}
            onPress={() => router.push("/(auth)/signup-method")}
          />
          <Button
            label={t("auth.welcome.signIn")}
            variant="secondary"
            onPress={() => router.push("/(auth)/sign-in")}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
