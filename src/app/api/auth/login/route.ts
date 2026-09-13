import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createSession,
  sessionCookie,
  verifyPassword,
  forbidden,
  badRequest,
  unauthorized,
} from "@/lib/auth";

// POST /api/auth/login - { username, password }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    if (!username || !password) {
      return badRequest("Username and password are required");
    }

    const user = await db.user.findUnique({ where: { username } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return unauthorized("Invalid username or password");
    }
    if (!user.active) {
      return forbidden(
        "This account has been deactivated. Please contact the hostel office."
      );
    }

    const { token, expiresAt } = await createSession(user.id);
    const res = NextResponse.json({
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
    });
    res.cookies.set(sessionCookie(token, expiresAt, req));
    return res;
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
