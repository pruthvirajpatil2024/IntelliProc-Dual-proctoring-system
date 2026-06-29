# ─── Stage 1: Build React frontend ───────────────────────────────────────────
FROM node:18-slim AS frontend-build

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps

COPY frontend/ ./
# BUILD_PATH=dist so the output matches what server.js expects at frontend/dist
RUN BUILD_PATH=dist npm run build

# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM node:18-slim

# Install Python3 and Java JDK for /run-python and /run-java endpoints
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    default-jdk-headless \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app

# Install root-level (backend) production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/ ./backend/

# Copy frontend static build from stage 1
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["node", "backend/server.js"]
