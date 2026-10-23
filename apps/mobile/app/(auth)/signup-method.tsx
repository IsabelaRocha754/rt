import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../src/components/Button";
import { useTheme } from "../../src/theme/tokens";
import type { SignupMethod } from "./age-terms";

export default function SignupMethodScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  function choose(method: SignupMethod) {
    router.push({ pathname: "/(auth)/age-terms", params: { method } });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 12 }}>
        <Button label={t("auth.method.apple")} onPress={() => choose("apple")} />
        <Button label={t("auth.method.google")} onPress={() => choose("google")} />
        <Button
          label={t("auth.method.email")}
          variant="secondary"
          onPress={() => choose("email")}
        />
      </View>
    </SafeAreaView>
  );
}
