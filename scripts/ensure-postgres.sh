#!/bin/bash
# ensure-postgres.sh — idempotent: make sure the local PostgreSQL server is up
# before prisma touches it. Called automatically by `bun run db:push`.
# If no local server is installed (e.g. the project was deployed elsewhere and
# DATABASE_URL points to a remote database such as Neon), this is a no-op.
set -euo pipefail

PG_HOME="/home/z/my-project/pgserver"
PG_DATA="/home/z/my-project/pgdata"
PG_PORT=5432

# If the active DATABASE_URL points to a remote database (e.g. Neon), the local
# PostgreSQL server is irrelevant — skip it entirely so a broken/stale local
# cluster can never block schema pushes against the remote DB.
ACTIVE_URL="$(sed -n 's/^DATABASE_URL=//p' /home/z/my-project/.env 2>/dev/null | tail -1 | tr -d '"' || true)"
case "$ACTIVE_URL" in
  *localhost*|*127.0.0.1*|"") ;;  # local DB (or unset) → keep going
  *) echo "Remote DATABASE_URL detected — skipping local PostgreSQL."; exit 0 ;;
esac

# No local server installed → assume remote DB (e.g. Neon), nothing to do.
[ -x "$PG_HOME/bin/pg_ctl" ] || exit 0

# Already accepting connections → done.
if "$PG_HOME/bin/pg_isready" -h localhost -p "$PG_PORT" -q 2>/dev/null; then
  exit 0
fi

# If a postmaster.pid exists with a live PID, the server is mid-startup — wait it out.
PID_FILE="$PG_DATA/postmaster.pid"
if [ -f "$PID_FILE" ]; then
  PID=$(head -1 "$PID_FILE" 2>/dev/null || true)
  if [ -n "${PID:-}" ] && kill -0 "$PID" 2>/dev/null; then
    for _ in $(seq 1 30); do
      "$PG_HOME/bin/pg_isready" -h localhost -p "$PG_PORT" -q 2>/dev/null && exit 0
      sleep 1
    done
    exit 0
  fi
fi

# Start the server (crash recovery is automatic if it was killed uncleanly).
"$PG_HOME/bin/pg_ctl" -D "$PG_DATA" -l "$PG_DATA/server.log" -w -t 60 \
    start -o "-p $PG_PORT -c listen_addresses=localhost -k /tmp" >/dev/null 2>&1 || true

"$PG_HOME/bin/pg_isready" -h localhost -p "$PG_PORT" -q
