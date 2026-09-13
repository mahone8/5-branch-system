#!/bin/bash
# switch-to-neon.sh — point the Hostel Management System at a Neon PostgreSQL database
#
# Usage:
#   bash scripts/switch-to-neon.sh "postgresql://user:pass@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
#
# What it does:
#   1. Validates the connection string
#   2. Rewrites DATABASE_URL in .env (keeps a timestamped backup)
#   3. Pushes the Prisma schema to Neon (creates all 6 tables)
#   4. Reminds you how to seed demo data
set -euo pipefail

NEON_URL="${1:-}"
PROJECT_DIR="/home/z/my-project"

if [ -z "$NEON_URL" ]; then
  echo "Usage: bash scripts/switch-to-neon.sh \"postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require\""
  echo ""
  echo "Get your connection string from the Neon dashboard (https://neon.tech):"
  echo "  Project -> Dashboard -> Connection string (pooled connection recommended)"
  exit 1
fi

case "$NEON_URL" in
  postgresql://*|postgres://*) ;;
  *) echo "ERROR: the URL must start with postgresql:// or postgres://"; exit 1 ;;
esac
if [[ "$NEON_URL" != *neon.tech* ]]; then
  echo "WARNING: URL does not look like a Neon endpoint (no 'neon.tech' found) — continuing anyway."
fi

# 1. backup current .env
cp "$PROJECT_DIR/.env" "$PROJECT_DIR/.env.backup.$(date +%Y%m%d-%H%M%S)"

# 2. rewrite DATABASE_URL (the active, non-commented line)
python3 - "$PROJECT_DIR/.env" "$NEON_URL" <<'PY'
import sys, re
path, url = sys.argv[1], sys.argv[2]
lines = open(path).read().splitlines(keepends=False)
out, replaced = [], False
for line in lines:
    if line.startswith("DATABASE_URL="):
        out.append(f'DATABASE_URL="{url}"')
        replaced = True
    else:
        out.append(line)
if not replaced:
    out.insert(0, f'DATABASE_URL="{url}"')
open(path, "w").write("\n".join(out) + "\n")
print("DATABASE_URL updated in .env")
PY

# 3. push schema to Neon
echo "Pushing Prisma schema to Neon..."
cd "$PROJECT_DIR"
unset DATABASE_URL
bunx prisma db push --accept-data-loss

echo ""
echo "Done! The app now uses Neon PostgreSQL."
echo "Seed demo data:  curl -X POST http://localhost:3000/api/seed"
echo "(The dashboard also auto-seeds on first load when the database is empty.)"
echo "Switch back to local PostgreSQL anytime with:"
echo "  DATABASE_URL=\"postgresql://hostel:hostel123@localhost:5432/hostel?schema=public\" in .env"
