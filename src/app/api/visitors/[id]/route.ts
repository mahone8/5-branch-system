import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/visitors/[id] - check out a visitor (staff only)
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();
    if (user.role === "RESIDENT") return forbidden();

    const { id } = await params;
    const visitor = await db.visitor.findUnique({
      where: { id },
      include: { student: { select: { branchId: true } } },
    });
    if (!visitor) return notFound("Visitor not found");
    if (user.role === "WARDEN" && visitor.student.branchId !== user.branchId) {
      return forbidden("This visitor log belongs to another branch");
    }

    const body = await req.json();
    const updated = await db.visitor.update({
      where: { id },
      data: {
        ...(body.action === "checkOut" ? { checkOut: new Date() } : {}),
        ...(body.purpose !== undefined ? { purpose: body.purpose } : {}),
      },
      include: { student: { select: { studentId: true, name: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/visitors/[id] error:", error);
    return NextResponse.json({ error: "Failed to update visitor" }, { status: 500 });
  }
}

// DELETE /api/visitors/[id] (staff only)
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();
    if (user.role === "RESIDENT") return forbidden();

    const { id } = await params;
    const visitor = await db.visitor.findUnique({
      where: { id },
      include: { student: { select: { branchId: true } } },
    });
    if (!visitor) return notFound("Visitor not found");
    if (user.role === "WARDEN" && visitor.student.branchId !== user.branchId) {
      return forbidden("This visitor log belongs to another branch");
    }

    await db.visitor.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/visitors/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete visitor log" }, { status: 500 });
  }
}
