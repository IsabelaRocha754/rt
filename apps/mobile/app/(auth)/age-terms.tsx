import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient } from "../../src/auth/client";
import { acceptTerms } from "../../src/api/me";
import { Button } from "../../src/components/Button";
import { useTheme } from "../../src/theme/tokens";

export type SignupMethod = "apple" | "google" | "email";

// Bumped whenever the Terms/Privacy Policy text changes (DEV_PLAN Phase 1
// "terms acceptance stored with version").
export const CURRENT_TERMS_VERSION = "2026-01-01";

function Checkbox({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: checked ? theme.accent : "transparent",
        }}
      />
      <Text style={{ color: theme.text, fontSize: 15, flex: 1 }}>{label}</Text>
    </Pressable>
  );
}

export default function AgeTermsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { method } = useLocalSearchParams<{ method: SignupMethod }>();
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = ageConfirmed && termsAccepted;

  async function handleContinue() {
    if (!canContinue) return;
    setError(null);

    if (method === "email") {
      router.push({
        pathname: "/(auth)/signup-email",
        params: { termsVersion: CURRENT_TERMS_VERSION },
      });
      return;
    }

    setSubmitting(true);
    const { error: signInError } = await authClient.signIn.social({
      provider: method,
      callbackURL: "plate://onboarding",
    });
    if (signInError) {
      setSubmitting(false);
      setError(t("auth.method.providerUnavailable"));
      return;
    }

    try {
      await acceptTerms(CURRENT_TERMS_VERSION);
      router.replace("/(onboarding)/username");
    } catch {
      setSubmitting(false);
      setError(t("auth.errors.generic"));
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, padding: 24, gap: 24, justifyContent: "center" }}>
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: "700" }}>
          {t("auth.ageTerms.title")}
        </Text>
        <View style={{ gap: 16 }}>
          <Checkbox
            checked={ageConfirmed}
            label={t("auth.ageTerms.ageLabel")}
            onToggle={() => setAgeConfirmed((value) => !value)}
          />
          <Checkbox
            checked={termsAccepted}
            label={t("auth.ageTerms.termsLabel")}
            onToggle={() => setTermsAccepted((value) => !value)}
          />
        </View>
        {error ? <Text style={{ color: "#D1453B" }}>{error}</Text> : null}
        <Button
          label={t("auth.ageTerms.continue")}
          onPress={handleContinue}
          disabled={!canContinue}
          loading={submitting}
        />
      </View>
    </SafeAreaView>
  );
}
