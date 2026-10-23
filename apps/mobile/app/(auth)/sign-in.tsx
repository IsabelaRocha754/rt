import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
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

const signInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

type SignInForm = z.infer<typeof signInSchema>;

export default function SignInScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SignInForm>({ resolver: zodResolver(signInSchema) });

  async function onSubmit(values: SignInForm) {
    setSubmitError(null);
    const { error } = await authClient.signIn.email(values);
    if (error) {
      if (error.code === "EMAIL_NOT_VERIFIED") {
        router.push({ pathname: "/(auth)/verify-email", params: { email: values.email } });
        return;
      }
      setSubmitError(t("auth.signIn.genericError"));
      return;
    }
    router.replace("/(onboarding)/username");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, padding: 24, gap: 16, justifyContent: "center" }}>
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: "700" }}>
          {t("auth.signIn.title")}
        </Text>

        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <TextField
              label={t("auth.signIn.email")}
              value={field.value}
              onChangeText={field.onChange}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <TextField
              label={t("auth.signIn.password")}
              value={field.value}
              onChangeText={field.onChange}
              secureTextEntry
            />
          )}
        />

        {submitError ? <Text style={{ color: "#D1453B" }}>{submitError}</Text> : null}

        <Button
          label={t("auth.signIn.submit")}
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
        />
        <Button
          label={t("auth.signIn.forgotPassword")}
          variant="secondary"
          onPress={() => router.push("/(auth)/forgot-password")}
        />
        <Button
          label={t("auth.signIn.noAccount")}
          variant="secondary"
          onPress={() => router.replace("/(auth)/signup-method")}
        />
      </View>
    </SafeAreaView>
  );
}
