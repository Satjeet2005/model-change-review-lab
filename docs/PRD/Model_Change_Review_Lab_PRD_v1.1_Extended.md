# Product Requirements Document: Model Change Review Lab

**Version:** 1.0  
**Status:** Implementation-ready specification  
**Prepared:** 10 October 2026  
**Target role:** Frontend Engineer — Drivetrain (India / Remote)  
**Intended implementation:** React + TypeScript, built incrementally with coding agents  
**Project type:** Independent portfolio/proof-of-impact prototype; not affiliated with Drivetrain

---

## 0. Read this first: build contract

This PRD is the source of truth for implementation. Coding agents must implement the product in phases and must not silently add features, change domain rules, substitute real AI for the mock, or make unsupported claims about Drivetrain.

### Non-negotiable invariants

1. **Independent work:** The application is an independent prototype inspired by public descriptions of AI-native financial planning and analysis (FP&A). It is not affiliated with Drivetrain, does not use Drivetrain data, and does not reproduce its implementation.
2. **Synthetic data only:** Every displayed financial figure is fabricated for the demo. Use USD as an illustrative display unit. Never include customer, employer, or confidential data.
3. **Mock AI only:** The app must not call an LLM, external API, MCP server, or remote service. All proposals come from a deterministic local `ProposalProvider` and are visibly labelled “Simulated AI proposal”.
4. **Human approval before applying a proposal:** Generating or previewing a proposal must never mutate the active financial model. A proposal only becomes active after the user explicitly accepts it or edits it and then accepts it.
5. **All changes are validated and atomic:** An accepted proposal either applies every operation or none. No partial application is allowed. Manual assumption edits are also validated and committed through the same domain transaction pathway.
6. **One source of truth for calculations:** Revenue, payroll, operating expense, EBITDA, cash, scenario comparison and preview values must come from the same pure TypeScript calculation engine. Do not compute the same metric separately inside React components.
7. **Deterministic calculations:** The same input assumptions must produce exactly the same rounded output values and trace graph. No random values or current timestamps may influence model arithmetic.
8. **Traceability:** Every calculated output cell must have an explainable formula and valid input references. No dangling trace edges.
9. **Stale proposal safety:** A proposal generated against an earlier model revision cannot be accepted after the underlying model has changed. The UI must explain why and require regeneration or rejection.
10. **Measured, not invented, performance:** Record the actual benchmark method and environment. Never insert expected numbers into the README as if measured.
11. **Performance harness is separate from the finance model:** The 10,000 × 24 synthetic grid measures virtualized UI behavior. It is not part of the financial calculation engine and must not imply 10,000 rows of real financial data.
12. **No premature outreach:** The project is not ready to share until its core flow works, tests pass, the disclosure is present, and a live demo or reproducible local run is available.

### Implementation order is mandatory

Do not start by styling the whole application. Build and test the domain types, validation, calculation engine and trace model first. Then build the grid, proposal review flow, undo/history, comparison chart, and performance lab. Finish with accessibility, polish, documentation, and deployment.

---

## 1. Product summary

### 1.1 Product name

**Model Change Review Lab**

### 1.2 One-sentence description

An independent, frontend-focused prototype of a financial planning model where a simulated AI proposal can be previewed, edited, accepted or rejected; calculations update deterministically only after a valid commit; users can trace outputs to assumptions; and the spreadsheet-style UI is stress-tested on a large synthetic grid.

### 1.3 Why this project exists

The target Frontend Engineer role explicitly calls out complex data visualization, performant charts and tables, a spreadsheet-inspired business-modelling system, React, data structures, accessibility, reusable components, and performance. Drivetrain's public product messaging also describes AI-assisted work under user oversight, deterministic calculations, source traceability, and controls around model changes.

The project should demonstrate engineering judgment at the intersection of those themes, not pretend to identify an internal Drivetrain defect.

### 1.4 The product problem we are exploring

> How might an interface let a user evaluate a proposed change to a financial planning model without losing control of the model, obscuring downstream consequences, or making the results difficult to explain?

This is a **design/engineering question for an independent prototype**, not a claim that Drivetrain's current product fails to do this.

### 1.5 Primary demo narrative

A reviewer should be able to understand the value in roughly 90 seconds:

1. They see a 24-month planning model with assumptions and calculated outputs.
2. They select a predefined request such as “Add two engineers starting in Month 7”.
3. The application displays the proposed assumption changes and predicted downstream impact without applying them.
4. The reviewer edits the proposal, accepts it, or rejects it.
5. On acceptance, the same deterministic calculation engine recomputes the model; the chart and values update together.
6. The reviewer clicks a calculated value and sees its formula and source assumptions.
7. The reviewer can undo the accepted change and can inspect baseline-versus-working scenario differences.
8. A separate Performance Lab demonstrates virtualized rendering on a seeded 10,000-row × 24-column synthetic grid and displays real measurements.

### 1.6 Target reviewer

A frontend engineer, engineering manager, CTO, or product leader assessing whether the candidate can reason about complex interactive UIs, state correctness, financial-data presentation, accessible interactions, tests, and performance.

### 1.7 Project positioning

This project is proof of frontend and product-engineering ability. It is **not**:

- a finance system suitable for real business decisions;
- an attempt to clone Drivetrain's UI;
- an implementation of Drivetrain's formulas, internal APIs, permission model, or architecture;
- a real AI agent or MCP integration;
- production-grade financial controls, accounting, authorization, or audit compliance.

---

## 2. Evidence, assumptions, and hypotheses

Keep the following categories distinct in code comments, README, case study, and outreach.

### 2.1 Source-supported signals

The supplied research materials report these public signals:

- The Frontend Engineer role calls out complex/performance-sensitive charts and tables and a spreadsheet-inspired business-modelling system.
- Drivetrain's public Drive AI messaging describes user approval/oversight, deterministic calculation of numbers, source traceability, auditability, and data-access controls.
- Leadership commentary has framed the controlled system around a model—the “harness”—as important: determinism, repeatability, access boundaries, and collaboration.
- The product has public demos for model building, scenarios, formulas, reporting, headcount planning, and related workflows.
- External reviews from May–June 2025 mentioned areas such as dashboard/reporting UX, model mechanics, load times, and complex linking. Drivetrain's public responses in August 2025 described work on UX/reporting and performance at that time.

These are public descriptions and historical reports. They are not evidence of a current unreported defect. The project must not frame them as one.

### 2.2 Product hypotheses this prototype will explore

- A visible before/after proposal diff can help a user understand a proposed change before committing it.
- A review gate can separate a proposal from an applied change in a way that is easy to inspect and test.
- A consistent formula/trace panel can make derived outputs easier to explain.
- Virtualized grid rendering can keep the visible UI bounded even when the synthetic dataset is much larger than the viewport.
- Explicit stale-proposal handling can protect against applying a proposal computed against outdated assumptions.

These are hypotheses to demonstrate, not findings about Drivetrain's implementation.

### 2.3 Claims the project may make only after evidence exists

Allowed after implementation and measurement:

- “The prototype rejects invalid edits and applies valid proposal changes atomically.”
- “The calculation engine is deterministic for the covered model inputs and tests.”
- “The performance lab renders a virtualized view of 10,000 synthetic rows × 24 columns on the documented test environment.”
- “The measured p50/p95 interaction latency was X under the stated method.”

Not allowed without separate evidence:

- “Drivetrain has this bug.”
- “This is how Drivetrain works internally.”
- “The demo is production-ready financial software.”
- “The measured performance represents every device/browser or Drivetrain's performance.”
- “The app uses AI/MCP/LLMs” when the proposal provider is a deterministic mock.

---

## 3. Goals and non-goals

### 3.1 Goals

**G1 — Demonstrate a trustworthy proposal workflow.** A proposal is visible before it can change the model; the reviewer can inspect the diff and downstream impact; acceptance is explicit.

**G2 — Demonstrate deterministic calculations.** Business metrics are derived by pure tested TypeScript functions and update consistently after accepted changes.

**G3 — Demonstrate explainability.** Every computed cell can show the formula and the assumptions or upstream results it depends on.

**G4 — Demonstrate spreadsheet-like interaction.** Inputs can be edited by keyboard and mouse with validation, predictable focus, and clear errors.

**G5 — Demonstrate correct scenario comparison.** Baseline remains unchanged while the working scenario changes; tables and charts use the same calculation outputs.

**G6 — Demonstrate disciplined performance work.** The app virtualizes a separate synthetic large grid and reports real measurements with a reproducible method.

**G7 — Make code reviewable.** The domain layer is independent from React, dependencies are limited, tests cover important invariants, and documentation states limitations.

### 3.2 Non-goals

Out of scope for MVP:

- actual LLM integration, prompt engineering, agent orchestration, RAG, embeddings, or MCP;
- real Drivetrain APIs, credentials, or product data;
- authentication, roles, permissions, or multi-user collaboration;
- backend, database, remote persistence, or cloud architecture;
- a general-purpose spreadsheet formula parser;
- arbitrary cell formulas authored by users;
- production financial/accounting logic, taxes, debt, working capital, revenue recognition, depreciation, cap table logic, currency conversion, or compliance/audit guarantees;
- importing real spreadsheets or connecting to actual data providers;
- advanced formula dependency editing, drag-fill, copy/paste ranges, multi-cell selection, or collaborative editing;
- a full financial dashboard or clone of any company's product;
- complex animation, decorative 3D visuals, or nonessential charts;
- spending time on a physical mailing package before the online artifact is complete and useful.

---

## 4. Users, use cases, and product success

### 4.1 Primary user: hiring reviewer

Needs to quickly understand what the prototype does, interact with its core flow without setup, inspect engineering choices, and tell which behavior is implemented versus mocked.

### 4.2 Secondary user: candidate/developer

Needs a manageable vertical slice to build in about seven focused working days, with a clear implementation order and measurable quality gates.

### 4.3 Core jobs to be done

- “When someone proposes a model change, I want to see what would change before committing it.”
- “When I accept a change, I want every downstream metric to recalculate consistently.”
- “When I see a calculated number, I want to inspect how it was derived.”
- “When I edit a cell, I want immediate validation and reliable keyboard behavior.”
- “When I compare scenarios, I want to see the direction and size of the differences.”
- “When a proposal is based on old inputs, I want the app to prevent me from applying it accidentally.”
- “When I assess performance, I want measured results rather than unsubstantiated speed claims.”

### 4.4 Success criteria

A successful project enables a reviewer to:

- finish the main proposal/review/accept/trace/undo journey in under two minutes without instructions;
- distinguish assumptions from derived values;
- understand that proposal generation is simulated and calculations are deterministic;
- verify that Reject makes no change to the model, accepted changes recompute outputs, and Undo restores the previous working snapshot/history;
- inspect an output's formula and valid dependency path;
- use the model grid without a mouse for the primary edit cycle;
- open the performance lab and understand its dataset, measurements, and limitations;
- find the run instructions, tests, architecture, and disclosure in the README.

These are usability/behavior criteria, not a guarantee of interview outcomes.

---

## 5. MVP scope and priorities

### P0 — Required for an acceptable demo

1. React + TypeScript application scaffold with strict type checking.
2. Seeded synthetic 24-month financial model.
3. Pure, deterministic calculation engine.
4. Explicit assumption rows and derived output rows.
5. Keyboard-accessible grid edit flow and numeric validation.
6. Deterministic mock proposal provider behind an interface.
7. Proposal preview with affected cells and before/after values.
8. Accept / Edit / Reject workflow with atomic commit and stale proposal protection.
9. Change history and Undo.
10. Output-to-input trace panel.
11. Baseline vs working scenario comparison table and one accessible chart.
12. Separate 10,000 × 24 synthetic grid with row virtualization.
13. Built-in or documented performance measurement method.
14. Unit and interaction tests for core invariants.
15. README disclosure, architecture diagram, CI checks, live deployment or reproducible local run.

### P1 — Required before outreach if time allows

- polished empty, loading, error, stale, and success states;
- responsive layout at desktop and mobile widths;
- reduced-motion support and accessible focus styling;
- a 90-second walkthrough recording;
- a one-page engineering note explaining one non-obvious trade-off;
- a short “AI assistance and verification” note describing what coding tools helped with and what was independently checked.

### P2 — Explicitly defer unless P0 and P1 are complete

- live LLM adapter;
- backend persistence;
- collaborative editing;
- actual finance import/export;
- full keyboard range selection/copy/paste;
- formula parsing;
- server auth or permission simulation beyond explanatory labels;
- multiple chart types or a general dashboard builder.

### 5.1 Requirement IDs and traceability

These IDs are the implementation checklist. Agents should reference an ID in phase summaries and tests where practical. P0 requirements are release-blocking.

| ID | Priority | Requirement | Acceptance evidence |
|---|---|---|---|
| FR-001 | P0 | App loads directly into the independent prototype with synthetic-data/mock-AI disclosure. | Initial-load UI test and README disclosure. |
| FR-002 | P0 | Seed a deterministic 24-month baseline and working copy. | Seed fixture tests; baseline/working independence test. |
| FR-003 | P0 | Render five editable assumption rows, six calculated rows and two model-level settings. | Model grid integration test. |
| FR-004 | P0 | Support keyboard navigation and editable-cell lifecycle. | Enter/Escape/arrows/Tab tests and manual keyboard run. |
| FR-005 | P0 | Validate every manual input with type/range-aware rules. | Boundary, malformed input and fractional-FTE tests. |
| FR-006 | P0 | Commit manual edits as validated single transactions. | Valid edit recomputes once; invalid edit leaves state unchanged. |
| FR-007 | P0 | Provide three deterministic proposal templates behind `ProposalProvider`. | Template operation tests; no network calls. |
| FR-008 | P0 | Preview proposal diffs and downstream metric impacts without modifying working state. | Preview-vs-committed snapshot equality test. |
| FR-009 | P0 | Edit proposal operations in a draft separate from the model. | Editing does not change current grid; accepted value uses draft. |
| FR-010 | P0 | Accept a valid proposal atomically as one transaction. | Multi-operation commit/rollback tests. |
| FR-011 | P0 | Reject a proposal without changing canonical state/history. | Deep-equality invariant test. |
| FR-012 | P0 | Prevent acceptance of stale proposals and duplicate commits. | Stale-after-edit/undo/reset tests; double-accept test. |
| FR-013 | P0 | Calculate all metrics through one pure deterministic engine. | Formula, rounding, immutability and repeatability tests. |
| FR-014 | P0 | Trace each calculated cell to formula and valid dependencies. | No-dangling-reference and chain-to-assumptions tests. |
| FR-015 | P0 | Preserve immutable baseline and mutable working scenario. | Baseline immutability tests across edit/accept/undo/reset. |
| FR-016 | P0 | Compare baseline/working with a chart and tabular alternative. | Chart/table same-data test; zero-baseline case. |
| FR-017 | P0 | Undo last manual edit or accepted proposal as one unit. | Snapshot restoration/history tests. |
| FR-018 | P0 | Reset working scenario only after explicit confirmation. | Reset behavior and confirmation test. |
| FR-019 | P0 | Generate stable 10,000 × 24 synthetic performance data. | Deterministic dataset fixture test. |
| FR-020 | P0 | Virtualize performance grid rows and keep edits while scrolling. | Rendered-row cap and virtual edit persistence tests. |
| FR-021 | P0 | Measure grid readiness, edit latency, model recompute and row count honestly. | Benchmark UI shows no pre-filled result; method documented. |
| FR-022 | P0 | Make primary flows keyboard accessible with visible focus and non-color-only cues. | Component tests plus manual accessibility pass. |
| FR-023 | P0 | Keep the app usable on desktop and narrow/mobile widths. | Responsive manual test; no unintended page horizontal overflow. |
| FR-024 | P0 | Provide tests for domain invariants and critical interactions. | Required tests pass and command results are recorded. |
| FR-025 | P0 | Document formulas, setup, limitations and independent-project disclosure. | README checklist. |
| FR-026 | P0 | CI runs lint, typecheck, tests and production build. | Green CI run or exact documented environment blocker. |
| FR-027 | P0 | Make no network request to real AI, Drivetrain, or external data services. | Code review and browser network inspection. |
| NFR-001 | P0 | Domain logic stays independent of React/browser/UI dependencies. | Import-boundary review. |
| NFR-002 | P0 | No external API keys, confidential data or personal/company data. | Repository secret/data scan and manual review. |
| NFR-003 | P0 | Performance claims are reproducible and tied to environment/method. | README measurements and benchmark controls. |
| NFR-004 | P1 | Visual design prioritizes grid/diff clarity over decoration. | Human design review against Section 13. |
| NFR-005 | P1 | User-facing status/errors are understandable and announced accessibly. | Live-region/focus checks. |
| NFR-006 | P1 | App loads quickly without unnecessary dependencies and unused abstractions. | Dependency/diff review. |

---

## 6. Domain and model specification

This section defines the canonical model. Agents must not invent additional formula semantics. If a rule proves technically inconsistent, report it and propose a specific change before implementation.

### 6.1 Units and horizon

- **Horizon:** 24 monthly periods, labelled `M01` through `M24`.
- **Grouping:** Year 1 = M01–M12; Year 2 = M13–M24. Quarter labels may be displayed for navigation (Q1=M01–M03, Q2=M04–M06, Q3=M07–M09, Q4=M10–M12, then repeat for Year 2).
- **Currency:** USD, used only as synthetic illustrative data.
- **Headcount:** integer full-time-equivalent (FTE) count.
- **Growth:** decimal stored as a fraction; display as a percentage. For example, `0.025` displays as `2.5%`.
- **Rounding:** displayed and committed monetary outputs are rounded to two decimal places (cents) at each derived money step. Use one shared `roundMoney` utility. Avoid inconsistent rounding between grid, chart, diff, and trace panel.

### 6.2 Canonical model inputs

`ModelAssumptions` contains:

- `startingRevenueUsd: number` — the revenue level immediately before M01, used as the revenue base for M01.
- `startingCashUsd: number` — opening cash immediately before M01.
- `months: MonthAssumptions[]` — exactly 24 entries in period order.

Each `MonthAssumptions` contains:

- `period: PeriodIndex` — integer 1 through 24; unique and ordered.
- `revenueGrowthRate: number` — monthly growth fraction, default 0.025.
- `engineeringFte: number` — integer engineering headcount assumption.
- `otherFte: number` — integer non-engineering headcount assumption.
- `loadedMonthlyCostPerFteUsd: number` — illustrative average loaded monthly cost per FTE.
- `otherOperatingExpenseUsd: number` — illustrative monthly operating expense excluding payroll.

Scenario settings are synthetic, and the model does not represent a real company's forecast.

### 6.3 Seed data

Use deterministic seed data with these values and rules:

- `startingRevenueUsd = 750000`.
- `startingCashUsd = 3000000`.
- Every month's `revenueGrowthRate = 0.025` (2.5%).
- `loadedMonthlyCostPerFteUsd = 12000` for all months.
- `otherOperatingExpenseUsd = 240000` for all months.
- `engineeringFte`: M01–M06 = 12; M07–M12 = 14; M13–M18 = 16; M19–M24 = 18.
- `otherFte`: M01–M06 = 18; M07–M12 = 20; M13–M18 = 22; M19–M24 = 24.

Seed data must be generated by a deterministic function (or explicit fixture), not `Math.random()`. A fresh page load initializes a clean default baseline and working scenario. MVP persistence is in-memory only; refresh resets the demo.

### 6.4 Derived values and formulas

For each period `t`:

1. **Revenue**
   - `revenue[1] = roundMoney(startingRevenueUsd * (1 + growthRate[1]))`.
   - For `t > 1`: `revenue[t] = roundMoney(revenue[t-1] * (1 + growthRate[t]))`.
2. **Total headcount**
   - `totalFte[t] = engineeringFte[t] + otherFte[t]`.
3. **Payroll expense**
   - `payroll[t] = roundMoney(totalFte[t] * loadedMonthlyCostPerFteUsd[t])`.
4. **Total operating expense**
   - `totalOperatingExpense[t] = roundMoney(payroll[t] + otherOperatingExpenseUsd[t])`.
5. **EBITDA (simplified)**
   - `ebitda[t] = roundMoney(revenue[t] - totalOperatingExpense[t])`.
6. **Ending cash**
   - `endingCash[1] = roundMoney(startingCashUsd + ebitda[1])`.
   - For `t > 1`: `endingCash[t] = roundMoney(endingCash[t-1] + ebitda[t])`.

**Important simplified-model note:** EBITDA is used only as an illustrative revenue-minus-operating-expense measure. The model omits taxes, capital expenditure, debt, working capital, deferred revenue, and other finance/accounting behavior. Ending cash is a simplified rolling total, not a finance-grade cash-flow forecast.

### 6.5 Grid row groups

The Model grid must contain the following groups in this order:

**Assumptions (editable):**

1. Revenue growth (%)
2. Engineering headcount (FTE)
3. Other headcount (FTE)
4. Loaded monthly cost per FTE ($)
5. Other operating expense ($)

**Calculated (read-only):**

6. Revenue ($)
7. Total headcount (FTE)
8. Payroll expense ($)
9. Total operating expense ($)
10. EBITDA ($)
11. Ending cash ($)

Model-level settings `Starting revenue ($)` and `Starting cash ($)` must be visible in a compact “Model settings” area and editable with the same validation/transaction semantics. They are not duplicated in all 24 month columns.

### 6.6 Preset proposal templates

The proposal provider supports exactly these three predefined choices for MVP. Buttons/labels may be phrased naturally, but the provider must use stable IDs and deterministic operations.

**Template A — Hire two engineers from Q3 onward**

- ID: `hire-engineers-from-q3`.
- Display text: “Add 2 engineering hires from M07 (Q3) onward”.
- Operations: add `2` to `engineeringFte` for M07 through M24 inclusive (18 cell operations).
- Because this is a proposal, those cells remain unchanged until Accepted.
- Preview all changed assumption cells and show resulting deltas for payroll, EBITDA, and ending cash.

**Template B — Increase monthly revenue growth from Q3 onward**

- ID: `increase-growth-from-q3`.
- Display text: “Increase monthly revenue growth by 1 percentage point from M07 onward”.
- Operations: add `0.01` to `revenueGrowthRate` for M07 through M24 inclusive (18 cell operations).
- Display the percentage-point change clearly (e.g., `2.5% → 3.5%`), not as `0.025 → 0.035` in the visible UI.
- Preview compounded revenue differences and downstream EBITDA/cash changes.

**Template C — Reduce other operating expense**

- ID: `reduce-opex-from-m04`.
- Display text: “Reduce other operating expense by 8% from M04 onward”.
- Operations: set `otherOperatingExpenseUsd` to `roundMoney(currentValue * 0.92)` for M04 through M24 inclusive (21 cell operations).
- Preview resulting expense, EBITDA and cash deltas.

All templates operate on the current working scenario at the time the proposal is generated. The proposal captures that scenario's revision. The provider must not silently modify values outside its listed operations.

### 6.7 Proposal representation

Each `ChangeProposal` must have:

- stable `id` (deterministic for test fixtures or generated by a local sequence, not used for model arithmetic);
- `templateId`;
- human-readable `title` and `rationale`;
- `baseRevision` representing the working model version against which it was generated;
- ordered `operations[]`;
- creation time only if needed for display (must not affect calculations); and
- `status` held in app/UI state, not mutated inside canonical assumptions.

Each `ProposalOperation` must identify:

- target assumption key;
- target period, or `null` for model-level setting;
- previous value captured from the proposal's base snapshot;
- proposed value;
- display unit/format;
- a user-readable change label.

Do not use freeform natural-language parsing for the MVP. A user selects one of the stable templates, which returns pre-defined operations. This avoids implying that an AI understood a prompt.

### 6.8 Model version and stale-proposal rules

- The working model has a monotonic `revision` token that changes after every successful model transaction and every Undo/Reset action.
- A pending proposal is valid only when `proposal.baseRevision === workingModel.revision`.
- If the user edits an assumption, accepts another proposal, undoes a change, or resets the working scenario while a proposal is pending, the proposal becomes stale.
- Stale proposals show a clear warning: “The model changed after this proposal was prepared. Regenerate it before accepting.”
- Accept is disabled for stale proposals. Edit and Accept must not bypass the stale guard. The user may Reject the stale proposal or regenerate it against the latest model.
- `revision` is a concurrency guard, not a user-visible financial value. Undo restores the prior assumptions and change-history snapshot while increasing the monotonic revision token, so an old proposal cannot become valid again just because the values happen to match.

### 6.9 Validation rules

Validation happens before any canonical state mutation.

| Input | Rule | On invalid value |
|---|---|---|
| `startingRevenueUsd` | Finite number; 0 to 1,000,000,000 inclusive | Reject edit and show field-level message |
| `startingCashUsd` | Finite number; 0 to 1,000,000,000 inclusive | Reject edit and show field-level message |
| `revenueGrowthRate` | Finite number; -0.5 to +0.5 inclusive | Reject edit and show field-level message |
| FTE fields | Integer; 0 to 1,000 inclusive | Reject decimals, text, blanks and out-of-range values |
| `loadedMonthlyCostPerFteUsd` | Finite number; 1 to 100,000 inclusive | Reject edit and show field-level message |
| `otherOperatingExpenseUsd` | Finite number; 0 to 1,000,000,000 inclusive | Reject edit and show field-level message |

Additional rules:

- Reject empty, whitespace-only, `NaN`, `Infinity`, `-Infinity`, and numeric strings with trailing garbage.
- Do not silently coerce malformed values to zero.
- Do not partially apply a multi-operation proposal. Validate all operations against a draft first; commit all if all are valid, otherwise commit none.
- Duplicate operations targeting the same cell are invalid unless a deterministic normalization strategy is separately approved. Prefer rejecting duplicates in MVP.
- A resulting negative ending cash value is allowed in the illustrative model and should be displayed with a readable warning style; it is not an invalid input.
- A calculated zero is a legitimate result and must not be confused with missing data.

---

## 7. Information architecture and screen specification

### 7.1 Application navigation

The application uses a small tab set:

1. **Model** — core planning grid and proposal workflow.
2. **Scenario comparison** — baseline-versus-working metrics, chart and delta table.
3. **Performance Lab** — large synthetic grid and benchmark measurements.
4. **Change history** — accepted/manual commits and Undo context. A history section can be included on the Model page if this gives a simpler interface; there must still be an obvious way to inspect the latest changes.

Do not add a marketing homepage or onboarding flow. Load directly into the usable demo.

### 7.2 Shared app shell

Header requirements:

- Product title: “Model Change Review Lab”.
- Visible status label: “Independent prototype · Synthetic data”.
- Small disclosure/tooltip stating the proposal step is simulated and no external AI is called.
- Main tabs.
- Undo button, disabled when there is no eligible transaction to undo.
- Reset working scenario button; confirm before discarding changes.
- No Drivetrain logo, copied visual identity, or claim of affiliation.

### 7.3 Model screen layout

Recommended desktop hierarchy:

1. **Header and navigation.**
2. **Compact model summary strip:** revenue in M24, EBITDA in M24, ending cash in M24, and working-scenario delta from baseline. These are derived from the engine; no extra formula implementation.
3. **Propose a change panel:** three preset proposal actions, with one sentence clarifying that the proposal is simulated.
4. **Proposal review panel:** only visible when a proposal exists. Shows title/rationale, model revision, affected assumptions, before/after values, preview deltas, Edit/Accept/Reject, and stale/validation messages.
5. **Model settings:** starting revenue and starting cash.
6. **Planning grid:** assumption and calculated row groups across M01–M24. Sticky header and sticky row-label column are preferred.
7. **Trace panel:** opens when a calculated output is selected; can be a right-side drawer on wide screens or an inline panel on narrow screens.

Keep the grid the visual centre. Do not turn this into a KPI dashboard with the table pushed below the fold.

### 7.4 Planning grid visual behavior

- Currency values use consistent number formatting with currency and readable precision; avoid showing unnecessary decimal places in every cell. Detailed trace may show cents.
- Growth cells show percentages, not raw fractions.
- Headcount cells show integer FTEs.
- Assumption and calculated row groups must be visually distinguishable and explicitly labelled.
- Calculated cells must not look editable. Add a read-only cue or appropriate interaction affordance for trace inspection.
- Hover, focus, edited, invalid, selected-trace and changed-by-proposal states must be distinct without relying on color alone.
- Sticky column/row headers must not obscure keyboard focus or trace selection.
- Provide a readable compact label for each month including year/quarter grouping.
- Where a proposal affects a cell, mark the preview state only in the proposal preview; do not visually imply that canonical model cells already changed.
- Baseline and working-scenario difference indicators must include text or symbols in addition to color.

### 7.5 Proposal review states

The proposal panel must support the following states:

- **Empty:** no proposal selected; instructions show how to generate one.
- **Generating:** action disabled to prevent duplicate requests; short nonblocking progress indication.
- **Review:** show the diff and preview-only output deltas.
- **Editing proposal:** proposed values are editable separately from the model; current model cells remain unchanged.
- **Invalid edited proposal:** field-level errors shown; Accept disabled; no partial update.
- **Stale:** explain that the base model changed; Accept disabled.
- **Accepted:** proposal panel confirms acceptance, applied operations and resulting model update; after a short acknowledgement it may collapse but the change remains in history.
- **Rejected:** model has not changed; panel may show a brief confirmation before clearing.
- **Unexpected failure:** explain that no change was committed and offer retry. Do not leave a partially modified model.

### 7.6 Diff presentation

Every proposed cell change shows:

- row/assumption name;
- period;
- current value;
- proposed (or edited) value;
- absolute or percentage-point delta appropriate to the unit;
- validation state if edited.

For proposals spanning many periods, group the changes by row (e.g. “Engineering headcount · M07–M24”) and allow the reviewer to expand all cells. The collapsed group must still clearly communicate how many cells change and the period range. Do not hide the detailed cell changes entirely.

The preview should include at least:

- Payroll expense impact;
- EBITDA impact;
- Ending cash impact;
- Revenue impact when the proposal affects growth.

These preview results must come from running the canonical calculation engine against a cloned assumption snapshot with proposed operations applied. The active working model must remain unchanged during preview.

### 7.7 Trace panel

When the user selects a calculated cell, show:

- metric name and period;
- formatted calculated value;
- readable formula line;
- direct input/dependency rows with their labels and current values;
- a recursively expanded chain back to assumption cells, where applicable;
- a clear distinction between assumptions and derived values;
- a way to close or change the selection.

Examples:

- `Payroll[M07] = Total headcount[M07] × Loaded monthly cost per FTE[M07]`.
- `EBITDA[M07] = Revenue[M07] − Total operating expense[M07]`.
- `Ending cash[M07] = Ending cash[M06] + EBITDA[M07]`.
- `Revenue[M07] = Revenue[M06] × (1 + Revenue growth[M07])`.

The trace panel is an explanation of the prototype's formula definitions. It must not be described as Drivetrain's proprietary formula semantics.

### 7.8 Scenario comparison screen

- Baseline is an immutable copy of the initial seeded assumptions/outputs.
- Working scenario is the state changed by accepted proposals and direct edits.
- Display a selector for one of Revenue, EBITDA, or Ending cash.
- Show one accessible line chart with baseline and working values across M01–M24.
- Show a data table containing, per period, baseline, working value, absolute delta, and percentage delta where a percentage delta is meaningful.
- If baseline is zero, show percentage delta as “—” or “not applicable”; never divide by zero.
- Provide a concise overall summary using correct model outputs (e.g. M24 cash delta, cumulative revenue delta). Define cumulative revenue as the sum of monthly revenue values from M01–M24 and label it accordingly.
- Charts must include an accessible name/summary and a data-table alternative. The comparison must remain understandable without color perception or hovering.
- Resetting the working scenario restores it to baseline without altering baseline.

### 7.9 Change history screen/section

- List committed model transactions, newest first.
- Each entry contains transaction type (`Accepted proposal` or `Manual cell edit`), short description, affected assumptions/period range, and an understandable before/after summary.
- Rejected proposals are not model-change history entries because they did not change the model.
- Undo removes the latest committed transaction from the restorable model history and restores its previous working assumptions. This is an **undoable demo history**, not an immutable compliance audit log.
- Reset clears the working change history after explicit confirmation.
- Do not claim tamper-proof or compliance-grade auditability.

### 7.10 Performance Lab screen

- Clearly label it “Synthetic UI benchmark — not part of the financial model”.
- Default grid size: 10,000 rows × 24 month-like columns.
- Deterministic seeded values; no `Math.random()`.
- Vertically virtualized rows. Column virtualization is optional because 24 columns are modest; horizontal scrolling is required.
- At most viewport-sized rows plus a documented overscan should be mounted. Acceptance test should assert fewer than 100 visible row elements for the default viewport, excluding header/group labels.
- Allow editing one visible synthetic cell with a sparse local override map. This makes keystroke-to-paint measurements representative of the grid's edit interaction without requiring a 240,000-cell React state tree.
- Use a fixed seed; include row and cell identifiers so repeated runs are comparable.
- Measure dataset generation separately from grid rendering; do not combine them into a misleading “render time”.
- Expose a “Run benchmark” action and clear measurements after a new run.
- Display environment information available from the browser (user agent/browser, viewport size, run time). Ask the developer to manually record machine/CPU/OS in the README rather than pretending browser APIs expose reliable hardware details.

---

## 8. Interaction and state-machine specification

### 8.1 Canonical state versus UI state

Keep canonical model data separate from transient UI concerns.

Canonical state includes:

- baseline assumptions (immutable after seed);
- working assumptions;
- working model revision token;
- calculated outputs/trace generated from current working assumptions, or values derived from them via memoization;
- undo snapshots and committed change history.

UI state includes:

- active tab;
- selected proposal template;
- proposal provider loading state;
- pending proposal and its review/edit/stale state;
- currently edited grid cell and draft text;
- selected trace cell;
- reset confirmation;
- performance run/measurement state.

Do not store duplicate independently mutable copies of values already derivable from canonical assumptions. If outputs are memoized, they must be invalidated from the working assumptions revision and never mutated directly.

### 8.2 Proposal workflow state machine

Expected logical transitions:

`idle → generating → review → editing (optional) → accepted`

Alternate endings:

`review → rejected`, `editing → rejected`, `review/editing → stale`, `stale → regenerated review`, or `generating → error`.

Rules:

- `Accept` only allowed in `review` or `editing`, when the proposal is valid and not stale.
- `Edit` transitions from `review` to `editing`; it does not commit anything.
- `Reject` clears proposal state and leaves model assumptions, outputs, revision and committed history unchanged.
- Generation failures leave the model unchanged and allow retry.
- Any valid committed manual edit or other model transaction invalidates a pending proposal via the revision guard.
- Double-clicking Accept cannot apply a proposal twice. The commit pathway is atomic and idempotent for a proposal ID while it is being handled.

### 8.3 Manual grid edit lifecycle

1. User focuses an editable assumption cell.
2. Enter or an appropriate action enters edit mode.
3. The input displays a human-editable value in a format appropriate to the type.
4. Enter attempts to validate and commit.
5. If valid, commit as one model transaction, recompute outputs through the pure engine, update trace and comparison outputs, increment revision, and record a change-history entry.
6. If invalid, keep the old canonical value; show a field-level error and retain a recoverable edit state.
7. Escape cancels the draft and restores the previous displayed value without mutating the model.
8. A successful edit moves focus in a predictable way and leaves a visible focus indicator.

For money/percentage formatting, separate the draft input representation from the committed numeric representation. Do not parse formatted strings by stripping arbitrary characters in an unsafe way. Use explicit parse/format functions by assumption type.

### 8.4 Required keyboard behavior

- Arrow keys move focus between cells when not editing.
- Enter begins editing an editable assumption cell; while editing, Enter validates and attempts commit.
- Escape cancels active editing; it must not mutate canonical values.
- Tab and Shift+Tab follow a logical order through editable cells and controls.
- Arrow keys while typing must behave like normal text-editing keys (do not hijack caret movement inside the input).
- A focus ring is always visible for keyboard users.
- Derived values are discoverable with the keyboard and can open the trace panel with Enter/Space.
- If the selected/focused row is virtualized out of view, scroll it into view before setting focus.
- The grid must not trap keyboard focus.

### 8.5 Undo and reset

- Undo is disabled when the working transaction history is empty.
- Each successful manual edit or accepted proposal creates one undoable transaction. A multi-cell proposal is one transaction, not 18 separate undo steps.
- Undo restores all assumptions affected by the transaction and returns committed change history to its previous snapshot.
- Undo does not modify the baseline.
- Undo increments the monotonic revision token to invalidate stale proposals.
- Reset restores the working scenario and history to the initial seeded snapshot and increments revision. Baseline remains the initial seed.
- Reset is explicit and confirmable; no accidental single-click data loss.

---

## 9. Calculation engine and trace contracts

### 9.1 Required pure functions

At minimum, implement pure functions equivalent to:

- `createSeedAssumptions(): ModelAssumptions`
- `validateAssumptionValue(target, value): ValidationResult`
- `validateOperationSet(assumptions, operations): ValidationResult`
- `applyOperationsToDraft(assumptions, operations): ModelAssumptions` (never mutate input)
- `calculateModel(assumptions): CalculatedModel`
- `buildTraceIndex(assumptions, calculatedModel): TraceIndex`
- `calculateScenarioDelta(baseline, working): ScenarioComparison`
- `createProposal(templateId, snapshot, revision): ChangeProposal`

Function names may vary slightly, but there must be one well-tested implementation of each responsibility. React components must not implement domain formulas.

### 9.2 Engine invariants

- Input assumption objects are never mutated by calculate/apply functions.
- Input month length must be exactly 24; invalid model shape returns an explicit validation error or throws a well-defined domain error at the boundary. Do not quietly calculate partial models.
- Every derived row contains 24 outputs.
- Derived money values use the shared rounding function.
- All displayed metrics derive from `calculateModel`.
- Repeating `calculateModel` with an equal assumption snapshot gives equal result values and dependency metadata.
- Proposal previews use a cloned draft and the same calculation engine as committed state.
- A failed validation leaves the original snapshot deeply equal to its prior state.

### 9.3 Trace node schema

Each input or calculated cell must have a stable ID, for example:

- `setting:startingRevenueUsd`
- `setting:startingCashUsd`
- `assumption:revenueGrowthRate:M07`
- `assumption:engineeringFte:M07`
- `calculated:revenue:M07`
- `calculated:payroll:M07`

Each trace node includes:

- `id`;
- `kind: 'setting' | 'assumption' | 'calculated'`;
- `label`;
- `period` where applicable;
- `value` and `unit`;
- `formulaLabel` for calculated nodes;
- `inputIds: string[]`.

Trace dependencies must be explicit in calculation definitions rather than guessed by the UI. For every `inputId`, the trace index must contain a matching node. All valid traces must resolve eventually to setting/assumption nodes without a cycle. The current simple financial model should be acyclic by construction.

### 9.4 Formula contracts by row

- Revenue M01 inputs: starting revenue setting + M01 growth assumption.
- Revenue Mt (t>1) inputs: Revenue M(t-1) + growth assumption for Mt.
- Total headcount Mt inputs: Engineering FTE Mt + Other FTE Mt.
- Payroll Mt inputs: Total headcount Mt + Loaded monthly cost per FTE Mt. For transparency, trace may show the total headcount node plus recursively expanded FTE assumption nodes.
- Total operating expense Mt inputs: Payroll Mt + Other operating expense Mt.
- EBITDA Mt inputs: Revenue Mt + Total operating expense Mt.
- Ending cash M01 inputs: Starting cash setting + EBITDA M01.
- Ending cash Mt (t>1) inputs: Ending cash M(t-1) + EBITDA Mt.

### 9.5 Trace acceptance criteria

- Click a derived cell; panel shows the correct formula label and current computed value.
- Every direct input reference resolves to a node.
- Expanding a trace shows all assumption inputs needed for the output.
- Editing an assumption recomputes the trace values; no stale prior values remain.
- Trace is consistent with the currently selected scenario (working, and baseline where explicitly supported).
- Invalid/dangling trace references fail unit tests.
- Trace output does not claim to reveal a real Drivetrain formula or private implementation.

---

## 10. Transaction, history, and atomicity requirements

### 10.1 Transaction object

Each committed change should have a transaction record with:

- transaction ID;
- kind: `manual-edit` or `proposal-accepted`;
- user-readable description;
- previous assumptions snapshot (or an equivalent reversible patch);
- next assumptions snapshot or operations;
- changed cell identifiers;
- previous/next working revision tokens if useful for debugging (revision remains monotonic at the app state boundary);
- history entry data shown in UI.

A single accepted proposal with 18 operations is one transaction.

### 10.2 Commit algorithm

On manual edit commit or proposal acceptance:

1. Validate requested value/operation set against current canonical assumptions.
2. Verify any proposal's base revision matches current revision.
3. Apply operations to a draft copy only.
4. Verify resulting model shape and assumptions.
5. Calculate all derived outputs from the draft through the pure engine.
6. Build/validate trace metadata for the draft.
7. If any step fails, discard the draft and leave canonical state untouched; surface an error.
8. If all steps pass, commit the new assumptions and derived result as one reducer/domain transaction, add history/undo snapshot, increment revision and clear/close the applied proposal.

No React component should mutate the model before validation. No intermediate state may show some proposal operations committed and others not.

### 10.3 Reject invariants

Rejecting a proposal must leave the following deeply equal to their pre-proposal values:

- working assumptions;
- derived outputs;
- trace values;
- working model revision;
- committed history and undo stack;
- baseline assumptions and outputs.

UI state is allowed to change (e.g. the proposal panel closes and a brief “Rejected — no model changes” notice appears). Do not store the rejected proposal as a model change history entry.

### 10.4 Undo invariants

- Undo the latest transaction only in MVP.
- For a proposal transaction, undo all its operations together.
- Restore prior assumptions, recalculated outputs, and prior committed change-history view.
- Do not mutate baseline.
- Increment monotonic revision after restoring so older proposal objects stay invalid.
- Do not use a mutable object reference as the only history snapshot; prove restoration via tests.

---

## 11. Scenario comparison specification

### 11.1 Baseline/working semantics

- `baseline` is created once from `createSeedAssumptions()` and is immutable during an app session.
- `working` starts as a deep copy of `baseline`.
- Proposals and manual edits apply only to `working`.
- Undo restores `working` to its prior transaction snapshot, never baseline.
- Reset re-copies baseline to working and clears change history.

### 11.2 Delta rules

For every period and metric:

- `absoluteDelta = workingValue - baselineValue`.
- If baseline value is non-zero, `percentageDelta = absoluteDelta / abs(baselineValue) * 100` for display, with a label that communicates this convention.
- If baseline value is zero, percentage delta is not applicable (`—`).
- FTE delta is shown as an integer; currency delta uses currency formatting; growth-rate delta displays percentage points, not percent-of-percent.
- Cumulative revenue equals the sum of each month's revenue, not M24 revenue.

### 11.3 Chart requirements

- One line chart in MVP.
- Metric selector: Revenue, EBITDA, Ending cash.
- Baseline and Working series must be labelled in a legend and in accessible text.
- Use a visually distinguishable non-color-only treatment (e.g. line style/marker plus labels where practical).
- Include an accessible title/description and a tabular data equivalent.
- Do not use chart tooltip as the only way to access a value.
- Chart series must come from the exact same baseline/working output objects that feed the comparison table.

---

## 12. Performance Lab specification

### 12.1 Why it exists

The target role emphasizes performant complex tables and data visualization. The Performance Lab lets reviewers inspect virtualization behavior and reproducible measurements without confusing a synthetic stress test with the actual 24-month financial model.

### 12.2 Dataset generation

- Rows: exactly 10,000 by default.
- Columns: exactly 24 numeric monthly columns.
- Use a deterministic seed and predictable formula such as `value = 1000 + ((rowIndex * 37 + columnIndex * 13 + seed) % 9000)` (or an equivalent stable mapping).
- Include a stable row ID/name, such as `Line item 00001`.
- No random data, network call, or 240,000 independently rendered React cell components at once.
- It is acceptable to build a 10,000-row data array and calculate/display its 24 values per visible row, or precompute a typed dataset if memory is measured. The implementation must measure dataset preparation separately from UI render/ready time.
- Edits in this lab are local ephemeral overrides; they do not affect the financial model, proposals, history or scenarios.

### 12.3 Virtualization requirements

- Use a maintained virtual-row library, preferably `@tanstack/react-virtual`, unless the repository already has an equivalent suitable implementation.
- Render visible rows plus a documented overscan only.
- The header remains visible during vertical scrolling.
- Horizontal scroll must reach all 24 columns.
- Column virtualization is optional, but layout must not mount all 10,000 rows.
- A visible editable cell must be able to receive keyboard input.
- After editing, scrolling, switching tabs, and rerunning the benchmark, row identity and values must remain correct.
- Keep synthetic grid state separate from financial model state.

### 12.4 Measurement definitions

Do not publish a performance number without its definition.

**A. Dataset generation time**

Time to prepare the fixed 10,000 × 24 synthetic dataset (if values are materialized). Report separately; if values are calculated lazily, document that choice and what the measurement includes.

**B. Time to grid ready**

Time from the user pressing “Run benchmark” to after the grid's first committed layout with its header and initial visible rows. Use a consistent Performance API mark/measurement and a layout effect or equally defensible signal. State that this is a client-side prototype measurement, not a browser-wide Core Web Vital.

**C. Edit keystroke-to-paint latency**

Measure from an input edit event that changes the displayed draft/cell value to the corresponding committed render/layout effect. Collect at least 30 samples; report p50 and p95 where possible. Explain whether the metric represents text-draft updates or cell commit latency and keep that method constant.

**D. Model recomputation duration**

Measure the domain calculation work for the 24-period financial model, including a representative accepted assumption change. Report the actual measurement method; separate pure calculation time from React render time.

**E. DOM virtualization evidence**

Record the number of rendered body rows for the default viewport and the dataset size. Test that visible body rows are fewer than 100 for the default viewport, excluding header/ancillary UI. This structural assertion is more stable than a timing threshold.

### 12.5 Benchmark UI

Display:

- dataset size and fixed seed;
- dataset generation duration or clear “computed lazily” statement;
- time to grid ready;
- most recent edit latency and sample count, plus p50/p95 after enough samples;
- financial model recompute measurement separately;
- visible DOM row count;
- browser/user-agent and viewport size;
- an explicit “Run benchmark” / “Rerun” control and reset control.

Show “No measurements collected yet” before any run. Do not show invented default timing values. If measurement fails, show “measurement unavailable” and the reason where possible.

### 12.6 Targets versus claims

Targets are diagnostic objectives, not guaranteed results across hardware:

- grid ready target: under 500 ms after user initiates the benchmark on the documented reference machine in a production build;
- edit latency target: p95 under 100 ms in the documented reference environment;
- visible body row count: fewer than 100 rows for the default viewport;
- model recompute target: under 10 ms for the 24-month dataset in the documented reference environment.

If timing targets are missed, investigate and make one measured optimization pass. If they remain missed, report the real result and explain the trade-off. Never suppress an unfavourable measurement or present a target as an achieved result.

---

## 13. Visual design, responsiveness, and accessibility

### 13.1 Visual direction

Use a restrained, high-quality software-tool aesthetic appropriate for a technical/finance workflow:

- neutral canvas, strong typography hierarchy, restrained accent color;
- clear section headers and units;
- fine borders and generous alignment rather than decorative cards everywhere;
- compact but legible numerical density;
- clear distinction between editable assumptions and calculated values;
- meaningful state markers for pending review, stale proposal, validation failure, accepted change, and negative ending cash;
- no copied Drivetrain branding, logos, screenshots, copy, or proprietary visual assets.

The grid and diff must be visually prioritized over cosmetic dashboard metrics.

### 13.2 Responsive behavior

Desktop is the primary demo context; mobile must remain usable rather than being a fully redesigned mobile spreadsheet.

- At wide widths, keep row labels sticky and period columns horizontally scrollable.
- At medium widths, allow horizontal grid scrolling and stack summary/toolbar controls.
- At mobile widths, stack proposal/review/trace panels above or below the grid; keep primary actions visible.
- Do not shrink 24 columns until values become unreadable.
- The performance lab can retain a horizontally scrollable grid, while its controls and measurements stack vertically.
- No page-level horizontal overflow except the intentionally horizontally scrollable grid.

### 13.3 Accessibility requirements

- Aim for WCAG 2.2 AA-aligned patterns for contrast, focus, keyboard, labels and state announcements; document any known gap.
- All interactive elements must have visible keyboard focus.
- Do not convey only through color that a value changed, a cell is invalid, or a scenario increased/decreased.
- Editable cells must be keyboard-operable and labelled with row, period and unit.
- Error copy is associated with the input (e.g. `aria-describedby`) and not conveyed only in a toast.
- On proposal acceptance/rejection/validation failure, use a polite live region to announce the result without unexpectedly moving focus.
- After opening/closing a trace panel, proposal panel or confirmation dialog, focus remains predictable and is returned to the invoking control where appropriate.
- Dialogs/menus must support Escape and correct focus behavior.
- Chart must have accessible title/description and data-table alternative.
- Respect `prefers-reduced-motion`; animation is not necessary for data correctness.
- Use semantic buttons for actions and labels for inputs. Do not create click handlers on noninteractive containers without keyboard equivalents.

---

## 14. Error handling and edge cases

The app must handle these intentionally:

1. No preset selected: Generate disabled or prompt selection required.
2. Proposal generation in progress: disable duplicate generation actions.
3. Proposal provider error: no model mutation; retry available.
4. Proposal based on stale revision: Accept disabled; reason visible.
5. Edited proposal value invalid: Accept disabled; cell-level feedback visible.
6. Proposal has one invalid operation: reject whole transaction; show no partial application.
7. Duplicate operations target the same cell: invalidate proposal; no commit.
8. Unknown assumption key or period outside M01–M24: reject before commit.
9. Empty input / malformed numeric text / non-finite numbers: reject without coercion.
10. FTE decimal input: reject; do not round automatically.
11. Negative ending cash: display a warning style, not a validation error.
12. Undo with empty history: disabled and safe.
13. Undo after an accepted multi-cell proposal: all operations restore together.
14. Reset while unsaved proposal edits exist: confirmation explains that the working model and pending proposal state will reset.
15. Chart metric selector changes: chart and table show the same chosen metric.
16. Zero baseline in percentage delta: render “—”, never `Infinity`/`NaN`.
17. Refresh: restore initial synthetic defaults because persistence is out of scope.
18. Very long row labels on synthetic grid: truncate visually but expose full label through accessible text/title.
19. Virtualized row editing followed by scrolling: edited value remains in the sparse override map and appears correctly when revisiting the row.
20. Measurement not supported or interrupted: show an honest unavailable state instead of `0 ms`.

---

## 15. Technical architecture and implementation boundaries

### 15.1 Required stack

- Vite
- React
- TypeScript with strict mode enabled
- `@tanstack/react-virtual` for the Performance Lab's virtualized rows
- Recharts for the scenario comparison line chart, unless an existing compatible chart library is already established in the repo
- Vitest and React Testing Library for unit/component tests
- Playwright for one end-to-end critical journey, if browser installation is feasible in the environment
- ESLint and Prettier or the repository's equivalent formatting/lint setup

Avoid adding a global state library unless project complexity proves local reducer/context insufficient. No backend or external AI dependency is required.

### 15.2 Dependency boundaries

- `domain/` must not import React, browser APIs, UI components or chart libraries.
- `features/proposals/` may depend on domain types and calculation/transaction services, not vice versa.
- `features/model/` renders domain state and dispatches commands; it does not implement finance formulas.
- `features/performance/` is isolated from canonical financial model types except for shared design primitives.
- Charts consume a typed comparison result; they don't re-compute deltas.
- Provider boundary makes the proposal source replaceable in theory, but do not implement real providers in MVP.

### 15.3 Suggested source tree

```text
src/
  app/
    App.tsx
    appReducer.ts
    appState.ts
    routesOrTabs.tsx
  domain/
    modelTypes.ts
    seedModel.ts
    validation.ts
    calculations.ts
    trace.ts
    proposals.ts
    transactions.ts
    scenarioComparison.ts
    formatting.ts
  features/
    model/
      ModelPage.tsx
      ModelGrid.tsx
      ModelSettings.tsx
      EditableAssumptionCell.tsx
      CalculatedCell.tsx
      gridKeyboard.ts
    proposals/
      ProposalProvider.ts
      MockProposalProvider.ts
      ProposalPromptSelector.tsx
      ProposalReviewPanel.tsx
      ProposalDiff.tsx
    trace/
      TracePanel.tsx
      TraceNodeList.tsx
    comparison/
      ScenarioComparisonPage.tsx
      ScenarioChart.tsx
      ScenarioDeltaTable.tsx
    history/
      ChangeHistory.tsx
    performance/
      PerformanceLabPage.tsx
      SyntheticDataset.ts
      VirtualizedGrid.tsx
      performanceMeasurements.ts
  components/
    AppHeader.tsx
    Tabs.tsx
    Button.tsx
    StatusMessage.tsx
    ConfirmDialog.tsx
    MetricStrip.tsx
  styles/
    tokens.css
    global.css
    components.css
  test/
    fixtures.ts
    setup.ts
```

This tree is a recommended separation, not permission to create empty wrappers for every file. Keep modules small and purposeful. Reuse existing repo conventions if the repository already has a structure, but preserve the dependency boundaries.

### 15.4 State management recommendation

Use a typed reducer or equivalent single transaction dispatcher for canonical model mutations. UI event handlers dispatch commands like:

- `DIRECT_EDIT_COMMIT`
- `PROPOSAL_GENERATED`
- `PROPOSAL_EDIT_OPERATION`
- `PROPOSAL_ACCEPT`
- `PROPOSAL_REJECT`
- `UNDO_LAST_TRANSACTION`
- `RESET_WORKING_SCENARIO`
- `SET_SELECTED_TRACE_CELL`

The reducer/domain transaction layer should invoke validated pure functions. Do not let several components each maintain their own copy of assumptions/outputs.

### 15.5 State and derivation strategy

- Derive outputs from the latest working assumptions; memoization is permitted where keyed to stable assumptions/revision.
- Derive scenario deltas from baseline and working outputs using one function.
- Derive trace index using the same model output snapshot.
- Do not serialize computed outputs to localStorage or duplicate them in UI state unless a concrete performance need is shown and consistency is tested.
- Proposal preview derives from a proposal draft + current base snapshot through the same engine, without mutating working state.

---

## 16. Testing strategy and acceptance matrix

Tests are an implementation deliverable, not polish to add at the end. Add tests with each relevant phase.

### 16.1 Unit tests: domain model/validation/calculation

1. Seed function produces exactly 24 ordered periods with the specified default assumptions.
2. Seed function returns fresh objects (mutating a returned object in a test must not affect a later seed result).
3. `calculateModel` returns exactly 24 values for every derived metric.
4. Revenue formula M01 uses starting revenue and M01 growth.
5. Revenue formula M02+ uses previous revenue and current-period growth.
6. Payroll equals total FTE × loaded monthly cost.
7. Total operating expense equals payroll + other operating expense.
8. EBITDA equals revenue − total operating expense.
9. Ending cash rolls forward previous ending cash + current EBITDA.
10. Money rounding is consistent at two decimal places.
11. Two calculations using equal inputs produce equal outputs and trace metadata.
12. Calculation does not mutate input assumptions.
13. Each allowed validation boundary is tested at min/max and just outside it.
14. Empty strings, whitespace, NaN, infinities, and trailing garbage reject.
15. Fractional FTE rejects.
16. Proposal operation sets with duplicate/unknown target/out-of-range period reject.
17. Applying a valid operation set returns a changed clone and leaves the original assumptions deeply equal to their original values.
18. Applying an operation set with one invalid operation changes nothing.
19. Scenario delta handles zero baseline safely.
20. Cumulative revenue is the sum across 24 monthly revenue values.

### 16.2 Unit tests: proposals and trace

21. Each of the three preset templates produces the correct ordered operations and current old values.
22. Hire proposal affects M07–M24 only; M01–M06 remain unchanged.
23. Growth proposal adds exactly 0.01 (one percentage point) for M07–M24.
24. Opex proposal reduces M04–M24 to 92% of the captured current value, rounded by the shared money function.
25. Proposal generation does not mutate working assumptions.
26. Preview calculation is equal to calculation of a cloned model with those proposal operations applied.
27. Every calculated trace node points only to existing nodes.
28. Every trace dependency chain resolves to assumption/setting nodes and contains no cycles.
29. Changing an assumption updates the corresponding trace value.

### 16.3 Component/integration tests: grid and proposal lifecycle

30. Editable assumption cells can enter/exit edit mode with the required keyboard actions.
31. Valid Enter commit updates the model once and recomputes values.
32. Escape cancels the draft and leaves canonical state deeply equal.
33. Invalid Enter commit shows an error and leaves the model unchanged.
34. Reject leaves assumptions, outputs, revision, history, baseline and undo stack unchanged.
35. Accept applies all operations in one transaction and updates derived metrics.
36. Edit then Accept uses the edited operation value, not the template's original proposed value.
37. An invalid edited operation disables Accept and cannot partially apply other operations.
38. A stale proposal cannot be accepted after a direct edit, another transaction, Undo or Reset.
39. A failed proposal provider leaves the model unchanged and allows retry.
40. Repeated/double Accept cannot apply a proposal twice.
41. Undo after direct edit restores the previous assumption/output/history snapshot.
42. Undo after accepted multi-cell proposal restores all affected cells together.
43. Reset restores the initial seeded working model and clears committed history while leaving baseline unchanged.
44. Focus indicators exist for keyboard navigation; focus is not lost when trace panel opens/closes.

### 16.4 Component/integration tests: comparison/trace/performance lab

45. Scenario chart and delta table consume identical comparison values.
46. Switching chart metric updates both chart and related table consistently.
47. Calculated cell selection opens a trace panel with the correct metric, period, value and formula.
48. Virtualized grid shows fewer than 100 body rows for the default viewport and 10,000-row dataset.
49. Editing a virtualized synthetic cell persists when scrolling away and back within the current session.
50. Performance panel shows no fabricated measurement values before a run.
51. Measurement failure creates an unavailable/error state, not a false zero.
52. Responsive layout has no unintended page-level horizontal overflow at representative mobile width (the grid's own horizontal scroll is allowed).

### 16.5 End-to-end test: required happy path

Automate one E2E journey if feasible:

1. Load the app.
2. Confirm the synthetic/mock disclosure is visible.
3. Generate the hiring proposal.
4. Verify the proposed diff shows M07–M24 and model values have not yet changed.
5. Edit one proposed value and accept.
6. Verify relevant output cells and chart/table change.
7. Open a calculated cell's trace panel.
8. Undo the transaction.
9. Verify assumptions, output values, and change history are restored.
10. Reject a second proposal and verify it makes no model change.

If Playwright cannot be installed/run in the build environment, document why, keep integration tests, and include a manual acceptance record. Do not claim the E2E test passed if it was not run.

### 16.6 Quality checks on every phase

Run the checks that exist in the repository, typically:

- formatter/check;
- linter;
- TypeScript typecheck;
- domain/component tests;
- production build.

A phase cannot be marked complete unless checks run and results are reported. If a check fails for an unrelated pre-existing issue, identify it explicitly instead of hiding it.

---

## 17. Definition of Done

### Product behavior

- [ ] App loads directly into a usable model with synthetic-data disclosure.
- [ ] All 24 periods and 11 grid rows render correctly.
- [ ] Three proposal templates work through the provider interface.
- [ ] Proposed changes are visibly separate from committed model state.
- [ ] Accept, Edit and Reject behavior matches the specification.
- [ ] Stale proposals cannot be accepted.
- [ ] Manual assumption edits validate and commit through one transaction path.
- [ ] Outputs recompute through the domain engine and update consistently in the grid, trace and comparison.
- [ ] Trace panel exposes formula, direct inputs and assumption dependencies.
- [ ] Undo restores all operations of the latest transaction and its prior history snapshot.
- [ ] Baseline cannot be changed by proposal/edit/undo/reset actions.
- [ ] Scenario comparison table and chart agree.
- [ ] Performance lab uses deterministic synthetic data and row virtualization.
- [ ] Measurements are populated by actual runs only.

### Engineering quality

- [ ] Domain layer imports no React/browser/UI dependencies.
- [ ] Strict TypeScript passes.
- [ ] All core domain and lifecycle tests pass.
- [ ] Lint/format/build checks pass.
- [ ] No secrets, API keys, actual customer data, or company-confidential data exist in repository.
- [ ] No external AI/model/provider request occurs.
- [ ] No console errors or unhandled promise rejections in the main flow.
- [ ] Dependency list is proportionate to project needs.

### Evidence bundle

- [ ] Public repository with clear, truthful description.
- [ ] Live demo or locally reproducible run.
- [ ] README with install/run/test steps and all required disclosure wording.
- [ ] State-flow diagram and calculation/trace diagram.
- [ ] Measured benchmark results with environment/method (after measuring).
- [ ] 90-second walkthrough recording.
- [ ] One-page engineering note with a real challenge/trade-off, tests and limitation.
- [ ] No fabricated product/business impact metrics.

---

## 18. Required README disclosure

Include this wording (minor grammar edits are fine; meaning must remain):

> **Independent prototype notice:** Model Change Review Lab is an independent prototype inspired by public descriptions of AI-native financial planning and analysis. It is not affiliated with Drivetrain, does not use Drivetrain's product or data, and does not reproduce its implementation. The “AI proposal” step is a deterministic local mock; no LLM or external AI service is called. All financial values are synthetic. Calculations are deliberately simplified for demonstration and are not suitable for real financial decisions. The prototype does not implement production-grade authentication, authorization, permission controls, financial accuracy guarantees, or a compliance-grade immutable audit log.

Also include:

- product purpose and the narrow question being explored;
- screenshots or short GIF of the main flow;
- tech stack;
- setup/commands;
- architecture and state-flow diagrams;
- formula definitions and model simplifications;
- test categories and actual results;
- benchmark method/environment and actual measurements;
- known limitations;
- short note on AI-assisted coding: what tools were used, what they generated, and how behavior was independently validated.

Never include a pre-filled result such as “50 ms” or “10x faster” unless the code has measured it through the documented method.

---

## 19. Recommended repository scripts and quality gates

Use names consistent with the chosen package manager/repository, but provide equivalents for:

- `dev` — run development server;
- `build` — production build;
- `preview` — serve production build locally;
- `lint` — run static lint;
- `typecheck` — strict TypeScript check without emit;
- `test` — run unit/component test suite;
- `test:watch` — watch mode;
- `test:e2e` — Playwright critical journey when configured;
- `format` / `format:check` — consistent formatting.

CI must install dependencies reproducibly, run lint, typecheck, tests and production build. Don't add a deployment workflow until local quality gates are green.

---

## 20. Step-by-step build plan for coding agents

**Important:** Give coding agents one phase at a time. Do not paste a prompt asking one agent to build the entire app in one shot. After every phase, inspect the code and test output, review the diff, and commit a coherent checkpoint before continuing.

### Agent contract — prepend to every implementation prompt

```text
You are implementing a phase of the Model Change Review Lab PRD.

Rules:
1. Read the relevant PRD sections first. The PRD is the source of truth.
2. Inspect the repository, package scripts and existing code before changing anything.
3. Do not silently add features, new services, external APIs, real AI, persistence, or unrelated refactors.
4. Preserve the strict invariants: synthetic data only, deterministic mock proposal provider, explicit approval, pure calculation engine, atomic transactions, stale-proposal guard, traceability, honest performance measurements, and disclosure that this is not affiliated with Drivetrain.
5. Implement only the scope of the current phase. If a dependency or design decision blocks progress, report the blocker and ask before broadening scope.
6. Write or update tests with the implementation. Do not defer tests to the end.
7. Do not claim that a test, command, build, or benchmark passed unless you ran it and observed the result.
8. After implementation, run the relevant checks, inspect the full diff, and report: files changed, behavior implemented, tests/commands actually run, results, remaining limitations, and any deviation from the PRD.
9. Keep the domain layer independent of React and browser APIs.
10. Do not expose secrets or use real company/customer data.
```

### Phase 0 — Repository reconnaissance and implementation plan

**Objective:** Understand the existing repo and create a low-risk implementation plan before making changes.

**Scope:** Inspect files, package.json, existing scripts, framework, TypeScript settings, test setup and current git diff. No feature implementation in this phase.

**Acceptance:** Agent reports the present repository state; identifies existing reusable infrastructure/dependencies; lists minimal changes needed for Phase 1; identifies any conflicts with this PRD. It must not overwrite existing work or introduce dependencies yet.

**Prompt:**

```text
Execute Phase 0 (repository reconnaissance) of the Model Change Review Lab PRD.
Do not implement product features or change files yet. Inspect the repository and report:
- current framework and package manager;
- existing folder structure, dependencies and scripts;
- TypeScript strictness, lint, tests and CI status;
- files that would be added/modified in Phase 1;
- likely risks and any PRD conflicts.
Then provide a minimal phase-by-phase plan aligned to the PRD. Wait for approval before making code changes.
```

### Phase 1 — Scaffold, types, seed model and pure calculation engine

**PRD sections:** 6, 9, 15, 16.1, 16.2.

**Objective:** Create the typed domain foundation with no production UI logic.

**Implement:**

- project scaffold only if the repo requires it;
- strict TypeScript and scripts for lint/typecheck/test/build;
- domain types for settings, monthly assumptions, calculated model, trace nodes, proposals, operations and transaction records;
- deterministic seed function;
- input/operation validation;
- pure calculation engine and shared rounding/formatting functions;
- trace generation and referential-integrity check;
- preset proposal operation generation (provider abstraction and pure template generation may be included here; UI comes later);
- unit tests for formulas, seed shape, validation, immutability, determinism, templates and trace references.

**Do not implement:** React grid, charts, performance lab, real AI, backend, persistence or final visual design.

**Acceptance:** All domain tests pass; typecheck passes; repeated calculations produce equal outputs; no function mutates the input snapshot; no trace reference is dangling.

**Prompt:**

```text
Implement Phase 1 of the Model Change Review Lab PRD: domain foundation only.
Read PRD sections 6, 9, 15 and 16. Create typed model/proposal/trace/transaction contracts, deterministic seed data, validation, the pure financial calculation engine, trace index generation, and deterministic proposal template generation. Add tests with the implementation.
Do not build React UI in this phase. Do not add a real LLM, backend, persistence or external API. Use the exact formulas and validation ranges in the PRD. Report any formula ambiguity before choosing a different rule.
Run and report the actual lint/typecheck/test/build commands available. Inspect the diff and list changed files and remaining gaps.
```

### Phase 2 — Application shell and editable model grid

**PRD sections:** 7.1–7.4, 8.3–8.4, 13.

**Objective:** Render the seeded 24-month model and support correct editable assumptions.

**Implement:**

- app shell, tabs and disclosure;
- Model view with compact summaries, settings, grouped rows and 24 periods;
- assumption vs calculated styling;
- keyboard movement/edit lifecycle (arrows, Enter, Escape, Tab/Shift+Tab);
- field-level validation errors and accessible labels;
- manual-edit commit routed through the single transaction pathway/reducer, not component-local mutation;
- derived value trace selection affordance (panel itself may be completed in Phase 4).

**Do not implement:** proposal generation, scenario chart, performance grid or a final outreach package.

**Acceptance:** valid manual edit recomputes outputs; invalid edit and Escape leave model unchanged; keyboard flow works; derived cells are not editable; baseline remains untouched; UI fits desktop and mobile by scrolling intentionally.

**Prompt:**

```text
Implement Phase 2 of the Model Change Review Lab PRD: app shell and Model grid.
Use the Phase 1 domain functions; do not duplicate formulas in React. Build the 24-period grid with grouped assumption/calculated rows, editable model settings, keyboard editing (arrows/Enter/Escape/Tab), validation errors, visible focus, and a single transaction dispatch path for manual edits. Keep all values synthetic and show the disclosure in the shell.
Do not implement proposal workflow or charts yet. Add component/integration tests for keyboard commit/cancel, validation, model recompute and baseline immutability. Run relevant checks and report actual results and diff.
```

### Phase 3 — Mock proposal provider and review gate

**PRD sections:** 6.6–6.8, 7.5–7.6, 8.2, 10, 14, 16.3.

**Objective:** Complete the core project differentiator: proposal → preview → decision → atomic apply/no-op.

**Implement:**

- `ProposalProvider` interface and `MockProposalProvider` implementation;
- three preset proposal controls;
- deterministic proposal generation against a captured model revision;
- before/after cell diff with grouped range presentation;
- preview calculation using a cloned model and the canonical engine;
- preview KPI deltas;
- Edit proposal flow separate from the working model;
- Accept/Reject, invalid proposal handling, stale state/warning, retry/error state;
- atomic commit and protection against duplicate Accept;
- proposal history description after accept.

**Acceptance:** no assumption/output changes while proposal is merely generated, reviewed, edited or rejected; Edit then Accept uses the edited value; acceptance commits all operations at once; stale proposals cannot be accepted; Reject leaves canonical state/history unchanged.

**Prompt:**

```text
Implement Phase 3 of the Model Change Review Lab PRD: mock proposal workflow and human review gate.
Use only the deterministic three-template provider defined in the PRD. Label the proposal as simulated; make no network or LLM calls. Show every changed cell's before/after values (grouping long ranges without hiding detail). Calculate the preview by cloning assumptions and calling the Phase 1 engine; do not mutate canonical state until Accept.
Implement Edit, Accept, Reject, stale revision protection, all-or-nothing validation, duplicate-accept protection, visible statuses, and tests for every invariant. A stale proposal must remain unacceptably stale even after Undo/reset changes revision. Report all tests actually run and any incomplete behavior.
```

### Phase 4 — Undo/change history and trace panel

**PRD sections:** 7.7, 7.9, 8.5, 9, 10, 16.2–16.3.

**Objective:** Make every result explainable and make a transaction safely reversible.

**Implement:**

- trace panel for selected calculated cells;
- direct formula and input chain to assumptions/settings;
- live trace values tied to current working scenario;
- change-history UI for manual edits and accepted proposals;
- Undo latest transaction as one unit, restoring prior assumptions and committed-history snapshot;
- revision increments after Undo/Reset to invalidate pending stale proposals;
- focus/keyboard behavior for open/close panels;
- tests for trace no-dangling-references and undo semantics.

**Do not claim:** immutable/compliance-grade audit log or production financial explainability.

**Prompt:**

```text
Implement Phase 4 of the Model Change Review Lab PRD: trace panel, change history and undo.
Use the domain trace index; do not build formula strings by reverse-engineering UI rows. Clicking a calculated cell should show its value, formula label, direct inputs and full chain to assumptions. Add committed history for manual edits and accepted proposals. Undo the latest transaction as one unit and restore the previous assumptions and history snapshot; increment the monotonic revision token so old proposals remain stale. Keep baseline immutable. Add tests for trace references, live values, accepted multi-cell transaction undo, manual-edit undo and stale proposals after undo.
Call this an undoable demo history, not an immutable audit ledger.
```

### Phase 5 — Scenario comparison

**PRD sections:** 7.8, 11, 16.4.

**Objective:** Show baseline versus working scenario coherently, using the same domain outputs for chart and table.

**Implement:**

- comparison page/tab;
- metric selector for Revenue, EBITDA, Ending cash;
- one responsive accessible line chart;
- monthly delta table and cumulative revenue summary;
- correct zero-baseline/percentage-point handling;
- empty/equal-baseline state and tests.

**Acceptance:** chart and table values must be generated by one shared scenario comparison structure; no formulas live inside the chart component; baseline never changes.

**Prompt:**

```text
Implement Phase 5 of the Model Change Review Lab PRD: scenario comparison.
Build baseline-versus-working comparison using the shared domain comparison function. Add a metric selector for Revenue, EBITDA and Ending cash, one accessible line chart, and a table alternative with monthly absolute deltas and safe percentage deltas. Cumulative revenue is the sum across 24 monthly values. Show “—” when percentage delta is undefined; do not divide by zero. Add tests that chart/table share the same data and baseline is immutable. Do not add a second chart type or dashboard scope.
```

### Phase 6 — Performance Lab and honest measurement

**PRD sections:** 7.10, 12, 14, 16.4.

**Objective:** Demonstrate virtualized UI rendering and record reproducible measurements.

**Implement:**

- deterministic 10,000 × 24 synthetic dataset;
- virtualized rows (prefer TanStack React Virtual);
- fixed header and horizontal scrolling;
- sparse local overrides for synthetic cell edits;
- Run benchmark/reset workflow;
- separate dataset-generation, grid-ready, edit latency, model recompute and DOM row-count measurements;
- environment display and unavailable state;
- test visible body row count under 100 for default viewport;
- update README only with actual run results.

**Acceptance:** no 10,000-row DOM; rendered row count is bounded by viewport/overscan; data values are repeatable; benchmark values are created only by actual measurements.

**Prompt:**

```text
Implement Phase 6 of the Model Change Review Lab PRD: Performance Lab.
Build a deterministic 10,000-row by 24-column synthetic grid separated from the finance model. Use virtualized rows and sparse local edit overrides. Measure dataset preparation separately from first grid layout, capture edit keystroke-to-paint samples, separately measure the 24-period model engine, show visible DOM row count and basic browser/viewport context. Before the first run, show no measurement values. Do not hardcode, estimate or invent timings. Add structural virtualization tests and editing/scroll tests. Report the actual measured values from your environment only if you ran the benchmark; label those values with the method and environment.
```

### Phase 7 — Quality, design polish, responsiveness and documentation

**PRD sections:** 13, 16, 17–19.

**Objective:** Turn a functionally correct demo into an understandable, accessible, reviewable artifact.

**Implement:**

- visual consistency and responsive panel behavior;
- keyboard focus polish, error and live-announcement behavior;
- reduced-motion and chart data alternative;
- end-to-end critical journey where feasible;
- README with the exact disclosure, formulas, architecture, limitations, commands, tests and measured benchmark results;
- state-flow and dependency trace diagrams;
- production build and CI (lint/typecheck/tests/build);
- remove console noise and dead code;
- live deployment if configuration and quality checks are stable;
- short walkthrough recording and one-page engineering note (can be prepared manually after code is stable).

**Acceptance:** all P0 requirements met, every required check has a recorded actual result, no unverified timing claims, and disclosure is visible in both UI/README.

**Prompt:**

```text
Implement Phase 7 of the Model Change Review Lab PRD: final quality and release readiness.
Do not add scope. Audit the implementation against sections 13, 16, 17, 18 and 19. Fix accessibility/responsive issues, add or finish the critical E2E test if the environment supports it, complete README/documentation with formulas and explicit limitations, and wire CI to run lint, typecheck, tests and production build. Do not put unmeasured performance values in documentation. Run each available check and report actual results. Inspect the final diff and provide a Definition-of-Done checklist with completed/blocked status.
```

---

## 21. Coding-agent operating protocol

### 21.1 One agent owns integration

Use one primary coding agent to own the app state architecture and merge changes. If multiple agents are used, assign distinct tasks with non-overlapping files (for example, one agent writes domain tests while another reviews UX requirements), and do not let two agents edit `appState`, domain transaction files, or shared components concurrently.

### 21.2 Ask for plans before nontrivial changes

For each phase, the agent should first present a short implementation plan and the files it expects to change. Approve the plan before the write step if the agent proposes:

- a new major library;
- changing formula/model semantics;
- adding backend/persistence/AI;
- altering transaction/history rules;
- removing a required feature;
- changing the performance measurement definition.

### 21.3 No “done” based only on code generation

A phase is not done just because code exists. The agent must actually run the checks available in the environment and report:

- command;
- pass/fail/blocked status;
- relevant test summary;
- any manual check that remains;
- known gap and next action.

### 21.4 Diff review checklist

After each phase, inspect:

- formulas are present only in the domain layer;
- canonical state never mutates before a validated commit;
- pending proposal operations do not mutate model values;
- rejecting changes no model state;
- baseline is immutable;
- revision/stale guard works through Undo and Reset;
- no real API/secret/data introduced;
- no false performance or test claims;
- no uncontrolled dependency growth;
- no unrelated resume/other-project files changed.

### 21.5 Working with AI-generated code

Coding agents may generate implementation scaffolding, components and tests. The human owner must personally verify the core math, transaction semantics, stale-proposal protection, trace dependencies, undo behavior and benchmark methodology. Do not present AI-generated code as verified until it has been run and checked.

---

## 22. Manual acceptance script

Run this script against the deployed production build before recording the walkthrough.

### A. Baseline

1. Load the app in a fresh browser session.
2. Confirm header says “Independent prototype · Synthetic data”.
3. Confirm the page does not claim that it uses Drivetrain or a real AI service.
4. Record key output values for M07 (or use deterministic test fixture assertions).

### B. Proposal preview

5. Choose “Add 2 engineering hires from M07 (Q3) onward”.
6. Confirm preview contains engineering headcount changes for M07–M24 only.
7. Confirm M01–M06 remain unchanged in the actual model.
8. Confirm preview shows payroll/EBITDA/cash impact.
9. Reject the proposal.
10. Confirm working assumptions, outputs, revision, history and undo availability are unchanged.

### C. Edit and accept

11. Generate the same proposal again.
12. Enter Edit mode; change one proposed value (e.g. one period's proposed engineering FTE) to another valid integer.
13. Confirm no actual model cells change while editing the proposal.
14. Accept the proposal.
15. Confirm only specified cells change, and the edited value—not the original proposed value—is applied.
16. Confirm derived values, trace values, scenario delta table, and chart update consistently.
17. Confirm exactly one proposal transaction appears in change history.

### D. Trace and Undo

18. Select an EBITDA output cell and open Trace.
19. Confirm formula, current value, Revenue and Total Operating Expense dependencies are shown.
20. Expand dependency chain and ensure it ends in assumptions/settings.
21. Undo.
22. Confirm working model and history return to the pre-proposal snapshot, baseline remains unchanged, and revision has advanced internally.

### E. Manual edit and stale proposal

23. Generate a proposal; keep it pending.
24. Modify an assumption directly through the grid.
25. Confirm the pending proposal is marked stale and Accept disabled.
26. Attempt invalid input such as a fractional headcount; confirm no value changes and an inline message appears.
27. Escape an active draft; confirm original value returns.

### F. Comparison and performance

28. Open Scenario comparison; confirm chart and table use the same selected metric.
29. Switch metric to Ending cash; confirm labels/table/chart update.
30. Open Performance Lab; confirm “No measurements collected yet” before Run.
31. Run benchmark; verify dataset size, timings and row count are measured and reported, not static fake values.
32. Edit a visible synthetic cell; scroll away and back; confirm the override persists for the session.
33. Verify visible DOM row count remains under the acceptance cap.

### G. Final hygiene

34. Refresh; confirm model returns to clean synthetic defaults.
35. Confirm no network request to an LLM, external AI, Drivetrain, or private data service is made by the app.
36. Verify no runtime console errors in the main flow.
37. Open the README; confirm disclosure, formula definitions, benchmark methods and actual test results are present.

Log failures, fix them, then rerun the relevant portions. Do not record the demo while known P0 failures remain.

---

## 23. Walkthrough and engineering note requirements

### 23.1 90-second walkthrough sequence

- **0–10 sec:** explain the problem question: “What if we change hiring or growth assumptions, and how do we review the impact before committing it?”
- **10–25 sec:** show the 24-month assumption/calculated grid and select the hiring proposal.
- **25–40 sec:** inspect the before/after diff and preview deltas; emphasize that the live model has not changed.
- **40–52 sec:** edit one proposed value and accept it; show synchronized outputs.
- **52–64 sec:** select EBITDA or Ending cash and show formula/source trace.
- **64–74 sec:** undo the change and show model/history restoration.
- **74–85 sec:** open Performance Lab; show virtualized 10k × 24 grid and actual measured data/row count.
- **85–90 sec:** state the key limitation: local mock AI, synthetic data, simplified model, independent prototype.

### 23.2 One-page engineering note structure

1. Product/technical question.
2. What the demo does and explicitly does not do.
3. State/transaction flow diagram.
4. One hard edge case (recommended: stale proposal or atomic multi-cell acceptance).
5. Tests proving the behavior.
6. A real performance measurement with method/environment.
7. A trade-off and what would change for production.

Do not fabricate business impact or infer customer value from synthetic calculations. The impact being shown is engineering evidence: correctness, performance methodology, accessibility and clarity.

---

## 24. Outreach readiness and contact approach

Do not make outreach part of the implementation task. The coding agent should not message anyone, apply to a job, or publish the project without the user's explicit action.

Once the artifact is live:

1. Apply through the official role channel if the listing is still open and application is appropriate.
2. Include the live demo, public repo and walkthrough in the official application materials.
3. Consider sharing the demo with Tarkeshwar Thakur (CTO) as a plausible technical reader; the supplied research does not confirm that he owns this vacancy.
4. Consider Saurav Bhagat (Head of Product) only as a later product-workflow contact if needed.
5. Lead with what was implemented and actual measured evidence, not broad self-description.
6. Say “independent prototype inspired by public descriptions of AI-native FP&A.”
7. Do not claim to have discovered a Drivetrain bug or copied its current interface.
8. Send at most one follow-up after 5–7 days.

### Application-note template — fill only after the demo is live

> I built an independent prototype exploring a review-before-recompute workflow for a simplified planning model: a simulated proposal shows the affected assumptions and downstream impact, the user can edit/accept/reject it, and one deterministic engine recalculates values with trace-to-source. The model and data are synthetic; it is not affiliated with Drivetrain. Live: [link]. Repo: [link]. Walkthrough: [link]. On the documented 10,000 × 24 synthetic grid, the measured visible-row count was [actual result], and edit latency was [actual measured result + method]. I’m a final-year B.Tech student with contract product-engineering experience and would welcome your feedback on the technical approach.

Do not leave placeholders in a sent message. If the performance measurement does not yield a credible result, omit the timing claim and share the method/limitation truthfully.

---

## 25. Project risks and mitigations

| Risk | Why it matters | Mitigation |
|---|---|---|
| Building too much spreadsheet functionality | Scope expands and the key story gets buried | Stick to the 11 rows × 24 periods for the finance model; use a separate synthetic performance grid |
| Proposal appears to change model before acceptance | Violates the core trust proposition | Keep preview calculations on a cloned snapshot; test Reject and pending-review invariants |
| Duplicate formulas in UI and engine | Values diverge across grid/chart/trace | Domain engine owns formulas; UI consumes typed outputs |
| Stale proposal is accidentally accepted | Demonstrates unsafe state handling | Monotonic revision guard checked at acceptance boundary and in tests |
| Undo only reverses some proposal cells | Breaks atomicity and confidence | One transaction per accepted proposal; test full restoration |
| Trace is a pretty description disconnected from calculation | Undermines trust | Derive trace edges from calculation definitions; test every reference |
| Benchmark is misleading | Weakens credibility | Define metrics, separate dataset preparation and render time, report environment, include p50/p95 and real method |
| App imitates Drivetrain too closely | Creates affiliation/IP confusion | Original design, synthetic data, no logo/screenshot/brand mimicry, clear disclaimer |
| Historical reviews treated as current flaws | Inaccurate and reputationally poor | State they were historical public feedback and use them only as context |
| Scope consumes time needed for applications | Career search cost | Enforce seven-phase plan; stop at P0/P1; continue applying in parallel |
| AI-generated code hides a broken core invariant | Demo may fail under review | Human verifies math, atomicity, stale proposal, trace, undo and measured results personally |
| Candidate overstates seniority | Creates trust mismatch | Present as a final-year B.Tech candidate with honest contract experience and measurable project proof |

---

## 26. Final build decision

Build the **Model Change Review Lab**, not a generic finance dashboard and not a Drivetrain clone.

The proof must come from a small number of well-engineered behaviors:

- a proposal is reviewable before it changes state;
- accepted changes are validated and atomic;
- all financial values are computed by a deterministic engine;
- every derived value can be traced to inputs;
- baseline and working scenario stay consistent across table/chart/trace;
- Undo really restores the preceding transaction snapshot;
- stale proposals cannot be applied;
- large-grid behavior is virtualized and measured honestly;
- every claim can be reproduced from code, tests, or a documented benchmark.

**Definition of success:** a reviewer can click through the flow, inspect the calculations, read the source, run the tests, reproduce the performance method, and clearly understand the prototype's limitations. A smaller trustworthy demonstration is more valuable than a large app whose behavior is difficult to verify.

---

## Appendix A — Public references underlying the opportunity

These links support the role/product context only. They do not expose internal implementation or establish a current bug.

- [Official Frontend Engineer role](https://jobs.lever.co/drivetrain/cd39cc4e-056e-444c-8c17-9f97e34ddbce)
- [Drivetrain About / leadership](https://www.drivetrain.ai/about)
- [Drive AI](https://www.drivetrain.ai/drive-ai)
- [Drivetrain micro demos](https://www.drivetrain.ai/micro-demos)
- [MCP server for finance announcement](https://www.drivetrain.ai/post/mcp-server-finance-launch)
- [Native Anthropic/OpenAI connectors](https://www.drivetrain.ai/post/drivetrain-launches-native-connectors-to-anthropic-and-openai)
- [Drivetrain customer stories](https://www.drivetrain.ai/customers)
- [Software Advice historical customer reviews](https://www.softwareadvice.com/product/519895-Drivetrain/reviews/)
- [Drivetrain engineering role index](https://jobs.lever.co/drivetrain)

The supplied companion research document, “Drivetrain: Deep Public-Signal Research & Engineering Opportunity Analysis”, has additional notes on source confidence, leadership signals, product/customer contexts, and the limits of public evidence.

---

# Extension v1.1 — Public UI Reconnaissance, Component Strategy, and Implementation Tooling

**Extension date:** 10 October 2026  
**Compatibility:** Supplements PRD v1.0 above. The original v1.0 content is retained verbatim; this extension adds public-product reconnaissance and implementation decisions.  
**Why this extension exists:** The original PRD defined the domain behavior and core stack, but did not fully document what was inspected in Drivetrain's public UI, which implementation libraries/services should be used, which internal-stack facts remain unknown, or exactly how coding agents should make UI and dependency decisions.

> **Precedence rule:** This extension clarifies how to implement the existing requirements; it does not remove, weaken, or silently replace any earlier domain invariant, requirement ID, acceptance test, non-goal, implementation phase, or disclaimer. If a recommendation here conflicts with an existing invariant, the invariant in the original PRD wins. The project remains independent and must not imitate Drivetrain's protected visual identity or claim to reproduce its internal implementation.

## 27. Public UI research: what was inspected and what is known

### 27.1 Official UI references

Before implementing visual details, read the current public materials below. They are the best source for understanding the product categories, workflows, and language Drivetrain chooses to explain publicly.

| Reference | What to inspect | Why it matters to this prototype | Evidence class |
|---|---|---|---|
| [Drivetrain Micro Demos](https://www.drivetrain.ai/micro-demos) | Current video library and its Planning, Reporting, Collaboration, and Drive AI groupings | Shows that the product spans model editing, scenarios, formula help, collaboration, reports, and AI-assisted workflows; prevents us from treating it as a generic dashboard | Direct public product material |
| [Headcount Planning](https://www.drivetrain.ai/solutions/headcount-planning-software) | Headcount planning, team collaboration, scenario exploration, model/formula explanations, and the public workflow descriptions | Closest public workflow to the synthetic headcount-change example in this PRD | Direct public product material |
| [Drive AI](https://www.drivetrain.ai/drive-ai) | Reporting Agent, Modeling Agent, Scenario Agent, Formula Agent, Insights Agent, Help Agent, data transformation and MCP descriptions | Helps define the boundary between an AI-generated proposal and deterministic model calculations; these are existing public capabilities, not features we should pretend are novel to Drivetrain | Direct public product material |
| [Frontend Engineer role](https://jobs.lever.co/drivetrain/cd39cc4e-056e-444c-8c17-9f97e34ddbce) | Accessibility, responsive UI, interactions, reusable components, performance, data visualization, charts/tables, spreadsheet-inspired modelling, React and data structures | Direct statement of what this specific role emphasizes | Direct public hiring material |
| [MCP server for finance announcement](https://www.drivetrain.ai/post/mcp-server-finance-launch) | Governed access to business context through AI tooling | Supports the emphasis on access boundaries and grounded data; the independent prototype will not implement MCP or permissions | Direct public product/leadership material |
| [Native Anthropic/OpenAI connectors announcement](https://www.drivetrain.ai/blog) | Find the June 2026 native connector announcement and its description of AI spend attribution | Useful wider context for finance workflows; not a reason to widen the MVP into AI-spend analytics | Direct public company material; verify the exact announcement before quoting it externally |

The public Micro Demos page currently lists demos with titles such as **Headcount Planning**, **Scenario Modeling**, **Collaborative Planning**, **Formula Agent: Explain, write, and debug formulas in plain English**, **Debugging/making sense of models (explain formula + show calculation)**, **Generate live dashboards using plain English**, **Build financial models through conversation**, **Budget vs Actuals**, **Multi-Entity Consolidation**, **Waterfall Charts**, **Board Reporting**, and an **MCP server** workflow. The catalogue and names may change; use the page as the current source rather than hardcoding old demo titles into product copy.

### 27.2 Required pre-build viewing pass

The coding agent must not infer the live product's exact interface from marketing copy alone. Before implementing the page shell, a human or agent with access to a browser must open the public demo library and inspect the following demonstrations where the currently available player permits it:

1. **Headcount Planning** — map the user-visible planning object, periods, assumptions, headcount-specific terminology, and where totals or derived numbers appear.
2. **Scenario Modeling** — map how scenarios are introduced, compared, and described.
3. **Formula Agent / model debugging and explanation** — note how formula explanation and source/context are presented publicly.
4. **Collaborative Planning** — note collaboration affordances, but do not implement real-time collaboration in this project.
5. **Reporting Agent / live dashboards** — note how data visualization is contextualized; do not build a dashboard generator.
6. **Drive AI overview or model-building conversation** — note where AI is positioned alongside model editing and where the product describes human oversight.

For each available demo, record only observations supported by what is visible. Do not infer the backend, internal state model, component library, or unshown interactions. If a video is blocked, inaccessible, or only its title is visible, record **“title/description inspected; full interaction not verified”** instead of claiming to have watched it.

The durable result should be a short note in the project repository:

```text
docs/research/public-product-observations.md
```

Required columns in that note:

- source URL and public title;
- inspection date;
- what was directly observed;
- what is an interpretation or hypothesis;
- implication for our independent prototype;
- what we explicitly will not copy or claim.

Do not copy proprietary assets, reuse Drivetrain's logo, scrape app-only data, bypass access controls, or make screenshots of the public product part of our own product UI. A small private research note may link to the official public references without republishing their assets.

### 27.3 Public product surface inventory

The sources above expose a broader product surface than a simple grid-and-chart dashboard. This matters primarily as a **scope boundary**: the independent prototype should demonstrate one deep interaction and should not attempt to recreate the full platform.

| Publicly described surface | What this signals | Prototype response |
|---|---|---|
| Spreadsheet-inspired model building | Finance users expect dense, precise, editable tabular interactions | Keep the model grid central; make keyboard editing, units, periods, and validation clear |
| Headcount planning | People, planned hires, start dates, salaries/costs, actual roster data, and hiring records may have to reconcile | Use a simple, fully synthetic “add two engineers starting in Month 7” proposal; no ATS/HRIS integration |
| Scenario modelling | Users need to compare alternative assumptions and downstream outcomes | Keep immutable Baseline versus editable Working scenario semantics already defined in §11 |
| Formula Agent / formula explanation | Explainability is part of the public product story | Keep the trace panel tied to real calculation definitions, not generated prose |
| AI-assisted model creation, reporting and insights | AI is a product workflow, not merely a chat box | Show a proposed change as a pending, inspectable object; do not build fake chat or a generic AI assistant |
| Deterministic numeric calculation | Drivetrain says AI writes logic/formulas while its calculation engine computes the numbers | Preserve the PRD's pure TypeScript deterministic engine and visibly mocked proposal source |
| Reporting, board reporting, waterfall charts and dashboard generation | Visualizations are attached to business questions and reporting workflows | Use one chart plus an equivalent accessible table; do not create a gallery of disconnected charts |
| Collaboration and shared planning | A real product must reason about concurrent users, access and shared state | Do not implement collaboration; preserve stale-proposal guards locally and state that no multi-user permissions exist |
| MCP and native AI integrations | Governance and data access boundaries matter when AI receives financial context | No API keys, real AI calls, external connectors, MCP or simulated authorization in the MVP |
| Multiple systems and data sources | FP&A interfaces represent connected data, not isolated hand-entered numbers | Use synthetic model inputs and make the source assumptions visibly synthetic; no external integration layer |

**Important:** the public product already describes AI-assisted scenario planning and formula explanations. Our proof is not “I invented human approval” or “I found that Drivetrain lacks traceability.” Our proof is the engineering implementation of a small, independently designed review/commit/trace workflow whose correctness can be verified in tests.

### 27.4 Public engineering signal from a frontend engineer profile

A public GitHub profile for [Gaurav Kumar](https://github.com/gk9848970), whose profile identifies him as a Frontend Engineer at Drivetrain AI, describes several projects he says he shipped at work. The profile mentions:

- a Google Sheets add-on/import path for customer board decks;
- a PDF automation system with pagination and custom report covers;
- CI/CD optimization, reporting a reduction from six minutes to 1.5 minutes;
- a Figma plugin to convert designs into production React components;
- EU number formatting using JavaScript's `Intl.NumberFormat` API.

The profile also describes his personal interest in fast, type-safe frontend applications. A public post discusses using `Intl.NumberFormat` for EU decimal/thousands separators: [LinkedIn post](https://www.linkedin.com/posts/gaurav-kumar-84b361188_javascript-activity-7403338249865474048-EpFu).

**Evidence caveat:** These are statements on an individual's public profile, not an official Drivetrain engineering architecture document. They do not prove these are team-wide priorities, that the individual currently owns these areas, or that Drivetrain uses a specific library. The work descriptions are still useful as clues about the kinds of product-engineering tasks a frontend engineer associated with the company has publicly highlighted.

| Public profile clue | Reasonable implication for our project | What we must not infer |
|---|---|---|
| Figma-to-React component plugin | Reusable components and faithful implementation of design intent are relevant; maintain a small, consistent component set and tokens | Do not claim Drivetrain uses our chosen UI library or that its internal design system is generated this way |
| PDF pagination/custom covers | Report/export layouts and content formatting can be real frontend engineering problems | Do not build a full PDF export system in MVP or claim knowledge of its report-generation implementation |
| Google Sheets add-on for board-deck imports | Finance reporting connects to external artifacts and existing workflows | Do not add a Google Sheets API dependency or fake integration to this project |
| CI/CD pipeline improvements | Fast, repeatable verification and a clean engineering workflow are worth showing | Do not make a performance claim about Drivetrain's current pipeline |
| EU number formatting | Locale-aware numeric display matters in financial software | Do not add a currency-conversion engine or a full localization feature to the MVP |

**Net new requirement:** use reusable UI primitives and a coherent design-token layer; make CI checks reliable; centralize number/currency formatting; and defer export/integration features unless the core demo is complete.

### 27.5 What remains unknown

A public search did **not** establish a reliable source naming Drivetrain's current internal:

- component library or design system package;
- table/grid engine (for example AG Grid, Handsontable, TanStack Table, or an in-house grid);
- charting library;
- CSS/styling framework;
- frontend state-management library;
- source tree, build tooling, test stack, or internal APIs.

The Frontend Engineer listing says React is important and highlights charts/tables, a spreadsheet-inspired modelling system, accessibility, reusable components, and performance. Those are the reliable stack/product signals. **Do not state or imply that Drivetrain uses shadcn/ui, Radix, Tailwind, Recharts, TanStack Virtual, TanStack Table, Redux, Zustand, or any other library because we select it for this portfolio project.** Our choices are independent implementation choices, not a reconstruction of their internal stack.

## 28. Implementation stack: exact library and service decisions

The original §15.1 stack remains the baseline. The following adds a **small UI-primitives layer** and defines why each dependency is or is not allowed. Coding agents must inspect the repository first and reuse a compatible installed package when it already satisfies the requirement.

### 28.1 Recommended stack decision matrix

| Concern | Decision | Required? | Why | Guardrail |
|---|---|---:|---|---|
| App framework/build | Vite + React + strict TypeScript | Yes, already in §15.1 | Small client-only prototype; no server rendering or backend needed | Keep the existing lockfile/package manager if a repo already exists |
| Basic UI primitives | `shadcn/ui` component source, using one consistent underlying primitive family (prefer Radix-based preset if supported by the current official initializer) | Recommended for a new, empty repo | Quickly provides consistent buttons, inputs, tabs, alerts, tooltips, dialogs and mobile sheets while leaving source code in the repo for inspection/customization | Follow current [shadcn/ui docs](https://ui.shadcn.com/docs/tailwind-v4) and component docs; do not mix Base UI, React Aria, and Radix implementations for the same component |
| Styling and tokens | Tailwind CSS with CSS custom properties/design tokens if the repo is greenfield and the official setup builds cleanly; otherwise use the repo's existing styling approach | Required: one system, not two competing systems | Fast layout composition and consistent spacing, color, typography and component states | Do not combine Tailwind v3 instructions with v4 setup. Do not migrate a functioning repo just to chase a version |
| Icons | `lucide-react` | Recommended | Consistent, light, recognizable action icons | Use icons sparingly and always include accessible labels for icon-only buttons |
| Model grid | Custom feature component built with semantic table markup and explicit keyboard/focus logic | Yes | The core value is the correctness and interaction behavior of this small, purpose-built grid | Do not outsource grid editing, transaction semantics or formula logic to a UI component library |
| Virtualized Performance Lab | Existing `@tanstack/react-virtual` from §15.1 | Yes | Headless virtualization for the synthetic 10,000-row view, with our own markup and style control ([official docs](https://tanstack.com/virtual/latest/docs/introduction)) | Virtualization stays isolated in the Performance Lab; do not make the small 24-month finance model unnecessarily virtualized |
| Table abstraction | Native table/custom row model for the model screen; do not add `@tanstack/react-table` by default | Not required | The MVP has a fixed 24-period structure and no required sort/filter/grouping feature; another abstraction is not yet justified | Reconsider only if implementation proves the row/column model needs sorting/filtering, pinning or visibility APIs |
| Scenario chart | Existing Recharts dependency from §15.1 | Yes | Enough for one line chart with baseline/working series and a responsive container ([official examples](https://recharts.github.io/en-US/examples/)) | Chart consumes typed output from the domain; it never computes financial math. Always provide the equivalent data table and text summary |
| Number/currency formatting | Native `Intl.NumberFormat`, wrapped in `domain/formatting.ts` | Yes | Browser-native locale-aware formatting; public engineer profile also highlights this API ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat)) | Default to explicit `en-US`/USD for the demo. Do not scatter `.toLocaleString()` calls through JSX |
| Canonical state | Typed reducer/transaction dispatcher from §15.4 | Yes | Preserves one mutation path for edits, proposals, undo and reset | Do not introduce Zustand/Redux just for fashion; choose another store only if a documented problem requires it |
| Proposal validation | Existing TypeScript domain validation; optional runtime schema at provider boundary only if useful | Yes validation; schema lib optional | Prevent invalid operations reaching the commit function | Do not maintain two conflicting financial validation implementations |
| Unit/component testing | Vitest + React Testing Library + `@testing-library/user-event` | Yes, already in §15.1 and §16 | Tests real user operations, not only low-level event dispatch ([user-event docs](https://testing-library.com/docs/user-event/intro/)) | Keep domain tests fast and independent of React |
| Browser-level journey | Playwright | Required for one critical journey, as in §15.1 | Verifies integrated user experience from rendered UI through state changes | Must assert the visible outcomes, not just that elements exist |
| Accessibility automation | `@axe-core/playwright` as a development dependency | Recommended | Catches a subset of common accessibility issues; Playwright explicitly notes automated checks do not replace manual assessment ([docs](https://playwright.dev/docs/accessibility-testing)) | Add one smoke test for key routes; still manually verify keyboard and focus behavior |
| CI | GitHub Actions (or existing repository CI) | Yes before outreach | Run install, lint, typecheck, unit/component tests and production build on pull requests | Avoid slow heavyweight CI stages unless needed; keep the pipeline reproducible |
| Static hosting | Vercel, Netlify, or GitHub Pages based on the existing account/repo workflow | Yes for a shareable link; one provider only | Vite app needs static hosting, not a backend | No secrets or API keys; test deep-link/refresh behavior if using routes |
| Browser performance | `performance.now()`, `performance.mark/measure`, React Profiler and browser DevTools | Yes | Uses built-in/browser tooling and produces reproducible local evidence | Do not send telemetry to a third party; document browser, machine, warm-up and repeated-run method |
| Production monitoring/analytics | None | No | The prototype is anonymous, static, and contains synthetic data | No Sentry, PostHog, Google Analytics, auth, cookies, or external telemetry in MVP |
| Backend/database | None | No | All state resets on refresh by design; synthetic data is bundled/generated locally | No Supabase, Firebase, database, serverless API, or persistence layer |
| External AI/MCP | None; deterministic mock `ProposalProvider` only | No | The PRD requires the proposal source to be visibly mocked and calculations deterministic | No LLM/API calls, secret management, live connectors, or claims of real AI |

### 28.2 Why shadcn/ui is suitable—but must stay in its lane

Use UI primitives for ordinary interface infrastructure where accessibility and consistency are easy to get wrong or expensive to repeat: buttons, labels, inputs, tabs, badges, separators, tooltip, alert, dialog, and a responsive sheet. The current shadcn documentation supports Tailwind v4 and React 19 and provides dialog/sheet building blocks, but it also supports different underlying primitive options. Use one chosen setup and follow its current documentation rather than pasting examples from different versions.

Keep these parts custom and visible in our code because they carry the proof:

- `ModelGrid` and `EditableAssumptionCell` keyboard lifecycle;
- `ProposalDiff` before/after cells and impacted outputs;
- domain transaction and stale-proposal protections;
- `TracePanel` output-to-input view;
- `ScenarioChart` mapping from pure comparison data;
- `VirtualizedGrid` and benchmark instrumentation.

Do not let the UI library decide when a proposal applies, how formulas are calculated, what undo means, or whether an invalid transaction is committed. Components are presentational and interactive adapters; domain correctness stays in the domain layer.

### 28.3 Why we are not choosing a full spreadsheet grid library

AG Grid, Handsontable and full spreadsheet engines solve much wider problems than this prototype needs. The MVP has 24 planning periods, a narrow set of editable assumption rows, known calculation rules, and a separate performance page for virtualization. Bringing in a full commercial/proprietary grid may:

- obscure the keyboard and focus handling that the project is meant to demonstrate;
- introduce licensing or setup work irrelevant to the demo;
- encourage features the PRD explicitly excludes (formula parser, paste ranges, drag-fill, arbitrary formulas);
- make it harder to show that transactions and model calculations are independent of the UI.

This is a scope decision, not a statement that these libraries are poor or that Drivetrain does not use one. If implementation evidence shows the custom grid is too risky, stop and present a trade-off proposal before changing the stack.

### 28.4 Dependency budget and change approval

The agent must first inspect `package.json`, the package-manager lockfile, scripts and installed packages. For a fresh repo, dependencies are allowed only when they map to a line in §28.1. Before adding a package, the agent must state:

1. the capability needed;
2. the exact package and official docs;
3. why built-in/browser/current dependencies are insufficient;
4. bundle/runtime and maintenance implications;
5. the smallest smoke test proving the package works with the selected React/Tailwind versions.

No routine package upgrades or lockfile regeneration unrelated to the task. Do not install multiple packages that solve the same problem. Commit the lockfile. Never switch npm/pnpm/yarn midway.

## 29. UI design system and component contracts

### 29.1 Design direction

Build an original, calm enterprise-finance tool interface. The public Drivetrain UI is a product reference for workflow concepts only—not a visual template to copy. Use neutral surfaces, crisp typography, subtle separators, compact numeric density, consistent alignment, and clear interaction states. Do not over-card every section, use excessive gradients, or turn this into a marketing landing page.

### 29.2 Design tokens

Create a token layer before page-specific polish. The single source of truth should be CSS custom properties (Tailwind theme variables may point to those properties if Tailwind is chosen). Minimum token groups:

- **Color:** app canvas, surface, elevated surface, border/subtle border, primary text, secondary text, muted, primary action, focus ring, selected, info, success, warning, error.
- **Semantic model values:** editable assumption, calculated output, pending proposal, accepted change, rejected/no-op state, stale proposal, negative-cash warning. Color is never the only signal; pair it with label/icon/text.
- **Spacing:** a small consistent scale; do not invent one-off gaps throughout components.
- **Typography:** product title, section title, body, caption, numeric/table value, compact metadata; use tabular numerals for financial data.
- **Radius, shadow and border:** restrained; no heavy shadows on each grid cell.
- **Layout:** top bar height, page max-width, side-panel width, grid row height, sticky header height, mobile breakpoint.
- **Motion:** quick state transitions only; respect `prefers-reduced-motion`.

Document the token names in `src/styles/tokens.css` or the existing project's equivalent. If using Tailwind v4, ensure generated utility classes reference the defined theme tokens; do not duplicate palette values in both CSS and arbitrary JSX classes.

### 29.3 Reusable base components

The UI primitive directory can contain the generated/installed primitive components and a small layer of app-specific wrappers. Required app-specific wrappers:

| Component | Responsibility | Must not own |
|---|---|---|
| `AppShell` | Page frame, header, navigation, main viewport and responsive layout | Financial state or calculations |
| `PageHeader` | Page title, concise context, action slot and status | Navigation/business rules |
| `StatusBadge` | Text+optional icon for pending/accepted/stale/error/working states | State transitions |
| `InlineNotice` | Persistent warning/error/success message with accessible semantics | Toast-only error handling |
| `MetricValue` | Consistent number/currency formatting and optional delta | Recalculation logic |
| `Button` wrapper | Consistent sizes/variants/focus states from chosen primitive | Domain actions beyond invoking a callback |
| `ConfirmDialog` | Confirm reset or destructive UI action; restore focus correctly | Undo transaction implementation |
| `SidePanel`/`MobileSheet` | Desktop side panel with mobile sheet behavior for Proposal/Trace details | Proposal or trace computation |
| `EmptyState` | Explain what to do next when no proposal/history/trace is selected | Hidden automatic mutations |

Use a single reusable primitive for each of these. Do not write a second button/dialog/toast system inside a feature.

### 29.4 Application shell and layout

Preserve the navigation and screens already defined in §7. Use a compact shell with:

- the project label **Model Change Review Lab**;
- a visible **Independent prototype · synthetic data · mock AI** disclosure near the top of the page (a footer-only disclaimer is insufficient for a reviewer landing directly on a deep link);
- navigation for Model, Scenario Compare, History, and Performance Lab according to §7;
- a visible working-scenario/revision indicator where it helps explain stale-proposal handling;
- consistent page spacing and scroll behavior.

Do not add authentication, profile menus, billing navigation, settings pages, notification centers, a marketing homepage, or a backend-style admin shell.

### 29.5 Model screen layout

Desktop layout should prioritize the model grid. Suggested arrangement:

1. **Top:** title and short context; working scenario badge; undo/reset controls; pending-proposal state if present.
2. **Model toolbar:** period horizon, visible units, proposal preset selector, and one primary “Prepare proposal” action.
3. **Main grid:** assumptions and calculated rows; row labels frozen/sticky; months M01–M24 horizontally scrollable; units and section names stay visible.
4. **Review region:** after generation, render a persistent proposal summary/diff panel on desktop; use the same content in a mobile sheet or stacked region on narrow screens.
5. **Explainability region:** selecting an output opens the trace panel; it must never hide whether a proposal is pending or stale.
6. **Scenario chart/summary:** show only the most important metrics on this page; detailed comparison remains in Scenario Compare.

The page should visibly distinguish assumptions the user can edit from computed outputs. Do not make output cells look editable.

### 29.6 Grid rendering and keyboard contract

The main 24-month grid is small enough to render without virtualization. Prioritize readable semantics and correct editing. Use a real HTML `<table>` unless browser testing establishes a reason that an ARIA grid is necessary. If using a custom `role="grid"`, the agent must implement and test the complete expected focus model; adding the role alone is a failure.

Required behavior remains compatible with §6–§8:

- one editing lifecycle: Enter/F2/double-click (choose and document a consistent start gesture), Enter commits a valid draft, Escape cancels, and arrow keys navigate when not editing;
- while editing, arrow keys may move the caret inside the input; they must not unexpectedly commit or move cells;
- a commit invokes domain validation and transaction dispatch, never a component-local formula;
- invalid input remains visible with an associated message and does not alter the model/revision;
- after commit/cancel, focus goes to a predictable cell/control;
- focus and selection must be visible without depending on color alone;
- assumptions and derived values have accessible labels containing row name, period and unit;
- values remain correct after scroll, rerender, proposal acceptance, rejection and undo.

Use the narrowest keyboard feature set that satisfies the PRD. Do not silently promise a complete Excel keyboard model, copy/paste range support, drag-fill, formula bar, or multi-cell selection.

### 29.7 Proposal review panel

The proposal panel is the primary proof asset. It must read like a review surface, not a fake chatbot.

Required structure:

- **Source:** a plain label “Simulated AI proposal” and the selected preset/intent;
- **Scope:** human-readable summary of what the proposal intends to change;
- **Change list:** each operation shows target row/period, current value, proposed value, signed/absolute delta, and unit;
- **Impact preview:** show a small list of affected outputs computed through the same engine using a preview snapshot; distinguish “preview” from active values;
- **Revision:** show the revision on which the proposal was generated;
- **Actions:** Accept proposal, Edit proposal, Reject proposal; destructive/commit action labels must be explicit;
- **Staleness:** if the model revision changes, visibly mark the proposal stale, disable Accept, explain why, and offer regeneration/rejection;
- **Feedback:** after an action, announce exactly what happened through an accessible status region.

The panel must not claim the mock is an LLM response. Do not add a typing indicator or an AI-branded assistant avatar.

### 29.8 Trace panel

A click on any derived output opens a view driven by the `TraceGraph` defined in §9:

- selected metric, period and displayed value;
- formula name/description and the relevant formula expression in plain text;
- its direct input assumptions/upstream outputs with readable labels and values;
- one-click navigation to an in-view input cell where feasible;
- an empty/error state if a trace is missing, which should also fail tests rather than being silently hidden;
- optional small tree/indented dependency list; no need for a large node-link graph library.

Do not build a visual DAG editor. The trace UI is an inspection tool for an already defined model, not a formula authoring tool.

### 29.9 Comparison chart and table

- Chart series must be computed by `scenarioComparison.ts` and consumed as data; no business math inside chart callbacks.
- Provide a clear title, chosen metric, period labels, baseline and working series names, units, and understandable tooltip values.
- Include a data-table alternative with the same data points; the table is not merely a copy of the legend.
- Use labels plus shape/line styles so the chart remains understandable without color perception.
- Keep axis formatting consistent with the selected metric; never display currency as a percentage or round away a meaningful delta.
- Handle null, negative, zero baseline and no-change cases as specified in §11 and §14.
- Avoid chart animation that makes each edit feel slow or distracts from the numbers; disable or shorten animation in reduced-motion mode and in performance runs.

### 29.10 Performance Lab UI

- Clearly label the screen as a **synthetic rendering benchmark**, separate from financial-model calculations.
- Display dimensions (`10,000 rows × 24 columns` or actual configured dimensions), generated data seed, visible-row count and virtualization state.
- Controls: run benchmark, rerun, optionally choose a small/large preset only if this remains a simple UI; no external benchmark service.
- Metrics must distinguish dataset preparation, initial mount/render, interaction latency proxy, and engine recomputation. Do not combine these into an ambiguous “speed score.”
- Display the environment/method next to results and include an explanation of limitations.
- Do not put expensive benchmark loops inside React render. Build/generate the dataset in a setup step or memoized state and keep the timed section precisely defined.
- State visibly when a metric is unavailable or measurement is interrupted; never show 0 ms as a fallback.

### 29.11 Number formats and locale

Use the single formatting module required by §15.3. It must own all formatting for currency, integers, decimals, percentages, deltas and missing values.

- Default visual locale: `en-US`; illustrative currency: USD.
- Configure `Intl.NumberFormat` explicitly; do not rely on the user's device locale implicitly changing the demo output.
- Use tabular numerals for grid values where supported by CSS.
- Never parse editable values from already-formatted currency text. Maintain canonical numeric state and use a separate raw edit string while editing.
- Add unit tests for grouping, decimals, zero, negatives, percentages, and one alternate locale such as `de-DE` to verify the formatter uses locale-aware output. The visible app does not need a locale switch in MVP.
- No currency conversion, exchange rates, date libraries or full localization framework.

### 29.12 UI state matrix

Every primary component must have intentional appearance and behavior for its states. The agent must include these states in its implementation checklist and review screenshots.

| Component/flow | States that must exist |
|---|---|
| Assumption cell | idle, focused, editing, invalid draft, committed, changed-by-proposal, restored-by-undo |
| Calculated cell | idle, selected for trace, changed after commit, negative/warning metric |
| Proposal panel | no proposal, generating, preview ready, proposal edited, accepted, rejected, stale, validation error, provider error |
| Action button | default, hover, keyboard focus, disabled, pending where relevant |
| Trace panel | no selection, selected output, valid dependencies, missing trace/error diagnostic |
| Scenario chart | loaded, baseline equals working, positive/negative delta, zero baseline, empty/unavailable data |
| Performance Lab | idle, running, completed, failed/interrupted, metric unavailable |
| Navigation/panel | normal, active, keyboard focus, mobile layout, dialog/sheet open and closed |

Use skeletons only when there is actual asynchronous work or an intentional loading state. Do not add fake network loading to make a static demo feel more “real.”

## 30. External services: approved, optional, and forbidden

### 30.1 Approved supporting services

| Service/tool | Use | Data sent | Rule |
|---|---|---|---|
| GitHub | Public source, issues if needed, reviewable commits, README and CI | Only this independent project's code and documentation | No company proprietary data or old employer code |
| GitHub Actions or existing CI | Run lint, typecheck, tests and production build | Code/check logs | No secrets needed; avoid unnecessary third-party action permissions |
| Vercel or Netlify (choose one) | Host the static demo and preview builds | Built static assets and synthetic demo code/data | No server-side API or environment secrets; test the final URL and refresh behavior |
| Browser DevTools + React Profiler | Analyze renders and interaction performance | Local runtime only | Record actual method/device/browser; no external telemetry |
| Playwright | Run the critical user journey and collect optional screenshots/artifacts | Test fixture data only | No production credentials or real financial data |
| axe-core/Playwright | Catch common accessibility regressions | Local rendered UI | Automated result is not a substitute for manual checks |
| Screen recorder/Loom (optional) | Publish a 90-second walkthrough | Screen capture of this demo only | Do not expose environment details, tokens or other browser tabs |

### 30.2 Deliberately not needed

Do not add the following in MVP: Supabase, Firebase, PostgreSQL, authentication, server API, React Query/TanStack Query, Redux, Zustand, Sentry, PostHog, analytics, an LLM provider, MCP, Google Sheets API, ATS/HRIS connectors, actual PDF-generation services, or persistent storage.

These services are unnecessary for the required proof. They introduce configuration and claims that do not strengthen the central demonstration. If a later revision proposes one, it must make the case in writing before installation and be classified as deferred scope, not silently added by an agent.

### 30.3 Lightweight report/export consideration

The public engineer profile's mention of PDF report pagination/custom covers and Google Sheets board-deck output suggests that finance-product outputs can extend beyond the on-screen grid. That is context, not a requirement to reproduce those internal systems.

**Optional P2 only, after P0/P1:** add a simple print stylesheet for a one-page scenario-impact summary (scenario name, assumptions changed, affected outputs, and timestamp explicitly labelled as local display metadata). Use browser print; do not add a PDF-generation dependency, export integration, or dynamic report engine. The output must carry the synthetic-data and non-affiliation disclosure. This must not delay the core demo or outreach.

## 31. Code-organization extension

Keep the original source tree in §15.3. If using the component system described above, add these directories/files only when they contain real implementation:

```text
src/
  components/
    ui/                         # source-owned shadcn primitives, if selected
    app/
      AppShell.tsx
      PageHeader.tsx
      StatusBadge.tsx
      InlineNotice.tsx
      MetricValue.tsx
      ConfirmDialog.tsx
      SidePanel.tsx
  styles/
    tokens.css                  # single source of design tokens
    global.css
  lib/
    cn.ts                       # only if generated component conventions require it
  features/
    model/
      ModelGrid.tsx             # bespoke grid; UI library does not own state rules
      GridCell.tsx
      EditableAssumptionCell.tsx
    proposals/
      ProposalReviewPanel.tsx
      ProposalDiff.tsx
    trace/
      TracePanel.tsx
    comparison/
      ScenarioChart.tsx
    performance/
      VirtualizedGrid.tsx
      performanceMeasurements.ts
  test/
    accessibility.smoke.test.ts # or colocated Playwright axe test, if configured
```

This is additive to the original tree, not a requirement to create every file in advance. Agent must prefer fewer, purposeful files over empty one-line abstractions. The domain modules remain framework-independent.

## 32. New and clarified acceptance criteria

These criteria supplement the existing requirement matrix in §5.1 and tests in §16. They do not supersede existing IDs or reduce coverage.

| ID | Requirement | Acceptance test |
|---|---|---|
| UI-01 | The UI uses one consistent primitive/styling system | `package.json` and source show no duplicate dialog/menu/button systems or mixed shadcn primitive families |
| UI-02 | App visually identifies itself as an independent prototype | Disclosure visible in the initial viewport on Model and at least present on every screen |
| UI-03 | Main grid remains semantic and keyboard-operable | Test edit, valid commit, invalid commit, cancel and focus after commit/cancel; manually verify screen-reader labels and focus visibility |
| UI-04 | UI cannot mutate domain state directly | All model writes go through the canonical dispatcher/transaction layer; tests fail if Reject or invalid edit changes revision or data |
| UI-05 | Proposal preview values are not active model values | Before acceptance, model grid/history/revision remain unchanged; only preview data indicates proposed results |
| UI-06 | Staleness is visible and safe | Change an assumption after generating a proposal; Accept is disabled and reason is visible until regeneration/rejection |
| UI-07 | Chart and comparison table stay consistent | Both are generated from the same scenario-comparison result; test exact values for the chosen metric/periods |
| UI-08 | Trace panel uses calculation definitions | All trace references resolve; selecting an output shows its real source assumptions/upstream outputs; dangling trace fails tests |
| UI-09 | Financial formatting is centralized | No JSX-owned numeric formatting for model/business values; tests cover currency, signs, precision and one alternate locale |
| UI-10 | Performance Lab is isolated from finance calculations | Synthetic rows never appear in finance outputs, proposals or history; benchmark is a separate route/feature |
| UI-11 | Dependency set is justified | README or architecture note lists major packages and why each is used; no unexplained API/service dependencies |
| UI-12 | Primary UI states are complete | Review checklist covers idle/loading/pending/error/stale/disabled/success/focus states from §29.12 |
| UI-13 | Accessibility automated smoke test exists | If Playwright is installed, an axe check runs on primary route(s); known findings are documented and severe avoidable issues fixed |
| UI-14 | CI is reproducible | A clean install followed by lint, typecheck, Vitest, and production build succeeds; Playwright runs on the critical journey where configured |
| UI-15 | Public demo research is honest | `docs/research/public-product-observations.md` separates direct observations from hypotheses and records inaccessible videos truthfully |
| UI-16 | Original scope stays intact | No backend, auth, AI API, MCP, integrations, arbitrary formulas, collaboration or actual export service in MVP |

## 33. Updated coding-agent protocol for UI and dependency work

Append the following directives to the agent contract in §20. They are mandatory for each coding phase that changes UI, package configuration or product behavior.

### 33.1 Phase 0 must include product and repository reconnaissance

Before changing files, the agent must:

1. list the repository's current files, `package.json`, lockfile, scripts, installed UI primitives, styling configuration, tests and CI;
2. state whether the repository is empty, partially built or already has an established design system;
3. open/review the public sources in §27.1, inspect available demos as far as technically accessible, and write the evidence note in §27.2;
4. record any unknown internal Drivetrain stack details instead of guessing;
5. present a package-by-package change plan with purpose, official documentation, compatibility concern and validation command;
6. identify any contradiction between the current repository and this PRD and ask before doing a large migration;
7. propose an app component hierarchy and a minimal visual state matrix before styling;
8. make no code changes until the reconnaissance summary and implementation plan are reviewed.

### 33.2 Do not allow package/version hallucinations

- Read the current lockfile and package manager first.
- Use official documentation appropriate to the selected version, especially for Tailwind and shadcn/ui.
- Do not copy an older tutorial's config into a newer major version.
- After adding a base UI component, immediately run the production build and at least one render test before generating many more components.
- Keep dependency versions in the repository lockfile. Report exact installed package versions in the implementation notes.
- If the shadcn setup is incompatible with the present repo, use existing components/styles or CSS modules; do not spend days upgrading the project for a component library.

### 33.3 Build by product slice, not component count

Each phase should be completed as an end-to-end slice:

- first, domain value and test;
- then the UI that exposes that value;
- then the error/edge state;
- then a regression test;
- then visual polish.

Do not generate the whole component catalogue first. Do not build mock screens with inert buttons. Every control in a delivered screen must have its promised behavior implemented or be visibly disabled/labelled out of scope.

### 33.4 Visual review is a required engineering step

After the core behavior passes:

1. run the application locally;
2. use the target desktop viewport and one mobile viewport;
3. capture screenshots for the baseline model, proposal diff, stale proposal, trace panel, comparison chart/table and Performance Lab;
4. inspect alignment, clipping, density, sticky headers/labels, numeric alignment, focus state, responsive overflow and chart/table consistency;
5. fix concrete issues and rerun tests;
6. do not add screenshots to the public README if they accidentally contain machine usernames, tokens, browser tabs, or unintended content.

Screenshots are a QA aid, not proof of performance. Performance claims must come from §12's documented measurement method.

### 33.5 Required phase outputs

For every agent phase, require a concise report containing:

- files changed;
- behaviors delivered;
- tests added and exact test command/results;
- any new dependency and why;
- limitations or decisions left open;
- manual acceptance checks performed;
- proof that the relevant invariants from §0, §10 and §16 still hold.

No phase is complete just because the agent says “done.” The human owner reviews the diff and independently runs the checks.

## 34. Research-informed scope adjustments

These are clarifications that improve fidelity without expanding the project beyond its core.

### Keep in MVP

- a compact financial-model UI rather than a marketing-style dashboard;
- a headcount-related sample proposal grounded in the public product category;
- a visible pending/proposed state, before/after change list, deterministic preview, explicit human commit, trace-to-source and undo;
- readable chart + equivalent table;
- consistent finance number formatting through `Intl.NumberFormat`;
- reusable accessible primitives around custom high-value interactions;
- tests and CI that demonstrate correctness and repeatability.

### Keep out of MVP

- matching Drivetrain's exact visual design, logos, typography, colors, screenshots or interface copy;
- an attempt to infer or reproduce its internal component library or app architecture;
- a full formula editor, multi-cell spreadsheet engine, real-time collaboration, permissions, or backend persistence;
- actual report PDF generation, Google Sheets import/export, ATS/HRIS matching, MCP or live AI providers;
- an AI-spend dashboard just because the company has an AI-spend use case;
- broad scope expansion to include every product demo or every historical customer complaint.

### Optional only after the existing Definition of Done is met

- print stylesheet for a one-page model-change review report;
- a small component gallery within the app for UI primitives/states, only if it helps reviewers understand the reusable component system without adding a separate Storybook deployment;
- additional chart types beyond the single required chart;
- sorting/filtering in the performance grid if needed to demonstrate a real requirement rather than as decorative functionality.

## 35. Research and implementation reference links

### Drivetrain public product and hiring sources

- [Frontend Engineer role](https://jobs.lever.co/drivetrain/cd39cc4e-056e-444c-8c17-9f97e34ddbce)
- [Micro Demos](https://www.drivetrain.ai/micro-demos)
- [Headcount Planning](https://www.drivetrain.ai/solutions/headcount-planning-software)
- [Drive AI](https://www.drivetrain.ai/drive-ai)
- [MCP server for finance](https://www.drivetrain.ai/post/mcp-server-finance-launch)
- [Frontend engineer's public GitHub profile describing work at Drivetrain](https://github.com/gk9848970)
- [Public post on EU number formatting with Intl.NumberFormat](https://www.linkedin.com/posts/gaurav-kumar-84b361188_javascript-activity-7403338249865474048-EpFu)

### Library and browser documentation

- [shadcn/ui with Tailwind v4 and React 19](https://ui.shadcn.com/docs/tailwind-v4)
- [shadcn/ui Dialog](https://ui.shadcn.com/docs/components/base/dialog)
- [shadcn/ui Sheet](https://ui.shadcn.com/docs/components/base/sheet)
- [TanStack Virtual](https://tanstack.com/virtual/latest/docs/introduction)
- [Recharts examples](https://recharts.github.io/en-US/examples/)
- [Testing Library user-event](https://testing-library.com/docs/user-event/intro/)
- [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing)
- [MDN Intl.NumberFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat)

## 36. Updated final decision

Retain the original **Model Change Review Lab** architecture and domain plan. Add a thin, consistent UI-primitives layer to accelerate basic interactions; handcraft the financial grid, proposal review, trace view, and performance harness where the engineering judgment should be visible; use the already-selected TanStack Virtual and Recharts only for their specific jobs; and rely on browser-native formatting and profiling APIs where possible.

The public research supports a rich, interconnected planning/reporting/AI workflow and explicit frontend emphasis on performance, reusable UI, accessibility, charts/tables, and spreadsheet-like modelling. A public frontend engineer profile also gives clues about component generation, report pagination, Google Sheets board-deck workflow, CI/CD, and locale formatting. It does **not** establish Drivetrain's internal component-library or chart/grid choices. We should be transparent about that distinction.

**The implementation rule is simple:** leverage libraries for routine UI infrastructure, but keep the core proof—the proposed changes, state transitions, math, traceability, stale guards, undo and measurements—small, explicit, testable and owned by this project.
