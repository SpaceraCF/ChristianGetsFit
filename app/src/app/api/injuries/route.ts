import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  bodyArea: z.enum(["shoulder", "back", "knee", "wrist", "elbow", "hip", "neck", "other"]),
  severity: z.enum(["mild", "moderate", "bad"]),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = bodySchema.parse(await req.json());
    const injury = await prisma.injury.create({
      data: {
        userId: user.id,
        bodyArea: body.bodyArea,
        severity: body.severity,
        notes: body.notes ?? undefined,
      },
    });
    return NextResponse.json(injury);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Failed to log injury" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await requireUser();
    const injuries = await prisma.injury.findMany({
      where: { userId: user.id, resolvedAt: null },
      orderBy: { startedAt: "desc" },
    });
    return NextResponse.json(injuries);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
