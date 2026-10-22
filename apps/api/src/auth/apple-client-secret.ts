import { importPKCS8, SignJWT } from "jose";

const APPLE_AUDIENCE = "https://appleid.apple.com";
// Apple's own cap is 6 months. We generate this once at process startup, so
// staying comfortably under it covers any realistic uptime between
// deploys/restarts — there is no live rotation.
const EXPIRES_IN_SECONDS = 60 * 60 * 24 * 150;

export interface AppleClientSecretConfig {
  teamId: string;
  keyId: string;
  // The private key as downloaded from Apple (PKCS#8 PEM, "AuthKey_*.p8").
  // In .env it's stored with literal "\n" escapes, since real newlines
  // don't survive a single env var line — restored here.
  privateKey: string;
  // The Services ID ("client id") registered for Sign in with Apple.
  clientId: string;
}

// Better Auth's `apple()` provider takes a plain `clientSecret` string (see
// docs/SECURITY.md) — unlike some other libraries, it does not generate the
// required ES256 client-assertion JWT from a team/key id and private key
// itself, so we do it here.
export async function buildAppleClientSecret(config: AppleClientSecretConfig): Promise<string> {
  const privateKey = await importPKCS8(config.privateKey.replace(/\\n/g, "\n"), "ES256");
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + EXPIRES_IN_SECONDS)
    .setAudience(APPLE_AUDIENCE)
    .setSubject(config.clientId)
    .sign(privateKey);
}
