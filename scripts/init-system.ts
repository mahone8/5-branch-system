/**
 * init-system.ts — provisioning of the real multi-branch hostel system.
 *
 * Creates:
 *   - 5 branches: Nazzal (NZL), Nooroxotel (NRX), Ayesha (AYS),
 *     Aqsa (AQS), Velvetrose (VLR)
 *   - Per branch: 13 rooms / 28 beds in the 3 room types:
 *       Floor 1: 101–103  → 3 x 1-Seater (SINGLE,  30,000/mo)
 *       Floor 2: 201–205  → 5 x 2-Seater (DOUBLE, 22,000/mo)
 *       Floor 3: 301–305  → 5 x 3-Seater (TRIPLE, 15,000/mo)
 *   - Super admin account:     admin / admin123
 *   - Branch warden accounts:  warden.nazzal, warden.nooroxotel, warden.ayesha,
 *                              warden.aqsa, warden.velvetrose / warden123
 *   - Demo resident in Nazzal: NZL-0001 / resident123
 *
 * Migration: if legacy branches (e.g. the old GV1..GV5 system) exist, their
 * data (users, residents, payments, complaints, visitors, notices, rooms) is
 * removed first. Existing NEW branches are left untouched (idempotent).
 *
 * Run:  bun run init
 */
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { readFileSync, existsSync } from "fs";

// Load DATABASE_URL from .env when it is not already in the environment.
// (bun loads .env automatically; node/tsx users need this fallback.)
if (!process.env.DATABASE_URL && existsSync(".env")) {
  const m = readFileSync(".env", "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
  if (m) process.env.DATABASE_URL = m[1];
}

const db = new PrismaClient();

const BRANCHES = [
  { code: "NZL", name: "Nazzal", city: "Lahore", phone: "+92 42 35210001", address: "12-C Main Boulevard, Gulberg III, Lahore" },
  { code: "NRX", name: "Nooroxotel", city: "Islamabad", phone: "+92 51 28710002", address: "Street 12, F-11/3, Islamabad" },
  { code: "AYS", name: "Ayesha", city: "Lahore", phone: "+92 42 35860003", address: "45-A Johar Town, Lahore" },
  { code: "AQS", name: "Aqsa", city: "Karachi", phone: "+92 21 35390004", address: "Block 6, Gulshan-e-Iqbal, Karachi" },
  { code: "VLR", name: "Velvetrose", city: "Rawalpindi", phone: "+92 51 55620005", address: "Peshawar Road, Satellite Town, Rawalpindi" },
];

const NEW_CODES = BRANCHES.map((b) => b.code);

// Room types: the hostel only has 1-seater, 2-seater and 3-seater rooms
const ROOM_LAYOUT = [
  { floor: 1, suffixes: ["01", "02", "03"], type: "SINGLE", capacity: 1, monthlyFee: 30000 },
  { floor: 2, suffixes: ["01", "02", "03", "04", "05"], type: "DOUBLE", capacity: 2, monthlyFee: 22000 },
  { floor: 3, suffixes: ["01", "02", "03", "04", "05"], type: "TRIPLE", capacity: 3, monthlyFee: 15000 },
];

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function roomsForBranch(branchCode: string) {
  const rooms: {
    roomNumber: string;
    block: string;
    floor: number;
    type: string;
    capacity: number;
    monthlyFee: number;
  }[] = [];
  for (const layout of ROOM_LAYOUT) {
    for (const suffix of layout.suffixes) {
      rooms.push({
        roomNumber: `${branchCode}-${layout.floor}${suffix}`,
        block: branchCode,
        floor: layout.floor,
        type: layout.type,
        capacity: layout.capacity,
        monthlyFee: layout.monthlyFee,
      });
    }
  }
  return rooms;
}

async function removeLegacyBranches() {
  const legacy = await db.branch.findMany({ where: { code: { notIn: NEW_CODES } } });
  if (legacy.length === 0) return;
  const oldIds = legacy.map((b) => b.id);
  console.log(`\n[migrate] Removing ${legacy.length} legacy branch(es): ${legacy.map((b) => b.code).join(", ")}`);

  const oldStudentIds = (
    await db.student.findMany({ where: { branchId: { in: oldIds } }, select: { id: true } })
  ).map((s) => s.id);

  await db.session.deleteMany({
    where: { user: { OR: [{ branchId: { in: oldIds } }, ...(oldStudentIds.length ? [{ residentId: { in: oldStudentIds } }] : [])] } },
  });
  await db.messMenu.deleteMany({ where: { uploader: { branchId: { in: oldIds } } } });
  await db.user.deleteMany({
    where: { OR: [{ branchId: { in: oldIds } }, ...(oldStudentIds.length ? [{ residentId: { in: oldStudentIds } }] : [])] },
  });
  await db.payment.deleteMany({ where: { branchId: { in: oldIds } } });
  if (oldStudentIds.length) {
    await db.complaint.deleteMany({ where: { studentId: { in: oldStudentIds } } });
    await db.visitor.deleteMany({ where: { studentId: { in: oldStudentIds } } });
  }
  await db.notice.deleteMany({ where: { branchId: { in: oldIds } } });
  await db.student.deleteMany({ where: { branchId: { in: oldIds } } });
  await db.room.deleteMany({ where: { branchId: { in: oldIds } } });
  await db.branch.deleteMany({ where: { id: { in: oldIds } } });
  console.log("[migrate] Legacy data removed (users, residents, payments, rooms)");
}

async function main() {
  console.log("Initializing multi-branch hostel system (Nazzal · Nooroxotel · Ayesha · Aqsa · Velvetrose)...\n");

  await removeLegacyBranches();

  // 1. Branches + rooms
  for (const b of BRANCHES) {
    const existing = await db.branch.findUnique({ where: { code: b.code } });
    if (existing) {
      const roomCount = await db.room.count({ where: { branchId: existing.id } });
      console.log(`[skip] Branch ${b.code} (${b.name}) already exists (${roomCount} rooms)`);
      continue;
    }
    const branch = await db.branch.create({
      data: { code: b.code, name: b.name, city: b.city, phone: b.phone },
    });
    const rooms = roomsForBranch(b.code);
    for (const room of rooms) {
      await db.room.create({
        data: { ...room, branchId: branch.id, occupied: 0, status: "AVAILABLE" },
      });
    }
    const beds = rooms.reduce((s, r) => s + r.capacity, 0);
    console.log(`[ok]   Branch ${b.code} (${b.name}) created — 13 rooms / ${beds} beds (1/2/3-seater)`);
  }

  // 2. Super admin
  if (!(await db.user.findUnique({ where: { username: "admin" } }))) {
    await db.user.create({
      data: {
        username: "admin",
        passwordHash: hashPassword("admin123"),
        role: "ADMIN",
        name: "System Administrator",
      },
    });
    console.log(`[ok]   Admin account created: admin / admin123`);
  } else {
    console.log(`[skip] Admin account already exists`);
  }

  // 3. Wardens (one per branch)
  for (const b of BRANCHES) {
    const username = `warden.${b.name.toLowerCase()}`;
    if (await db.user.findUnique({ where: { username } })) {
      console.log(`[skip] Warden ${username} already exists`);
      continue;
    }
    const branch = await db.branch.findUnique({ where: { code: b.code } });
    if (!branch) continue;
    await db.user.create({
      data: {
        username,
        passwordHash: hashPassword("warden123"),
        role: "WARDEN",
        name: `Warden — ${b.name}`,
        branchId: branch.id,
      },
    });
    console.log(`[ok]   Warden account created: ${username} / warden123 (${b.name})`);
  }

  // 4. Demo resident in Nazzal (bed 1 of a 2-seater) so the resident portal
  //    can be explored. Deletable from the Residents page like any record.
  if (!(await db.student.findUnique({ where: { studentId: "NZL-0001" } }))) {
    const nazzal = await db.branch.findUnique({ where: { code: "NZL" } });
    const room = await db.room.findUnique({ where: { roomNumber: "NZL-201" } });
    if (nazzal && room) {
      const student = await db.student.create({
        data: {
          studentId: "NZL-0001",
          name: "Hamza Tariq",
          email: "hamza.tariq@example.com",
          phone: "0300 1234567",
          gender: "MALE",
          cnic: "35202-1234567-1",
          university: "COMSATS University Islamabad",
          course: "BS Computer Science",
          department: "Computer Science",
          guardianName: "Tariq Mehmood",
          guardianPhone: "0301 7654321",
          address: "House 21, Street 4, Model Town, Lahore",
          branchId: nazzal.id,
          roomId: room.id,
          bedNumber: 1,
        },
      });
      await db.room.update({ where: { id: room.id }, data: { occupied: 1 } });
      await db.user.create({
        data: {
          username: "NZL-0001",
          passwordHash: hashPassword("resident123"),
          role: "RESIDENT",
          name: "Hamza Tariq",
          residentId: student.id,
        },
      });
      const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
      await db.payment.create({
        data: {
          studentId: student.id,
          branchId: nazzal.id,
          amount: room.monthlyFee,
          month,
          status: "PAID",
          method: "CASH",
          paidAt: new Date(),
        },
      });
      console.log(`[ok]   Demo resident created: NZL-0001 (Hamza Tariq) / resident123 — ${room.roomNumber}, Bed 1`);
    }
  } else {
    console.log(`[skip] Demo resident NZL-0001 already exists`);
  }

  const branches = await db.branch.count();
  const rooms = await db.room.count();
  const beds = await db.room.aggregate({ _sum: { capacity: true } });
  console.log(`\nDone. ${branches} branches · ${rooms} rooms · ${beds._sum.capacity ?? 0} beds total.`);
  console.log("Login: admin / admin123 (super admin — change this password after first login)");
  console.log("Wardens: warden.nazzal, warden.nooroxotel, warden.ayesha, warden.aqsa, warden.velvetrose / warden123");
  console.log("Demo resident: NZL-0001 / resident123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
