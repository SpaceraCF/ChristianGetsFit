import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "./cron-auth";

// Any accidental database or network access fails the test before it can occur.
vi.mock("@/lib/db", () => ({ prisma: new Proxy({}, {
  get: () => { throw new Error("Database access is forbidden in auth tests"); },
}) }));
const seed = vi.hoisted(() => vi.fn(async () => ({ exercises: 1 })));
vi.mock("@/lib/program-catalog", () => ({ seedWorkoutProgram: seed }));

import { GET as daily } from "@/app/api/cron/daily/route";
import { GET as fitbit } from "@/app/api/cron/fitbit-sync/route";
import { GET as restDay } from "@/app/api/cron/rest-day/route";
import { GET as schedule } from "@/app/api/cron/schedule-calcom/route";
import { GET as tick } from "@/app/api/cron/tick/route";
import { GET as weekly } from "@/app/api/cron/weekly/route";
import { POST as adminSeed } from "@/app/api/admin/seed/route";

describe("operational bearer boundary", () => {
  const secret = "a-random-cron-test-key-at-least-32-characters";
  const request = (authorization?: string) => new NextRequest("https://example.test/api/cron/tick", {
    headers: authorization ? { authorization } : {},
  });
  beforeEach(() => {
    seed.mockClear();
    vi.stubEnv("CRON_SECRET", secret);
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network access forbidden"); }));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("requires an exact bearer match and handles unequal UTF-8 byte lengths", () => {
    expect(isAuthorizedCronRequest(request(`Bearer ${secret}`))).toBe(true);
    for (const header of [undefined, secret, `Basic ${secret}`, `Bearer ${secret}x`, `Bearer ${"é".repeat(secret.length)}`]) {
      expect(isAuthorizedCronRequest(request(header))).toBe(false);
    }
  });

  describe.each([
    ["daily", daily], ["fitbit-sync", fitbit], ["rest-day", restDay],
    ["schedule-calcom", schedule], ["tick", tick], ["weekly", weekly], ["admin/seed", adminSeed],
  ] as const)("%s", (_name, handler) => {
    it.each([undefined, "", "weak-secret"])("fails closed with key %s before side effects", async (key) => {
      vi.stubEnv("CRON_SECRET", key);
      const result = await handler(request(key ? `Bearer ${key}` : undefined));
      expect(result.status).toBe(401);
      expect(seed).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });
    it("rejects an incorrect bearer before side effects", async () => {
      const result = await handler(request(`Bearer ${"x".repeat(secret.length)}`));
      expect(result.status).toBe(401);
      expect(seed).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  it("forwards the authenticated secret to both tick targets", async () => {
    vi.stubEnv("APP_URL", "https://example.test");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    const response = await tick(request(`Bearer ${secret}`));
    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls).toEqual([
      ["https://example.test/api/cron/daily", { headers: { authorization: `Bearer ${secret}` } }],
      ["https://example.test/api/cron/rest-day", { headers: { authorization: `Bearer ${secret}` } }],
    ]);
  });

  it("keeps an authenticated program seed usable", async () => {
    const response = await adminSeed(request(`Bearer ${secret}`));
    expect(response.status).toBe(200);
    expect(seed).toHaveBeenCalledOnce();
  });
});
