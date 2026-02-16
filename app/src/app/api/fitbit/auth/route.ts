import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getFitbitAuthUrl } from "@/lib/fitbit";
import { SignJWT } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "christian-gets-fit-dev-secret"
);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  const state = await new SignJWT({ userId: session.id })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(SECRET);
  const url = getFitbitAuthUrl(state);
  if (!url) {
    return NextResponse.json({ error: "Fitbit not configured" }, { status: 500 });
  }
  return NextResponse.redirect(url);
}
