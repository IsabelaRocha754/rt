import { BIO_MAX_LENGTH } from "@plate/shared";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { patchMe, uploadAvatar } from "../../src/api/me";
import { useInvalidateMe } from "../../src/api/useMe";
import { Button } from "../../src/components/Button";
import { TextField } from "../../src/components/TextField";
import { useTheme } from "../../src/theme/tokens";

export default function AvatarBioScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const invalidateMe = useInvalidateMe();
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [picking, setPicking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    setPicking(true);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    setPicking(false);
    if (result.canceled || !result.assets[0]) return;
    setPreviewUri(result.assets[0].uri);
  }

  async function handleContinue() {
    setError(null);
    setSubmitting(true);
    try {
      if (previewUri) {
        const file = await fetch(previewUri);
        const bytes = await file.blob();
        await uploadAvatar(bytes, bytes.type || "image/jpeg");
      }
      if (bio.trim().length > 0) {
        await patchMe({ bio: bio.trim() });
      }
      await invalidateMe();
      router.replace("/(onboarding)/find-friends");
    } catch {
      setError(t("auth.errors.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, padding: 24, gap: 16, justifyContent: "center" }}>
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: "700" }}>
          {t("onboarding.avatarBio.title")}
        </Text>

        {previewUri ? (
          <Image
            source={{ uri: previewUri }}
            style={{ width: 96, height: 96, borderRadius: 48, alignSelf: "center" }}
          />
        ) : null}
        <Button
          label={t("onboarding.avatarBio.pickPhoto")}
          variant="secondary"
          onPress={handlePickPhoto}
          loading={picking}
        />

        <TextField
          label={t("onboarding.avatarBio.bio")}
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={BIO_MAX_LENGTH}
        />
        <Text style={{ color: theme.textMuted, fontSize: 13 }}>
          {t("onboarding.avatarBio.bioHint")}
        </Text>

        {error ? <Text style={{ color: "#D1453B" }}>{error}</Text> : null}

        <Button
          label={t("onboarding.avatarBio.continue")}
          onPress={handleContinue}
          loading={submitting}
        />
        <Button
          label={t("onboarding.avatarBio.skip")}
          variant="secondary"
          onPress={() => router.replace("/(onboarding)/find-friends")}
        />
      </View>
    </SafeAreaView>
  );
}
