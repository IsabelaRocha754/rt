import { router, Tabs } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../src/theme/tokens";

export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.feed") }} />
      <Tabs.Screen name="search" options={{ title: t("tabs.search") }} />
      <Tabs.Screen
        name="log-placeholder"
        options={{
          title: "",
          tabBarButton: () => (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/log-sheet")}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: theme.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: theme.background, fontSize: 20, lineHeight: 20 }}>+</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <Tabs.Screen name="activity" options={{ title: t("tabs.activity") }} />
      <Tabs.Screen name="profile" options={{ title: t("tabs.profile") }} />
    </Tabs>
  );
}
