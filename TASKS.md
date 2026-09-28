# Task Breakdown & Implementation Tracker
## WiFi Billing & Hotspot Platform

---

### Phase Status Summary
| Phase / Slice | Description | Status |
| :--- | :--- | :--- |
| **Slice 1** | Foundation Scaffolding & Multi-Container Docker Orchestration | 🟢 COMPLETED |
| **Slice 2** | Database Schema, Prisma Migrations & Seed Data | 🟢 COMPLETED |
| **Slice 3** | Core Domain Business Logic & Unit Test Suite | ⚪ BACKLOG |
| **Slice 4** | M-Pesa Daraja Engine (STK Push, Webhook, Idempotency, Ledger) | ⚪ BACKLOG |
| **Slice 5** | FreeRADIUS (rlm_sql) & MikroTik RouterOS Gateway Controller | ⚪ BACKLOG |
| **Slice 6** | Session Accounting, Quota Enforcer & BullMQ Expiry Watchdog | ⚪ BACKLOG |
| **Slice 7** | Mobile-First Captive Portal (Plan Selection, STK Polling, Status) | ⚪ BACKLOG |
| **Slice 8** | Voucher Management System (Bulk Generator, PDF/CSV, Redemptions) | ⚪ BACKLOG |
| **Slice 9** | Admin Management Platform, RBAC & Financial Analytics | ⚪ BACKLOG |
| **Slice 10** | End-to-End Verification, Security Hardening & Documentation | ⚪ BACKLOG |

---

### Detailed Vertical Slices & Acceptance Criteria

#### [x] Slice 1: Foundation Scaffolding & Multi-Container Docker Orchestration
* [x] Initialize Git repository with `main` branch.
* [x] Draft core system documentation (`PRD.md`, `ARCHITECTURE.md`, `RULES.md`, `DESIGN.md`, `TASKS.md`, `MEMORY.md`).
* [x] Create project root structure (`apps/api`, `apps/portal`, `apps/admin`, `packages/shared`, `infrastructure/docker`).
* [x] Configure root `package.json`, TypeScript configs (`tsconfig.base.json`), and tooling.
* [x] Build `docker-compose.yml` for multi-service stack:
  - `postgres`: PostgreSQL 15/16 with health check.
  - `redis`: Redis 7 Alpine with persistence.
  - `freeradius`: FreeRADIUS 3.x with PostgreSQL dictionary and `rlm_sql`.
  - `api`: Node.js / Fastify backend service.
  - `portal`: Captive Portal web frontend.
  - `admin`: Admin Management Platform frontend.
  - `nginx`: Reverse proxy with SSL & walled-garden forwarding.
* [x] Generate comprehensive `.env.example` documenting all configuration keys.
* *Acceptance Criteria*: Docker Compose builds without errors; environment variables validated; core directories created.

#### [x] Slice 2: Database Schema, Prisma Migrations & Seed Data
* [x] Implement complete Prisma schema in `packages/database`:
  - `User`, `Role`, `Permission`, `AuditLog`
  - `Location`, `Router`, `AccessPoint`
  - `Plan`, `Customer`, `Device`
  - `Payment`, `Transaction`, `Entitlement`
  - `VoucherBatch`, `Voucher`, `Session`
  - FreeRADIUS native tables: `nas`, `radcheck`, `radreply`, `radacct`
* [x] Create SQL migration files ensuring indexes, foreign keys, and unique constraints.
* [x] Create idempotent database seed script (`prisma/seed.ts`):
  - Superadmin account (Argon2id password)
  - Default Location ("Main Campus / HQ")
  - Default Bandwidth Plans (1 Hour, 24 Hours, 7 Days, 5GB Capped)
  - Router definition template for MikroTik-E7161B
* *Acceptance Criteria*: Database migrations apply cleanly; seed script populates default catalog and superadmin; relations enforce integrity.

#### [ ] Slice 3: Core Domain Business Logic & Unit Test Suite
* [ ] Bandwidth Profile Calculator:
  - Translate Plan download/upload/burst values into valid `Mikrotik-Rate-Limit` strings.
* [ ] Entitlement & Expiry Engine:
  - Time-based expiry calculations (`expires_at = now + duration`).
  - Data quota remaining calculations.
* [ ] Voucher Code Generator:
  - Cryptographically secure alphanumeric generator avoiding visual ambiguities (`O` vs `0`, `I` vs `1`, `L`).
* [ ] Unit tests for all domain calculators using Vitest / Jest.
* *Acceptance Criteria*: 100% test pass rate on plan math, rate-limit strings, and voucher code entropy.

#### [ ] Slice 4: M-Pesa Daraja Payment Engine
* [ ] Daraja OAuth token manager with automatic token caching in Redis and early refresh.
* [ ] STK Push dispatcher (Lipa na M-Pesa Online) generating correct Base64 password and timestamp.
* [ ] Webhook receiver endpoint (`POST /api/webhooks/mpesa`):
  - Strict payload validation.
  - Row-level lock (`SELECT ... FOR UPDATE`) on payment record to prevent race conditions.
  - ResultCode evaluation (0 = success, other = failure).
  - Idempotent transaction ledger record creation.
  - Automatic entitlement generation on success.
* [ ] Background payment reconciliation job: Queries Daraja Query API for stuck/pending payments after 120s.
* [ ] Unit & integration tests with simulated Daraja callbacks.
* *Acceptance Criteria*: Simulated STK push and webhook callback reliably transition payment state to SUCCESS, create transaction record, and generate active entitlement with zero duplicate credits.

#### [ ] Slice 5: FreeRADIUS & MikroTik RouterOS Gateway Controller
* [ ] FreeRADIUS `rlm_sql` query templates mapping `radcheck` and `radreply` to active entitlements.
* [ ] MikroTik RouterOS API Client:
  - Secure TLS connection to RouterOS port 8729 (or HTTP REST for v7).
  - Telemetry reader: router identity, CPU, memory, uptime, active hotspot hosts.
* [ ] RADIUS Packet of Disconnect (PoD / CoA) implementation:
  - UDP 3799 socket transmitter sending RFC 3576 Disconnect-Request with `User-Name` and `Framed-IP-Address`.
* [ ] Hotspot host kick function via RouterOS API fallback (`/ip/hotspot/active/remove`).
* *Acceptance Criteria*: Server successfully queries router telemetry and sends valid CoA disconnect packets.

#### [ ] Slice 6: Session Accounting, Quota Enforcer & BullMQ Expiry Watchdog
* [ ] Interim accounting processor (`radacct` listener):
  - Increments device upload/download bytes.
  - Updates remaining quota on associated entitlement.
* [ ] Quota enforcer: Automatically triggers CoA disconnect when `used_bytes >= total_bytes`.
* [ ] BullMQ scheduled job (runs every 60s):
  - Finds all entitlements where `expires_at <= NOW()` and status is `ACTIVE`.
  - Disconnects active sessions and transitions entitlement status to `EXPIRED`.
* [ ] Router reboot recovery handler: Reconciles active hotspot leases against active entitlements.
* *Acceptance Criteria*: Expired time or exhausted data triggers automatic session termination and gateway disconnect.

#### [ ] Slice 7: Mobile-First Captive Portal Application
* [ ] Ultra-lightweight self-contained frontend (zero external CDNs).
* [ ] Screen 1: Plan Picker with pricing cards and feature badges.
* [ ] Screen 2: M-Pesa phone number input and STK trigger.
* [ ] Screen 3: Real-time payment verification screen (polling payment status).
* [ ] Screen 4: Active session status (live countdown clock, data gauge, refresh button).
* [ ] Screen 5: Voucher redemption tab.
* [ ] Responsive design verified for 375px mobile screens.
* *Acceptance Criteria*: Portal renders instantly in captive browser; complete guest purchase flow triggers STK and redirects to active session.

#### [ ] Slice 8: Voucher Management System
* [ ] Bulk voucher generation service with batch names and expiration dates.
* [ ] Voucher redemption endpoint with rate-limiting and brute-force protection.
* [ ] CSV export and printable A4 PDF template generator with QR codes.
* *Acceptance Criteria*: Batch of 100 vouchers generated, exported to CSV, and individual vouchers redeemed into active entitlements.

#### [ ] Slice 9: Admin Management Platform, RBAC & Financial Analytics
* [ ] Secure Admin Authentication (Argon2id, HTTP-only session cookies).
* [ ] Overview Dashboard: Gross revenue, today's sales, active users, online routers.
* [ ] Router Management module: Fleet list, ping heartbeat, active clients.
* [ ] Plan Management module: Create/edit/toggle bandwidth plans.
* [ ] Live Sessions module: Real-time active devices table with remote kick button.
* [ ] Financial Reports & Audit Log module: Immutable transaction history, CSV export.
* *Acceptance Criteria*: Admin can manage routers, create plans, kick sessions, and inspect financial metrics.

#### [ ] Slice 10: End-to-End Verification, Security Hardening & Documentation
* [ ] Full Acceptance Test execution (Step 1 through Step 23 in Section 58).
* [ ] Security audit: Rate limiting, SQL injection defense, CSRF, input validation.
* [ ] Operational documentation:
  - `NETWORK-SETUP.md`
  - `MIKROTIK-SETUP.md`
  - `DEPLOYMENT.md`
  - `OPERATIONS.md`
* [ ] Final pre-deployment verification checklist.
