# Project Memory & System Decisions
## WiFi Billing & Hotspot Platform

### Core System Context
* **Project Name**: WiFi Billing & Hotspot Management System
* **Primary Target**: Production deployment on Linux VPS/Server managing MikroTik RouterOS gateways (MikroTik-E7161B)
* **Default Currency**: KES (Kenyan Shillings)
* **Primary Payment Gateway**: Safaricom M-Pesa Daraja (Lipa na M-Pesa Online / STK Push)
* **Architecture Pattern**: Modular Monolith with Background Workers and Dedicated FreeRADIUS 3.x AAA Daemon
* **Database**: PostgreSQL 16
* **Queue / Cache**: Redis 7 + BullMQ

### Architectural Invariants (Must Never Be Broken)
1. **Separation of Domains**:
   - `Payment` != `Entitlement` != `Network Session`.
   - Successful payment creates an Entitlement.
   - An Entitlement creates/manages Network Sessions.
   - Network Sessions are enforced at the Router gateway via RADIUS/API.
2. **Payment Idempotency**:
   - M-Pesa webhook calls `SELECT ... FOR UPDATE` by `checkout_req_id`.
   - Never credit twice. Duplicate callbacks return instant HTTP 200 without side effects.
3. **Walled Garden Zero-CDN Constraint**:
   - Captive portal cannot load assets from external CDNs (Google Fonts, unpkg, cdnjs) because unauthenticated devices have no internet access.
   - All fonts, CSS, and JS bundles must be self-contained and local.
4. **Next.js Routing Constraint**:
   - Never use `middleware.ts` in Next.js apps. Route protection is enforced via server-side session utilities or `proxy.ts`.

### Hardware & Network Defaults
* **Primary Gateway**: MikroTik-E7161B
* **RouterOS API Port**: `8729` (API-SSL) / `8728` (Plaintext API fallback)
* **RADIUS Auth Port**: `1812` (UDP)
* **RADIUS Accounting Port**: `1813` (UDP)
* **RADIUS CoA / PoD Port**: `3799` (UDP Disconnect-Request)
* **Default Hotspot Subnet**: `192.168.88.0/24` or `10.10.0.0/16` (Hotspot VLAN 10)

### Current Progress State
* Repository initialized with `main` branch.
* Foundational documentation completed: `PRD.md`, `ARCHITECTURE.md`, `RULES.md`, `DESIGN.md`, `TASKS.md`, `MEMORY.md`.
* **Vertical Slice 1 COMPLETED**: Foundation Scaffolding, monorepo workspaces (`packages/shared`, `packages/database`, `apps/api`, `apps/portal`, `apps/admin`), multi-container Docker Compose configuration (`postgres`, `redis`, `freeradius`, `api`, `portal`, `admin`, `nginx`), environment validation (`.env.example`), and zero-CDN captive portal UI.
* **Vertical Slice 2 COMPLETED**: Complete Prisma schema (User, Location, Router, Plan, Customer, Device, Payment, Transaction, Entitlement, Session, Voucher, FreeRADIUS rlm_sql tables), seed script with `@node-rs/argon2`, and client generation.
* **Vertical Slice 3 COMPLETED**: Core Domain Business Logic & Unit Test Suite (Bandwidth profile calculation, Mikrotik-Rate-Limit strings, Entitlement expiry calculations, Data quota exhaustion engine, cryptographically secure voucher generation). 18 automated tests passing (100%).
* **Ready for Vertical Slice 4**: M-Pesa Daraja Engine (STK Push, Webhook, Idempotency, Ledger).
