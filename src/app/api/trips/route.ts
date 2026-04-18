import { db } from "@/db";
import { trips } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// POST /api/trips — create trip
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, destination, departDate, returnDate } = body;

    // Validation
    if (!userId) return NextResponse.json({ error: "請選擇用戶" }, { status: 400 });

    const dest = (destination as string)?.trim();
    if (!dest) return NextResponse.json({ error: "請輸入目的地" }, { status: 400 });
    if (dest.length > 200)
      return NextResponse.json({ error: "目的地不能超過 200 個字" }, { status: 400 });

    if (!departDate || !returnDate)
      return NextResponse.json({ error: "請選擇出發及回程日期" }, { status: 400 });

    const dep = new Date(departDate);
    const ret = new Date(returnDate);
    if (isNaN(dep.getTime()) || isNaN(ret.getTime()))
      return NextResponse.json({ error: "日期格式無效" }, { status: 400 });
    if (ret < dep)
      return NextResponse.json({ error: "回程日期不能早於出發日期" }, { status: 400 });

    const diffDays = Math.round((ret.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 365)
      return NextResponse.json({ error: "單次出國不能超過 365 日，請分開記錄" }, { status: 400 });

    const [trip] = await db
      .insert(trips)
      .values({ userId, destination: dest, departDate, returnDate })
      .returning();

    return NextResponse.json({ trip }, { status: 201 });
  } catch (error) {
    console.error("Create trip error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
