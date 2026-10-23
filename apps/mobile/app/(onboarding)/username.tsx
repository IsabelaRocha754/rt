import { zodResolver } from "@hookform/resolvers/zod";
import { DISPLAY_NAME_MAX_LENGTH, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@plate/shared";
import { router } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";
import { patchMe } from "../../src/api/me";
import { useInvalidateMe } from "../../src/api/useMe";
import { Button } from "../../src/components/Button";
import { TextField } from "../../src/components/TextField";
import { useTheme } from "../../src/theme/tokens";

const usernameFormSchema = z.object({
  username: z.string().trim().min(USERNAME_MIN_LENGTH).max(USERNAME_MAX_LENGTH),
  displayName: z.string().trim().min(1).max(DISPLAY_NAME_MAX_LENGTH),
});

type UsernameForm = z.infer<typeof usernameFormSchema>;

export default function UsernameScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const invalidateMe = useInvalidateMe();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<UsernameForm>({ resolver: zodResolver(usernameFormSchema) });

  async function onSubmit(values: UsernameForm) {
    setSubmitError(null);
    try {
      await patchMe(values);
      await invalidateMe();
      router.replace("/(onboarding)/avatar-bio");
    } catch {
      setSubmitError(t("onboarding.username.taken"));
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, padding: 24, gap: 16, justifyContent: "center" }}>
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: "700" }}>
          {t("onboarding.username.title")}
        </Text>

        <Controller
          control={control}
          name="username"
          render={({ field }) => (
            <TextField
              label={t("onboarding.username.username")}
              value={field.value}
              onChangeText={field.onChange}
              autoCapitalize="none"
            />
          )}
        />
        <Text style={{ color: theme.textMuted, fontSize: 13 }}>
          {t("onboarding.username.usernameHint")}
        </Text>
        <Controller
          control={control}
          name="displayName"
          render={({ field }) => (
            <TextField
              label={t("onboarding.username.displayName")}
              value={field.value}
              onChangeText={field.onChange}
              autoCapitalize="words"
            />
          )}
        />

        {submitError ? <Text style={{ color: "#D1453B" }}>{submitError}</Text> : null}

        <Button
          label={t("onboarding.username.continue")}
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
        />
      </View>
    </SafeAreaView>
  );
}
