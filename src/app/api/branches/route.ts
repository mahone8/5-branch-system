import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";

// GET /api/branches - branches visible to the current user
// ADMIN: all branches; WARDEN: their branch; RESIDENT: their branch
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const branches = await db.branch.findMany({
    where:
      user.role === "ADMIN"
        ? {}
        : { id: user.role === "WARDEN" ? user.branchId ?? "" : user.resident?.branchId ?? "" },
    select: {
      id: true,
      code: true,
      name: true,
      city: true,
      phone: true,
      rooms: { select: { capacity: true, occupied: true, status: true } },
      students: { where: { status: "ACTIVE" }, select: { id: true } },
    },
    orderBy: { code: "asc" },
  });

  return NextResponse.json(
    branches.map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      city: b.city,
      phone: b.phone,
      totalBeds: b.rooms.reduce((sum, r) => sum + r.capacity, 0),
      occupiedBeds: b.rooms.reduce((sum, r) => sum + r.occupied, 0),
      activeResidents: b.students.length,
    }))
  );
}
