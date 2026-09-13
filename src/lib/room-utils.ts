import { db } from "@/lib/db";

/**
 * Recalculate a room's occupancy from active student records
 * and update its status accordingly.
 */
export async function syncRoomOccupancy(roomId: string) {
  const activeStudents = await db.student.count({
    where: { roomId, status: "ACTIVE" },
  });
  const room = await db.room.findUnique({ where: { id: roomId } });
  if (!room) return;

  let status = "AVAILABLE";
  if (room.status === "MAINTENANCE") {
    status = "MAINTENANCE";
  } else if (activeStudents >= room.capacity) {
    status = "FULL";
  }

  await db.room.update({
    where: { id: roomId },
    data: { occupied: activeStudents, status },
  });
}

/**
 * Room types supported by the hostel: 1-seater, 2-seater and 3-seater only.
 * capacity must always match the type.
 */
export const ROOM_TYPE_CAPACITIES: Record<string, number> = {
  SINGLE: 1,
  DOUBLE: 2,
  TRIPLE: 3,
};

export function roomTypeLabel(type: string): string {
  return type === "SINGLE" ? "1-Seater" : type === "DOUBLE" ? "2-Seater" : type === "TRIPLE" ? "3-Seater" : type;
}

/**
 * Resolve the bed number for a (re)allocation.
 * - If a desired bed is given, validate it is within 1..capacity and free.
 * - Otherwise auto-pick the first free bed.
 * Returns { bedNumber } or { error }.
 */
export async function resolveBed(
  roomId: string,
  desired: unknown,
  excludeStudentId?: string
): Promise<{ bedNumber: number | null; error?: string }> {
  const room = await db.room.findUnique({ where: { id: roomId } });
  if (!room) return { bedNumber: null, error: "Room not found" };

  const taken = (
    await db.student.findMany({
      where: { roomId, status: "ACTIVE", ...(excludeStudentId ? { id: { not: excludeStudentId } } : {}) },
      select: { bedNumber: true },
    })
  )
    .map((s) => s.bedNumber)
    .filter((n): n is number => n !== null);

  const free: number[] = [];
  for (let i = 1; i <= room.capacity; i++) {
    if (!taken.includes(i)) free.push(i);
  }

  if (desired === undefined || desired === null || desired === "") {
    if (free.length === 0) {
      return { bedNumber: null, error: `Room ${room.roomNumber} is full (${room.capacity} beds)` };
    }
    return { bedNumber: free[0] };
  }

  const wanted = Number(desired);
  if (!Number.isInteger(wanted) || wanted < 1 || wanted > room.capacity) {
    return {
      bedNumber: null,
      error: `Bed ${desired} does not exist in ${room.roomNumber} — beds are numbered 1 to ${room.capacity}`,
    };
  }
  if (!free.includes(wanted)) {
    return { bedNumber: null, error: `Bed ${wanted} in ${room.roomNumber} is already occupied` };
  }
  return { bedNumber: wanted };
}

/** Normalize a CNIC like "3520212345671" → "35202-1234567-1"; null if invalid. */
export function normalizeCnic(input: string): string | null {
  const digits = input.replace(/[^0-9]/g, "");
  if (digits.length !== 13) return null;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

