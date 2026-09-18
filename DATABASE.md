# Database Guide — GreenView Hostel Management System

The app uses **Prisma ORM** with **PostgreSQL**, currently pointed at a **Neon**
database (serverless Postgres). It is a real multi-branch system:

- **5 branches** (GV1 Central / GV2 North / GV3 South / GV4 East / GV5 West),
  each with **12 rooms / 36 beds** (3 floors × 2 Double + 2 Four-share)
- **Login-based**: super admin (`admin`), branch wardens (`warden.gv1`…`warden.gv5`)
  and **resident accounts that are generated automatically at check-in**
- Every branch has its own residents, payments and monthly earnings; the same
  menu is used for all branches (admin can switch branches in the header)

## Accounts (first-run)

| Role | Username | Password |
|------|----------|----------|
| Super Admin (all 5 branches) | `admin` | `admin123` |
| Branch Warden | `warden.gv1` … `warden.gv5` | `warden123` |
| Resident | auto-generated (e.g. `GV1-0001`) | random, shown once at check-in |

Change these passwords after first login (account menu → Change password).
Resident passwords can be reset from the Residents page (key icon).

### Schema (prisma/schema.prisma)

- **Branch** — the 5 hostels (code GV1–GV5, name, city, phone)
- **User** — login accounts (ADMIN / WARDEN / RESIDENT), scrypt password hashes
- **Session** — httpOnly-cookie login sessions (7-day expiry, DB-backed)
- **Student** — residents, scoped to a branch, auto IDs like `GV1-0007`
- **Room** — 12 rooms per branch, branch-prefixed numbers (e.g. `GV1-101`)
- **Payment** — monthly fee per resident (`@@unique([studentId, month])`), branch-tagged for earnings
- **Complaint** — maintenance requests with category/priority/status workflow
- **Visitor** — visit log with check-in / check-out times
- **Notice** — per-branch announcements

### Provisioning / resetting the system

```bash
bun run db:push   # create/refresh tables (non-destructive)
bun run init      # idempotent: create 5 branches + 60 rooms + admin & wardens
```

`scripts/init-system.ts` is safe to re-run — existing branches/accounts are
skipped. To start completely fresh: `bunx prisma db push --force-reset && bun run init`.

### Useful commands

```bash
bunx prisma studio     # visual database browser
pgserver/bin/psql "<DATABASE_URL from .env>"   # direct SQL access (local PG fallback)
```

## Switching to Neon PostgreSQL (production)

Neon (https://neon.tech) offers a free serverless Postgres tier. Two ways to switch:

**Option A — one command:**

```bash
bash scripts/switch-to-neon.sh "postgresql://USER:PASS@ep-xxxx-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

The script backs up `.env`, rewrites `DATABASE_URL`, and pushes the schema to
Neon (all 6 tables are created automatically).

**Option B — manual:**

1. Create a project at https://neon.tech (free plan is enough for this app)
2. Copy the **pooled** connection string from the project dashboard
   (it looks like `postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require`)
3. In `.env`, replace the `DATABASE_URL` line with it — keep `sslmode=require`
4. Run `bun run db:push` to create the tables on Neon
5. Restart the app / reload the dashboard — demo data auto-seeds an empty database,
   or POST `/api/seed` explicitly

No code changes are required: Neon is standard PostgreSQL, so Prisma, the API
routes and the UI all work identically.

## Migrating between databases (e.g. Neon → Nhost)

`scripts/migrate-db.mjs` copies **all data** (branches, users, sessions,
students, rooms, payments, complaints, visitors, notices, mess menus,
expenses) from one Postgres database to another, preserving every ID, and
verifies row counts when done:

```bash
SOURCE_DATABASE_URL="postgres://…old…" \
TARGET_DATABASE_URL="postgres://…new…" \
node scripts/migrate-db.mjs
```

- It applies the Prisma schema to the target first, so the target can be empty.
- It refuses to run if the target already has data (re-run with `CLEAN=1` to
  wipe the target and start fresh, e.g. after a failed half-run).
- Prefer the **direct** connection (port 5432) while migrating. For serverless
  hosts (Vercel), put the **pooled** endpoint in `DATABASE_URL` instead — if it
  goes through PgBouncer (port 6543), also append `&pgbouncer=true`.
- After migrating: update `DATABASE_URL` in Vercel → Settings → Environment
  Variables, redeploy, verify the app, and only then delete the old database.

## Notes

- The sandbox runner injects a default `DATABASE_URL` (sqlite) into every shell.
  `package.json` scripts (`dev`, `db:push`) strip it with `env -u DATABASE_URL`
  so the value from `.env` always wins.
- Local PostgreSQL files (`pgserver/`, `pgdata/`) are only needed for local
  development; deployments that use Neon can ignore them entirely.
- SQLite is history: the old `db/custom.db` file remains only as a backup of
  the previous demo dataset.
