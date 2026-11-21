# Use Node.js 20 runtime
FROM node:20-alpine AS base

# Install gosu for non-root user
RUN apk add --no-cache gosu

# Install PM2 globally
RUN npm install -g pm2

# Development stage
FROM base AS dev
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

# Start dev server (not production-ready)
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --production

# Copy source code
COPY . .

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 api
RUN mkdir -p /app/node_modules && chown -R api:nodejs /app

USER api

# Copy migrations
COPY prisma ./prisma
CMD ["npx", "prisma", "migrate", "deploy"]

# Start application
CMD ["pm2-runtime", "dist/server.js"]