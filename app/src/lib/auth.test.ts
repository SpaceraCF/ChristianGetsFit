import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT, jwtVerify } from "jose";

const cookie = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => cookie.token ? { value: cookie.token } : undefined }),
}));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { createSession, getJwtSecret, getSession } from "./auth";

describe("session signing boundary", () => {
  const secret = "a-random-test-key-at-least-32-characters";
  beforeEach(() => {
    cookie.token = undefined;
    vi.stubEnv("NEXTAUTH_SECRET", secret);
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([undefined, "", "short", "x".repeat(31)])("rejects a missing or weak key (%s)", async (key) => {
    vi.stubEnv("NEXTAUTH_SECRET", key);
    expect(() => getJwtSecret()).toThrow("at least 32 characters");
    await expect(createSession("user-1", "user@example.com")).rejects.toThrow();
  });

  it("signs and reads an HS256 session with the configured key", async () => {
    cookie.token = await createSession("user-1", "user@example.com");
    const result = await jwtVerify(cookie.token, new TextEncoder().encode(secret));
    expect(result.protectedHeader.alg).toBe("HS256");
    expect(result.payload.exp! - result.payload.iat!).toBe(7 * 24 * 60 * 60);
    await expect(getSession()).resolves.toEqual({ id: "user-1", email: "user@example.com" });
  });

  it("rejects a session forged with the removed public fallback key", async () => {
    cookie.token = await new SignJWT({ userId: "user-1", email: "user@example.com" })
      .setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h")
      .sign(new TextEncoder().encode("christian-gets-fit-dev-secret-change-me"));
    await expect(getSession()).resolves.toBeNull();
    vi.stubEnv("NEXTAUTH_SECRET", undefined);
    await expect(getSession()).resolves.toBeNull();
  });

  it("rejects a correctly signed token using a non-allowlisted algorithm", async () => {
    cookie.token = await new SignJWT({ userId: "user-1", email: "user@example.com" })
      .setProtectedHeader({ alg: "HS384" }).setExpirationTime("1h")
      .sign(new TextEncoder().encode(secret));
    await expect(getSession()).resolves.toBeNull();
  });

  it("rejects expired and incomplete sessions", async () => {
    cookie.token = await new SignJWT({ userId: "user-1", email: "user@example.com" })
      .setProtectedHeader({ alg: "HS256" }).setExpirationTime(1)
      .sign(new TextEncoder().encode(secret));
    await expect(getSession()).resolves.toBeNull();
    cookie.token = await new SignJWT({ email: "user@example.com" })
      .setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h")
      .sign(new TextEncoder().encode(secret));
    await expect(getSession()).resolves.toBeNull();
  });
});
