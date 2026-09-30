# Production VPS Deployment Guide
## Carrier-Grade WiFi Hotspot Billing & Management Platform

This guide walks you through deploying the complete WiFi Billing stack onto a fresh **Ubuntu 22.04 / 24.04 LTS VPS** (DigitalOcean, Linode, AWS EC2, Contabo, or Hetzner).

---

## 1. System Requirements & Architecture

### Minimum VPS Specifications
* **CPU**: 2 vCPUs
* **RAM**: 2 GB (4 GB recommended for high concurrent sessions)
* **Disk**: 25 GB SSD / NVMe
* **OS**: Ubuntu 22.04 LTS or 24.04 LTS
* **Network**: 1 Static Public IPv4 Address
* **Domain / DNS**:
  - `billing.yourdomain.com` (pointing to VPS Public IP) OR
  - `portal.yourdomain.com` (pointing to VPS Public IP)

---

## 2. Server Preparation & Security Hardening

Connect to your VPS via SSH as root:
```bash
ssh root@<YOUR_VPS_PUBLIC_IP>
```

### 2.1 Update System & Install Dependencies
```bash
apt update && apt upgrade -y
apt install -y git curl wget ufw certbot fail2ban ca-certificates gnupg lsb-release
```

### 2.2 Configure Firewall (UFW)
Open strictly necessary ports for web ingress and RADIUS AAA:
```bash
# Allow SSH
ufw allow 22/tcp

# Allow Web Traffic (Captive Portal, API, Admin)
ufw allow 80/tcp
ufw allow 443/tcp

# Allow RADIUS Authentication & Accounting from MikroTik Router(s)
ufw allow 1812/udp comment 'RADIUS Authentication'
ufw allow 1813/udp comment 'RADIUS Accounting'

# Allow RADIUS Packet of Disconnect / CoA
ufw allow 3799/udp comment 'RADIUS CoA / Disconnect'

# Enable Firewall
ufw --force enable
ufw status verbose
```
> [!IMPORTANT]
> **PostgreSQL (5432)** and **Redis (6379)** are kept internal to the Docker bridge network. They are **NOT** opened to the public internet.

---

## 3. Install Docker Engine & Docker Compose

```bash
# Add Docker's official GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker packages
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

---

## 4. Obtain SSL / TLS Certificates (Let's Encrypt)

Stop any service using port 80 temporarily and generate certificates for your domain:
```bash
# Replace billing.yourdomain.com with your real domain
export DOMAIN="billing.yourdomain.com"
export EMAIL="admin@yourdomain.com"

certbot certonly --standalone -d $DOMAIN --non-interactive --agree-tos -m $EMAIL
```

Your certificates will be stored in:
`/etc/letsencrypt/live/$DOMAIN/fullchain.pem`
`/etc/letsencrypt/live/$DOMAIN/privkey.pem`

---

## 5. Clone Repository & Setup Environment

```bash
# Clone the repository
git clone https://github.com/your-username/wifi-billing-system.git /opt/wifi-billing
cd /opt/wifi-billing

# Create production environment configuration
cp .env.example .env
```

Edit `.env` with production secrets:
```bash
nano .env
```

### Production Configuration Reference:
```env
# ==============================================================================
# PRODUCTION ENVIRONMENT CONFIGURATION
# ==============================================================================
NODE_ENV=production
LOG_LEVEL=info

# PostgreSQL
POSTGRES_USER=wifibilling
POSTGRES_PASSWORD=GENERATE_STRONG_RANDOM_PASSWORD_HERE
POSTGRES_DB=wifi_billing_db
POSTGRES_PORT=5432
DATABASE_URL=postgresql://wifibilling:GENERATE_STRONG_RANDOM_PASSWORD_HERE@postgres:5432/wifi_billing_db?schema=public

# Redis
REDIS_URL=redis://redis:6379

# Application Ports & URLs
API_PORT=3001
API_HOST=0.0.0.0
PORTAL_PORT=3000
PORTAL_HOST=0.0.0.0
ADMIN_PORT=3002
ADMIN_HOST=0.0.0.0
APP_SECRET_KEY=GENERATE_64_CHAR_HEX_SECRET_FOR_JWT_AND_SESSIONS

# FreeRADIUS AAA Shared Secret (MUST match the secret on MikroTik Router)
RADIUS_SECRET=STRONG_COMPLEX_RADIUS_SECRET_HERE

# Safaricom M-Pesa Daraja Production Credentials
MPESA_ENVIRONMENT=production
MPESA_CONSUMER_KEY=YOUR_PRODUCTION_CONSUMER_KEY
MPESA_CONSUMER_SECRET=YOUR_PRODUCTION_CONSUMER_SECRET
MPESA_PASSKEY=YOUR_PRODUCTION_LIPA_NA_MPESA_PASSKEY
MPESA_SHORTCODE=YOUR_PAYBILL_OR_TILL_NUMBER
MPESA_CALLBACK_URL=https://billing.yourdomain.com/api/webhooks/mpesa

# Primary MikroTik Gateway
MIKROTIK_HOST=ROUTER_IP_OR_VPN_IP
MIKROTIK_API_PORT=8729
MIKROTIK_USERNAME=api_billing
MIKROTIK_PASSWORD=SECURE_ROUTER_API_PASSWORD
```

---

## 6. Configure Production Nginx with SSL

Create or update `/opt/wifi-billing/infrastructure/docker/nginx/nginx.prod.conf`:

```nginx
events {
    worker_connections 2048;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript image/svg+xml;

    upstream portal_service { server portal:3000; }
    upstream api_service    { server api:3001; }
    upstream admin_service  { server admin:3002; }

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }

    # Production HTTPS Server
    server {
        listen 443 ssl http2;
        server_name _;

        ssl_certificate /etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/YOUR_DOMAIN/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Captive Portal Probe Redirections (RFC 8952 / Android / Apple)
        location /generate_204 { return 302 /hotspot; }
        location /hotspot-detect.html { return 302 /hotspot; }
        location /ncsi.txt { return 302 /hotspot; }

        # Backend API
        location /api/ {
            proxy_pass http://api_service;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 90s;
        }

        # Admin Dashboard
        location /admin/ {
            proxy_pass http://admin_service/;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Captive Portal Frontend
        location / {
            proxy_pass http://portal_service;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

Mount certificates into Nginx in `docker-compose.yml`:
```yaml
    volumes:
      - ./infrastructure/docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
```

---

## 7. Build, Migrate & Launch the Stack

### 7.1 Start Database & Cache
```bash
docker compose up -d postgres redis
```

### 7.2 Run Prisma Migrations & Seed Default Data
```bash
# Install root node dependencies to run prisma migrations
npm ci

# Run schema migrations against production Postgres
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma

# Seed initial superadmin user and default billing plans
npm run seed --workspace=@wifi-billing/database
```

### 7.3 Start Entire Stack
```bash
docker compose up -d --build
```

### 7.4 Verify Running Containers
```bash
docker compose ps
```
All services (`wifi_billing_postgres`, `wifi_billing_redis`, `wifi_billing_freeradius`, `wifi_billing_api`, `wifi_billing_portal`, `wifi_billing_admin`, `wifi_billing_nginx`) should report `Up (healthy)` or `Up`.

---

## 8. Post-Deployment Verification

### 8.1 Verify FreeRADIUS AAA
Test local RADIUS authentication directly inside the container:
```bash
docker exec -it wifi_billing_freeradius radtest testuser testpass 127.0.0.1 0 testing123_production_radius_secret
```
Expected output:
```text
Received Access-Accept Id ...
Mikrotik-Rate-Limit = "5M/2M"
```

### 8.2 Verify API Gateway Health
```bash
curl -I http://169.58.96.131:3001/health
# Expected: HTTP/1.1 200 OK
```

### 8.3 Automated Postgres Backup Cron
Add a daily database backup to `crontab -e`:
```bash
0 2 * * * docker exec wifi_billing_postgres pg_dump -U wifibilling wifi_billing_db | gzip > /var/backups/wifi_billing_$(date +\%F).sql.gz
```

---

## 9. Hybrid Deployment: Frontends on Vercel + Backend on VPS 169.58.96.131

In this optimal carrier architecture:
* **Vercel** hosts:
  - `apps/admin`: Admin Management & Analytics Platform (global CDN, instant updates, custom domain).
  - `apps/portal` (Optional): Fast, CDN-cached Captive Portal.
* **VPS (`169.58.96.131`)** hosts:
  - FreeRADIUS 3.x (UDP 1812/1813/3799)
  - PostgreSQL 16 & Redis 7
  - Fastify Core API & BullMQ Expiry Worker (Port 3001)

### 9.1 Deploy Admin Dashboard to Vercel
1. Install Vercel CLI locally or push this repository to GitHub/GitLab:
```bash
npm install -g vercel
```
2. Navigate to `apps/admin` and deploy:
```bash
cd apps/admin
vercel
```
* **Project Name**: `wifi-billing-admin`
* **Root Directory**: `apps/admin`
* **Output Directory**: `public`
* The included `apps/admin/vercel.json` automatically proxies `/api/*` requests to `http://169.58.96.131:3001/api/*`.

### 9.2 Deploy Captive Portal to Vercel (Optional)
```bash
cd apps/portal
vercel
```
* The included `apps/portal/vercel.json` proxies all payment/session calls to `http://169.58.96.131:3001/api/*`.
* In your MikroTik router, ensure Walled Garden allows `*.vercel.app` (configured in `MIKROTIK-SETUP.md`).

