import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient } from "../../src/auth/client";
import { acceptTerms } from "../../src/api/me";
import { Button } from "../../src/components/Button";
import { useTheme } from "../../src/theme/tokens";

const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { email, termsVersion } = useLocalSearchParams<{ email: string; termsVersion: string }>();
  const { data: session } = authClient.useSession();
  const [checking, setChecking] = useState(false);
  const [notYetVerified, setNotYetVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const advancing = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    // Verifying signs the user in automatically (autoSignInAfterVerification,
    // apps/api/src/auth/auth.ts) — whether that happened via the deep link
    // or the manual "continue" check below, this reacts to it either way.
    if (!session || advancing.current) return;
    advancing.current = true;
    void acceptTerms(termsVersion)
      .then(() => router.replace("/(onboarding)/username"))
      .catch(() => {
        advancing.current = false;
      });
  }, [session, termsVersion]);

  async function handleContinue() {
    setChecking(true);
    setNotYetVerified(false);
    const { data } = await authClient.getSession();
    setChecking(false);
    // `useSession()` above updates reactively off the back of this same
    // call, which is what the effect acts on — this is just the "nothing
    // to react to yet" message.
    if (!data) setNotYetVerified(true);
  }

  async function handleResend() {
    if (cooldown > 0) return;
    await authClient.sendVerificationEmail({ email, callbackURL: "plate://verify-email" });
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, padding: 24, gap: 16, justifyContent: "center" }}>
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: "700" }}>
          {t("auth.verifyEmail.title")}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 15 }}>
          {t("auth.verifyEmail.body", { email })}
        </Text>
        {notYetVerified ? (
          <Text style={{ color: "#D1453B" }}>{t("auth.verifyEmail.notYetVerified")}</Text>
        ) : null}
        <Button
          label={t("auth.verifyEmail.continue")}
          onPress={handleContinue}
          loading={checking}
        />
        <Button
          label={
            cooldown > 0
              ? t("auth.verifyEmail.resendCooldown", { seconds: cooldown })
              : t("auth.verifyEmail.resend")
          }
          variant="secondary"
          onPress={handleResend}
          disabled={cooldown > 0}
        />
      </View>
    </SafeAreaView>
  );
}
