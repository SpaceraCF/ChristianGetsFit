import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { SignJWT } from "jose";
import sgMail from "@sendgrid/mail";

const bodySchema = z.object({ email: z.string().email() });

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "christian-gets-fit-dev-secret-change-me"
);
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = bodySchema.parse(body);
    const normalizedEmail = email.toLowerCase().trim();

    const token = await new SignJWT({ email: normalizedEmail })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("15m")
      .setIssuedAt()
      .sign(SECRET);

    await prisma.magicLinkToken.create({
      data: {
        email: normalizedEmail,
        token,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      await sgMail.send({
        to: normalizedEmail,
        from: process.env.SENDGRID_FROM_EMAIL ?? "noreply@christiangetsfit.app",
        subject: "Your ChristianGetsFit login link",
        text: `Click to log in: ${APP_URL}/api/auth/callback?token=${token}`,
        html: `
          <p>Click the link below to log in to ChristianGetsFit. This link expires in 15 minutes.</p>
          <p><a href="${APP_URL}/api/auth/callback?token=${token}">Log in</a></p>
        `,
      });
    } else {
      console.log("[DEV] Magic link (no SendGrid):", `${APP_URL}/api/auth/callback?token=${token}`);
    }

    return NextResponse.json({ ok: true, message: "Check your email for the login link." });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Failed to send magic link" }, { status: 500 });
  }
}
