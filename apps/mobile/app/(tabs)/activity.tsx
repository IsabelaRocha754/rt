import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../src/theme/tokens";

export default function ActivityScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.background,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ color: theme.text }}>{t("activity.placeholder")}</Text>
    </View>
  );
}
