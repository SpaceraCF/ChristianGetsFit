import { createHmac, timingSafeEqual } from "node:crypto";

export const HEALTHTRACK_EXPORT_PATH = "/api/healthtrack/export";
export const BRIDGE_REPLAY_WINDOW_SECONDS = 5 * 60;

export function createHealthTrackSignature(
  secret: string,
  timestamp: string,
  path = HEALTHTRACK_EXPORT_PATH,
) {
  return createHmac("sha256", secret)
    .update(`${timestamp}\nGET\n${path}`)
    .digest("hex");
}

export function verifyHealthTrackSignature(input: {
  secret: string;
  timestamp: string | null;
  signature: string | null;
  nowSeconds?: number;
  path?: string;
}) {
  if (input.secret.length < 32) return false;
  if (!input.timestamp || !/^\d{10}$/.test(input.timestamp)) return false;
  if (!input.signature || !/^[a-f0-9]{64}$/i.test(input.signature)) return false;
  const timestampNumber = Number(input.timestamp);
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (
    Math.abs(nowSeconds - timestampNumber) > BRIDGE_REPLAY_WINDOW_SECONDS
  ) {
    return false;
  }
  const expected = Buffer.from(
    createHealthTrackSignature(
      input.secret,
      input.timestamp,
      input.path ?? HEALTHTRACK_EXPORT_PATH,
    ),
    "hex",
  );
  const received = Buffer.from(input.signature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
