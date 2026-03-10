# EPCON — Recommended Server-Side Architecture

> What the API backing this Angular frontend should look like, what types it would own,
> and why each decision was made. Written as a senior full-stack recommendation.

---

## Table of Contents

1. [Recommended Stack](#1-recommended-stack)
2. [Domain Model — The Real Entities](#2-domain-model--the-real-entities)
3. [Database Schema](#3-database-schema)
4. [API Contract](#4-api-contract)
5. [The Acceptance Token — Security Design](#5-the-acceptance-token--security-design)
6. [DTOs vs Domain Entities — Why They're Different](#6-dtos-vs-domain-entities--why-theyre-different)
7. [Type Sharing Between Frontend and Backend](#7-type-sharing-between-frontend-and-backend)
8. [Alternatives Considered](#8-alternatives-considered)

---

## 1. Recommended Stack

**NestJS + PostgreSQL + Prisma**

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | **NestJS** | TypeScript-first, mirrors Angular's decorator/module pattern, familiar to Angular devs, strong ecosystem |
| Database | **PostgreSQL** | Relational data (assignments link workers to opportunities), JSON support for coordinates, mature, ACID-compliant |
| ORM | **Prisma** | Type-safe queries, auto-generated types from schema, excellent migration tooling |
| Validation | **class-validator + class-transformer** | Decorator-based DTO validation, native NestJS integration |
| Auth (token) | **HMAC-SHA256 signed tokens** (or short-lived JWT) | Stateless, no session store needed, verifiable without a DB lookup |
| Email | **SendGrid / AWS SES** | Transactional email for sending assignment links |
| Hosting | **Railway / Render / AWS ECS** | Containerised NestJS deploys cleanly |

**Why NestJS specifically:**
An Angular developer will feel immediately at home — decorators, dependency injection, modules, providers. The mental model is nearly identical. This matters for a team where the same developers might touch both sides of the stack.

---

## 2. Domain Model — The Real Entities

The frontend only sees a simplified view. The server owns the full domain.

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Worker     │     │   Assignment     │     │    Campaign       │
│              │     │                  │     │                   │
│ id           │──┐  │ id               │  ┌──│ id                │
│ name         │  │  │ workerId  ───────│──┘  │ name              │
│ email        │  └──│ campaignId───────│─────│ activityType      │
│ role         │     │ token            │     │ startDate         │
│ status       │     │ tokenExpiresAt   │     │ endDate           │
└──────────────┘     │ tokenUsedAt      │     │ coordinatorId     │
                     │ submittedAt      │     └──────────────────┘
                     └────────┬─────────┘
                              │
                     ┌────────▼─────────┐
                     │ AssignmentItem   │  ← one row per opportunity per worker
                     │                  │
                     │ id               │
                     │ assignmentId     │
                     │ opportunityId ───│──────────────────────┐
                     │ status           │                      │
                     │ scheduledDate    │     ┌────────────────▼──┐
                     │ targetPeopleCount│     │   Opportunity      │
                     │ decidedAt        │     │                    │
                     └──────────────────┘     │ id                 │
                                              │ locationId ────────│──┐
                                              │ campaignId         │  │
                                              │ activityType       │  │
                                              │ defaultDate        │  │  ┌──────────────┐
                                              │ defaultPeopleCount │  └──│  Location    │
                                              │ status             │     │              │
                                              └────────────────────┘     │ id           │
                                                                          │ name         │
                                                                          │ country      │
                                                                          │ coordinates  │
                                                                          │ region       │
                                                                          └──────────────┘
```

### Why these entities exist separately

**`Worker`** — the authenticated user in the system. Has a role (field worker, coordinator, admin) and an overall status (active, suspended).

**`Campaign`** — the top-level outreach effort. "Zambia TB Screening Q2 2026" is a campaign. A campaign has an `activityType` and a date range, and it contains many `Opportunity` records.

**`Location`** — a geographic area. Reusable across campaigns. Chipata District exists as a location regardless of which campaign is running there.

**`Opportunity`** — a specific role at a specific location within a campaign. "TB Screening officer at Chipata District for the Q2 2026 campaign" is one opportunity. This is the atomic unit workers accept or decline.

**`Assignment`** — links a worker to a campaign. It owns the acceptance token and tracks whether the worker has responded.

**`AssignmentItem`** — one row per opportunity per worker. This is where `ACCEPTED`, `DECLINED`, `ACCEPTED_BY_OTHER` status lives. When a worker accepts opportunity X, we write an `AssignmentItem` record. When another worker accepts the same opportunity, existing PENDING items for other workers on that same opportunity are automatically set to `ACCEPTED_BY_OTHER`.

---

## 3. Database Schema

```prisma
// prisma/schema.prisma

model Worker {
  id          String   @id @default(cuid())
  name        String
  email       String   @unique
  role        WorkerRole
  status      WorkerStatus @default(ACTIVE)
  assignments Assignment[]
  createdAt   DateTime @default(now())
}

model Location {
  id          String   @id @default(cuid())
  name        String
  country     String   // ISO 3166-1 alpha-2
  countryName String
  region      String?
  lat         Float
  lng         Float
  opportunities Opportunity[]
}

model Campaign {
  id           String       @id @default(cuid())
  name         String
  activityType ActivityType
  startDate    DateTime
  endDate      DateTime
  status       CampaignStatus @default(DRAFT)
  opportunities Opportunity[]
  assignments   Assignment[]
}

model Opportunity {
  id                 String         @id @default(cuid())
  locationId         String
  campaignId         String
  defaultDate        DateTime
  defaultPeopleCount Int
  status             OpportunityStatus @default(OPEN)
  location           Location       @relation(fields: [locationId], references: [id])
  campaign           Campaign       @relation(fields: [campaignId], references: [id])
  assignmentItems    AssignmentItem[]
}

model Assignment {
  id             String    @id @default(cuid())
  workerId       String
  campaignId     String
  token          String    @unique  // the emailed token
  tokenExpiresAt DateTime
  tokenUsedAt    DateTime?
  submittedAt    DateTime?
  worker         Worker    @relation(fields: [workerId], references: [id])
  campaign       Campaign  @relation(fields: [campaignId], references: [id])
  items          AssignmentItem[]
  createdAt      DateTime  @default(now())
}

model AssignmentItem {
  id                 String     @id @default(cuid())
  assignmentId       String
  opportunityId      String
  status             ItemStatus @default(PENDING)
  scheduledDate      DateTime?  // worker-confirmed date
  targetPeopleCount  Int?       // worker-confirmed count
  decidedAt          DateTime?
  assignment         Assignment @relation(fields: [assignmentId], references: [id])
  opportunity        Opportunity @relation(fields: [opportunityId], references: [id])

  @@unique([assignmentId, opportunityId])
}

// ── Enums ────────────────────────────────────────────────────────────────────

enum WorkerRole   { FIELD_WORKER COORDINATOR ADMIN }
enum WorkerStatus { ACTIVE SUSPENDED }

enum ActivityType {
  TB_SCREENING
  VACCINATION
  MALARIA_PREVENTION
  NUTRITION_SURVEY
}

enum CampaignStatus    { DRAFT ACTIVE CLOSED }
enum OpportunityStatus { OPEN FILLED CANCELLED }

enum ItemStatus {
  PENDING
  ACCEPTED
  DECLINED
  ACCEPTED_BY_OTHER
}
```

---

## 4. API Contract

The frontend needs exactly **two endpoints**. Everything else (creating campaigns, assigning workers, sending emails) is internal admin functionality.

### `GET /api/v1/assignments/:token`

Validates the token and returns the full assignment data needed to render the UI.

**Request:** Token in URL path (from the email link). No auth header — the token IS the credential for this flow.

**Response `200 OK`:**
```typescript
interface AssignmentResponse {
  worker: {
    name:  string;
    email: string;
  };
  campaign: {
    id:           string;
    name:         string;
    activityType: ActivityType;
  };
  locations: LocationResponse[];
}

interface LocationResponse {
  id:          string;
  name:        string;
  country:     string;
  countryName: string;
  coordinates: { lat: number; lng: number };
  opportunities: OpportunityResponse[];
}

interface OpportunityResponse {
  id:                string;
  activityType:      ActivityType;
  status:            ItemStatus;
  scheduledDate:     string;   // ISO 8601 date string
  targetPeopleCount: number;
}
```

**Response `401 Unauthorized`:**
```typescript
{ error: 'TOKEN_INVALID' }
```

**Response `410 Gone`:**
```typescript
{ error: 'TOKEN_EXPIRED' }
```

**Response `409 Conflict`:**
```typescript
{ error: 'ALREADY_SUBMITTED' }
```

Using distinct HTTP status codes + error codes lets the frontend show specific messaging rather than a generic error page. `410 Gone` is semantically correct for an expired token — the resource existed but no longer does.

---

### `POST /api/v1/assignments/:token/decisions`

Submits the worker's decisions. This is a **write-once** operation — once submitted, the token is consumed.

**Request body:**
```typescript
interface SubmitDecisionsRequest {
  decisions: DecisionRequest[];
}

interface DecisionRequest {
  opportunityId:    string;
  status:           'ACCEPTED' | 'DECLINED';
  scheduledDate?:   string;         // required when ACCEPTED
  targetPeopleCount?: number;       // required when ACCEPTED, 1–10000
}
```

**Response `200 OK`:**
```typescript
interface SubmitDecisionsResponse {
  submittedAt: string;
  summary: {
    accepted: number;
    declined: number;
  };
}
```

**Response `422 Unprocessable Entity`** (validation failed):
```typescript
{
  error: 'VALIDATION_FAILED',
  fields: [
    { opportunityId: 'opp-001', field: 'scheduledDate', message: 'Required when accepting' }
  ]
}
```

**What the server does on receipt:**
1. Validates and consumes the token (set `tokenUsedAt = now()`)
2. For each `ACCEPTED` decision, updates the `AssignmentItem` status + date + count, sets `decidedAt`
3. For each `DECLINED` decision, updates the `AssignmentItem` status
4. Finds any other workers who had the same opportunities as `PENDING` and updates them to `ACCEPTED_BY_OTHER`
5. Sets `Assignment.submittedAt = now()`
6. Returns summary

Step 4 is the critical business logic the frontend can't do — only the server has visibility across all workers' assignments.

---

## 5. The Acceptance Token — Security Design

The emailed link looks like:
```
https://app.epcon.org/acceptance/eyJhbGciOiJIUzI1NiJ9...
```

### Option A — HMAC-Signed Token (Recommended)

```typescript
// On assignment creation (server)
const payload = {
  assignmentId: 'asgn-001',
  workerId:     'wkr-001',
  exp:          Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
};
const token = jwt.sign(payload, process.env.TOKEN_SECRET, { algorithm: 'HS256' });
```

On validation the server:
1. Verifies the HMAC signature — no DB lookup needed to confirm it's genuine
2. Checks `exp` claim — rejects expired tokens with `410 Gone`
3. Looks up the `Assignment` in the DB to check `submittedAt` — rejects already-used tokens with `409 Conflict`

This is stateless — the token encodes the `assignmentId` so the server knows what to load without a token-to-assignment lookup table.

### Option B — Random UUID in Database

A `token` column on the `Assignment` table with a random UUID (already shown in the Prisma schema). Simpler, but requires a DB lookup on every validation. Perfectly acceptable for this scale.

### What NOT to do

- Never put the `workerId` or email directly in the URL without signing — that's enumerable and spoofable
- Never use the token as a session token — it should be single-use, consumed on submission

---

## 6. DTOs vs Domain Entities — Why They're Different

This is a common source of confusion. The rule is simple: **never return a database row directly to a client**.

```typescript
// ✗ Leaks internal fields, relationships, and DB implementation details
return this.prisma.assignment.findUnique({ where: { token }, include: { items: true } });

// ✓ Transform to a DTO that matches exactly what the frontend needs
async getAssignment(token: string): Promise<AssignmentResponse> {
  const assignment = await this.prisma.assignment.findUnique({
    where:   { token },
    include: { worker: true, campaign: true, items: { include: { opportunity: { include: { location: true } } } } }
  });

  return this.transformToResponse(assignment);
}

private transformToResponse(assignment: AssignmentWithRelations): AssignmentResponse {
  // Group items by location, shape to what the Angular app expects
  const locationMap = new Map<string, LocationResponse>();

  for (const item of assignment.items) {
    const loc = item.opportunity.location;
    if (!locationMap.has(loc.id)) {
      locationMap.set(loc.id, {
        id:          loc.id,
        name:        loc.name,
        country:     loc.country,
        countryName: loc.countryName,
        coordinates: { lat: loc.lat, lng: loc.lng },
        opportunities: [],
      });
    }
    locationMap.get(loc.id)!.opportunities.push({
      id:                item.opportunityId,
      activityType:      item.opportunity.campaign.activityType,
      status:            item.status,
      scheduledDate:     item.scheduledDate?.toISOString().split('T')[0]
                         ?? item.opportunity.defaultDate.toISOString().split('T')[0],
      targetPeopleCount: item.targetPeopleCount ?? item.opportunity.defaultPeopleCount,
    });
  }

  return {
    worker:    { name: assignment.worker.name, email: assignment.worker.email },
    campaign:  { id: assignment.campaignId, name: assignment.campaign.name, activityType: assignment.campaign.activityType },
    locations: [...locationMap.values()],
  };
}
```

This transformation layer is where:
- Internal IDs that shouldn't be exposed can be excluded
- The flat DB structure (`AssignmentItem` rows) is shaped into the nested structure the UI needs (`Location → Opportunity[]`)
- Default values are resolved (the worker sees the default date until they change it)

---

## 7. Type Sharing Between Frontend and Backend

Since both are TypeScript, there is a strong argument for a **shared types package** — a small library that both the Angular app and the NestJS API import from.

### Recommended structure: Nx Monorepo or shared npm package

```
epcon/
├── apps/
│   ├── frontend/          ← Angular app
│   └── api/               ← NestJS app
└── libs/
    └── shared-types/
        └── src/
            ├── assignment.types.ts   ← AssignmentResponse, OpportunityResponse etc.
            ├── decision.types.ts     ← SubmitDecisionsRequest, DecisionRequest
            └── enums.ts              ← ActivityType, ItemStatus (shared)
```

```typescript
// libs/shared-types/src/enums.ts
export type ActivityType =
  | 'TB_SCREENING'
  | 'VACCINATION'
  | 'MALARIA_PREVENTION'
  | 'NUTRITION_SURVEY';

export type ItemStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'ACCEPTED_BY_OTHER';

// libs/shared-types/src/assignment.types.ts
export interface OpportunityResponse {
  id:                string;
  activityType:      ActivityType;
  status:            ItemStatus;
  scheduledDate:     string;
  targetPeopleCount: number;
}

export interface LocationResponse {
  id:          string;
  name:        string;
  country:     string;
  countryName: string;
  coordinates: { lat: number; lng: number };
  opportunities: OpportunityResponse[];
}

export interface AssignmentResponse {
  worker:    { name: string; email: string };
  campaign:  { id: string; name: string; activityType: ActivityType };
  locations: LocationResponse[];
}

// libs/shared-types/src/decision.types.ts
export interface DecisionRequest {
  opportunityId:      string;
  status:             'ACCEPTED' | 'DECLINED';
  scheduledDate?:     string;
  targetPeopleCount?: number;
}

export interface SubmitDecisionsRequest {
  decisions: DecisionRequest[];
}
```

The Angular `location.model.ts` would then import from this shared package rather than defining its own types:

```typescript
// Angular app
import { AssignmentResponse, ItemStatus, ActivityType } from '@epcon/shared-types';
```

```typescript
// NestJS API
import { AssignmentResponse, SubmitDecisionsRequest } from '@epcon/shared-types';
```

**The payoff:** If the API ever changes `OpportunityResponse` — say, adding a `maxPeopleCount` field — the TypeScript compiler immediately flags every Angular component that reads from that type. The contract between frontend and backend is enforced at compile time, not discovered at runtime.

---

## 8. Alternatives Considered

### REST vs GraphQL

**GraphQL** would let the Angular app request exactly the fields it needs and reduce over-fetching. For this application it's unnecessary — there are only two API interactions and neither has variable field requirements. GraphQL pays off when you have many different consumers (mobile, web, admin dashboard) all querying the same data in different shapes.

### NestJS vs Express

**Express** is more flexible but gives you nothing for free. NestJS gives you dependency injection, a module system, validation, OpenAPI generation, and guards all out of the box. For a team already writing Angular, the NestJS mental model is directly transferable.

### PostgreSQL vs MongoDB

**MongoDB** is appealing because the `LocationResponse` shape with nested `opportunities[]` maps naturally to a document. However the underlying data is relational — a worker is assigned to opportunities, opportunities belong to campaigns and locations, and decisions create cross-worker effects (ACCEPTED_BY_OTHER). Relational integrity and transactions are important here. PostgreSQL handles the document-like response shape via JSON columns or simply the ORM transformation layer.

### REST vs tRPC

**tRPC** is an excellent choice if the frontend and backend are in the same monorepo and both TypeScript. It provides end-to-end type safety without a code generation step — the API's router types are directly imported by the Angular app. This would be the most type-safe option available. The tradeoff is that it couples the frontend and backend tightly, which is appropriate for a product team but less appropriate if the API needs to be consumed by third parties or mobile clients.

---

## Summary

The server side of this application is conceptually straightforward because the frontend interaction is a single, linear flow. The complexity lives in:

1. **Token security** — the emailed token is the authentication mechanism and must be single-use and expiry-enforced
2. **The ACCEPTED_BY_OTHER side effect** — only the server can see across all workers and update competing assignments
3. **The DTO transformation** — the database's flat relational structure must be shaped into the nested location/opportunity hierarchy the UI expects
4. **Type sharing** — using a shared types package eliminates the most common source of frontend/backend drift: mismatched type definitions

The two-endpoint API surface (`GET` to load, `POST` to submit) is intentionally minimal. The Angular app's job is to present and collect decisions; the server's job is to validate, persist, and enforce business rules. Clear separation of those responsibilities is what makes both sides independently testable and maintainable.
