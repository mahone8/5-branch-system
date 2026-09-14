export interface Branch {
  id: string;
  code: string;
  name: string;
  city: string | null;
  phone: string | null;
  totalBeds?: number;
  occupiedBeds?: number;
  activeResidents?: number;
}

export interface AuthUser {
  id: string;
  username: string;
  role: string; // ADMIN | WARDEN | RESIDENT
  name: string | null;
  branchId: string | null;
  branch: { id: string; code: string; name: string } | null;
  residentId: string | null;
  resident: {
    id: string;
    studentId: string;
    name: string;
    branchId: string;
    roomId: string | null;
    branch: { code: string; name: string } | null;
  } | null;
}

export interface ResidentAccount {
  username: string;
  password: string;
}

export interface Room {
  id: string;
  roomNumber: string;
  block: string;
  floor: number;
  type: string;
  capacity: number;
  occupied: number;
  status: string;
  monthlyFee: number;
  branchId: string;
  students?: { id: string; studentId: string; name: string; phone?: string; bedNumber?: number | null }[];
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  id: string;
  studentId: string;
  name: string;
  email: string | null;
  phone: string;
  gender: string;
  cnic: string | null;
  university: string | null;
  course: string | null;
  department: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  address: string | null;
  status: string;
  checkInDate: string;
  checkOutDate: string | null;
  branchId: string;
  branch?: { code: string; name: string } | null;
  roomId: string | null;
  room: Room | null;
  bedNumber?: number | null;
  account?: { username: string; active: boolean } | null;
  payments?: Payment[];
  complaints?: Complaint[];
  visitors?: Visitor[];
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  studentId: string;
  amount: number;
  month: string;
  status: string;
  method: string | null;
  paidAt: string | null;
  createdAt: string;
  student: {
    id: string;
    studentId: string;
    name: string;
    roomId: string | null;
    room: { roomNumber: string; block: string } | null;
  };
}

export interface Complaint {
  id: string;
  studentId: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  student: {
    studentId: string;
    name: string;
    roomId: string | null;
    room?: { roomNumber: string } | null;
  };
}

export interface Visitor {
  id: string;
  name: string;
  phone: string | null;
  studentId: string;
  purpose: string | null;
  checkIn: string;
  checkOut: string | null;
  student: {
    studentId: string;
    name: string;
    room: { roomNumber: string } | null;
  };
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  priority: string;
  createdAt: string;
}

export interface DashboardData {
  branch: { id: string; code: string; name: string; city: string | null } | null;
  month: string;
  students: { total: number; active: number; checkedOut: number };
  rooms: {
    total: number;
    maintenance: number;
    available: number;
    full: number;
    totalBeds: number;
    occupiedBeds: number;
    occupancyRate: number;
  };
  finance: {
    totalCollected: number;
    totalPending: number;
    paidCount: number;
    pendingCount: number;
    monthCollected: number;
    monthPendingAmount: number;
    monthPaidCount: number;
    monthPendingCount: number;
  };
  complaints: {
    open: number;
    inProgress: number;
    recent: {
      id: string;
      title: string;
      status: string;
      priority: string;
      category: string;
      createdAt: string;
      studentName: string;
    }[];
  };
  visitors: { active: number };
  notices: Notice[];
  charts: {
    revenueTrend: { month: string; amount: number }[];
    occupancyByFloor: { floor: number; capacity: number; occupied: number }[];
    roomTypes: { type: string; count: number }[];
  };
  branchesOverview:
    | {
        id: string;
        code: string;
        name: string;
        city: string | null;
        totalBeds: number;
        occupiedBeds: number;
        occupancyRate: number;
        activeResidents: number;
        earningsThisMonth: number;
      }[]
    | null;
}

export interface MessMenu {
  id: string;
  title: string;
  note: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  active: boolean;
  createdAt: string;
  uploader: { name: string | null; username: string };
}

export const ROOM_TYPES = [
  { value: "SINGLE", label: "1-Seater", capacity: 1 },
  { value: "DOUBLE", label: "2-Seater", capacity: 2 },
  { value: "TRIPLE", label: "3-Seater", capacity: 3 },
] as const;

export function roomTypeLabel(type: string): string {
  return ROOM_TYPES.find((t) => t.value === type)?.label ?? type;
}

export const CATEGORIES = [
  { value: "ELECTRICAL", label: "Electrical" },
  { value: "PLUMBING", label: "Plumbing" },
  { value: "CLEANLINESS", label: "Cleanliness" },
  { value: "FURNITURE", label: "Furniture" },
  { value: "INTERNET", label: "Internet" },
  { value: "OTHER", label: "Other" },
] as const;

export const MONTH_LABELS: Record<string, string> = {
  "01": "Jan",
  "02": "Feb",
  "03": "Mar",
  "04": "Apr",
  "05": "May",
  "06": "Jun",
  "07": "Jul",
  "08": "Aug",
  "09": "Sep",
  "10": "Oct",
  "11": "Nov",
  "12": "Dec",
};

export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${MONTH_LABELS[m] ?? m} ${y.slice(2)}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");
}

// WhatsApp click-to-send share URL. Without a phone number, wa.me opens the
// WhatsApp contact picker with the message pre-filled, so the sender chooses
// which chat (warden, maintenance, group) to forward the complaint to.
export function complaintWhatsAppText(complaint: Complaint): string {
  const room = complaint.student.room?.roomNumber;
  const category =
    CATEGORIES.find((c) => c.value === complaint.category)?.label ?? complaint.category;
  const lines = [
    "🏠 *Hostel Complaint*",
    "",
    `*Title:* ${complaint.title}`,
    `*Student:* ${complaint.student.name} (${complaint.student.studentId})`,
  ];
  if (room) lines.push(`*Room:* ${room}`);
  lines.push(
    `*Category:* ${category}`,
    `*Priority:* ${titleCase(complaint.priority)}`,
    `*Status:* ${titleCase(complaint.status)}`,
    `*Filed:* ${formatDateTime(complaint.createdAt)}`,
    "",
    "*Description:*",
    complaint.description,
  );
  return lines.join("\n");
}

export function complaintWhatsAppUrl(complaint: Complaint): string {
  return `https://wa.me/?text=${encodeURIComponent(complaintWhatsAppText(complaint))}`;
}
