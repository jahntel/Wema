# Multi-stage build for both client and server
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci

# Install client dependencies
COPY client/package*.json ./client/
RUN cd client && npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY --from=deps /app/client/node_modules ./client/node_modules
COPY . .

# Build client
RUN cd client && npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy server files
COPY --chown=nextjs:nodejs server ./server
COPY --from=deps /app/server/node_modules ./server/node_modules

# Copy client build
COPY --from=builder --chown=nextjs:nodejs /app/client/.next/standalone ./client/
COPY --from=builder --chown=nextjs:nodejs /app/client/.next/static ./client/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/client/public ./client/public

USER nextjs

EXPOSE 3000
EXPOSE 5000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Start both services using a process manager
COPY start.sh ./
RUN chmod +x start.sh

CMD ["./start.sh"]