import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// DELETE /api/notices/[id] (staff of that branch only)
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();
    if (user.role === "RESIDENT") return forbidden();

    const { id } = await params;
    const notice = await db.notice.findUnique({ where: { id } });
    if (!notice) return notFound("Notice not found");
    if (user.role === "WARDEN" && notice.branchId !== user.branchId) {
      return forbidden("This notice belongs to another branch");
    }

    await db.notice.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/notices/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete notice" }, { status: 500 });
  }
}
