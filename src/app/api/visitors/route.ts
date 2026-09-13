import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, resolveBranchId, unauthorized, forbidden, badRequest, notFound } from "@/lib/auth";

// GET /api/visitors - staff: branch visitor logs; residents: their own visitors
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();

    const active = req.nextUrl.searchParams.get("active");

    if (user.role === "RESIDENT") {
      const visitors = await db.visitor.findMany({
        where: { studentId: user.residentId ?? "", ...(active === "true" ? { checkOut: null } : {}) },
        include: {
          student: { select: { studentId: true, name: true, room: { select: { roomNumber: true } } } },
        },
        orderBy: { checkIn: "desc" },
      });
      return NextResponse.json(visitors);
    }

    const branchId = await resolveBranchId(req, user);
    if (!branchId) return badRequest("No branch available for this account");

    const visitors = await db.visitor.findMany({
      where: { student: { branchId }, ...(active === "true" ? { checkOut: null } : {}) },
      include: {
        student: {
          select: { studentId: true, name: true, room: { select: { roomNumber: true } } },
        },
      },
      orderBy: { checkIn: "desc" },
    });
    return NextResponse.json(visitors);
  } catch (error) {
    console.error("GET /api/visitors error:", error);
    return NextResponse.json({ error: "Failed to fetch visitors" }, { status: 500 });
  }
}

// POST /api/visitors - log a visitor check-in (staff only)
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();
    if (user.role === "RESIDENT") return forbidden();

    const branchId = await resolveBranchId(req, user);
    if (!branchId) return badRequest("No branch available for this account");

    const body = await req.json();
    const { name, phone, studentId, purpose } = body;
    if (!name || !studentId) {
      return badRequest("Missing required fields: name, studentId");
    }

    const student = await db.student.findUnique({ where: { id: studentId } });
    if (!student) return notFound("Student not found");
    if (student.branchId !== branchId) {
      return forbidden("This student belongs to another branch");
    }

    const visitor = await db.visitor.create({
      data: { name, phone: phone || null, studentId, purpose: purpose || null },
      include: { student: { select: { studentId: true, name: true } } },
    });

    return NextResponse.json(visitor, { status: 201 });
  } catch (error) {
    console.error("POST /api/visitors error:", error);
    return NextResponse.json({ error: "Failed to create visitor log" }, { status: 500 });
  }
}
