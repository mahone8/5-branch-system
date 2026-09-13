import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const SESSION_COOKIE = 'hms_session'
const SESSION_DAYS = 7

// ---------------------------------------------------------------- passwords

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = crypto.scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return (
    candidate.length === expected.length &&
    crypto.timingSafeEqual(candidate, expected)
  )
}

/** Random readable password (no ambiguous characters) for resident accounts. */
export function generatePassword(length = 10): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

// ---------------------------------------------------------------- sessions

export interface SessionUser {
  id: string
  username: string
  role: string // ADMIN | WARDEN | RESIDENT
  name: string | null
  active: boolean
  branchId: string | null
  branch: { id: string; code: string; name: string } | null
  residentId: string | null
  resident: {
    id: string
    studentId: string
    name: string
    branchId: string
    roomId: string | null
    branch: { code: string; name: string } | null
  } | null
}

export async function createSession(userId: string): Promise<{
  token: string
  expiresAt: Date
}> {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000)
  await db.session.create({ data: { token, userId, expiresAt } })
  return { token, expiresAt }
}

export function sessionCookie(token: string, expiresAt: Date, req?: NextRequest) {
  // Behind the HTTPS preview proxy the app can be embedded in a cross-site
  // iframe (chat preview panel). SameSite=Lax cookies are silently dropped
  // there — login returns 200 but the session never reaches /api/auth/me.
  // Detect the proxied HTTPS context and relax the cookie accordingly.
  const isHttps =
    (req?.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https') ||
    (req?.headers.get('cf-visitor')?.includes('"scheme":"https"') ?? false) ||
    (req?.nextUrl.protocol === 'https:')
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    secure: isHttps,
    path: '/',
    expires: expiresAt,
  }
}

export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  const session = await db.session.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          branch: { select: { id: true, code: true, name: true } },
          resident: {
            select: {
              id: true,
              studentId: true,
              name: true,
              branchId: true,
              roomId: true,
              branch: { select: { code: true, name: true } },
            },
          },
        },
      },
    },
  })
  if (!session) return null
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined)
    return null
  }
  const u = session.user
  if (!u.active) return null
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    name: u.name,
    active: u.active,
    branchId: u.branchId,
    branch: u.branch,
    residentId: u.residentId,
    resident: u.resident,
  }
}

// ---------------------------------------------------------------- scoping

/**
 * Which branch's data the current request should operate on.
 * - WARDEN   -> always their own branch
 * - RESIDENT -> the branch of their resident record
 * - ADMIN    -> x-branch-id header, falling back to the first branch
 */
export async function resolveBranchId(
  req: NextRequest,
  user: SessionUser
): Promise<string | null> {
  if (user.role === 'WARDEN') return user.branchId
  if (user.role === 'RESIDENT') return user.resident?.branchId ?? null
  const header = req.headers.get('x-branch-id')
  if (header) {
    const branch = await db.branch.findUnique({ where: { id: header } })
    if (branch) return branch.id
  }
  const first = await db.branch.findFirst({ orderBy: { code: 'asc' } })
  return first?.id ?? null
}

// ---------------------------------------------------------------- guards

export function unauthorized(msg = 'Authentication required') {
  return NextResponse.json({ error: msg }, { status: 401 })
}

export function forbidden(msg = 'You do not have permission for this action') {
  return NextResponse.json({ error: msg }, { status: 403 })
}

export function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 })
}

export function notFound(msg = 'Not found') {
  return NextResponse.json({ error: msg }, { status: 404 })
}
