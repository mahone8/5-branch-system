import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, resolveBranchId, unauthorized, forbidden, badRequest, notFound } from "@/lib/auth";

// GET /api/complaints - staff: branch complaints; residents: their own
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();

    const status = req.nextUrl.searchParams.get("status");

    if (user.role === "RESIDENT") {
      const complaints = await db.complaint.findMany({
        where: { studentId: user.residentId ?? "", ...(status ? { status } : {}) },
        include: { student: { select: { studentId: true, name: true, roomId: true } } },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(complaints);
    }

    const branchId = await resolveBranchId(req, user);
    if (!branchId) return badRequest("No branch available for this account");

    const complaints = await db.complaint.findMany({
      where: { student: { branchId }, ...(status ? { status } : {}) },
      include: { student: { select: { studentId: true, name: true, roomId: true, room: { select: { roomNumber: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(complaints);
  } catch (error) {
    console.error("GET /api/complaints error:", error);
    return NextResponse.json({ error: "Failed to fetch complaints" }, { status: 500 });
  }
}

// POST /api/complaints - residents file their own; staff file on behalf of a resident
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();

    const body = await req.json();
    const { studentId, title, description, category, priority } = body;
    if (!title || !description) {
      return badRequest("Missing required fields: title, description");
    }

    // Residents can only file complaints for themselves
    const targetStudentId =
      user.role === "RESIDENT" ? user.residentId ?? "" : studentId;
    if (!targetStudentId) {
      return badRequest("Missing required field: studentId");
    }

    const student = await db.student.findUnique({ where: { id: targetStudentId } });
    if (!student) return notFound("Student not found");

    if (user.role === "WARDEN" && student.branchId !== user.branchId) {
      return forbidden("This student belongs to another branch");
    }

    const complaint = await db.complaint.create({
      data: {
        studentId: targetStudentId,
        title,
        description,
        category: category || "OTHER",
        priority: priority || "MEDIUM",
      },
      include: {
        student: { select: { studentId: true, name: true, roomId: true, room: { select: { roomNumber: true } } } },
      },
    });

    return NextResponse.json(complaint, { status: 201 });
  } catch (error) {
    console.error("POST /api/complaints error:", error);
    return NextResponse.json({ error: "Failed to create complaint" }, { status: 500 });
  }
}
