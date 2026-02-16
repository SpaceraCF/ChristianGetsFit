import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export async function GET() {
  await clearSession();
  return NextResponse.redirect(APP_URL);
}

export async function POST() {
  await clearSession();
  return NextResponse.redirect(APP_URL);
}
