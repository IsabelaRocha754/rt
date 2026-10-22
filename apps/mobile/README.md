# @plate/mobile

Expo (SDK 58) app. See the repo root `CLAUDE.md` and `docs/TRD.md` for architecture.

## Development builds

Expo Go doesn't support SDK 58 yet, so this app uses an **Expo development build**
(`expo-dev-client`) instead. Build the dev client once per device/emulator; after
that, Metro's dev-client dev server is what you run day to day — you don't rebuild
for ordinary code changes.

One-time setup, from the repo root:

```bash
pnpm exec eas login      # if not already logged in
pnpm --filter @plate/mobile exec eas init
```

`eas init` prints a project ID — paste it into `EAS_PROJECT_ID` in
`apps/mobile/app.config.ts` (the only place it's stored).

## Running on a phone

```bash
pnpm build:dev:android      # 1. build the development APK on EAS (prints a download link/QR when done)
#    download and install the APK on your phone from that link
pnpm dev:mobile:tunnel      # 2. start Metro for the dev client, over a tunnel
#    open the installed dev-client app on your phone and scan the QR Metro prints
```

Use `pnpm dev:mobile` instead of the `:tunnel` variant when your phone is on the
same local network as this machine — it's faster and doesn't need a tunnel.
