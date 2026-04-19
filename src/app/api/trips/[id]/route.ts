import { db } from "@/db";
import { trips } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// PUT /api/trips/[id] — edit trip
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "缺少記錄 ID" }, { status: 400 });
    }

    const body = await request.json();
    const { destination, departDate, returnDate } = body;

    if (!destination || !departDate || !returnDate) {
      return NextResponse.json({ error: "請填寫所有欄位" }, { status: 400 });
    }
    if (new Date(returnDate) < new Date(departDate)) {
      return NextResponse.json({ error: "回程日期不能早於出發日期" }, { status: 400 });
    }
    const diff = (new Date(returnDate).getTime() - new Date(departDate).getTime()) / (1000 * 60 * 60 * 24);
    if (diff + 1 > 365) {
      return NextResponse.json({ error: "單次出國不能超過 365 日" }, { status: 400 });
    }

    const existing = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
    if (existing.length === 0) {
      return NextResponse.json({ error: "記錄不存在" }, { status: 404 });
    }

    await db.update(trips)
      .set({ destination, departDate, returnDate })
      .where(eq(trips.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update trip error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

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
