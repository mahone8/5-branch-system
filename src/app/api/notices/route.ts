import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, resolveBranchId, unauthorized, forbidden, badRequest } from "@/lib/auth";

// GET /api/notices - notices of the caller's branch (staff + residents)
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();

    const branchId = await resolveBranchId(req, user);
    if (!branchId) return badRequest("No branch available for this account");

    const notices = await db.notice.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(notices);
  } catch (error) {
    console.error("GET /api/notices error:", error);
    return NextResponse.json({ error: "Failed to fetch notices" }, { status: 500 });
  }
}

// POST /api/notices - publish a notice to the branch (staff only)
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();
    if (user.role === "RESIDENT") return forbidden();

    const branchId = await resolveBranchId(req, user);
    if (!branchId) return badRequest("No branch available for this account");

    const body = await req.json();
    const { title, content, priority } = body;
    if (!title || !content) {
      return badRequest("Missing required fields: title, content");
    }

    const notice = await db.notice.create({
      data: { title, content, priority: priority || "NORMAL", branchId },
    });

    return NextResponse.json(notice, { status: 201 });
  } catch (error) {
    console.error("POST /api/notices error:", error);
    return NextResponse.json({ error: "Failed to create notice" }, { status: 500 });
  }
}
