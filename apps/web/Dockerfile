# Base stage
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies only
FROM base AS deps
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package.json package-lock.json* turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/

# Install all dependencies
RUN npm ci

# Development stage
FROM deps AS development
WORKDIR /app

# Copy source code
COPY apps/web ./apps/web
COPY packages ./packages
COPY tsconfig.base.json ./

EXPOSE 3000
CMD ["npm", "run", "dev", "--workspace=apps/web"]

# Builder stage
FROM deps AS builder
WORKDIR /app

# Set environment for build
ENV NEXT_TELEMETRY_DISABLED 1

# Copy all source
COPY . .

# Build the application
RUN npm run build --workspace=apps/web

# Production stage
FROM base AS production
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED 1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "apps/web/server.js"]
