import { timingSafeEqual } from "node:crypto";

const MIN_SECRET_LENGTH = 32;

/** Fail closed unless a sufficiently strong CRON_SECRET bearer value matches. */
export function isAuthorizedCronRequest(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length < MIN_SECRET_LENGTH) return false;

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;

  const supplied = authorization.slice(7);
  const expectedBytes = Buffer.from(expected, "utf8");
  const suppliedBytes = Buffer.from(supplied, "utf8");
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}
