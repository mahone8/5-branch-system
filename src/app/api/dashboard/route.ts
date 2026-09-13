import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, resolveBranchId, unauthorized } from "@/lib/auth";

function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// GET /api/dashboard - branch-scoped statistics; admins additionally get a
// comparison of all branches (occupancy + this month's earnings)
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();

    const branchId = await resolveBranchId(req, user);
    if (!branchId) {
      return NextResponse.json({ error: "No branch available" }, { status: 400 });
    }
    const branch = await db.branch.findUnique({ where: { id: branchId } });

    const [students, rooms, payments, complaints, visitors, notices] =
      await Promise.all([
        db.student.findMany({
          where: { branchId },
          select: { status: true },
        }),
        db.room.findMany({ where: { branchId } }),
        db.payment.findMany({ where: { branchId }, select: { amount: true, status: true, month: true } }),
        db.complaint.findMany({
          where: { student: { branchId } },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { student: { select: { name: true } } },
        }),
        db.visitor.count({ where: { student: { branchId }, checkOut: null } }),
        db.notice.findMany({ where: { branchId }, orderBy: { createdAt: "desc" }, take: 5 }),
      ]);

    const totalStudents = students.length;
    const activeStudents = students.filter((s) => s.status === "ACTIVE").length;

    const totalBeds = rooms.reduce((sum, r) => sum + r.capacity, 0);
    const occupiedBeds = rooms.reduce((sum, r) => sum + r.occupied, 0);
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    const paid = payments.filter((p) => p.status === "PAID");
    const pending = payments.filter((p) => p.status !== "PAID");
    const totalCollected = paid.reduce((sum, p) => sum + p.amount, 0);
    const totalPending = pending.reduce((sum, p) => sum + p.amount, 0);

    const month = monthKey();
    const monthPaid = paid.filter((p) => p.month === month);
    const monthPending = pending.filter((p) => p.month === month);
    const monthCollected = monthPaid.reduce((sum, p) => sum + p.amount, 0);
    const monthPendingAmount = monthPending.reduce((sum, p) => sum + p.amount, 0);

    // Revenue trend (last 6 months)
    const revenueByMonth = new Map<string, number>();
    for (const p of paid) {
      revenueByMonth.set(p.month, (revenueByMonth.get(p.month) ?? 0) + p.amount);
    }
    const revenueTrend = Array.from(revenueByMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([m, amount]) => ({ month: m, amount }));

    // Occupancy by floor (each branch is one building)
    const floorMap = new Map<number, { floor: number; capacity: number; occupied: number }>();
    for (const r of rooms) {
      const entry = floorMap.get(r.floor) ?? { floor: r.floor, capacity: 0, occupied: 0 };
      entry.capacity += r.capacity;
      entry.occupied += r.occupied;
      floorMap.set(r.floor, entry);
    }
    const occupancyByFloor = Array.from(floorMap.values()).sort((a, b) => a.floor - b.floor);

    const openComplaints = await db.complaint.count({
      where: { student: { branchId }, status: "OPEN" },
    });
    const inProgressComplaints = await db.complaint.count({
      where: { student: { branchId }, status: "IN_PROGRESS" },
    });

    // Admin-only: compare all branches
    let branchesOverview: {
      id: string;
      code: string;
      name: string;
      city: string | null;
      totalBeds: number;
      occupiedBeds: number;
      occupancyRate: number;
      activeResidents: number;
      earningsThisMonth: number;
    }[] | null = null;

    if (user.role === "ADMIN") {
      const allBranches = await db.branch.findMany({
        orderBy: { code: "asc" },
        include: {
          rooms: { select: { capacity: true, occupied: true } },
          students: { where: { status: "ACTIVE" }, select: { id: true } },
          payments: {
            where: { status: "PAID", month },
            select: { amount: true },
          },
        },
      });
      branchesOverview = allBranches.map((b) => {
        const beds = b.rooms.reduce((s, r) => s + r.capacity, 0);
        const occ = b.rooms.reduce((s, r) => s + r.occupied, 0);
        return {
          id: b.id,
          code: b.code,
          name: b.name,
          city: b.city,
          totalBeds: beds,
          occupiedBeds: occ,
          occupancyRate: beds > 0 ? Math.round((occ / beds) * 100) : 0,
          activeResidents: b.students.length,
          earningsThisMonth: b.payments.reduce((s, p) => s + p.amount, 0),
        };
      });
    }

    return NextResponse.json({
      branch: branch ? { id: branch.id, code: branch.code, name: branch.name, city: branch.city } : null,
      month,
      students: { total: totalStudents, active: activeStudents, checkedOut: totalStudents - activeStudents },
      rooms: {
        total: rooms.length,
        maintenance: rooms.filter((r) => r.status === "MAINTENANCE").length,
        available: rooms.filter((r) => r.status === "AVAILABLE").length,
        full: rooms.filter((r) => r.status === "FULL").length,
        totalBeds,
        occupiedBeds,
        occupancyRate,
      },
      finance: {
        totalCollected,
        totalPending,
        paidCount: paid.length,
        pendingCount: pending.length,
        monthCollected,
        monthPendingAmount,
        monthPaidCount: monthPaid.length,
        monthPendingCount: monthPending.length,
      },
      complaints: {
        open: openComplaints,
        inProgress: inProgressComplaints,
        recent: complaints.map((c) => ({
          id: c.id,
          title: c.title,
          status: c.status,
          priority: c.priority,
          category: c.category,
          createdAt: c.createdAt,
          studentName: c.student.name,
        })),
      },
      visitors: { active: visitors },
      notices,
      charts: { revenueTrend, occupancyByFloor, roomTypes: [] },
      branchesOverview,
    });
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
