#!/bin/bash
# db-push.sh — wrapper around `prisma db push`
# The sandbox runner injects a default DATABASE_URL (sqlite) into every shell;
# we must drop it so Prisma reads the real connection string from .env instead
# (local PostgreSQL now, or Neon PostgreSQL when DATABASE_URL is switched).
set -euo pipefail
unset DATABASE_URL
cd /home/z/my-project
bash scripts/restore-env.sh   # self-heal .env if a sandbox reset reverted it to SQLite
bash scripts/ensure-postgres.sh
exec bunx prisma db push --accept-data-loss
