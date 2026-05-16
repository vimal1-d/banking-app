# ══════════════════════════════════════════════════════
#  Backend Dockerfile — Multi-stage, production-ready
# ══════════════════════════════════════════════════════

# ── Stage 1: Install dependencies ─────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files (* means package-lock.json is optional)
COPY package.json package-lock.json* ./

# npm install works with OR without lock file
# After first run on your machine: commit package-lock.json for faster builds
RUN npm install --omit=dev --no-audit --no-fund && \
    npm cache clean --force

# ── Stage 2: Production image ──────────────────────────
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init wget

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser  -S nodeapp -u 1001 -G nodejs

WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps --chown=nodeapp:nodejs /app/node_modules ./node_modules

# Copy source code
COPY --chown=nodeapp:nodejs src/ ./src
COPY --chown=nodeapp:nodejs package.json ./

# Switch to non-root user
USER nodeapp

EXPOSE 5000

# Use dumb-init to handle signals properly (SIGTERM for graceful shutdown)
ENTRYPOINT ["dumb-init", "--"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5000/health | grep -q '"status":"ok"' || exit 1

CMD ["node", "src/server.js"]
