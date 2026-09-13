import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncRoomOccupancy, ROOM_TYPE_CAPACITIES } from "@/lib/room-utils";
import { getSessionUser, resolveBranchId, unauthorized, forbidden, notFound } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

async function guardStaff(req: NextRequest, id: string) {
  const user = await getSessionUser(req);
  if (!user) return { error: unauthorized() };
  if (user.role === "RESIDENT") return { error: forbidden() };
  const branchId = await resolveBranchId(req, user);
  const room = await db.room.findUnique({ where: { id } });
  if (!room) return { error: notFound("Room not found") };
  const allowed =
    user.role === "ADMIN" ? !branchId || room.branchId === branchId : room.branchId === user.branchId;
  if (!allowed) return { error: forbidden("This room belongs to another branch") };
  return { user, room };
}

// GET /api/rooms/[id]
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();
    const { id } = await params;
    const room = await db.room.findUnique({
      where: { id },
      include: {
        students: {
          where: { status: "ACTIVE" },
          select: { id: true, studentId: true, name: true, phone: true, bedNumber: true },
        },
      },
    });
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    return NextResponse.json(room);
  } catch (error) {
    console.error("GET /api/rooms/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch room" },
      { status: 500 }
    );
  }
}

// PATCH /api/rooms/[id] - update room details / toggle maintenance
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const guard = await guardStaff(req, (await params).id);
    if (guard.error) return guard.error;
    const { id } = await params;
    const room = guard.room;
    const body = await req.json();

    // Room type drives capacity (1/2/3-seater only) and cannot shrink below occupancy
    let capacityUpdate: number | undefined = undefined;
    if (body.type !== undefined) {
      const derived = ROOM_TYPE_CAPACITIES[body.type];
      if (!derived) {
        return NextResponse.json(
          { error: "Room type must be 1-Seater (SINGLE), 2-Seater (DOUBLE) or 3-Seater (TRIPLE)" },
          { status: 400 }
        );
      }
      capacityUpdate = derived;
      if (derived < room.occupied) {
        return NextResponse.json(
          {
            error: `A ${body.type === "SINGLE" ? "1-seater" : body.type === "DOUBLE" ? "2-seater" : "3-seater"} room holds only ${derived} bed(s) — ${room.occupied} resident(s) currently allocated`,
          },
          { status: 400 }
        );
      }
    } else if (body.capacity !== undefined && Number(body.capacity) !== room.capacity) {
      return NextResponse.json(
        { error: "Capacity is fixed by the room type (1/2/3-seater) — change the type instead" },
        { status: 400 }
      );
    }

    const updated = await db.room.update({
      where: { id },
      data: {
        ...(body.roomNumber !== undefined ? { roomNumber: body.roomNumber } : {}),
        ...(body.block !== undefined ? { block: body.block } : {}),
        ...(body.floor !== undefined ? { floor: Number(body.floor) } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(capacityUpdate !== undefined ? { capacity: capacityUpdate } : {}),
        ...(body.monthlyFee !== undefined
          ? { monthlyFee: Number(body.monthlyFee) }
          : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
      include: {
        students: {
          where: { status: "ACTIVE" },
          select: { id: true, studentId: true, name: true, bedNumber: true },
        },
      },
    });

    // Recompute occupancy status after edits
    await syncRoomOccupancy(id);
    const fresh = await db.room.findUnique({
      where: { id },
      include: {
        students: {
          where: { status: "ACTIVE" },
          select: { id: true, studentId: true, name: true, bedNumber: true },
        },
      },
    });

    return NextResponse.json(fresh ?? updated);
  } catch (error) {
    console.error("PATCH /api/rooms/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update room" },
      { status: 500 }
    );
  }
}

// DELETE /api/rooms/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const guard = await guardStaff(req, (await params).id);
    if (guard.error) return guard.error;
    const { id } = await params;
    const room = await db.room.findUnique({
      where: { id },
      include: { students: true },
    });
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const activeStudents = room.students.filter(
      (s) => s.status === "ACTIVE"
    ).length;
    if (activeStudents > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete room ${room.roomNumber}: ${activeStudents} active student(s) still allocated`,
        },
        { status: 400 }
      );
    }

    // Detach historical residents (clear room AND bed)
    await db.student.updateMany({
      where: { roomId: id },
      data: { roomId: null, bedNumber: null },
    });
    await db.room.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/rooms/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete room" },
      { status: 500 }
    );
  }
}
