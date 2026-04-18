import { db } from "@/db";
import { trips } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// DELETE /api/trips/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "缺少記錄 ID" }, { status: 400 });
    }

    // Check trip exists
    const existing = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
    if (existing.length === 0) {
      return NextResponse.json({ error: "記錄不存在" }, { status: 404 });
    }

    await db.delete(trips).where(eq(trips.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete trip error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
