import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/auth";

// DELETE /api/expenses/[id] - staff only; wardens limited to their own branch
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();
    if (user.role === "RESIDENT") return forbidden("Expenses are staff-only");

    const { id } = await params;
    const expense = await db.expense.findUnique({ where: { id } });
    if (!expense) return notFound("Expense not found");

    if (user.role === "WARDEN" && expense.branchId !== user.branchId) {
      return forbidden("This expense belongs to another branch");
    }

    await db.expense.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/expenses/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
