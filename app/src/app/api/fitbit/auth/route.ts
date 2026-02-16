import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getFitbitAuthUrl } from "@/lib/fitbit";
import { SignJWT } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "christian-gets-fit-dev-secret"
);

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(`${APP_URL}/dashboard`);
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
