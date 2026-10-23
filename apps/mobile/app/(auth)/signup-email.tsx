import { zodResolver } from "@hookform/resolvers/zod";
import { MIN_PASSWORD_LENGTH } from "@plate/shared";
import { router, useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";
import { authClient } from "../../src/auth/client";
import { Button } from "../../src/components/Button";
import { TextField } from "../../src/components/TextField";
import { useTheme } from "../../src/theme/tokens";

const signupSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(MIN_PASSWORD_LENGTH),
});

type SignupForm = z.infer<typeof signupSchema>;

// Maps a few error codes the backend actually returns (apps/api/src/auth/
// auth.ts) to a translated message; anything else falls back to generic.
function errorMessageFor(code: string | undefined, t: (key: string) => string): string {
  switch (code) {
    case "disposable_email":
      return t("auth.errors.disposableEmail");
    case "PASSWORD_COMPROMISED":
      return t("auth.errors.passwordCompromised");
    case "rate_limited":
      return t("auth.errors.rateLimited");
    default:
      return t("auth.errors.generic");
  }
}

export default function SignupEmailScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { termsVersion } = useLocalSearchParams<{ termsVersion: string }>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupForm>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(values: SignupForm) {
    setSubmitError(null);
    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
      callbackURL: "plate://verify-email",
    });
    if (error) {
      setSubmitError(errorMessageFor(error.code, t));
      return;
    }
    router.push({
      pathname: "/(auth)/verify-email",
      params: { email: values.email, termsVersion },
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, padding: 24, gap: 16, justifyContent: "center" }}>
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: "700" }}>
          {t("auth.signupEmail.title")}
        </Text>

        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextField
              label={t("auth.signupEmail.name")}
              value={field.value}
              onChangeText={field.onChange}
              autoCapitalize="words"
              error={errors.name ? t("auth.signupEmail.name") : undefined}
            />
          )}
        />
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <TextField
              label={t("auth.signupEmail.email")}
              value={field.value}
              onChangeText={field.onChange}
              autoCapitalize="none"
              keyboardType="email-address"
              error={errors.email ? t("auth.signupEmail.email") : undefined}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <TextField
              label={t("auth.signupEmail.password")}
              value={field.value}
              onChangeText={field.onChange}
              secureTextEntry
              error={errors.password ? t("auth.signupEmail.passwordHint") : undefined}
            />
          )}
        />
        <Text style={{ color: theme.textMuted, fontSize: 13 }}>
          {t("auth.signupEmail.passwordHint")}
        </Text>

        {submitError ? <Text style={{ color: "#D1453B" }}>{submitError}</Text> : null}

        <Button
          label={t("auth.signupEmail.submit")}
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
        />
        <Button
          label={t("auth.signupEmail.haveAccount")}
          variant="secondary"
          onPress={() => router.replace("/(auth)/sign-in")}
        />
      </View>
    </SafeAreaView>
  );
}
