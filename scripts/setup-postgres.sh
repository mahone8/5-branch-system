#!/bin/bash
# setup-postgres.sh — Install & initialize a local PostgreSQL 17 server (no root required)
# Used by the Hostel Management System as its database backend.
# The same Prisma schema also works with Neon PostgreSQL (see DATABASE.md).
set -euo pipefail

PROJECT_DIR="/home/z/my-project"
TOOLS_DIR="$PROJECT_DIR/.tools"
MM_BIN="$TOOLS_DIR/bin/micromamba"
PG_HOME="$PROJECT_DIR/pgserver"       # conda env prefix containing postgres binaries
PG_DATA="$PROJECT_DIR/pgdata"          # database cluster data directory
PG_PORT=5432
PG_USER="hostel"
PG_PASSWORD="hostel123"
PG_DB="hostel"
export MAMBA_ROOT_PREFIX="$TOOLS_DIR/mamba-root"

log() { echo "[setup-postgres] $*"; }

# ---------------------------------------------------------------- 1. micromamba
if [ ! -x "$MM_BIN" ]; then
  log "Downloading micromamba..."
  mkdir -p "$TOOLS_DIR"
  curl -Ls https://micro.mamba.pm/api/micromamba/linux-64/latest | tar -xj -C "$TOOLS_DIR" bin/micromamba
fi
"$MM_BIN" --version

# ---------------------------------------------------------------- 2. postgresql
if [ ! -x "$PG_HOME/bin/postgres" ]; then
  log "Installing PostgreSQL into $PG_HOME (conda-forge)..."
  "$MM_BIN" create -y -q -p "$PG_HOME" -c conda-forge 'postgresql=17'
else
  log "PostgreSQL already installed at $PG_HOME"
fi

export PATH="$PG_HOME/bin:$PATH"
log "postgres binaries: $($PG_HOME/bin/postgres --version)"

# ---------------------------------------------------------------- 3. initdb
if [ ! -f "$PG_DATA/PG_VERSION" ]; then
  log "Initializing database cluster at $PG_DATA..."
  mkdir -p "$PG_DATA"
  PWFILE="$PROJECT_DIR/pgdata-pwfile"
  echo "$PG_PASSWORD" > "$PWFILE"
  initdb -D "$PG_DATA" -U "$PG_USER" --pwfile="$PWFILE" \
         --auth-local=trust --auth-host=scram-sha-256 -E UTF8
  rm -f "$PWFILE"
else
  log "Data directory already initialized"
fi

# ---------------------------------------------------------------- 4. start server
if "$PG_HOME/bin/pg_isready" -h localhost -p "$PG_PORT" -q; then
  log "PostgreSQL already running on port $PG_PORT"
else
  log "Starting PostgreSQL on port $PG_PORT..."
  "$PG_HOME/bin/pg_ctl" -D "$PG_DATA" -l "$PG_DATA/server.log" -w -t 60 \
      start -o "-p $PG_PORT -c listen_addresses=localhost -k /tmp"
fi

# ---------------------------------------------------------------- 5. create database
if "$PG_HOME/bin/psql" -h /tmp -U "$PG_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$PG_DB'" | grep -q 1; then
  log "Database '$PG_DB' already exists"
else
  log "Creating database '$PG_DB'..."
  "$PG_HOME/bin/createdb" -h /tmp -U "$PG_USER" "$PG_DB"
fi

log "Done. Connection string:"
log "postgresql://$PG_USER:$PG_PASSWORD@localhost:$PG_PORT/$PG_DB?schema=public"
