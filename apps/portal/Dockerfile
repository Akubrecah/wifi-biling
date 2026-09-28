FROM node:20-alpine AS base

WORKDIR /app

# Copy root and package manifests
COPY package.json package-lock.json* ./
COPY apps/portal/package.json ./apps/portal/

# Install dependencies
RUN npm install

# Copy source code and assets
COPY tsconfig.base.json ./
COPY apps/portal/ ./apps/portal/

# Build TypeScript & copy public assets
RUN npm --workspace=@wifi-billing/portal run build

EXPOSE 3000

CMD ["npm", "--workspace=@wifi-billing/portal", "run", "start"]
