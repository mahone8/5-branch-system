import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, resolveBranchId, unauthorized, forbidden, badRequest } from "@/lib/auth";

const include = {
  recorder: { select: { name: true, username: true } },
};

// GET /api/expenses - staff only: expenses for the active branch.
// Optional ?month=YYYY-MM (calendar month of spentAt); defaults to all months.
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();
    if (user.role === "RESIDENT") return forbidden("Expenses are staff-only");

    const branchId = await resolveBranchId(req, user);
    if (!branchId) return badRequest("No branch available for this account");

    const month = req.nextUrl.searchParams.get("month");
    const expenses = await db.expense.findMany({
      where: {
        branchId,
        ...(month ? { spentAt: { gte: new Date(`${month}-01T00:00:00`), lt: nextMonthStart(month) } } : {}),
      },
      include,
      orderBy: { spentAt: "desc" },
      take: 500,
    });
    return NextResponse.json(expenses);
  } catch (error) {
    console.error("GET /api/expenses error:", error);
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
}

// POST /api/expenses - staff only: record an expense for the active branch
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();
    if (user.role === "RESIDENT") return forbidden("Expenses are staff-only");

    const branchId = await resolveBranchId(req, user);
    if (!branchId) return badRequest("No branch available for this account");

    const body = await req.json();
    const { title, category, amount, paidTo, note, spentAt } = body;
    if (!title || amount === undefined || Number(amount) <= 0) {
      return badRequest("Missing required fields: title, amount (> 0)");
    }

    const expense = await db.expense.create({
      data: {
        branchId,
        title,
        category: category || "OTHER",
        amount: Number(amount),
        paidTo: paidTo || null,
        note: note || null,
        spentAt: spentAt ? new Date(spentAt) : new Date(),
        recordedBy: user.id,
      },
      include,
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("POST /api/expenses error:", error);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}

function nextMonthStart(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 1); // m is 1-based here; Date month is 0-based, so this is the 1st of the next month
}
