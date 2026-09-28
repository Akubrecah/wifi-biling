FROM node:20-alpine AS base

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copy root and package manifests
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN npm install

# Copy source code
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Generate Prisma Client & Build
RUN npm --workspace=@wifi-billing/database run generate
RUN npm --workspace=@wifi-billing/shared run build
RUN npm --workspace=@wifi-billing/database run build
RUN npm --workspace=@wifi-billing/api run build

EXPOSE 3001

CMD ["npm", "--workspace=@wifi-billing/api", "run", "start"]
