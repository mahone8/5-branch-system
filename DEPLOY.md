# Deploying the Hostel Management System

This guide takes the app from a dev machine to a live URL you can hand to your
client. Pick **Option A (Vercel)** if you want the fastest, free path.

## What you are deploying

| Piece | Where it lives |
|---|---|
| Next.js 16 app (this repo) | The hosting provider you pick below |
| PostgreSQL database | Neon cloud — already live with your 5 branches |
| Mess-menu files | Stored inside the database (no disk storage needed) |
| Login sessions | Database + httpOnly cookie (HTTPS is auto-detected) |

The app is **stateless** — it can be hosted anywhere. All your current data
(branches Nazzal, Nooroxotel, Ayesha, Aqsa, Velvetrose; rooms; accounts) already
lives in your Neon database. Every deployment below connects to it with a single
environment variable: `DATABASE_URL`.

## Step 0 — push the code to GitHub (needed by all options)

The repository is already cleaned: **no secrets and no build junk are committed**
(the real connection string lives only in `.env`, which is gitignored, and in
the hosting provider's dashboard).

1. Create a **private** repository on github.com, e.g. `hostel-management`.
2. From the project folder:

   ```bash
   git remote add origin https://github.com/<your-username>/hostel-management.git
   git push -u origin main
   ```

Keep the repo **private** — the code is your work product for the client.

---

## Option A — Vercel (recommended · free · ~10 minutes)

Vercel is built by the Next.js team, so this stack is zero-config there.

1. Go to **vercel.com** → sign up (free) with the GitHub account.
2. **Add New → Project** → **Import** the `hostel-management` repository.
3. Framework preset: **Next.js** (auto-detected) — leave all build settings at
   their defaults.
4. Open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | your Neon connection string (same one as in `.env`) |

5. Click **Deploy** — the first build takes ~2–3 minutes.
6. You get a live URL like `https://hostel-management.vercel.app`. Log in with
   `admin / admin123` to verify real data is loading.

**Custom domain for the client:** Project → **Settings → Domains** → add e.g.
`manage.yourclient.com`, then follow the DNS instructions (one A / CNAME record
at the domain registrar). The HTTPS certificate is issued automatically.

> **Vercel caveat:** serverless functions accept request bodies up to ~4.5 MB.
> Mess-menu uploads are capped at 5 MB by the app itself — on Vercel keep menu
> files under ~4 MB (compress images / PDFs), or use Option B / C.

---

## Option B — Railway (~$5/month)

A long-running server — no upload-size limits, same database.

1. Go to **railway.app** → sign up with GitHub → **New Project → Deploy from
   GitHub repo** → pick `hostel-management`.
2. In the service **Variables** tab, add `DATABASE_URL` (same Neon string).
3. In **Settings → Deploy**, set:
   - Build Command: `npm run build:standalone`
   - Start Command: `npm run start:node`
4. Deploy, then attach a domain in **Settings → Networking → Generate Domain**
   (HTTPS is automatic).

---

## Option C — any VPS with Docker (Hetzner / DigitalOcean / Contabo, ~$4–6/month)

A production `Dockerfile` is included in the repo.

```bash
git clone https://github.com/<your-username>/hostel-management.git
cd hostel-management
docker build -t hostel-management .

docker run -d --name hostel -p 3000:3000 --restart unless-stopped \
  -e DATABASE_URL="postgresql://...your Neon connection string..." \
  hostel-management
```

The app listens on container port 3000. Put a reverse proxy with HTTPS in front
of it — the easiest is Caddy (automatic certificates), using a `Caddyfile`
containing:

```
manage.yourclient.com {
    reverse_proxy 127.0.0.1:3000
}
```

---

## Giving the client a FRESH database (optional, but cleanest for handover)

Your current Neon database belongs to **your** account. If the client should own
their data:

1. The client creates a free account at **neon.tech** → new project → copies
   the **pooled** connection string.
2. On any machine with this repo and Node.js 20+:

   ```bash
   cp .env.example .env        # paste the client's connection string inside
   npm install
   npx prisma db push          # creates all tables
   npx tsx scripts/init-system.ts   # provisions branches, rooms, accounts
   ```

3. Deploy exactly as in Option A/B/C, but with the **client's** `DATABASE_URL`.

`scripts/init-system.ts` is idempotent (safe to re-run) and provisions the 5
branches × 13 rooms (1/2/3-seaters) plus all staff accounts.

---

## Handover checklist

- [ ] Change every default password on first login (admin, wardens)
- [ ] Delete the demo resident (`NZL-0001`) if the client wants an empty system
- [ ] Point the client's domain at the deployment (DNS step above)
- [ ] Decide database ownership: your Neon (fastest) or the client's Neon (clean
      handover — see section above)
- [ ] Transfer the GitHub repo and the hosting project to the client if they
      will maintain it (GitHub: Settings → Transfer ownership; Vercel: Project →
      Settings → Transfer)
- [ ] Take a database backup before going live (Neon dashboard → project →
      branch → **Export/backup**)

## Default accounts (change immediately after handover)

| Role | Username | Password |
|---|---|---|
| Super admin | `admin` | `admin123` |
| Warden — Nazzal | `warden.nazzal` | `warden123` |
| Warden — Nooroxotel | `warden.nooroxotel` | `warden123` |
| Warden — Ayesha | `warden.ayesha` | `warden123` |
| Warden — Aqsa | `warden.aqsa` | `warden123` |
| Warden — Velvetrose | `warden.velvetrose` | `warden123` |
| Demo resident | `NZL-0001` | `resident123` |

## Environment variables reference

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string; use the Neon **pooled** endpoint for serverless hosts |

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Login failed" on the deployed site | `DATABASE_URL` missing or wrong in the host dashboard env vars |
| First page load takes ~5–10 s | Neon free-tier cold start — normal; warms up after the first request |
| Mess-menu upload fails | File is over ~4 MB on Vercel → compress it, or host on Railway / VPS |
| 500 errors after a redeploy | Check the env variables survived the redeploy in the host dashboard |
