import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getSessionUser,
  resolveBranchId,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
} from "@/lib/auth";

// GET /api/payments - staff: branch payments; residents: their own payments
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();

    const status = req.nextUrl.searchParams.get("status");
    const month = req.nextUrl.searchParams.get("month");
    const studentId = req.nextUrl.searchParams.get("studentId");

    if (user.role === "RESIDENT") {
      const payments = await db.payment.findMany({
        where: {
          studentId: user.residentId ?? "",
          ...(status ? { status } : {}),
          ...(month ? { month } : {}),
        },
        include: {
          student: {
            select: {
              id: true,
              studentId: true,
              name: true,
              roomId: true,
              room: { select: { roomNumber: true, block: true } },
            },
          },
        },
        orderBy: [{ month: "desc" }, { createdAt: "desc" }],
      });
      return NextResponse.json(payments);
    }

    const branchId = await resolveBranchId(req, user);
    if (!branchId) return badRequest("No branch available for this account");

    const payments = await db.payment.findMany({
      where: {
        branchId,
        ...(status ? { status } : {}),
        ...(month ? { month } : {}),
        ...(studentId ? { studentId } : {}),
      },
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            name: true,
            roomId: true,
            room: { select: { roomNumber: true, block: true } },
          },
        },
      },
      orderBy: [{ month: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(payments);
  } catch (error) {
    console.error("GET /api/payments error:", error);
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
  }
}

// POST /api/payments - staff only: record a payment or generate monthly dues
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();
    if (user.role === "RESIDENT") return forbidden();

    const branchId = await resolveBranchId(req, user);
    if (!branchId) return badRequest("No branch available for this account");

    const body = await req.json();

    // Bulk-generate dues for a month — active residents of THIS branch with rooms
    if (body.action === "generateDues") {
      const month: string = body.month;
      if (!month) return badRequest("Missing month (e.g. 2026-09)");

      const activeStudents = await db.student.findMany({
        where: { status: "ACTIVE", roomId: { not: null }, branchId },
        include: { room: true },
      });

      let created = 0;
      for (const s of activeStudents) {
        const exists = await db.payment.findUnique({
          where: { studentId_month: { studentId: s.id, month } },
        });
        if (exists) continue;
        await db.payment.create({
          data: {
            studentId: s.id,
            branchId,
            month,
            amount: s.room?.monthlyFee ?? 0,
            status: "PENDING",
          },
        });
        created++;
      }
      return NextResponse.json({ success: true, created, total: activeStudents.length, month });
    }

    // Single payment record
    const { studentId, amount, month, status, method } = body;
    if (!studentId || amount === undefined || !month) {
      return badRequest("Missing required fields: studentId, amount, month");
    }

    const student = await db.student.findUnique({ where: { id: studentId } });
    if (!student) return notFound("Student not found");
    if (student.branchId !== branchId) {
      return forbidden("This student belongs to another branch");
    }

    const exists = await db.payment.findUnique({
      where: { studentId_month: { studentId, month } },
    });
    if (exists) {
      return NextResponse.json(
        { error: `Payment record for ${month} already exists for this student` },
        { status: 409 }
      );
    }

    const payment = await db.payment.create({
      data: {
        studentId,
        branchId,
        amount: Number(amount),
        month,
        status: status || "PENDING",
        method: method || null,
        paidAt: status === "PAID" ? new Date() : null,
      },
      include: { student: { select: { studentId: true, name: true } } },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error("POST /api/payments error:", error);
    return NextResponse.json({ error: "Failed to create payment" }, { status: 500 });
  }
}
