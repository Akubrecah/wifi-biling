# Product Requirements Document (PRD)
## Production-Ready WiFi Billing & Hotspot Management System

### 1. Document Overview
* **Product**: Carrier-Grade Multi-Location WiFi Hotspot Billing & Management System
* **Author**: Senior Network & Full-Stack Engineering Team
* **Target Environment**: Linux VPS / Local Linux Server + MikroTik RouterOS (v6/v7) Gateway + Wireless Access Points
* **Primary Markets**: Public venues, cafes, hotels, residential estates, student housing, rural/urban WISP deployments
* **Default Currency**: KES (Kenyan Shillings) with multi-currency extensibility
* **Primary Payment Gateway**: Safaricom M-Pesa Daraja (Lipa na M-Pesa Online STK Push + C2B) & Cryptographic Vouchers

---

### 2. Problem Statement
Public WiFi and local WISP operators struggle with:
1. **Unreliable Device Tracking**: Modern smartphone operating systems (iOS 14+, Android 10+) randomize MAC addresses, breaking traditional MAC-bound access models.
2. **False Authorizations**: Poorly engineered billing tools grant internet access before receiving guaranteed bank/M-Pesa settlement, or fail to disconnect users when time/data expires.
3. **Hardware Lock-in & Brittle Coupling**: Tightly coupling web code to specific router models without standard AAA (RADIUS) protocols leads to system breakdown during router reboots or network jitter.
4. **Lack of Idempotency & Financial Auditing**: Duplicate webhook callbacks from payment processors lead to double-credited accounts, duplicate data allocations, and inaccurate revenue bookkeeping.

---

### 3. User Personas & Core Journeys

#### Persona 1: Guest Customer (Walk-in User)
* **Goal**: Connect to SSID, immediately see plan prices, pay securely via M-Pesa STK push, and receive instant internet access without filling out multi-page forms.
* **Journey**:
  1. Associates with open/hotspot SSID `Free-WiFi` / `FastNet-Hotspot`.
  2. Captive Portal automatically pops up via Captive Network Assistant (CNA).
  3. Views responsive menu of database-driven plans (e.g., "1 Hour Unlimited - KES 20", "24 Hours - KES 100", "5GB - KES 100").
  4. Enters phone number (`2547XXXXXXXX`) and taps "Pay with M-Pesa".
  5. STK PIN prompt appears on phone; customer enters PIN.
  6. Portal displays live payment verification state.
  7. Upon callback confirmation, device is immediately authorized at gateway.
  8. Customer sees active session dashboard with remaining time/data and refresh button.

#### Persona 2: Voucher User (Cash Customer / Offline Buyer)
* **Goal**: Buy a printed scratch card / voucher slip from a counter or vendor and log into the WiFi.
* **Journey**:
  1. Connects to WiFi, sees Captive Portal.
  2. Navigates to "Voucher Login".
  3. Enters 8-to-12 character alphanumeric voucher code.
  4. System validates voucher status, binds device/session, provisions FreeRADIUS credentials, and unlocks internet.

#### Persona 3: Hotspot Administrator / ISP Operator
* **Goal**: Manage routers across multiple physical locations, configure bandwidth packages, generate and print voucher batches, monitor live bandwidth and active sessions, track daily/monthly revenues, and revoke abusive devices.
* **Journey**:
  1. Logs in via secure admin portal (`/admin/login`) with Argon2id credentials and role-based permissions.
  2. Views real-time dashboard: Gross Revenue, Active Sessions, Router Health (online/offline heartbeat), and Payment Success Rates.
  3. Creates new bandwidth plans with dynamic burst profiles (e.g., 5Mbps down / 2Mbps up, 10Mbps burst for 10s).
  4. Generates batch of 500 vouchers, exports formatted PDF printable cards or CSV.
  5. Inspects active sessions; executes one-click remote disconnect (PoD / CoA) on any active session.

---

### 4. Functional Requirements

#### 4.1 Captive Portal & Device Identification
* **REQ-CP-01**: Captive Portal Detection (RFC 8952 / Apple CNA / Android Captive Portal detection) must redirect automatically to the portal URL.
* **REQ-CP-02**: Captive portal must load within < 1.5 seconds on 3G/poor wireless connections.
* **REQ-CP-03**: Support MAC Randomization recovery: If a customer rotates their MAC, they can input their phone number or active session code on the portal to seamlessly reclaim their active entitlement.
* **REQ-CP-04**: Display live session status (start time, expiry time, countdown timer, upload/download byte counters) without blocking internet usage.

#### 4.2 Product Catalog & Internet Plans
* **REQ-PL-01**: Time-based plans (e.g., 30 mins, 1 hour, 12 hours, 24 hours, 7 days, 30 days).
* **REQ-PL-02**: Data-based plans (e.g., 500MB, 2GB, 10GB, 50GB).
* **REQ-PL-03**: Hybrid plans (e.g., 10GB valid for 7 days - terminates upon whichever threshold is reached first).
* **REQ-PL-04**: Unlimited bandwidth plans subject to Fair Usage Policy (FUP) rate drops.
* **REQ-PL-05**: Dynamic bandwidth rate-limiting strings (Mikrotik-Rate-Limit format: `rx-rate[/tx-rate] [rx-burst-rate[/tx-burst-rate]] [rx-burst-threshold[/tx-burst-threshold]] [rx-burst-time[/tx-burst-time]] [priority] [rx-rate-min[/tx-rate-min]]`).

#### 4.3 Payment & Financial Settlement
* **REQ-PY-01**: M-Pesa Daraja STK Push (Lipa na M-Pesa Online) initiation.
* **REQ-PY-02**: Strict Idempotency: Duplicate callbacks must never double-credit, create duplicate entitlements, or alter settled transaction amounts.
* **REQ-PY-03**: Explicit State Machine: `CREATED` -> `PENDING` -> `PROCESSING` -> `SUCCESS` / `FAILED` / `CANCELLED` / `TIMEOUT` / `REVERSED`.
* **REQ-PY-04**: Asynchronous reconciliation worker: Polling unresolved pending payments against Daraja Transaction Status API if callback packet is dropped by mobile network.
* **REQ-PY-05**: Immutable Financial Ledger: Append-only transaction table; zero silent updates or deletions of financial records.

#### 4.4 Network Enforcement & AAA
* **REQ-NW-01**: Gateway enforcement via FreeRADIUS 3.x using PostgreSQL direct integration (`rlm_sql`).
* **REQ-NW-02**: RouterOS Hotspot integration with fallback to RouterOS API / REST API.
* **REQ-NW-03**: Real-time accounting: Router sends interim RADIUS accounting updates every 60 seconds (`Acct-Interim-Interval = 60`).
* **REQ-NW-04**: Instant Disconnection: Send RFC 3576 / RFC 5176 Disconnect-Request (Packet of Disconnect / CoA) over UDP port 3799 when quota is exhausted or plan expires.
* **REQ-NW-05**: Router Reboot Resilience: Upon router reboot, client reconnection queries FreeRADIUS; if an entitlement is still active, access is immediately re-granted without re-payment.

#### 4.5 Voucher Management
* **REQ-VC-01**: Cryptographically random voucher code generation (e.g., 8-digit alphanumeric, avoiding confusing characters `0`, `O`, `1`, `I`, `L`).
* **REQ-VC-02**: Single and bulk voucher batch generation with configurable expiration dates, batch names, and locations.
* **REQ-VC-03**: Voucher status life cycle: `AVAILABLE` -> `RESERVED` -> `USED` -> `EXPIRED` / `DISABLED`.
* **REQ-VC-04**: Printable voucher cards with QR codes and formatted CSV export.

#### 4.6 Administration & Multi-Tenancy
* **REQ-AD-01**: Multi-location support: Group routers and access points into distinct physical sites (e.g., Branch A, Hotel Lobby, Campus West).
* **REQ-AD-02**: Role-Based Access Control (RBAC): `SUPER_ADMIN`, `ADMIN`, `OPERATOR`, `ACCOUNTANT`, `NETWORK_ENGINEER`, `READ_ONLY`.
* **REQ-AD-03**: Comprehensive Audit Log: Every administrative action records actor, timestamp, client IP, action type, and JSON state diff.
* **REQ-AD-04**: Router Fleet Monitoring: Track router heartbeat, uptime, active hotspot clients, CPU/Memory load, and interface traffic.

---

### 5. Non-Functional Requirements
* **Security**: Zero secrets in source code, strict OWASP compliance, Argon2id password hashing, HTTP-only secure cookies, CSRF protection, rate limiting on payment/login endpoints.
* **Performance**: Sub-100ms API response time for captive portal queries; support 100+ concurrent active sessions on basic VPS (1 vCPU, 2GB RAM) with horizontal scalability to 10,000+ sessions.
* **Availability**: 99.9% uptime for billing and authentication engine; safe degradation if external payment gateway experiences downtime.
* **Observability**: Structured JSON logs, unique correlation IDs per customer request and payment intent, Prometheus metrics endpoints.
