import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ROOM_TYPE_CAPACITIES } from "@/lib/room-utils";
import {
  getSessionUser,
  resolveBranchId,
  unauthorized,
  forbidden,
  badRequest,
} from "@/lib/auth";

// GET /api/rooms - branch-scoped room list with occupancy
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();

    const branchId = await resolveBranchId(req, user);
    if (!branchId) return badRequest("No branch available for this account");

    const status = req.nextUrl.searchParams.get("status");
    const type = req.nextUrl.searchParams.get("type");
    const rooms = await db.room.findMany({
      where: {
        branchId,
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
      },
      include: {
        students: {
          where: { status: "ACTIVE" },
          select: { id: true, studentId: true, name: true, bedNumber: true },
        },
      },
      orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
    });
    return NextResponse.json(rooms);
  } catch (error) {
    console.error("GET /api/rooms error:", error);
    return NextResponse.json({ error: "Failed to fetch rooms" }, { status: 500 });
  }
}

// POST /api/rooms - create a room in the active branch (staff only)
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
    const { roomNumber, floor, type, monthlyFee, status } = body;

    if (!roomNumber || floor === undefined || !type) {
      return badRequest("Missing required fields: roomNumber, floor, type");
    }

    // The hostel only has 1-seater, 2-seater and 3-seater rooms —
    // capacity is derived from the type and cannot be set independently.
    const capacity = ROOM_TYPE_CAPACITIES[type];
    if (!capacity) {
      return badRequest("Room type must be 1-Seater (SINGLE), 2-Seater (DOUBLE) or 3-Seater (TRIPLE)");
    }

    // Prefix with the branch code so room numbers stay globally unique
    const fullNumber = roomNumber.startsWith(`${branch.code}-`)
      ? roomNumber
      : `${branch.code}-${roomNumber}`;

    const existing = await db.room.findUnique({ where: { roomNumber: fullNumber } });
    if (existing) {
      return NextResponse.json(
        { error: `Room number "${fullNumber}" already exists` },
        { status: 409 }
      );
    }

    const room = await db.room.create({
      data: {
        roomNumber: fullNumber,
        block: branch.code,
        floor: Number(floor),
        type,
        capacity,
        monthlyFee: Number(monthlyFee) || 0,
        status: status || "AVAILABLE",
        occupied: 0,
        branchId,
      },
      include: { students: { select: { id: true, name: true, bedNumber: true } } },
    });

    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    console.error("POST /api/rooms error:", error);
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 });
  }
}
