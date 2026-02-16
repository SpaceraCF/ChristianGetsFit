import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getWeeklyQuests } from "@/lib/quests";

export async function GET() {
  try {
    const user = await requireUser();
    const quests = await getWeeklyQuests(user.id);
    return NextResponse.json({ quests });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
