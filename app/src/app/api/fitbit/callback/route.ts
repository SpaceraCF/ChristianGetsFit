import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { exchangeFitbitCode } from "@/lib/fitbit";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "christian-gets-fit-dev-secret"
);

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(`${APP_URL}/dashboard/settings?fitbit=error`);
  }
  try {
    const { payload } = await jwtVerify(state, SECRET);
    const userId = payload.userId as string;
    if (!userId) throw new Error("Invalid state");
    const tokens = await exchangeFitbitCode(code, userId);
    if (!tokens) throw new Error("Exchange failed");
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
    await prisma.user.update({
      where: { id: userId },
      data: {
        fitbitAccessToken: tokens.accessToken,
        fitbitRefreshToken: tokens.refreshToken,
        fitbitTokenExpiresAt: expiresAt,
      },
    });
    return NextResponse.redirect(`${APP_URL}/dashboard/settings?fitbit=ok`);
  } catch {
    return NextResponse.redirect(`${APP_URL}/dashboard/settings?fitbit=error`);
  }
}
