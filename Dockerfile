# syntax=docker/dockerfile:1
#
# Hostel Management System — production image (Next.js standalone + Prisma)
# Build:   docker build -t hostel-management .
# Run:     docker run -d --name hostel -p 3000:3000 \
#            -e DATABASE_URL="postgresql://..." hostel-management

# ---------- Stage 1: install & build ----------
FROM oven/bun:1 AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# prisma/ must be present before install so the postinstall hook
# (prisma generate) can find the schema
COPY package.json bun.lock ./
COPY prisma ./prisma
RUN bun install

# Build the standalone production server
COPY . .
RUN bun run build:standalone

# ---------- Stage 2: runtime ----------
FROM oven/bun:1 AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=build /app/.next/standalone ./

EXPOSE 3000
CMD ["bun", "server.js"]
