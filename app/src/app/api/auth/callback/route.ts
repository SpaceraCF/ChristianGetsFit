import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth";

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "christian-gets-fit-dev-secret-change-me"
);

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const email = (payload.email as string)?.toLowerCase?.();
    if (!email) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    const magic = await prisma.magicLinkToken.findFirst({
      where: { token, usedAt: null },
      orderBy: { expiresAt: "desc" },
    });
    if (!magic || magic.expiresAt < new Date()) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

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
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { currentWeight: user.currentWeight ?? 82 },
      });
    }

    await prisma.magicLinkToken.update({
      where: { id: magic.id },
      data: { usedAt: new Date(), userId: user.id },
    });

    const sessionToken = await createSession(user.id, user.email);
    await setSessionCookie(sessionToken);

    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
}
