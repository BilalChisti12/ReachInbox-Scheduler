# =============================================================================
# Stage 1: Builder
# Installs ALL dependencies (including devDependencies for TypeScript compiler
# and Prisma CLI), generates the Prisma client, and compiles TypeScript.
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first — Docker caches this layer so `npm ci` only
# re-runs when package.json or package-lock.json changes.
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (devDependencies needed for tsc + prisma CLI)
RUN npm ci

# Generate Prisma client for the current platform (linux/arm64 on Oracle Ampere)
RUN npx prisma generate

# Copy TypeScript config and source files
COPY tsconfig.json ./
COPY src ./src/

# Compile TypeScript -> JavaScript into /app/dist/
RUN npm run build

# =============================================================================
# Stage 2: Production
# Copies only compiled output + production node_modules.
# Final image is much smaller (no devDependencies, no TypeScript source).
# =============================================================================
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install ONLY production dependencies
RUN npm ci --omit=dev

# Generate Prisma client (needed at runtime, not just build time)
RUN npx prisma generate

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist/

# Create a non-root user for security best practices
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 5000

# Default command runs the API server.
# The docker-compose.prod.yml overrides this for the worker container.
CMD ["node", "dist/server.js"]
