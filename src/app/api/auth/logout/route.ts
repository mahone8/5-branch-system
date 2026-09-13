import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth";

// POST /api/auth/logout
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (token) {
      await db.session.deleteMany({ where: { token } }).catch(() => undefined);
    }
    const res = NextResponse.json({ success: true });
    // Mirror the login cookie attributes (sameSite/secure) so the clear
    // actually takes effect in proxied HTTPS contexts too.
    const isHttps =
      req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https';
    res.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: isHttps ? 'none' : 'lax',
      secure: isHttps,
      path: "/",
      maxAge: 0,
    });
    return res;
  } catch (error) {
    console.error("POST /api/auth/logout error:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
