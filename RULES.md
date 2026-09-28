# Project Coding Rules & Standards
## WiFi Billing & Hotspot Platform

### 1. Framework & Auth Constraints
- **Next.js & Routing**: NEVER use `middleware.ts` in any Next.js app. Next.js 15 route protection and auth checks must be enforced via server-side session checks, route handlers, or `proxy.ts`.
- **Custom Auth**: Authentication uses Argon2id password hashing and secure HTTP-only cookies. No reliance on external unvetted SaaS auth for the core ISP engine.

### 2. TypeScript & Code Quality
- **Strict Typing**: TypeScript `strict: true` must be enabled across all apps and packages.
- **No Untyped `any`**: Explicitly declare interfaces, DTOs, and domain entities. Use `unknown` with type guards if incoming data shape is unverified.
- **Single Responsibility**: Keep functions small, modular, and single-purpose. Isolate network I/O, database persistence, and payment logic into dedicated services.

### 3. Separation of Concerns & Clean Architecture
```
[ UI / Presentation ] ──> [ API Controllers / Route Handlers ]
                                       │
                                       ▼
                            [ Business Service Layer ]
                           /           │            \
                          ▼            ▼             ▼
                    [ Repositories ] [ Payment ] [ Router/RADIUS ]
                          │
                          ▼
                    [ PostgreSQL ]
```
- UI components must **never** perform direct database queries or communicate directly with router APIs.
- RouterOS API commands and RADIUS attribute manipulation belong strictly in `services/network/` and `services/radius/`.
- Financial transactions and entitlement updates must always execute within atomic database transactions (`tx.transaction`).

### 4. API Response Standards
Every HTTP endpoint must return a structured response adhering to this format:

```typescript
// Success Response (HTTP 200/201)
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req_01j7x8a...",
    "timestamp": "2026-09-28T09:25:00.000Z"
  }
}

// Error Response (HTTP 4xx/5xx)
{
  "success": false,
  "error": {
    "code": "PAYMENT_STK_FAILED",
    "message": "The M-Pesa STK push request was declined by user.",
    "details": null
  },
  "meta": {
    "requestId": "req_01j7x8a...",
    "timestamp": "2026-09-28T09:25:00.000Z"
  }
}
```

### 5. UI State Requirements
Every interactive UI screen (Captive Portal & Admin Dashboard) must explicitly handle:
1. **Loading State**: Visual skeletons or spinners during network requests; disabled submit buttons to prevent double-clicks.
2. **Error State**: Actionable, customer-friendly error messages (e.g. "PIN entry timed out. Tap retry.").
3. **Empty State**: Clear guidance and call-to-actions when lists are empty (e.g. "No active sessions. Connect a device.").
4. **Responsive Layout**: 100% responsive across mobile (375px), tablet (768px), and desktop (1440px).

### 6. Security & Secret Management
- **Zero Hardcoded Secrets**: Secrets (`DATABASE_URL`, `MPESA_CONSUMER_SECRET`, `RADIUS_SECRET`, `APP_KEY`) must never appear in Git repositories.
- **Input Validation**: All API inputs must be validated with schema validators (e.g., Zod / TypeBox) before processing.
- **SQL Injection Prevention**: Parameterized queries via Prisma or typed query builders.
- **MAC Normalization**: MAC addresses must be normalized to uppercase standard format (`AA:BB:CC:DD:EE:FF`) before lookup or insertion.

### 7. Atomic Commits & Documentation
- Commit messages must follow Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Documentation (`TASKS.md`, `MEMORY.md`, `ARCHITECTURE.md`) must be kept up to date after every vertical slice completion.
