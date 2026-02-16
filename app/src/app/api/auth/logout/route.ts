import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  await clearSession();
  const url = new URL("/", req.url);
  return NextResponse.redirect(url);
}
