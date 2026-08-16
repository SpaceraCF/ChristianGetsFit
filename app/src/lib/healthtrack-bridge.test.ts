import { describe, expect, it } from "vitest";

import {
  createHealthTrackSignature,
  verifyHealthTrackSignature,
} from "./healthtrack-bridge";

describe("HealthTrack bridge authentication", () => {
  const secret = "a-bridge-secret-that-is-longer-than-thirty-two-characters";
  const timestamp = "1786900000";

  it("accepts a current signed request", () => {
    expect(
      verifyHealthTrackSignature({
        secret,
        timestamp,
        signature: createHealthTrackSignature(secret, timestamp),
        nowSeconds: Number(timestamp) + 20,
      }),
    ).toBe(true);
  });

  it("rejects replayed and modified signatures", () => {
    const signature = createHealthTrackSignature(secret, timestamp);
    expect(
      verifyHealthTrackSignature({
        secret,
        timestamp,
        signature,
        nowSeconds: Number(timestamp) + 301,
      }),
    ).toBe(false);
    expect(
      verifyHealthTrackSignature({
        secret,
        timestamp,
        signature: `${signature.slice(0, -1)}0`,
        nowSeconds: Number(timestamp),
      }),
    ).toBe(false);
  });
});
