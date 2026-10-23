import { Redirect, Stack } from "expo-router";
import { authClient } from "../../src/auth/client";
import { useMe } from "../../src/api/useMe";

export default function OnboardingLayout() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const { data: me, isLoading: meLoading } = useMe();

  if (sessionPending || meLoading) return null;
  if (!session) return <Redirect href="/(auth)/welcome" />;
  // Onboarding (username is the one field that marks it complete) already
  // done — e.g. the app relaunched after a full signup.
  if (me?.username) return <Redirect href="/(tabs)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
