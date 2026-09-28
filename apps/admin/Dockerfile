FROM node:20-alpine AS base

WORKDIR /app

# Copy root and package manifests
COPY package.json package-lock.json* ./
COPY apps/admin/package.json ./apps/admin/

# Install dependencies
RUN npm install

# Copy source code and assets
COPY tsconfig.base.json ./
COPY apps/admin/ ./apps/admin/

# Build TypeScript & copy public assets
RUN npm --workspace=@wifi-billing/admin run build

EXPOSE 3002

CMD ["npm", "--workspace=@wifi-billing/admin", "run", "start"]
