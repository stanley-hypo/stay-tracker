import { db } from "@/db";
import { trips } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// PUT /api/trips/[id] — update trip
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "缺少記錄 ID" }, { status: 400 });

    const existing = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
    if (existing.length === 0) return NextResponse.json({ error: "記錄不存在" }, { status: 404 });

    const body = await request.json();
    const { destination, departDate, returnDate } = body;

    const dest = (destination as string)?.trim();
    if (!dest) return NextResponse.json({ error: "請輸入目的地" }, { status: 400 });
    if (dest.length > 200) return NextResponse.json({ error: "目的地不能超過 200 個字" }, { status: 400 });
    if (!departDate || !returnDate) return NextResponse.json({ error: "請選擇出發及回程日期" }, { status: 400 });

    const dep = new Date(departDate);
    const ret = new Date(returnDate);
    if (isNaN(dep.getTime()) || isNaN(ret.getTime())) return NextResponse.json({ error: "日期格式無效" }, { status: 400 });
    if (ret < dep) return NextResponse.json({ error: "回程日期不能早於出發日期" }, { status: 400 });

    const diffDays = Math.round((ret.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 365) return NextResponse.json({ error: "單次出國不能超過 365 日，請分開記錄" }, { status: 400 });

    const [updated] = await db
      .update(trips)
      .set({ destination: dest, departDate, returnDate, updatedAt: new Date() })
      .where(eq(trips.id, id))
      .returning();

    return NextResponse.json({ trip: updated });
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
    if (!id) return NextResponse.json({ error: "缺少記錄 ID" }, { status: 400 });

    const existing = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
    if (existing.length === 0) return NextResponse.json({ error: "記錄不存在" }, { status: 404 });

    await db.delete(trips).where(eq(trips.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete trip error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
