# Model Change Review Lab — Full-Stack Backend Architecture

This document describes the architectural design, concurrency controls, data persistence guarantees, and client-server boundaries for the **Model Change Review Lab** full-stack implementation.

---

## 1. System Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                          BROWSER CLIENT (React 19)                     │
│                                                                        │
│   ┌───────────────────────────┐     ┌──────────────────────────────┐   │
│   │ UI Components & Reducer   │     │  TypeScript Formula Engine   │   │
│   │ - ModelGrid               │     │  - calculateModel()          │   │
│   │ - ProposalReviewPanel     │────▶│  - Trace DAG Index           │   │
│   │ - ScenarioCompare         │     │  - Scenario Variances        │   │
│   │ - PerformanceLab          │     │  (ONLY financial formulas)   │   │
│   └─────────────┬─────────────┘     └──────────────────────────────┘   │
│                 │                                                      │
│                 │ API Commands (useAppCommands)                        │
│                 ▼                                                      │
│   ┌───────────────────────────┐                                        │
│   │ apiClient (Fetch Wrapper) │                                        │
│   │ - X-Workspace-Token       │                                        │
│   │ - Idempotency-Key         │                                        │
│   │ - Retry & Error Envelope  │                                        │
│   └─────────────┬─────────────┘                                        │
└─────────────────┼──────────────────────────────────────────────────────┘
                  │ HTTPS / JSON REST API
                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FASTAPI BACKEND (Python 3.12)                   │
│                                                                        │
│   ┌───────────────────────────┐     ┌──────────────────────────────┐   │
│   │ Routers (/api/v1)         │     │ Domain Validation & Ops      │   │
│   │ - /session                │     │ - Target parser whitelist    │   │
│   │ - /model                  │────▶│ - Input bounds validation    │   │
│   │ - /proposals              │     │ - Deterministic mock presets │   │
│   │ - /history                │     │ - Safe operation application │   │
│   └─────────────┬─────────────┘     └──────────────────────────────┘   │
│                 │                                                      │
│                 │ Services (with Row-Level Locks)                      │
│                 ▼                                                      │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Concurrency & Persistence Layer (SQLAlchemy 2.x)               │   │
│   │ - SELECT ... FOR UPDATE row locking on demo_sessions           │   │
│   │ - Revision monotonicity checks (expectedRevision)              │   │
│   │ - Idempotency replay cache (idempotency_records)               │   │
│   └─────────────┬──────────────────────────────────────────────────┘   │
└─────────────────┼──────────────────────────────────────────────────────┘
                  │ Connection Pool (psycopg)
                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       POSTGRESQL 16 DATABASE                           │
│                                                                        │
│   - demo_sessions (id, token_hash [SHA-256], revision, assumptions)   │
│   - proposal_workspaces (session_id, base_revision, status, title)     │
│   - proposal_variants (workspace_id, operations, reset_snapshots)      │
│   - change_transactions (session_id, resulting_rev, kind, provenance)  │
│   - idempotency_records (session_id, idempotency_key, response_body)   │
└────────────────────────────────────────────────────────────────────────┘
```

### The Strict Engine Separation Invariant
The TypeScript calculation engine (`calculateModel`, `buildTraceIndex`, `calculateProposalVariantComparison`) in `src/domain/` is the **single and authoritative** implementation of financial formulas (Revenue, Payroll, OpEx, EBITDA, Ending Cash, and Trace DAG).
The Python backend **never** duplicates financial calculations or formulas. The backend authoritatively stores and validates raw assumptions, handles revision monotonicity, manages proposal workspaces/variants, records transaction provenance, and returns hydrated snapshots. The client calculates all derived financial outputs instantly in memory upon receiving server assumptions.

---

## 2. Capability Token & Session Isolation

1. **Anonymous Bearer Capability:**
   - On first visit, the client generates a high-entropy UUID token and persists it in `localStorage['mcrl.workspace-token.v1']`.
   - The token is sent in the `X-Workspace-Token` HTTP header on all API calls.
2. **SHA-256 Token Hashing:**
   - The backend computes `hashlib.sha256(token.encode()).hexdigest()` and queries `demo_sessions.token_hash`.
   - Raw tokens are **never** stored in the database, logged, or exposed in error messages.
3. **Session Expiry (30-day inactivity):**
   - If a session has not been updated in 30 days (`updated_at < now - 30 days`), `POST /api/v1/session` automatically resets the session to a fresh baseline seed, advances revision to 1, and marks `sessionResetBecauseExpired: true`.
   - Other endpoints reject expired tokens with `401 Unauthorized`, prompting the client to reinitialize.

---

## 3. Concurrency, Locking & Idempotency Controls

### Row-Level Session Locking (`SELECT ... FOR UPDATE`)
All mutating endpoints acquire an exclusive database lock on the active `demo_sessions` row before reading or modifying state:
```python
session = db.scalar(
    select(DemoSession)
    .where(DemoSession.id == session_id)
    .with_for_update()
)
```
This guarantees strict serializability of concurrent requests within each user's session without table-level locking.

### Revision Conflict Protection (`expectedRevision`)
- Every mutation payload must include `expectedRevision: number`.
- If `session.revision != expectedRevision`, the backend immediately rejects the request with HTTP `409 Conflict` (`code: "revision_conflict"`).
- Concurrent edits to baseline assumptions automatically mark active proposal workspaces as stale (`isStale: true`), disabling acceptance while preserving inspection.

### Idempotency Replay Cache
- All mutating endpoints require an `Idempotency-Key` header generated per intent.
- Before acquiring a session lock, the backend checks `idempotency_records` for a matching `(session_id, idempotency_key, method, path, request_hash)`.
- If a match exists, the cached response status and payload are replayed identically without re-executing mutations.

---

## 4. API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health`, `/api/v1/health` | Health check verifying PostgreSQL connectivity (503 on DB unreachable). |
| `POST` | `/api/v1/session` | Upserts anonymous session by token hash; returns full snapshot. |
| `GET` | `/api/v1/session` | Reloads current session snapshot with baseline, working, workspace, and history. |
| `GET` | `/api/v1/model` | Returns baseline assumptions, working assumptions, and revision. |
| `PATCH` | `/api/v1/model/assumptions` | Direct edit to single assumption cell; returns updated snapshot. |
| `POST` | `/api/v1/model/reset` | Resets working assumptions to baseline; clears active proposals. |
| `POST` | `/api/v1/proposals` | Generates deterministic preset proposal workspace. Rejects if active workspace exists. |
| `POST` | `/api/v1/proposals/:id/variants` | Duplicates a variant (up to maximum 3 variants). |
| `PATCH` | `/api/v1/proposals/:id/variants/:vid` | Edits a single operation in a variant draft. |
| `POST` | `/api/v1/proposals/:id/variants/:vid/reset` | Resets a variant back to its creation snapshot operations. |
| `DELETE` | `/api/v1/proposals/:id/variants/:vid` | Removes a non-original variant (minimum 1 variant required). |
| `PATCH` | `/api/v1/proposals/:id/selection` | Updates selected and comparison variant IDs. |
| `POST` | `/api/v1/proposals/:id/accept` | Atomically commits variant operations into working assumptions; creates transaction. |
| `POST` | `/api/v1/proposals/:id/reject` | Discards proposal workspace without mutating canonical model. |
| `POST` | `/api/v1/proposals/:id/archive` | Moves active workspace into archived stale workspaces. |
| `POST` | `/api/v1/proposals/:id/dismiss` | Dismisses proposal workspace from review. |
| `POST` | `/api/v1/undo` | Undoes the most recent forward transaction; restores previous assumptions. |
| `GET` | `/api/v1/history` | Returns paginated transaction history with provenance metadata. |

---

## 5. Local Setup & Verification

### Prerequisites
- Docker & Docker Compose
- Python 3.12+ and `uv`
- Node.js 22+ and `npm`

### 1. Database Setup
```bash
docker compose up -d
# Verify PostgreSQL is healthy on localhost:5432
docker compose ps
```

### 2. Backend Setup & Tests
```bash
cd backend
uv sync --locked
uv run alembic upgrade head
uv run ruff check app tests
uv run ruff format --check app tests
uv run pytest
cd ..
```

### 3. Frontend Setup, Verification & Production Build
```bash
npm ci
npm run typecheck
npm run lint
npm run format
npm test -- --run
VITE_API_BASE_URL=http://127.0.0.1:8000 npm run build
```

### 4. End-to-End & Accessibility Tests
```bash
npm run test:e2e
```
