import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncRoomOccupancy, resolveBed, normalizeCnic } from "@/lib/room-utils";
import {
  getSessionUser,
  resolveBranchId,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
  generatePassword,
  hashPassword,
} from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// GET /api/students/[id] - residents may only fetch their own record
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();

    const { id } = await params;
    if (user.role === "RESIDENT" && id !== user.residentId) {
      return forbidden("You can only view your own record");
    }

    const student = await db.student.findUnique({
      where: { id },
      include: {
        room: true,
        branch: { select: { code: true, name: true, city: true } },
        payments: { orderBy: { month: "desc" } },
        complaints: { orderBy: { createdAt: "desc" } },
        visitors: { orderBy: { checkIn: "desc" } },
        user: { select: { username: true, active: true } },
      },
    });
    if (!student) return notFound("Student not found");

    // Wardens may only see students of their own branch
    if (user.role === "WARDEN" && student.branchId !== user.branchId) {
      return forbidden("This student belongs to another branch");
    }

    return NextResponse.json(student);
  } catch (error) {
    console.error("GET /api/students/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch student" }, { status: 500 });
  }
}

// PATCH /api/students/[id] - update, re-allocate room, check out (staff), reset account password
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();
    if (user.role === "RESIDENT") return forbidden();

    const { id } = await params;
    const existing = await db.student.findUnique({ where: { id } });
    if (!existing) return notFound("Student not found");

    const branchId = await resolveBranchId(req, user);
    if (user.role === "WARDEN" && existing.branchId !== user.branchId) {
      return forbidden("This student belongs to another branch");
    }
    if (user.role === "ADMIN" && branchId && existing.branchId !== branchId) {
      return forbidden("This student belongs to another branch");
    }

    const body = await req.json();

    // Reset the resident's account password (returns a new password once)
    if (body.action === "resetPassword") {
      const password = generatePassword();
      const account = await db.user.findFirst({ where: { residentId: id } });
      if (account) {
        await db.user.update({
          where: { id: account.id },
          data: { passwordHash: hashPassword(password), active: true },
        });
      } else {
        await db.user.create({
          data: {
            username: existing.studentId,
            passwordHash: hashPassword(password),
            role: "RESIDENT",
            name: existing.name,
            residentId: existing.id,
          },
        });
      }
      return NextResponse.json({
        success: true,
        account: { username: existing.studentId, password },
      });
    }

    // Check-out: deactivate the resident account too (bed is released)
    if (body.action === "checkOut") {
      const previousRoomId = existing.roomId;
      const updated = await db.student.update({
        where: { id },
        data: { status: "CHECKED_OUT", checkOutDate: new Date(), roomId: null, bedNumber: null },
        include: { room: true },
      });
      await db.user.updateMany({
        where: { residentId: id },
        data: { active: false },
      });
      if (previousRoomId) await syncRoomOccupancy(previousRoomId);
      return NextResponse.json(updated);
    }

    // Room / bed re-allocation
    const newRoomId = body.roomId !== undefined ? body.roomId : existing.roomId;
    let newBed: number | null | undefined = undefined; // undefined = untouched
    if (body.roomId !== undefined) {
      if (!body.roomId) {
        // Unallocated — clear the bed as well
        newBed = null;
      } else {
        const room = await db.room.findUnique({ where: { id: body.roomId } });
        if (!room || room.branchId !== existing.branchId) {
          return badRequest("Selected room does not belong to the student's branch");
        }
        if (room.status === "MAINTENANCE") {
          return badRequest(`Room ${room.roomNumber} is under maintenance`);
        }
        // Desired bed: explicit if given, otherwise auto-pick a free bed
        const resolved = await resolveBed(body.roomId, body.bedNumber, id);
        if (resolved.error) return badRequest(resolved.error);
        newBed = resolved.bedNumber;
      }
    } else if (body.bedNumber !== undefined) {
      // Same room, different bed
      if (!existing.roomId) {
        return badRequest("Allocate a room before assigning a bed");
      }
      if (body.bedNumber === null || body.bedNumber === "") {
        newBed = null;
      } else {
        const resolved = await resolveBed(existing.roomId, body.bedNumber, id);
        if (resolved.error) return badRequest(resolved.error);
        newBed = resolved.bedNumber;
      }
    }

    // CNIC (optional on update, but validated when provided)
    let cnicUpdate: string | null | undefined = undefined;
    if (body.cnic !== undefined) {
      if (!body.cnic || !String(body.cnic).trim()) {
        return badRequest("CNIC cannot be empty");
      }
      const normalizedCnic = normalizeCnic(String(body.cnic));
      if (!normalizedCnic) {
        return badRequest("Invalid CNIC — expected 13 digits, e.g. 35202-1234567-1");
      }
      const duplicateCnic = await db.student.findFirst({
        where: { cnic: normalizedCnic, status: "ACTIVE", id: { not: id } },
        select: { studentId: true, name: true },
      });
      if (duplicateCnic) {
        return badRequest(
          `This CNIC is already registered to ${duplicateCnic.name} (${duplicateCnic.studentId})`
        );
      }
      cnicUpdate = normalizedCnic;
    }

    const updated = await db.student.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.email !== undefined ? { email: body.email || null } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.gender !== undefined ? { gender: body.gender } : {}),
        ...(body.university !== undefined ? { university: body.university || null } : {}),
        ...(cnicUpdate !== undefined ? { cnic: cnicUpdate } : {}),
        ...(body.course !== undefined ? { course: body.course || null } : {}),
        ...(body.department !== undefined ? { department: body.department || null } : {}),
        ...(body.guardianName !== undefined ? { guardianName: body.guardianName || null } : {}),
        ...(body.guardianPhone !== undefined ? { guardianPhone: body.guardianPhone || null } : {}),
        ...(body.address !== undefined ? { address: body.address || null } : {}),
        ...(body.roomId !== undefined ? { roomId: body.roomId || null } : {}),
        ...(newBed !== undefined ? { bedNumber: newBed } : {}),
      },
      include: { room: true },
    });

    if (body.roomId !== undefined) {
      if (existing.roomId && existing.roomId !== updated.roomId) {
        await syncRoomOccupancy(existing.roomId);
      }
      if (updated.roomId) await syncRoomOccupancy(updated.roomId);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/students/[id] error:", error);
    return NextResponse.json({ error: "Failed to update student" }, { status: 500 });
  }
}

// DELETE /api/students/[id] - removes the resident record, payments, complaints,
// visitors and their login account (cascade)
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();
    if (user.role === "RESIDENT") return forbidden();

    const { id } = await params;
    const existing = await db.student.findUnique({ where: { id } });
    if (!existing) return notFound("Student not found");

    if (user.role === "WARDEN" && existing.branchId !== user.branchId) {
      return forbidden("This student belongs to another branch");
    }

    await db.session.deleteMany({
      where: { user: { residentId: id } },
    });
    await db.payment.deleteMany({ where: { studentId: id } });
    await db.complaint.deleteMany({ where: { studentId: id } });
    await db.visitor.deleteMany({ where: { studentId: id } });
    await db.user.deleteMany({ where: { residentId: id } });

    const roomId = existing.roomId;
    await db.student.delete({ where: { id } });
    if (roomId) await syncRoomOccupancy(roomId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/students/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete student" }, { status: 500 });
  }
}
