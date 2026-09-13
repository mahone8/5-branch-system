import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized, forbidden, notFound, badRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/payments/[id] - mark paid / update (staff only)
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();
    if (user.role === "RESIDENT") return forbidden();

    const { id } = await params;
    const payment = await db.payment.findUnique({ where: { id } });
    if (!payment) return notFound("Payment record not found");

    if (user.role === "WARDEN" && payment.branchId !== user.branchId) {
      return forbidden("This payment belongs to another branch");
    }

    const body = await req.json();
    const updated = await db.payment.update({
      where: { id },
      data: {
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.method !== undefined ? { method: body.method || null } : {}),
        ...(body.amount !== undefined ? { amount: Number(body.amount) } : {}),
        ...(body.status === "PAID" ? { paidAt: new Date() } : {}),
        ...(body.status !== undefined && body.status !== "PAID" ? { paidAt: null } : {}),
      },
      include: { student: { select: { studentId: true, name: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/payments/[id] error:", error);
    return NextResponse.json({ error: "Failed to update payment" }, { status: 500 });
  }
}

// DELETE /api/payments/[id] (staff only)
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();
    if (user.role === "RESIDENT") return forbidden();

    const { id } = await params;
    const payment = await db.payment.findUnique({ where: { id } });
    if (!payment) return notFound("Payment record not found");
    if (user.role === "WARDEN" && payment.branchId !== user.branchId) {
      return forbidden("This payment belongs to another branch");
    }

    await db.payment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/payments/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete payment" }, { status: 500 });
  }
}
