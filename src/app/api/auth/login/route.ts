import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const correctPassword = process.env.AUTH_PASSWORD || "stay2026";

  if (password === correctPassword) {
    const response = NextResponse.json({ success: true });
    response.cookies.set("stay-tracker-auth", correctPassword, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });
    return response;
  }

  return NextResponse.json({ error: "密碼錯誤" }, { status: 401 });
}
