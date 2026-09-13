import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized, forbidden, notFound, badRequest } from "@/lib/auth";

// The mess (dining hall) is COMMON for all hostel branches — the same menu
// applies everywhere. Staff upload the menu file from their local machine.

const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf", "text/plain"];
const ALLOWED_MIME_EXACT = ["application/pdf", "text/plain"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function allowedMime(mime: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p)) || ALLOWED_MIME_EXACT.includes(mime);
}

// GET /api/mess-menu — list of uploaded menus (metadata only), newest first.
// Available to every signed-in user (staff and residents of all branches).
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();

    const menus = await db.messMenu.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        note: true,
        fileName: true,
        mimeType: true,
        size: true,
        active: true,
        createdAt: true,
        uploader: { select: { name: true, username: true } },
      },
    });
    return NextResponse.json(menus);
  } catch (error) {
    console.error("GET /api/mess-menu error:", error);
    return NextResponse.json({ error: "Failed to fetch mess menu" }, { status: 500 });
  }
}

// POST /api/mess-menu — upload a menu file (multipart/form-data: file, title, note).
// Staff only. The newest upload becomes the active menu shown to everyone.
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();
    if (user.role === "RESIDENT") return forbidden("Only hostel staff can upload the mess menu");

    const form = await req.formData();
    const file = form.get("file");
    const title = String(form.get("title") ?? "").trim();
    const note = String(form.get("note") ?? "").trim();

    if (!(file instanceof File) || file.size === 0) {
      return badRequest("Choose a menu file to upload (image, PDF or text)");
    }
    if (!allowedMime(file.type)) {
      return badRequest("Unsupported file type — upload an image, PDF or text file");
    }
    if (file.size > MAX_SIZE_BYTES) {
      return badRequest("File is too large — the menu must be under 5 MB");
    }
    if (!title) {
      return badRequest("Give the menu a title (e.g. Weekly Menu — September)");
    }

    const data = Buffer.from(await file.arrayBuffer()).toString("base64");

    // The new upload becomes the active menu; archive the previous one
    await db.messMenu.updateMany({ data: { active: false } });
    const menu = await db.messMenu.create({
      data: {
        title,
        note: note || null,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        data,
        active: true,
        uploadedBy: user.id,
      },
      select: {
        id: true,
        title: true,
        note: true,
        fileName: true,
        mimeType: true,
        size: true,
        active: true,
        createdAt: true,
        uploader: { select: { name: true, username: true } },
      },
    });

    return NextResponse.json(menu, { status: 201 });
  } catch (error) {
    console.error("POST /api/mess-menu error:", error);
    return NextResponse.json({ error: "Failed to upload mess menu" }, { status: 500 });
  }
}
