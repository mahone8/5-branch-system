import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// GET /api/mess-menu/[id] — serve the stored menu file itself (binary).
// Any signed-in user can view it: the mess is common for all hostels.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const menu = await db.messMenu.findUnique({ where: { id } });
    if (!menu) return notFound("Menu not found");

    const buffer = Buffer.from(menu.data, "base64");
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": menu.mimeType,
        "Content-Length": String(buffer.length),
        // inline for images/PDF/text so <img>/<iframe>/<pre> render it directly
        "Content-Disposition": `inline; filename="${encodeURIComponent(menu.fileName)}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    console.error("GET /api/mess-menu/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch menu file" }, { status: 500 });
  }
}

// DELETE /api/mess-menu/[id] — remove an uploaded menu (staff only).
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();
    if (user.role === "RESIDENT") return forbidden("Only hostel staff can manage the mess menu");

    const { id } = await params;
    const existing = await db.messMenu.findUnique({ where: { id } });
    if (!existing) return notFound("Menu not found");

    await db.messMenu.delete({ where: { id } });

    // Promote the newest remaining upload to be the active menu
    const newest = await db.messMenu.findFirst({ orderBy: { createdAt: "desc" } });
    if (newest && !newest.active) {
      await db.messMenu.update({ where: { id: newest.id }, data: { active: true } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/mess-menu/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete menu" }, { status: 500 });
  }
}
