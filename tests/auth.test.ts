import { describe, expect, it } from "vitest";
import { ownerKeyError } from "../worker/auth";

describe("owner setup key diagnostics", () => {
  const secret = "test-only-owner-key-with-at-least-32-characters";
  it("distinguishes missing and too-short Worker configuration", async () => {
    expect((await ownerKeyError(undefined, secret))?.code).toBe(
      "OWNER_SETUP_NOT_CONFIGURED",
    );
    expect((await ownerKeyError(" \r\n", secret))?.code).toBe(
      "OWNER_SETUP_NOT_CONFIGURED",
    );
    expect((await ownerKeyError("short", secret))?.code).toBe(
      "OWNER_SETUP_INVALID_CONFIG",
    );
  });
  it("accepts the same key with accidental surrounding whitespace", async () => {
    expect(await ownerKeyError(secret, secret)).toBeUndefined();
    expect(
      await ownerKeyError(`\uFEFF${secret}\r\n`, ` ${secret} `),
    ).toBeUndefined();
  });
  it("rejects different, missing and case-changed keys without disclosing the secret", async () => {
    for (const provided of [
      undefined,
      "OWNER_SETUP_KEY",
      secret.toUpperCase(),
      secret + "x",
    ]) {
      const error = await ownerKeyError(secret, provided);
      expect(error?.code).toBe("OWNER_SETUP_KEY_MISMATCH");
      expect(JSON.stringify(error)).not.toContain(secret);
    }
  });
});
