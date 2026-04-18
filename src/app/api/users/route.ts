import { db } from "@/db";
import { trips, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// POST /api/users — create user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = (body.name as string)?.trim();

    if (!name || name.length < 1) {
      return NextResponse.json({ error: "用戶名稱不能為空" }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ error: "用戶名稱不能超過 100 個字" }, { status: 400 });
    }

    // Check duplicate name
    const existing = await db.select().from(users).where(eq(users.name, name)).limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ error: `用戶「${name}」已存在` }, { status: 409 });
    }

    const [user] = await db.insert(users).values({ name }).returning();
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
