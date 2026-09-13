import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, hashPassword, verifyPassword, unauthorized, badRequest } from "@/lib/auth";

// POST /api/auth/change-password - { currentPassword, newPassword }
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();

    const body = await req.json();
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    if (!currentPassword || !newPassword) {
      return badRequest("Current and new password are required");
    }
    if (newPassword.length < 6) {
      return badRequest("New password must be at least 6 characters");
    }

    const record = await db.user.findUnique({ where: { id: user.id } });
    if (!record || !verifyPassword(currentPassword, record.passwordHash)) {
      return badRequest("Current password is incorrect");
    }

    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(newPassword) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/auth/change-password error:", error);
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 });
  }
}
