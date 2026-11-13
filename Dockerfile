# ==============================================================================
# Dockerfile Multi-Stage untuk Deployment Next.js Standalone
# Kompatibel dengan Render, Koyeb, Railway, VPS, atau Container Cloud Lainnya
# ==============================================================================

# 1. Base Image: Node.js 20 LTS Alpine (Ringan & Cepat)
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# 2. Dependencies Stage
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci

# 3. Builder Stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variable untuk standalone build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV BUILD_STANDALONE=true

# Generate Prisma Client & Build Next.js
RUN npx prisma generate
RUN npm run build

# 4. Production Runner Stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Buat non-root user demi keamanan
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Siapkan folder uploads jika berjalan di container
RUN mkdir -p public/uploads && chown -R nextjs:nodejs public/uploads

# Salin aset statis & hasil build standalone
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
