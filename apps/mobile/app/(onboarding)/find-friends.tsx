import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../src/components/Button";
import { useTheme } from "../../src/theme/tokens";

// DEV_PLAN Phase 1 F1 "Find friends (search by username). Skip allowed."
// Real search needs the social/follow endpoints (Phase 4) — until then
// this step is a placeholder landing you straight on the feed either way.
export default function FindFriendsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  function finish() {
    router.replace("/(tabs)");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, padding: 24, gap: 16, justifyContent: "center" }}>
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: "700" }}>
          {t("onboarding.findFriends.title")}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 15 }}>
          {t("onboarding.findFriends.body")}
        </Text>
        <Button label={t("onboarding.findFriends.finish")} onPress={finish} />
      </View>
    </SafeAreaView>
  );
}
