# Design System & UI/UX Specification
## Captive Portal & ISP Admin Platform

---

### 1. Captive Portal UI Principles

#### 1.1 The Walled Garden Constraint (Critical Network Rule)
* **Zero External CDNs**: During captive portal redirection, the customer's device does **NOT** have general internet access. If the portal attempts to load fonts, CSS, or scripts from `fonts.googleapis.com`, `cdnjs.cloudflare.com`, or external tracking libraries, the browser will freeze, timeout, and fail to render.
* **Self-Contained Bundle**: All CSS, SVG icons, and JavaScript must be self-hosted, minified, and bundled locally.
* **Total Payload Budget**: Under **60 KB** gzipped for the initial page load to guarantee instant rendering on congested 2.4GHz WiFi channels.

#### 1.2 Color Palette
| Token | Hex Value | Usage |
| :--- | :--- | :--- |
| `primary` | `#059669` (Emerald 600) | Primary CTAs, active status, M-Pesa brand alignment |
| `primary-hover` | `#047857` (Emerald 700) | Button hover/active states |
| `accent` | `#0284C7` (Sky 600) | Secondary links, session refresh, info banners |
| `surface` | `#FFFFFF` | Card backgrounds, dialogs |
| `background` | `#F8FAFC` (Slate 50) | Main viewport background |
| `text-primary` | `#0F172A` (Slate 900) | Headings, plan prices, vital prompts |
| `text-muted` | `#64748B` (Slate 500) | Subtitles, duration labels, terms text |
| `danger` | `#DC2626` (Red 600) | Payment failed, session expired, invalid voucher |
| `warning` | `#D97706` (Amber 600) | Low data warning (< 10% remaining), timeout alerts |

#### 1.3 Typography
* **Stack**: Native system font stack for zero latency:
  `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
* **Scale**:
  - `H1`: 24px / Bold (Venue / Hotspot Title)
  - `Price Tag`: 28px / ExtraBold
  - `Body`: 15px / Regular
  - `Caption`: 13px / Medium

---

### 2. Captive Portal Screen Flows

#### Screen 1: Plan Selection (Default View)
* **Header**: Brand Logo + Network Status Badge ("Connected to FastNet Hotspot").
* **Plan Grid**:
  - Horizontal or stacked cards.
  - Plan name (e.g., "1 Hour FastPass").
  - Large price display: `KES 20`.
  - Feature badges: `5 Mbps Speed`, `Unlimited Data`, `1 Device`.
  - Prominent "Select & Pay" button.
* **Secondary Action**: Tab/Link to switch to "Use Scratch Card / Voucher".
* **Footer**: Support Hotline / WhatsApp link + Terms of Service.

#### Screen 2: Payment Modal / Screen
* Selected plan summary card.
* Mobile phone input with auto-prefixed country code (`+254` for Kenya).
* Dynamic validation (checks length: 9-10 digits, formats to `2547XXXXXXXX`).
* "Send M-Pesa Prompt" button with loading spinner.
* Helpful hint: *"Check your phone screen for the M-Pesa PIN prompt."*

#### Screen 3: Live Payment Verification (State Machine UI)
* Animated radial progress or spinner.
* Status text transitions:
  - `Connecting to Safaricom...`
  - `Prompt sent! Enter your M-Pesa PIN on your phone.`
  - `Payment verified! Unlocking internet access...`
* Fallback options:
  - "Didn't receive prompt? Click here to retry" (after 30s).
  - "Pay via Paybill / Till Number manually" option with account reference.

#### Screen 4: Active Session Dashboard
* Green glowing connection status indicator: **CONNECTED & ACTIVE**.
* Plan details: "24 Hours Unlimited Pass".
* Live countdown timer: `23h : 42m : 15s remaining`.
* Data usage progress bar (for capped plans): `1.4 GB / 5.0 GB used (3.6 GB remaining)`.
* "Refresh Status" button.
* "Disconnect Session" button.

---

### 3. Admin Dashboard UI Specifications

* **Layout**: Collapsible left sidebar navigation + top status bar + main content viewport.
* **Theme**: Clean Slate/Neutral dark & light mode support.
* **Component Library**: Tailored Tailwind CSS components (StatCards, DataTables, Badges, Tabs, Modals, Forms).
* **Key Modules**:
  1. **Overview Dashboard**:
     - Metric Cards: Gross Revenue Today, Active Hotspot Users, Online Routers, Voucher Sales.
     - Live Revenue & Traffic chart.
     - Recent Payment Activity stream.
  2. **Router Fleet**:
     - Real-time online/offline status pill, NAS IP, model, active client count, ping latency.
     - Quick "Sync Router" and "Reboot" triggers.
  3. **Plan Manager**:
     - Form to configure price, duration, upload/download speed, burst thresholds, device limit.
  4. **Voucher Studio**:
     - Bulk voucher generator (Batch name, plan, count, expiration).
     - Printable sheet preview (A4 layout with cut marks, QR code, and voucher PIN).
  5. **Live Sessions**:
     - Table of connected clients: IP, MAC, Router, Downloaded, Uploaded, Online Duration, and instant "Disconnect (Kick)" button.
  6. **Transactions & Audit Log**:
     - Filterable ledger with M-Pesa receipt IDs, customer phone numbers, timestamps, and reconciliation badges.
