import { generateKeyPairSync } from "node:crypto";
import { decodeJwt, decodeProtectedHeader } from "jose";
import { describe, expect, it } from "vitest";
import { buildAppleClientSecret } from "../../src/auth/apple-client-secret.js";

function generateTestPrivateKeyPem(): string {
  const { privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  return privateKey;
}

describe("buildAppleClientSecret", () => {
  it("signs a JWT Apple's token endpoint expects", async () => {
    const config = {
      teamId: "TEAMID1234",
      keyId: "KEYID56789",
      privateKey: generateTestPrivateKeyPem(),
      clientId: "dev.plate.signin",
    };

    const jwt = await buildAppleClientSecret(config);

    const header = decodeProtectedHeader(jwt);
    expect(header.alg).toBe("ES256");
    expect(header.kid).toBe(config.keyId);

    const payload = decodeJwt(jwt);
    expect(payload.iss).toBe(config.teamId);
    expect(payload.sub).toBe(config.clientId);
    expect(payload.aud).toBe("https://appleid.apple.com");
    expect(typeof payload.iat).toBe("number");
    expect(typeof payload.exp).toBe("number");
    expect((payload.exp as number) - (payload.iat as number)).toBeGreaterThan(0);
  });

  it("accepts a private key with literal \\n escapes (how it's stored in .env)", async () => {
    const pem = generateTestPrivateKeyPem();
    const escaped = pem.replace(/\n/g, "\\n");

    const jwt = await buildAppleClientSecret({
      teamId: "TEAMID1234",
      keyId: "KEYID56789",
      privateKey: escaped,
      clientId: "dev.plate.signin",
    });

    expect(typeof jwt).toBe("string");
  });
});
