import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/complaints/[id] - update status / priority (staff only)
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();
    if (user.role === "RESIDENT") return forbidden();

    const { id } = await params;
    const complaint = await db.complaint.findUnique({
      where: { id },
      include: { student: { select: { branchId: true } } },
    });
    if (!complaint) return notFound("Complaint not found");
    if (user.role === "WARDEN" && complaint.student.branchId !== user.branchId) {
      return forbidden("This complaint belongs to another branch");
    }

    const body = await req.json();
    const updated = await db.complaint.update({
      where: { id },
      data: {
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
      },
      include: { student: { select: { studentId: true, name: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/complaints/[id] error:", error);
    return NextResponse.json({ error: "Failed to update complaint" }, { status: 500 });
  }
}

// DELETE /api/complaints/[id] (staff only)
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();
    if (user.role === "RESIDENT") return forbidden();

    const { id } = await params;
    const complaint = await db.complaint.findUnique({
      where: { id },
      include: { student: { select: { branchId: true } } },
    });
    if (!complaint) return notFound("Complaint not found");
    if (user.role === "WARDEN" && complaint.student.branchId !== user.branchId) {
      return forbidden("This complaint belongs to another branch");
    }

    await db.complaint.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/complaints/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete complaint" }, { status: 500 });
  }
}
