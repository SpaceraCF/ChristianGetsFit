import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${APP_URL}/?error=no_code`);
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: `${APP_URL}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      console.error("[Google OAuth] Token exchange failed:", await tokenRes.text());
      return NextResponse.redirect(`${APP_URL}/?error=token_failed`);
    }

    const tokens = await tokenRes.json();

    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoRes.ok) {
      return NextResponse.redirect(`${APP_URL}/?error=userinfo_failed`);
    }

    const googleUser: { email: string; name?: string; picture?: string } = await userInfoRes.json();
    const email = googleUser.email.toLowerCase();

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          startingWeight: 82,
          currentWeight: 82,
          targetWeight: 75,
          goalStartedAt: new Date(),
        },
      });
    }

    const sessionToken = await createSession(user.id, user.email);
    await setSessionCookie(sessionToken);

    return NextResponse.redirect(`${APP_URL}/dashboard`);
  } catch (e) {
    console.error("[Google OAuth]", e);
    return NextResponse.redirect(`${APP_URL}/?error=auth_failed`);
  }
}
