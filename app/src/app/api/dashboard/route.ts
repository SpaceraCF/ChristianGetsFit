import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { getDashboardStats } from "@/lib/dashboard";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json(await getDashboardStats(user.id));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
