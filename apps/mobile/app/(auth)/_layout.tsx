import { Stack } from "expo-router";

// No blanket "already signed in -> redirect" guard here: the verify-email
// screen deliberately becomes signed-in mid-flow (autoSignInAfterVerification,
// apps/api/src/auth/auth.ts) and needs to run its own accept-terms call
// before navigating onward itself — a layout-level redirect reacting to
// that same session change would race it. Screens that don't expect an
// existing session (welcome, sign-in) check for one themselves.
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
