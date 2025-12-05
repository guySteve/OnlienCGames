# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build

# Stage 2: Build Backend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy Prisma schema
COPY prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate

# Stage 3: Runtime
FROM node:20-alpine

WORKDIR /app

# Install OpenSSL for Prisma runtime
RUN apk add --no-cache openssl

ENV NODE_ENV=production

# Copy application files first (to avoid overwriting node_modules)
COPY --chown=node:node . .

# Copy node_modules with generated Prisma Client from builder
COPY --from=builder --chown=node:node /app/node_modules ./node_modules

# Copy built frontend from frontend-builder
COPY --from=frontend-builder --chown=node:node /app/frontend/dist ./frontend/dist

EXPOSE 3000

# Make start script executable
RUN chmod +x start.sh

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["sh", "start.sh"]
