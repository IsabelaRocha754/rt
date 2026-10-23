import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient } from "../../src/auth/client";
import { Button } from "../../src/components/Button";
import { TextField } from "../../src/components/TextField";
import { useTheme } from "../../src/theme/tokens";

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Always shown after submit, success or not (USER_FLOWS.md F2: "always
  // shows 'If an account exists we sent an email'" — no account enumeration).
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    await authClient.requestPasswordReset({
      email,
      redirectTo: "plate://reset-password",
    });
    setSubmitting(false);
    setSent(true);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, padding: 24, gap: 16, justifyContent: "center" }}>
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: "700" }}>
          {t("auth.forgotPassword.title")}
        </Text>
        {sent ? (
          <Text style={{ color: theme.textMuted, fontSize: 15 }}>
            {t("auth.forgotPassword.sent")}
          </Text>
        ) : (
          <>
            <TextField
              label={t("auth.forgotPassword.email")}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Button
              label={t("auth.forgotPassword.submit")}
              onPress={handleSubmit}
              loading={submitting}
              disabled={!email}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
