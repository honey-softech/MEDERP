# MedERP architecture

Hospital ERP as a **modular monolith**: one Next.js app owns UI + API + domain helpers; Flutter talks over HTTP. Prefer clearer modules over microservices.

## System context

```text
┌──────────────────┐     HTTPS/JSON      ┌────────────────────────────────┐
│  apps/mobile     │ ─────────────────►  │  apps/web (Next.js 16)         │
│  (Flutter)       │                     │  App Router pages + route.ts   │
└──────────────────┘                     │  custom server.ts              │
                                         │   · Socket.IO realtime         │
                                         │   · outbound WhatsApp worker   │
                                         └──────────────┬─────────────────┘
                                                        │ Prisma
                                                        ▼
                                                 PostgreSQL
```

| Piece | Role |
|-------|------|
| `apps/web` | Staff dashboard, REST-ish App Router APIs, Prisma, Socket.IO, messaging |
| `apps/mobile` | Flutter client (consumes web API; no shared TS packages yet) |
| `apps/web/prisma` | Schema, migrations, seed |
| Root `package.json` | Script facade into `apps/web` / mobile — not a packages workspace |

## Runtime stack

- **Next.js 16** App Router + **React 19** + **Tailwind 4**
- **Prisma 6** + **PostgreSQL**
- **Custom auth** (cookie / Bearer sessions) — not NextAuth
- **Razorpay** (hospital + platform billing)
- **WhatsApp Cloud API** via `lib/messaging/*` + `OutboundMessage` outbox
- **PDFKit** for visit summary / bill PDFs

## Domain map

Boundaries are **folders + roles + `hospitalId`**, not separate deployables.

| Domain | UI (`src/app`) | API (`src/app/api`) | Lib |
|--------|----------------|---------------------|-----|
| Auth / session | `login`, `signup`, `forgot-password` | `api/auth/*` | `auth.ts`, `otp.ts`, `session-user.ts`, `rate-limit.ts` |
| Platform | `platform/*` | `api/platform/*` | `platform-*.ts` |
| Hospital admin | `hospital/*` | `api/hospital/*` | `hospital-*.ts`, `employee.ts` |
| Patients / OPD | `patients`, `appointments`, `queue`, `nurse` | `api/patients`, `api/appointments` | `front-desk.ts` (hub), `vitals.ts`, `visit-summary*.ts` |
| IPD / wards | `wards/*` | `api/wards`, `admissions`, `beds` | `wards.ts` |
| Billing | `billing/*` | `invoices`, `payments`, `billing` | `billing-reports.ts`, `bill-receipt-pdf.ts`, `razorpay*.ts` |
| Lab | `lab/*` | `api/lab/*` | `lab.ts`, `lab-catalog.ts` |
| Pharmacy | `pharmacy/*` | `api/pharmacy/*` | `pharmacy.ts`, `pharmacy-rx.ts` |
| Messaging | send buttons on clinical/billing pages | send routes on appointments/invoices | `messaging/*` (**best bounded example**) |
| Helpdesk / board / leave | matching routes | matching APIs | `helpdesk.ts`, `board.ts`, `staff-leave.ts` |

**Tenancy rule:** hospital APIs always filter with `hospitalId: scoped.user.hospitalId` after `requireHospitalActor()`.

**Platform roles** (`SOFTWARE_ADMIN`, helpdesk) stay out of hospital data via `isPlatformRole` + section layouts.

## Request flow (hospital API)

```text
middleware.ts          → cookie/Bearer present? (not full session validate)
route.ts               → requireHospitalActor() + forbidUnless(roles)
                       → (optional) validate body
                       → domain helper / Prisma
                       → writeAuditLog on sensitive writes
                       → JSON { ok } | { error }
```

Preferred shape for new code:

```text
route.ts (thin) → lib/<domain>/<use-case>.ts → prisma
```

## Layering target

Keep one deployable app. Organize **inside** `apps/web/src`:

```text
app/api/**/route.ts     HTTP only: auth, validate, call use-case, map status
lib/<domain>/           Use-cases + pure helpers (no NextResponse when avoidable)
lib/authz/              Roles + requireHospitalActor / forbidUnless
components/             UI only (fetch APIs; no Prisma)
prisma/                 Persistence schema
```

**Reference module:** `lib/messaging/` (`providers`, `queue`, `templates`, `whatsapp-media`) — copy this style for other domains.

## Current strengths

- Multi-tenant `hospitalId` scoping
- Shared hospital actor / role matrices
- Audit logging on many mutations
- Messaging outbox + provider separation
- Trial / subscription gating
- Section layouts for platform vs hospital admin

## Current risks

| Risk | Example |
|------|---------|
| God module | `lib/front-desk.ts` mixes authz, IDs, display, fees, duplicates |
| Fat routes | `api/appointments/[id]/route.ts` multi-action PATCH |
| Prisma in pages + routes | Hard to reuse/test; mobile depends only on HTTP luck |
| Ad-hoc validation | Manual `String(body?.x)` |
| No automated tests | Regressions as domains grow |
| Shallow middleware auth | Presence of cookie ≠ valid session |

---

## How we will execute (one step at a time)

Do **not** rewrite the app. Each step is a small, reviewable change. Stop after each step, confirm the app still runs, then start the next.

| Step | What we do | Done when | Risk |
|------|------------|-----------|------|
| **1** | Split `front-desk.ts` into focused modules; keep barrel re-exports | **Done** — modules + barrel re-exports. Existing `@/lib/front-desk` imports unchanged. | Low — no behavior change |
| **2** | Extract appointment PATCH actions into `lib/appointments/*` | **Done** — `[id]/route.ts` is auth + load + `runAppointmentPatch`. | Medium — many actions |
| **3** | Add Zod; validate auth + patients create + appointments create/PATCH | **Done** — invalid bodies return 400 `{ error }`. | Low |
| **4** | Add a test runner + 3 unit tests (authz, tenancy helper, WhatsApp template builder) | **Done** — `npm test` (Vitest) is green. | Low |
| **5** | (Later) OpenAPI / shared types for Flutter | Mobile and web agree on patient/appointment shapes | Skip until mobile drifts |
| **6** | Thin patient update / merge / family APIs + more tests | **Done** — `lib/patients/*`; 18 tests green | Medium |
| **7** | Thin invoice create / PATCH / WhatsApp send + billing tests | **Done** — `lib/billing/*`; 25 tests green | Medium |
| **8** | Thin lab order PATCH / collect / report rules + tests | **Done** — `lib/lab-orders/*`; 31 tests green | Medium |

**Pause after each step.** Do not combine steps in one change.

---

## Refactor plan (incremental)

Do **not** rewrite the app. Apply when touching a file (“boy scout”), plus the slices below.

### Slice 1 — Split `front-desk.ts` (no behavior change)

Extract into focused modules; keep `front-desk.ts` as a **re-export barrel** so imports keep working:

| New module | Move from `front-desk` |
|------------|------------------------|
| `lib/authz/hospital.ts` | Role lists, `walkInRolesFor`, `requireHospitalActor`, `requireHospitalPage`, `forbidUnless` |
| `lib/ids.ts` | `nextCounter`, `nextMrn`, `nextToken`, `nextInvoiceNo`, family codes, `pad` |
| `lib/display.ts` | `patientName`, `doctorName`, `physicianLine`, `prettyEnum`, `inr`, `age*`, `tokenLabel` |
| `lib/opd/fees.ts` | `DEFAULT_OPD_FEE`, `consultationFeeForVisit`, invoice status helpers |
| `lib/opd/patients.ts` | `findDuplicatePatients`, `ensureFamilyGroup`, photo sanitize |
| `lib/opd/scheduling.ts` | `dayRange`, `listBookableDoctors`, leave checks, `groupByDoctor` |

**Done when:** `front-desk.ts` only re-exports; all existing `@/lib/front-desk` imports still typecheck.

### Slice 2 — Appointments use-cases

Pull branches out of `api/appointments/[id]/route.ts` into e.g.:

- `lib/appointments/remind.ts`
- `lib/appointments/reschedule.ts`
- `lib/appointments/status.ts` (check-in / complete / cancel as applicable)

Route becomes: auth → parse `action` → call one function → return JSON.

### Slice 3 — API validation

Add Zod (or equivalent) at mutating edges first: auth, patients create, appointments create/PATCH, invoice send.

### Slice 4 — Tests (minimum set)

- `requireHospitalActor` / `forbidUnless` (role matrix)
- Tenant scope: query never returns other hospital’s patient
- Messaging template component builder (unit, no network)

### Slice 5 — Mobile contract (when Flutter grows)

OpenAPI snapshot or a small `packages/api-types` — only when drift becomes painful.

---

## Conventions for new code

1. **One job per module** — don’t add unrelated helpers to `front-desk`.
2. **Hospital APIs** always use `requireHospitalActor` + `hospitalId` filter.
3. **Mutations** that matter → `writeAuditLog`.
4. **WhatsApp** → `lib/messaging` only; don’t call Graph API from route bodies.
5. **Secrets** only in `.env` (never commit); document in `.env.example`.
6. Prefer **extracting a use-case** over growing a 300+ line `route.ts`.

## What we are not doing (yet)

- Microservices / separate billing service
- Full DDD ceremony
- Rewriting working Prisma calls “for purity”
- Shared monorepo packages until mobile needs typed contracts
