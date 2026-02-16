import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "christian-gets-fit-dev-secret-change-me"
);
const COOKIE_NAME = "cgf_session";
const TOKEN_EXPIRY = "7d";

export type SessionUser = {
  id: string;
  email: string;
};

export async function createSession(userId: string, email: string): Promise<string> {
  const token = await new SignJWT({ userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(TOKEN_EXPIRY)
    .setIssuedAt()
    .sign(SECRET);
  return token;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    const userId = payload.userId as string;
    const email = payload.email as string;
    if (!userId || !email) return null;
    return { id: userId, email };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** When no session, use first user in DB (login page removed for now). */
async function getDefaultUser() {
  return prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
}

export async function getUserOrNull() {
  const session = await getSession();
  if (session) {
    const user = await prisma.user.findUnique({
      where: { id: session.id },
    });
    if (user) return user;
  }
  return getDefaultUser();
}

export async function requireUser() {
  const user = await getUserOrNull();
  if (!user) throw new Error("Unauthorized");
  return user;
}
