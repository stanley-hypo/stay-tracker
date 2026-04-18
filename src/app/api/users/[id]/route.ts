import { db } from "@/db";
import { trips, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// DELETE /api/users/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "缺少用戶 ID" }, { status: 400 });
    }

    // Check user exists
    const existing = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (existing.length === 0) {
      return NextResponse.json({ error: "用戶不存在" }, { status: 404 });
    }

    // Cascade delete trips then user
    await db.delete(trips).where(eq(trips.userId, id));
    await db.delete(users).where(eq(users.id, id));

    return NextResponse.json({ success: true, deletedUser: existing[0].name });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
