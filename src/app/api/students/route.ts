import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncRoomOccupancy, resolveBed, normalizeCnic } from "@/lib/room-utils";
import {
  getSessionUser,
  resolveBranchId,
  unauthorized,
  forbidden,
  badRequest,
  generatePassword,
  hashPassword,
} from "@/lib/auth";

// GET /api/students - branch-scoped list (staff); residents get their own record
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();

    if (user.role === "RESIDENT") {
      const student = await db.student.findUnique({
        where: { id: user.residentId ?? "" },
        include: { room: true, branch: { select: { code: true, name: true } } },
      });
      return NextResponse.json(student ? [student] : []);
    }

    const branchId = await resolveBranchId(req, user);
    if (!branchId) return badRequest("No branch available for this account");

    const status = req.nextUrl.searchParams.get("status");
    const search = req.nextUrl.searchParams.get("search");
    const students = await db.student.findMany({
      where: {
        branchId,
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { studentId: { contains: search, mode: "insensitive" } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      include: { room: true, user: { select: { username: true, active: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(students);
  } catch (error) {
    console.error("GET /api/students error:", error);
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
  }
}

// POST /api/students - check-in: auto-generates student ID + resident account
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();
    if (user.role === "RESIDENT") return forbidden();

    const branchId = await resolveBranchId(req, user);
    if (!branchId) return badRequest("No branch available for this account");
    const branch = await db.branch.findUnique({ where: { id: branchId } });
    if (!branch) return badRequest("Branch not found");

    const body = await req.json();
    const { name, email, phone, gender, cnic, university, course, department, guardianName, guardianPhone, address, roomId, bedNumber } = body;

    if (!name || !phone || !gender) {
      return badRequest("Missing required fields: name, phone, gender");
    }
    if (!university || !String(university).trim()) {
      return badRequest("University name is required at check-in");
    }
    if (!cnic || !String(cnic).trim()) {
      return badRequest("CNIC number is required at check-in");
    }
    const normalizedCnic = normalizeCnic(String(cnic));
    if (!normalizedCnic) {
      return badRequest("Invalid CNIC — expected 13 digits, e.g. 35202-1234567-1");
    }

    // A CNIC identifies a person: block duplicates among active residents of this branch
    const duplicateCnic = await db.student.findFirst({
      where: { cnic: normalizedCnic, status: "ACTIVE" },
      select: { studentId: true, name: true },
    });
    if (duplicateCnic) {
      return badRequest(
        `This CNIC is already registered to ${duplicateCnic.name} (${duplicateCnic.studentId})`
      );
    }

    // Room must belong to the same branch; bed is validated/auto-assigned
    let bed: number | null = null;
    if (roomId) {
      const room = await db.room.findUnique({ where: { id: roomId } });
      if (!room || room.branchId !== branchId) {
        return badRequest("Selected room does not belong to this branch");
      }
      if (room.status === "MAINTENANCE") {
        return badRequest(`Room ${room.roomNumber} is under maintenance`);
      }
      const resolved = await resolveBed(roomId, bedNumber);
      if (resolved.error) return badRequest(resolved.error);
      bed = resolved.bedNumber;
    }

    // Auto-generate the next student ID for this branch (e.g. GV1-0007)
    const branchStudents = await db.student.findMany({
      where: { branchId },
      select: { studentId: true },
    });
    let maxSeq = 0;
    for (const s of branchStudents) {
      const m = s.studentId.match(new RegExp(`^${branch.code}-(\\d{4})$`));
      if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
    }
    const studentId = `${branch.code}-${String(maxSeq + 1).padStart(4, "0")}`;

    const student = await db.student.create({
      data: {
        studentId,
        name,
        email: email || null,
        phone,
        gender,
        cnic: normalizedCnic,
        university: String(university).trim(),
        course: course || null,
        department: department || null,
        guardianName: guardianName || null,
        guardianPhone: guardianPhone || null,
        address: address || null,
        branchId,
        roomId: roomId || null,
        bedNumber: bed,
      },
      include: { room: true },
    });

    if (roomId) await syncRoomOccupancy(roomId);

    // Generate the resident's login account
    const password = generatePassword();
    await db.user.create({
      data: {
        username: studentId,
        passwordHash: hashPassword(password),
        role: "RESIDENT",
        name,
        residentId: student.id,
      },
    });

    return NextResponse.json(
      { student, account: { username: studentId, password } },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/students error:", error);
    return NextResponse.json({ error: "Failed to check in student" }, { status: 500 });
  }
}
