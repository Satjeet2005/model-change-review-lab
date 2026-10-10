# Model Change Review Lab - Implementation Tasks

> **Phase 0 — Reconnaissance (mandatory, no code changes):** Inspect repository status, package manager/lockfile, existing framework/dependencies/scripts/config, components/styling/chart libraries/tests, CI/deployment setup. Produce a reconnaissance report. Wait for explicit human approval before any implementation changes. Only scaffold a new Vite project if reconnaissance confirms an empty repo or the user approves replacing the current structure. See `IMPLEMENTATION_MASTER_PLAN.md` §4.

## Phase 0 — Reconnaissance

### T-000: Repository and environment reconnaissance
- **Requirement IDs:** UI-15, FR-027, NFR-002
- **Phase:** P0
- **Title:** Inspect repository, dependencies, and existing project state
- **Dependencies:** None
- **Files to create/modify:** `docs/reconnaissance.md`, `docs/research/public-product-observations.md` (reports only)
- **Description:** Inspect repository status (directory listing, git status if present), manifests and lockfiles, package manager, dependencies, framework, scripts, components/styling/chart libraries/tests/CI/deployment, and existing source tree. Do NOT install dependencies or modify application source files. Also perform the PRD §27.2 public-demo viewing pass where accessible and document direct observations separately from hypotheses in `docs/research/public-product-observations.md`; record videos or sections that are inaccessible without inventing observations. If repository or demos are inaccessible, record the precise blocker and do not assume an empty repository or fabricate findings.
- **Recommendation format (must distinguish):** (1) Extend existing project with current package manager and structure; (2) Replace existing project — requires explicit user approval; (3) Create greenfield — only if repository is confirmed empty, and approval still required.
- **Tests to write:** None (inspection only)
- **Completion criteria:** Both `docs/reconnaissance.md` and `docs/research/public-product-observations.md` exist. The reconnaissance report records observed repository state, package manager, lockfile evidence, dependencies, framework, components/styles/tests/CI, recommendation (1/2/3), and blockers. The public-observation report separates direct observations from hypotheses and records inaccessible demos truthfully. User explicitly approves before T-001 or implementation starts.
- **Estimated complexity:** S

## Phase 1 — Domain Foundation
### T-001: Initialize / extend project (ONLY after T-000 approval)
- **Phase:** P1
- **Title:** Initialize project with [package-manager] create vite (react-ts template) — only if approved
- **Dependencies:** T-000 (must have real docs/reconnaissance.md and explicit approval)
- **Requirement IDs:** NFR-001, NFR-002, NFR-006
- **Files to create/modify:** `package.json`, `vite.config.ts`, `index.html` — or extend existing repo
- **Description:** Based on T-000 recommendation: (1) extend existing project, (2) replace existing project (requires explicit approval), or (3) create greenfield because repository is confirmed empty (still requires approval). Do NOT automatically scaffold or clear the repository. Preserve existing package manager unless approved to change. Do not install dependencies until Phase 0 completes.
- **Tests to write:** None
- **Completion criteria:** Project structure established consistent with T-000 recommendation; no unapproved repository deletion.
- **Estimated complexity:** S
### T-002: Configure strict TypeScript
- **Phase:** P1
- **Title:** Configure strict TypeScript
- **Dependencies:** T-001
- **Requirement IDs:** None — TypeScript configuration enabler
- **Files to create/modify:** `tsconfig.json`, `tsconfig.node.json`, `tsconfig.app.json`
- **Description:** Update TypeScript configuration to enable `strict: true`, `noUncheckedIndexedAccess`, and strict property typing.
- **Tests to write:** None
- **Completion criteria:** `[package-manager] typecheck` passes with strict rules enabled.
- **Estimated complexity:** S
### T-003: Install and configure Vitest + jsdom + RTL
- **Phase:** P1
- **Title:** Install and configure testing framework
- **Dependencies:** T-001
- **Requirement IDs:** FR-024
- **Files to create/modify:** `vite.config.ts`, `vitest.setup.ts`
- **Description:** Install Vitest, jsdom, and React Testing Library. Configure Vitest to use jsdom environment.
- **Tests to write:** A simple smoke test.
- **Completion criteria:** `[package-manager] test` successfully executes the smoke test.
- **Estimated complexity:** S

### T-004: Configure ESLint + Prettier
- **Phase:** P1
- **Title:** Configure ESLint and Prettier
- **Dependencies:** T-001
- **Requirement IDs:** None — lint/format tooling enabler
- **Files to create/modify:** `.eslintrc.cjs`, `.prettierrc`
- **Description:** Set up ESLint with React and TypeScript recommended rules. Configure Prettier.
- **Tests to write:** None
- **Completion criteria:** Linting rules catch unused variables, formatting applies cleanly.
- **Estimated complexity:** S
### T-005: Add npm scripts
- **Phase:** P1
- **Title:** Add npm lifecycle scripts
- **Dependencies:** T-001, T-002, T-003, T-004
- **Requirement IDs:** FR-024
- **Files to create/modify:** `package.json`
- **Description:** Add standard scripts for dev, build, typecheck, lint, test, format.
- **Tests to write:** None
- **Completion criteria:** All scripts execute correctly.
- **Estimated complexity:** S

### T-006: Create domain type definitions
- **Phase:** P1
- **Title:** Define core domain types
- **Dependencies:** T-002
- **Requirement IDs:** FR-003, FR-013, NFR-001
- **Files to create/modify:** `src/domain/types.ts`
- **Description:** Define TypeScript interfaces for ModelAssumptions (startingRevenueUsd, startingCashUsd, 24 MonthAssumptions), CalculatedModel (revenue, totalFte, payroll, totalOperatingExpense, ebitda, endingCash), PeriodIndex, Operation, Transaction, Proposal, and TraceIndex. No React/browser imports in domain files.
- **Tests to write:** Type compilation test; import-boundary review.
- **Completion criteria:** Types exported, `src/domain/` has no React/browser dependency imports.
- **Estimated complexity:** M
### T-007: Implement seedModel.ts
- **Phase:** P1
- **Title:** Create seed assumptions
- **Dependencies:** T-006
- **Requirement IDs:** FR-002
- **Files to create/modify:** `src/domain/seed.ts`
- **Description:** Implement `createSeedAssumptions()` to generate the deterministic 24-month baseline with default values for revenue growth (%), engineering FTE, other FTE, loaded monthly cost per FTE ($), other operating expense ($), plus model settings starting revenue and starting cash.
- **Tests to write:** T-017 (Verify seed generates exactly 24 periods).
- **Completion criteria:** Function returns a properly structured initial Model.
- **Estimated complexity:** S
### T-008: Implement validation.ts
- **Phase:** P1
- **Title:** Implement domain validation logic
- **Dependencies:** T-006
- **Requirement IDs:** FR-005, NFR-001 (domain independence)
- **Files to create/modify:** `src/domain/validation.ts`
- **Description:** Write `validateAssumptionValue` (type/range-aware rules for percentage, integer FTE, currency, non-negative) and `validateOperationSet` (ordered, valid targets, no duplicate/unknown targets). All formulas must remain in calculation engine; validation stays pure.
- **Tests to write:** T-019 (Validation boundaries).
- **Completion criteria:** Validation flags out-of-bounds numbers and conflicting edits.
- **Estimated complexity:** M

### T-009: Implement roundMoney utility
- **Phase:** P1
- **Title:** Implement monetary rounding utility
- **Dependencies:** T-000 (reconnaissance approved; domain work permitted)
- **Requirement IDs:** CALC-001 (supplemental: rounding consistency)
- **Files to create/modify:** `src/utils/math.ts`
- **Description:** Create a pure function `roundMoney` for deterministic monetary rounding.
- **Tests to write:** Tests for roundMoney with standard and float cases.
- **Completion criteria:** Handles precision errors safely.
- **Estimated complexity:** S

### T-010: Implement calculateModel() pure function
- **Phase:** P1
- **Title:** Implement core calculation engine
- **Dependencies:** T-006, T-009
- **Requirement IDs:** FR-003, FR-013, CALC-002, CALC-003
- **Files to create/modify:** `src/domain/calculation.ts`
- **Description:** Build `calculateModel(assumptions): CalculatedModel` per PRD §6.4 / §10. `assumptions` is `ModelAssumptions` containing `startingRevenueUsd`, `startingCashUsd`, and exactly 24 `months`. Evaluate the six calculated rows: Revenue (M01 = startingRevenueUsd × (1+growthRate[1]); M02+ = Revenue[t-1] × (1+growthRate[t])), Total FTE = engineeringFte + otherFte, Payroll = totalFte × loadedMonthlyCostPerFteUsd, Total operating expenses = payroll + otherOperatingExpenseUsd, EBITDA = revenue − totalOperatingExpense, Ending cash (M01 = startingCashUsd + ebitda[1]; M02+ = endingCash[t-1] + ebitda[t]). Use `roundMoney`. No separate settings argument — settings are fields inside `ModelAssumptions`. No Gross Margin or Net Income.
- **Tests to write:** T-018 (Calculation correctness: exact formulas for M01/M07/M24; immutability; determinism).
- **Completion criteria:** All six calculated rows match PRD §6.4 formulas; same inputs yield identical outputs; input objects unmutated.
- **Estimated complexity:** L

### T-011: Implement trace.ts
- **Phase:** P1
- **Title:** Implement dependency tracing logic (domain engine)
- **Dependencies:** T-006, T-010
- **Requirement IDs:** FR-014, TRACE-001, TRACE-002 (supplemental: domain trace engine, not UI panel)
- **Files to create/modify:** `src/domain/trace.ts`
- **Description:** Implement `buildTraceIndex` to generate a deterministic trace mapping from each calculated cell to its formula and valid dependency nodes (assumption or calculated). Resolve to base assumptions/settings; no dangling references; acyclic. This is the domain trace engine; the UI panel is separate (P4).
- **Tests to write:** T-021 (Trace graph correctness), T-027–T-29 analogs.
- **Completion criteria:** Every calculated node points only to existing nodes; all chains resolve to assumptions/settings.
- **Estimated complexity:** M

### T-012: Implement formatting utilities
- **Phase:** P1
- **Title:** Implement formatting and parsing utilities
- **Dependencies:** T-009
- **Requirement IDs:** UI-09, CALC-001 (supplemental: centralized formatting)
- **Files to create/modify:** `src/domain/formatting.ts`
- **Description:** Create `formatCurrency`, `formatPercentage` (show percentage points clearly), `parseEditableValue`. Use native `Intl.NumberFormat` wrapped in `src/domain/formatting.ts`. All numeric formatting centralized; no JSX-owned formatting.
- **Tests to write:** T-023 (Format strings correctly); FMT-1 analog.
- **Completion criteria:** Handles large numbers, negatives, zeros, decimals; percentage display is human-readable.
- **Estimated complexity:** S

### T-013: Implement proposals.ts
- **Phase:** P1
- **Title:** Implement proposal provider and templates
- **Dependencies:** T-006, T-009, T-010
- **Requirement IDs:** FR-007, FR-027, PROP-001
- **Files to create/modify:** `src/domain/proposals.ts`
- **Description:** Define `ProposalProvider` and `MockProposalProvider` with 3 predefined templates. Proposal generation is deterministic and local; do not call fetch, external APIs, Drivetrain services or a real LLM.
- **Tests to write:** T-020 (Verify templates).
- **Completion criteria:** Returns valid proposal objects.
- **Estimated complexity:** M
### T-014: Implement applyOperationsToDraft()
- **Phase:** P1
- **Title:** Implement operation application logic
- **Dependencies:** T-006, T-008
- **Requirement IDs:** FR-008, FR-009, UI-05, PROP-001
- **Files to create/modify:** `src/domain/operations.ts`
- **Description:** Create `applyOperationsToDraft` for applying Operations to a cloned model.
- **Tests to write:** T-018 (Operation application).
- **Completion criteria:** Base model unmutated, draft updated.
- **Estimated complexity:** S
### T-015: Implement transactions.ts
- **Phase:** P1
- **Title:** Implement transaction orchestration
- **Dependencies:** T-006, T-014, T-008, T-010
- **Requirement IDs:** FR-006, FR-010, PROP-003
- **Files to create/modify:** `src/domain/transactions.ts`
- **Description:** Build `commitTransaction` which validates, applies, and recalculates, returning new Model/Transaction.
- **Tests to write:** T-018 (commitTransaction success/failure).
- **Completion criteria:** Immutable state update on success.
- **Estimated complexity:** M
### T-016: Implement scenarioComparison.ts
- **Phase:** P1
- **Title:** Implement scenario delta calculations
- **Dependencies:** T-006
- **Requirement IDs:** FR-016
- **Files to create/modify:** `src/domain/scenarioComparison.ts`
- **Description:** Create `calculateScenarioDelta(baseline, working)` for computing absolute and percentage differences.
- **Tests to write:** T-022 (Delta calculations).
- **Completion criteria:** Safely handles zero denominators.
- **Estimated complexity:** M

### T-017: Write seed model tests
- **Phase:** P1
- **Title:** Write tests for seed model generation
- **Dependencies:** T-007
- **Requirement IDs:** FR-024
- **Files to create/modify:** `src/domain/__tests__/seedModel.test.ts`
- **Description:** Implement PRD tests 1-2. Verify 24 periods and default values.
- **Tests to write:** Verify period count and defaults.
- **Completion criteria:** Tests pass.
- **Estimated complexity:** S

### T-018: Write calculation engine tests
- **Phase:** P1
- **Title:** Write tests for calculation engine
- **Dependencies:** T-010, T-014, T-015
- **Requirement IDs:** CALC-002, CALC-003, FR-024
- **Files to create/modify:** `src/domain/__tests__/calculateModel.test.ts`
- **Description:** Implement PRD tests 3-12. Test cascades over 24 months.
- **Tests to write:** Calculation cascades.
- **Completion criteria:** 100% pass rate.
- **Estimated complexity:** M

### T-019: Write validation tests
- **Phase:** P1
- **Title:** Write tests for domain validation
- **Dependencies:** T-008
- **Requirement IDs:** FR-024
- **Files to create/modify:** `src/domain/__tests__/validation.test.ts`
- **Description:** Implement PRD input-validation tests 13–15 (minima, maxima, out-of-range, integer vs fractional FTE, non-numeric and whitespace rejection).
- **Tests to write:** Boundary and type-aware validation checks.
- **Completion criteria:** Validation tests pass.
- **Estimated complexity:** S

### T-020: Write proposal template tests
- **Phase:** P1
- **Title:** Write tests for proposal generation
- **Dependencies:** T-013, T-014
- **Requirement IDs:** FR-007, FR-024, FR-027
- **Files to create/modify:** `src/domain/__tests__/proposals.test.ts`
- **Description:** Implement PRD operation-set tests 16–18 (duplicate targets, unknown targets, invalid values) and template tests 21–26 (template operations, determinism, preview immutability, and confirmation that proposal generation performs no fetch/external network calls).
- **Tests to write:** Operation validation, template operations, determinism, preview immutability, and confirmation that proposal generation performs no fetch/external network calls.
- **Completion criteria:** All proposal-template, operation-set validation, and no-external-call tests pass.
- **Estimated complexity:** S
### T-021: Write trace tests
- **Phase:** P1
- **Title:** Write tests for dependency tracing
- **Dependencies:** T-011
- **Requirement IDs:** FR-014, FR-024, TRACE-001, TRACE-002
- **Files to create/modify:** `src/domain/__tests__/trace.test.ts`
- **Description:** Implement PRD tests 27-29.
- **Tests to write:** Trace index linkages.
- **Completion criteria:** Tests pass.
- **Estimated complexity:** M
### T-022: Write scenario comparison tests
- **Phase:** P1
- **Title:** Write tests for scenario comparison
- **Dependencies:** T-016
- **Requirement IDs:** FR-016, FR-024
- **Files to create/modify:** `src/domain/__tests__/scenarioComparison.test.ts`
- **Description:** Implement PRD tests 19-20.
- **Tests to write:** Baseline vs working delta.
- **Completion criteria:** Tests pass.
- **Estimated complexity:** S

### T-023: Write formatting tests
- **Phase:** P1
- **Title:** Write tests for formatting utilities
- **Dependencies:** T-012
- **Requirement IDs:** FR-024, UI-09
- **Files to create/modify:** `src/domain/__tests__/formatting.test.ts`
- **Description:** Validate `formatCurrency` and `formatPercentage`.
- **Tests to write:** Format string assertions.
- **Completion criteria:** Tests pass.
- **Estimated complexity:** S
### T-024: Verify all P1 checks pass
- **Phase:** P1
- **Title:** Validate Phase 1 completion
- **Dependencies:** T-017, T-018, T-019, T-020, T-021, T-022, T-023
- **Requirement IDs:** NFR-001, FR-024
- **Files to create/modify:** None
- **Description:** Run all lint, test, build checks.
- **Tests to write:** None
- **Completion criteria:** CI-equivalent checks pass.
- **Estimated complexity:** S

## Phase 2 — App Shell + Grid
### T-025: Install Tailwind CSS v4
- **Phase:** P2
- **Title:** Install Tailwind CSS v4 + @tailwindcss/vite
- **Dependencies:** T-001
- **Requirement IDs:** UI-01
- **Files to create/modify:** `package.json`, `vite.config.ts`, `src/index.css`
- **Description:** Set up Tailwind CSS via Vite plugin.
- **Tests to write:** None
- **Completion criteria:** Tailwind works in components.
- **Estimated complexity:** S
### T-026: Initialize shadcn/ui
- **Phase:** P2
- **Title:** Initialize shadcn/ui with Radix base
- **Dependencies:** T-025
- **Requirement IDs:** UI-01
- **Files to create/modify:** `components.json`, `src/lib/utils.ts`, `src/components/ui/Button.tsx`
- **Description:** Setup shadcn `cn()` and add basic primitives.
- **Tests to write:** None
- **Completion criteria:** Buttons render correctly.
- **Estimated complexity:** S
### T-027: Create design tokens
- **Phase:** P2
- **Title:** Create design tokens (`src/index.css`)
- **Dependencies:** T-025
- **Requirement IDs:** NFR-004, UI-01, A11Y-002
- **Files to create/modify:** `src/index.css`
- **Description:** Set up CSS vars for colors, baseline/working themes.
- **Tests to write:** None
- **Completion criteria:** Tokens used via Tailwind classes.
- **Estimated complexity:** S
### T-028: Create AppShell
- **Phase:** P2
- **Title:** Create AppShell with header, tabs, disclosure
- **Dependencies:** T-026, T-027
- **Requirement IDs:** DISC-002, FR-001, UI-02
- **Files to create/modify:** `src/components/shell/AppShell.tsx`
- **Description:** Frame with global header, tabs, and banner.
- **Tests to write:** Shell render test.
- **Completion criteria:** Layout renders responsively.
- **Estimated complexity:** M
### T-029: Create appState.ts + appReducer.ts
- **Phase:** P2
- **Title:** Create global application state
- **Dependencies:** T-015
- **Requirement IDs:** FR-002, FR-008, FR-015, UI-04
- **Files to create/modify:** `src/state/appState.ts`, `src/state/appReducer.ts`
- **Description:** Set up reducer, initial state holding model and proposals.
- **Tests to write:** Initialization action tests.
- **Completion criteria:** Reducer properly acts on events.
- **Estimated complexity:** M
### T-030: Create AppProvider
- **Phase:** P2
- **Title:** Create AppProvider
- **Dependencies:** T-029
- **Requirement IDs:** FR-008
- **Files to create/modify:** `src/state/AppProvider.tsx`
- **Description:** Context provider for appReducer state.
- **Tests to write:** Context injection test.
- **Completion criteria:** State accessible in children.
- **Estimated complexity:** S

### T-031: Create ModelPage layout
- **Phase:** P2
- **Title:** Create ModelPage layout
- **Dependencies:** T-028, T-030
- **Requirement IDs:** None — enabling page-layout task
- **Files to create/modify:** `src/pages/ModelPage.tsx`
- **Description:** Summary strip, settings area, grid area.
- **Tests to write:** Layout render test.
- **Completion criteria:** Structure is visible.
- **Estimated complexity:** S
### T-032: Create ModelSettings component
- **Phase:** P2
- **Title:** Create ModelSettings component
- **Dependencies:** T-031
- **Requirement IDs:** FR-003
- **Files to create/modify:** `src/components/model/ModelSettings.tsx`
- **Description:** Form for starting revenue and cash.
- **Tests to write:** Interaction updates state.
- **Completion criteria:** Triggers recalculation on update.
- **Estimated complexity:** S
### T-033: Create ModelGrid
- **Phase:** P2
- **Title:** Create ModelGrid
- **Dependencies:** T-031
- **Requirement IDs:** NFR-004, UI-03
- **Files to create/modify:** `src/components/model/ModelGrid.tsx`
- **Description:** Semantic table with sticky headers, row groups.
- **Tests to write:** Render tests.
- **Completion criteria:** Displays 24 columns clearly.
- **Estimated complexity:** M
### T-034: Create EditableAssumptionCell
- **Phase:** P2
- **Title:** Create EditableAssumptionCell
- **Dependencies:** T-033, T-012
- **Requirement IDs:** FR-004, UI-03, A11Y-004
- **Files to create/modify:** `src/components/model/EditableAssumptionCell.tsx`
- **Description:** Cell transitions to input on interaction, handles commit.
- **Tests to write:** View-edit-commit lifecycle.
- **Completion criteria:** Focus and input work accurately.
- **Estimated complexity:** M
### T-035: Create CalculatedCell
- **Phase:** P2
- **Title:** Create CalculatedCell
- **Dependencies:** T-033, T-012
- **Requirement IDs:** UI-03, FR-014
- **Files to create/modify:** `src/components/model/CalculatedCell.tsx`
- **Description:** Read-only cell with click-to-trace capability.
- **Tests to write:** Click emits trace action.
- **Completion criteria:** Interacts correctly.
- **Estimated complexity:** S
### T-036: Implement gridKeyboard.ts
- **Phase:** P2
- **Title:** Implement gridKeyboard.ts
- **Dependencies:** T-034
- **Requirement IDs:** FR-004, FR-022, FR-024, UI-03, A11Y-001
- **Files to create/modify:** `src/components/model/gridKeyboard.ts`
- **Description:** Excel-like navigation (arrows, Enter, Escape, Tab).
- **Tests to write:** T-040 (Navigation tests).
- **Completion criteria:** Smooth focus shifting.
- **Estimated complexity:** M
### T-037: Wire manual edit commit
- **Phase:** P2
- **Title:** Wire manual edit commit through appReducer
- **Dependencies:** T-034, T-029
- **Requirement IDs:** FR-006, FR-015, UI-04
- **Files to create/modify:** `src/state/appReducer.ts`
- **Description:** Add `DIRECT_EDIT_COMMIT` action firing `commitTransaction`.
- **Tests to write:** Direct edit test.
- **Completion criteria:** Updates cascade to UI.
- **Estimated complexity:** M
### T-038: Add field-level validation error display
- **Phase:** P2
- **Title:** Add field-level validation error display
- **Dependencies:** T-034, T-008
- **Requirement IDs:** FR-005, NFR-005
- **Files to create/modify:** `src/components/model/EditableAssumptionCell.tsx`
- **Description:** Show invalid input styling (red borders).
- **Tests to write:** Test invalid input UI states.
- **Completion criteria:** Rejects visually on bad input.
- **Estimated complexity:** S
### T-039: Add responsive layout
- **Phase:** P2
- **Title:** Add responsive layout (mobile stacking)
- **Dependencies:** T-031, T-033
- **Requirement IDs:** FR-023
- **Files to create/modify:** `src/components/model/ModelGrid.tsx`
- **Description:** Ensure table scrolls horizontally on small screens.
- **Tests to write:** None
- **Completion criteria:** Usable on 375px viewport.
- **Estimated complexity:** S
### T-040: Write grid keyboard tests
- **Phase:** P2
- **Title:** Write grid keyboard tests
- **Dependencies:** T-036
- **Requirement IDs:** FR-004, FR-022, FR-024, A11Y-001
- **Files to create/modify:** `src/components/model/__tests__/gridKeyboard.test.tsx`
- **Description:** Implement PRD tests 30-33.
- **Tests to write:** Focus, enter, escape tests.
- **Completion criteria:** Pass.
- **Estimated complexity:** M
### T-041: Write focus and accessibility tests
- **Phase:** P2
- **Title:** Write focus and accessibility tests
- **Dependencies:** T-036
- **Requirement IDs:** FR-022, FR-024, A11Y-002
- **Files to create/modify:** `src/components/model/__tests__/gridA11y.test.tsx`
- **Description:** Implement PRD test 44.
- **Tests to write:** Axe tests for grid roles.
- **Completion criteria:** Pass.
- **Estimated complexity:** S
### T-042: Verify all P2 checks pass
- **Phase:** P2
- **Title:** Verify all P2 checks pass
- **Dependencies:** T-040, T-041
- **Requirement IDs:** FR-024
- **Files to create/modify:** None
- **Description:** Dev server run, lint, build checks.
- **Tests to write:** None
- **Completion criteria:** Pass.
- **Estimated complexity:** S

## Phase 3 — Proposal Workflow

### T-043: Create ProposalPromptSelector
- **Phase:** P3
- **Title:** Create ProposalPromptSelector
- **Dependencies:** T-013, T-028
- **Requirement IDs:** FR-007
- **Files to create/modify:** `src/components/proposals/ProposalPromptSelector.tsx`
- **Description:** 3 preset buttons triggering mock provider.
- **Tests to write:** Render and click tests.
- **Completion criteria:** Renders and works.
- **Estimated complexity:** S
### T-044: Wire PROPOSAL_GENERATE action
- **Phase:** P3
- **Title:** Wire PROPOSAL_GENERATE action
- **Dependencies:** T-043, T-029
- **Requirement IDs:** FR-007, FR-008, UI-04
- **Files to create/modify:** `src/state/appReducer.ts`
- **Description:** Dispatch and handle generated draft model logic.
- **Tests to write:** Reducer tests for generation.
- **Completion criteria:** State updates properly.
- **Estimated complexity:** M
### T-045: Create ProposalReviewPanel layout
- **Phase:** P3
- **Title:** Create ProposalReviewPanel layout
- **Dependencies:** T-044
- **Requirement IDs:** UI-12
- **Files to create/modify:** `src/components/proposals/ProposalReviewPanel.tsx`
- **Description:** Bottom/side panel handling draft actions.
- **Tests to write:** Panel presence based on state.
- **Completion criteria:** Appears when draft exists.
- **Estimated complexity:** S
### T-046: Create ProposalDiff component
- **Phase:** P3
- **Title:** Create ProposalDiff component
- **Dependencies:** T-045
- **Requirement IDs:** FR-008, NFR-004, UI-05
- **Files to create/modify:** `src/components/proposals/ProposalDiff.tsx`
- **Description:** Visual representation of before/after/delta changes.
- **Tests to write:** Formatting checks.
- **Completion criteria:** Clear human-readable output.
- **Estimated complexity:** M
### T-047: Implement proposal preview
- **Phase:** P3
- **Title:** Implement proposal preview
- **Dependencies:** T-046, T-014
- **Requirement IDs:** FR-008, UI-05, PROP-001
- **Files to create/modify:** `src/components/proposals/ProposalPreviewKPIs.tsx`
- **Description:** Shows calculated KPI impacts while in draft mode.
- **Tests to write:** Display logic tests.
- **Completion criteria:** Accurately computes temporary KPIs.
- **Estimated complexity:** M
### T-048: Implement Edit proposal flow
- **Phase:** P3
- **Title:** Implement Edit proposal flow
- **Dependencies:** T-045
- **Requirement IDs:** FR-009
- **Files to create/modify:** `src/components/proposals/ProposalReviewPanel.tsx`
- **Description:** Allow modification of specific proposed ops.
- **Tests to write:** Draft modification actions.
- **Completion criteria:** Pruning operations works.
- **Estimated complexity:** M
### T-049: Implement Accept
- **Phase:** P3
- **Title:** Implement Accept with atomic commit
- **Dependencies:** T-048
- **Requirement IDs:** FR-010, FR-015, UI-04
- **Files to create/modify:** `src/state/appReducer.ts`
- **Description:** Accepting draft creates real Transaction.
- **Tests to write:** Accept applies to working model.
- **Completion criteria:** Success updates data.
- **Estimated complexity:** S
### T-050: Implement Reject
- **Phase:** P3
- **Title:** Implement Reject
- **Dependencies:** T-045
- **Requirement IDs:** FR-011, UI-04
- **Files to create/modify:** `src/state/appReducer.ts`
- **Description:** Clear draft via Reject button.
- **Tests to write:** Clearing clears state.
- **Completion criteria:** Discards cleanly.
- **Estimated complexity:** S
### T-051: Implement stale proposal detection
- **Phase:** P3
- **Title:** Implement stale proposal detection
- **Dependencies:** T-049
- **Requirement IDs:** FR-012, UI-06, NFR-005, PROP-002
- **Files to create/modify:** `src/state/appReducer.ts`, `src/components/proposals/ProposalReviewPanel.tsx`
- **Description:** Detect when a proposal's base revision differs from the current working revision; block acceptance and show the stale state and reason in the proposal panel.
- **Tests to write:** Stale trigger logic, acceptance blocked on revision mismatch, and visible stale warning.
- **Completion criteria:** A proposal based on an older revision cannot be accepted; state and visible panel explain why. Revision advancement on undo/reset is verified separately by T-064.
- **Estimated complexity:** M
### T-052: Implement duplicate-accept prevention
- **Phase:** P3
- **Title:** Implement duplicate-accept prevention
- **Dependencies:** T-049
- **Requirement IDs:** FR-012, PROP-004
- **Files to create/modify:** `src/components/proposals/ProposalReviewPanel.tsx`
- **Description:** Button disabled during sync/commit.
- **Tests to write:** None.
- **Completion criteria:** Can't be clicked twice.
- **Estimated complexity:** S
### T-053: Implement proposal error/retry state
- **Phase:** P3
- **Title:** Implement proposal error/retry state
- **Dependencies:** T-044
- **Requirement IDs:** NFR-005, UI-12
- **Files to create/modify:** `src/components/proposals/ProposalReviewPanel.tsx`
- **Description:** Error boundary around AI output.
- **Tests to write:** Error render test.
- **Completion criteria:** Displays feedback.
- **Estimated complexity:** S
### T-054: Create StatusBadge + InlineNotice components
- **Phase:** P3
- **Title:** Create StatusBadge + InlineNotice
- **Dependencies:** T-026
- **Requirement IDs:** FR-022, UI-01, UI-06, UI-12, NFR-005, A11Y-003, A11Y-005
- **Files to create/modify:** `src/components/ui/StatusBadge.tsx`, `src/components/app/InlineNotice.tsx`
- **Description:** Create reusable status badges and an inline notice with clear, accessible state/error announcements.
- **Tests to write:** None.
- **Completion criteria:** Reusable UI renders.
- **Estimated complexity:** S
### T-055: Write proposal lifecycle tests
- **Phase:** P3
- **Title:** Write proposal lifecycle tests
- **Dependencies:** T-049, T-050, T-051
- **Requirement IDs:** FR-024, NFR-005
- **Files to create/modify:** `src/components/proposals/__tests__/proposalLifecycle.test.tsx`
- **Description:** PRD tests 34-40.
- **Tests to write:** Full RTL test of flow.
- **Completion criteria:** Pass.
- **Estimated complexity:** L

### T-056: Verify all P3 checks pass
- **Phase:** P3
- **Title:** Verify all P3 checks pass
- **Dependencies:** T-055
- **Requirement IDs:** FR-024
- **Files to create/modify:** None
- **Description:** Validates pipeline.
- **Tests to write:** None
- **Completion criteria:** Pass.
- **Estimated complexity:** S

## Phase 4 — Trace + History + Undo

### T-057: Create TracePanel component
- **Phase:** P4
- **Title:** Create TracePanel component
- **Dependencies:** T-035, T-011
- **Requirement IDs:** FR-014, UI-08
- **Files to create/modify:** `src/features/trace/TracePanel.tsx`
- **Description:** Shows calculated dependency values.
- **Tests to write:** Presence check.
- **Completion criteria:** Renders when metric clicked.
- **Estimated complexity:** S
### T-058: Create TraceNodeList
- **Phase:** P4
- **Title:** Create TraceNodeList
- **Dependencies:** T-057, T-011
- **Requirement IDs:** FR-014, UI-08
- **Files to create/modify:** `src/components/trace/TraceNodeList.tsx`
- **Description:** Recursive rendering of trace graph outputs.
- **Tests to write:** Recursion rendering test.
- **Completion criteria:** Correctly loops through DAG nodes.
- **Estimated complexity:** M
### T-059: Wire SET_SELECTED_TRACE_CELL
- **Phase:** P4
- **Title:** Wire SET_SELECTED_TRACE_CELL
- **Dependencies:** T-057, T-029
- **Requirement IDs:** FR-014, UI-08
- **Files to create/modify:** `src/state/appReducer.ts`
- **Description:** Tracks what user is tracing in global state.
- **Tests to write:** Update tests.
- **Completion criteria:** Click links properly.
- **Estimated complexity:** S
### T-060: Create SidePanel/MobileSheet for trace
- **Phase:** P4
- **Title:** Create SidePanel/MobileSheet
- **Dependencies:** T-057
- **Requirement IDs:** FR-023
- **Files to create/modify:** `src/components/shell/SidePanel.tsx`
- **Description:** Responsive holder for Trace / History.
- **Tests to write:** None.
- **Completion criteria:** Behaves correctly on resize.
- **Estimated complexity:** S

### T-061: Create HistoryPanel component
- **Phase:** P4
- **Title:** Create HistoryPanel component
- **Dependencies:** T-060, T-015
- **Requirement IDs:** HIST-004
- **Files to create/modify:** `src/components/history/HistoryPanel.tsx`
- **Description:** Display committed transactions newest first, including transaction type and a before/after summary.
- **Tests to write:** Empty state, newest-first ordering, transaction-type labels, and before/after summaries for manual edits and accepted proposals.
- **Completion criteria:** Manual edits and accepted proposals render newest first with correct before/after details; empty history is handled accessibly.
- **Estimated complexity:** M

### T-062: Implement UNDO_LAST_TRANSACTION
- **Phase:** P4
- **Title:** Implement UNDO_LAST_TRANSACTION
- **Dependencies:** T-061, T-029
- **Requirement IDs:** FR-015, FR-017, HIST-001, HIST-002
- **Files to create/modify:** `src/state/appReducer.ts`
- **Description:** Reverts to previous history entry.
- **Tests to write:** Tests for un-winding model.
- **Completion criteria:** Restores cleanly.
- **Estimated complexity:** M
### T-063: Implement Reset with confirmation dialog
- **Phase:** P4
- **Title:** Implement RESET_TO_BASELINE and wire confirmation dialog
- **Dependencies:** T-062
- **Requirement IDs:** FR-015, FR-018, HIST-003
- **Files to create/modify:** `src/components/history/ResetDialog.tsx`, `src/state/appReducer.ts`, `src/domain/transactions.ts`
- **Description:** Require explicit confirmation before dispatching `RESET_TO_BASELINE`. Restore working assumptions from the immutable baseline, clear transaction history and pending proposal state, and preserve the baseline snapshot. T-064 separately enforces monotonic revision advancement for the reset path.
- **Tests to write:** Confirmation prevents reset when cancelled; confirmation resets working assumptions to baseline, clears history and pending proposal state, and leaves the baseline unchanged.
- **Completion criteria:** Cancel causes no state change; confirm restores the working model from baseline and clears history/pending proposal state atomically; baseline remains unchanged. Revision advancement is verified by T-064.
- **Estimated complexity:** M
### T-064: Ensure undo/reset increment revision
- **Phase:** P4
- **Title:** Ensure undo/reset increment revision
- **Dependencies:** T-062, T-063, T-051
- **Requirement IDs:** FR-012, PROP-002, HIST-002
- **Files to create/modify:** `src/state/appReducer.ts`
- **Description:** Prevent staleness edge cases.
- **Tests to write:** Revisions strictly increase.
- **Completion criteria:** No draft bypasses via undo.
- **Estimated complexity:** S

### T-065: Write trace panel tests
- **Phase:** P4
- **Title:** Write trace panel tests
- **Dependencies:** T-059
- **Requirement IDs:** FR-024
- **Files to create/modify:** `src/components/trace/__tests__/trace.test.tsx`
- **Description:** PRD test 47.
- **Tests to write:** Tests UI rendering of graph nodes.
- **Completion criteria:** Pass.
- **Estimated complexity:** M

### T-066: Write undo tests
- **Phase:** P4
- **Title:** Write undo tests
- **Dependencies:** T-062, T-063, T-064
- **Requirement IDs:** FR-024
- **Files to create/modify:** `src/components/history/__tests__/history.test.tsx`
- **Description:** PRD tests 41-43.
- **Tests to write:** Sequential interactions pop off accurately.
- **Completion criteria:** Pass.
- **Estimated complexity:** M

### T-067: Verify all P4 checks pass
- **Phase:** P4
- **Title:** Verify all P4 checks pass
- **Dependencies:** T-065, T-066
- **Requirement IDs:** FR-024
- **Files to create/modify:** None
- **Description:** Ensure quality.
- **Tests to write:** None
- **Completion criteria:** Pass.
- **Estimated complexity:** S

## Phase 5 — Scenario Comparison

### T-068: Install and configure Recharts
- **Phase:** P5
- **Title:** Install Recharts
- **Dependencies:** T-001, T-067
- **Requirement IDs:** FR-016
- **Files to create/modify:** `package.json`
- **Description:** Add dependency for Line Charts.
- **Tests to write:** None.
- **Completion criteria:** Installs cleanly.
- **Estimated complexity:** S

### T-069: Create ScenarioComparisonPage layout
- **Phase:** P5
- **Title:** Create ScenarioComparisonPage layout
- **Dependencies:** T-028, T-068
- **Requirement IDs:** FR-016
- **Files to create/modify:** `src/pages/ScenarioPage.tsx`
- **Description:** Shell page for charts and comparison.
- **Tests to write:** Smoke test.
- **Completion criteria:** Routing views this properly.
- **Estimated complexity:** S
### T-070: Create metric selector
- **Phase:** P5
- **Title:** Create metric selector
- **Dependencies:** T-069
- **Requirement IDs:** FR-016
- **Files to create/modify:** `src/components/scenario/MetricSelector.tsx`
- **Description:** Selects between Revenue, EBITDA, Cash.
- **Tests to write:** Toggles change variables.
- **Completion criteria:** Renders toggle UI.
- **Estimated complexity:** S
### T-071: Create ScenarioChart
- **Phase:** P5
- **Title:** Create ScenarioChart
- **Dependencies:** T-070, T-016
- **Requirement IDs:** FR-016, UI-07
- **Files to create/modify:** `src/components/scenario/ScenarioChart.tsx`
- **Description:** Recharts LineChart for baseline and working.
- **Tests to write:** Render component.
- **Completion criteria:** Plots two distinct series.
- **Estimated complexity:** M
### T-072: Create ScenarioDeltaTable
- **Phase:** P5
- **Title:** Create ScenarioDeltaTable
- **Dependencies:** T-071, T-016
- **Requirement IDs:** FR-016, UI-07
- **Files to create/modify:** `src/components/scenario/ScenarioDeltaTable.tsx`
- **Description:** Renders per-period variances below chart.
- **Tests to write:** Cell content maps deltas.
- **Completion criteria:** Displays values correctly.
- **Estimated complexity:** M
### T-073: Add cumulative revenue summary
- **Phase:** P5
- **Title:** Add cumulative revenue summary
- **Dependencies:** T-072
- **Requirement IDs:** FR-016
- **Files to create/modify:** `src/components/scenario/ScenarioSummaryCards.tsx`
- **Description:** Aggregates delta values overall.
- **Tests to write:** Mathematical summations.
- **Completion criteria:** Displays total numbers accurately.
- **Estimated complexity:** S
### T-074: Handle zero-baseline percentage delta
- **Phase:** P5
- **Title:** Handle zero-baseline percentage delta
- **Dependencies:** T-072
- **Requirement IDs:** FR-016
- **Files to create/modify:** `src/components/scenario/ScenarioDeltaTable.tsx`
- **Description:** Guards against divide-by-zero UI bugs.
- **Tests to write:** Edge case string output test.
- **Completion criteria:** Replaces Infinity with "—"
- **Estimated complexity:** S
### T-075: Add accessible chart title/description
- **Phase:** P5
- **Title:** Add accessible chart title/description
- **Dependencies:** T-071, T-072
- **Requirement IDs:** FR-022, A11Y-003
- **Files to create/modify:** `src/components/scenario/ScenarioChart.tsx`
- **Description:** Ensures SVGs have titles, tables fallbacks.
- **Tests to write:** Axe testing on chart div.
- **Completion criteria:** Usable with screen readers.
- **Estimated complexity:** S
### T-076: Write comparison tests
- **Phase:** P5
- **Title:** Write comparison tests
- **Dependencies:** T-072, T-073, T-074
- **Requirement IDs:** FR-024
- **Files to create/modify:** `src/components/scenario/__tests__/scenario.test.tsx`
- **Description:** PRD tests 45-46.
- **Tests to write:** Scenario delta rendering test.
- **Completion criteria:** Pass.
- **Estimated complexity:** M

### T-077: Verify all P5 checks pass
- **Phase:** P5
- **Title:** Verify all P5 checks pass
- **Dependencies:** T-076
- **Requirement IDs:** FR-024
- **Files to create/modify:** None
- **Description:** E2E visual check on Scenario behavior.
- **Tests to write:** None
- **Completion criteria:** Pass.
- **Estimated complexity:** S

## Phase 6 — Performance Lab

### T-078: Create SyntheticDataset
- **Phase:** P6
- **Title:** Create SyntheticDataset.ts
- **Dependencies:** T-000, T-067
- **Requirement IDs:** FR-019, PERF-003, UI-10
- **Files to create/modify:** `src/features/performance/SyntheticDataset.ts`
- **Description:** Deterministic 10k×24 generation for performance testing. Completely separate from the financial domain and canonical model calculations.
- **Tests to write:** Deterministic dataset fixture test.
- **Completion criteria:** Stable synthetic dataset generation isolated from finance domain.
- **Estimated complexity:** S
### T-079: Create VirtualizedGrid
- **Phase:** P6
- **Title:** Create VirtualizedGrid
- **Dependencies:** T-033, T-078
- **Requirement IDs:** FR-020, PERF-001, UI-10
- **Files to create/modify:** `src/features/performance/VirtualGrid.tsx`
- **Description:** Uses `@tanstack/react-virtual` for row limiting.
- **Tests to write:** Mount testing.
- **Completion criteria:** The 10,000-row dataset is virtualized with fewer than 100 body rows mounted at once; grid-ready time is measured and reported as a diagnostic result, not a guaranteed pass/fail threshold.
- **Estimated complexity:** L
### T-080: Implement fixed header + horizontal scrolling
- **Phase:** P6
- **Title:** Implement fixed header + horizontal scrolling
- **Dependencies:** T-079
- **Requirement IDs:** FR-020, PERF-001
- **Files to create/modify:** `src/features/performance/VirtualGrid.tsx`
- **Description:** Stickiness with tanstack virtual.
- **Tests to write:** Layout checks.
- **Completion criteria:** Scrolling doesn't break header sync.
- **Estimated complexity:** M
### T-081: Create performanceMeasurements.ts module
- **Phase:** P6
- **Title:** Create performance measurement module
- **Dependencies:** T-078
- **Requirement IDs:** FR-021, PERF-002, PERF-003
- **Files to create/modify:** `src/features/performance/performanceMeasurements.ts`
- **Description:** Create the measurement utilities (mark/measure wrappers) for dataset-gen time, grid-ready time, and edit latency (p50/p95). Measurements must be honest and not fabricated. Timing targets are diagnostic objectives. Keep synthetic dataset isolated from finance domain.
- **Tests to write:** Unit tests for measurement wrappers ensuring no fabricated results.
- **Completion criteria:** Utilities exist and report unavailable/error states when appropriate.
- **Estimated complexity:** S
### T-082: Integrate canonical engine measurement
- **Phase:** P6
- **Title:** Measure canonical engine performance
- **Dependencies:** T-010, T-081
- **Requirement IDs:** FR-021, NFR-001, UI-10
- **Files to create/modify:** `src/features/performance/VirtualGrid.tsx`, `src/features/performance/performanceMeasurements.ts`
- **Description:** Integrate the existing canonical `calculateModel` from `src/domain/calculation.ts` into the measurement harness to measure recompute duration. Do NOT create a second financial-calculation module. Ensure synthetic dataset stays isolated in the performance feature.
- **Tests to write:** Engine-recompute timing test; dataset isolation test.
- **Completion criteria:** Only existing `calculation.ts` used; measurements honest.
- **Estimated complexity:** M
### T-083: Create PerformanceLabPage layout
- **Phase:** P6
- **Title:** Create PerformanceLabPage layout
- **Dependencies:** T-028, T-079
- **Requirement IDs:** UI-10
- **Files to create/modify:** `src/features/performance/PerformanceLabPage.tsx`
- **Description:** Specialized route for benching.
- **Tests to write:** Route displays template.
- **Completion criteria:** Page shows properly.
- **Estimated complexity:** S
### T-084: Implement "Run Benchmark" flow
- **Phase:** P6
- **Title:** Implement "Run Benchmark" flow
- **Dependencies:** T-083, T-078
- **Requirement IDs:** FR-021, PERF-002
- **Files to create/modify:** `src/features/performance/PerformanceLabPage.tsx`
- **Description:** Generates UI metrics through interaction script.
- **Tests to write:** Benchmark sequence mock.
- **Completion criteria:** Triggers dataset and virtual grid loading.
- **Estimated complexity:** M
### T-085: Display metrics in UI
- **Phase:** P6
- **Title:** Display metrics in UI
- **Dependencies:** T-084, T-082
- **Requirement IDs:** FR-021, NFR-003, UI-10
- **Files to create/modify:** `src/components/performance/LabMetricsBanner.tsx`
- **Description:** Reads and surfaces performance traces in Header.
- **Tests to write:** Output formats accurately.
- **Completion criteria:** Stats are obvious and real-time.
- **Estimated complexity:** S
### T-086: Show environment info
- **Phase:** P6
- **Title:** Show environment info
- **Dependencies:** T-085
- **Requirement IDs:** FR-021, NFR-003, UI-10
- **Files to create/modify:** `src/components/performance/EnvironmentInfo.tsx`
- **Description:** Show browser version and device cores.
- **Tests to write:** Reads UA string natively.
- **Completion criteria:** Displays contextual info.
- **Estimated complexity:** S
### T-087: Implement "No measurements" and error states
- **Phase:** P6
- **Title:** Implement "No measurements" and error states
- **Dependencies:** T-085
- **Requirement IDs:** FR-021, UI-10, NFR-005
- **Files to create/modify:** `src/features/performance/PerformanceLabPage.tsx`
- **Description:** Fallbacks for lab pre-run.
- **Tests to write:** Tests empty views.
- **Completion criteria:** Beautiful empty screen shown.
- **Estimated complexity:** S
### T-088: Write virtualization tests
- **Phase:** P6
- **Title:** Write virtualization tests
- **Dependencies:** T-079, T-084
- **Requirement IDs:** FR-024
- **Files to create/modify:** `src/components/performance/__tests__/virtualization.test.tsx`
- **Description:** PRD tests 48-52.
- **Tests to write:** Test DOM elements rendered count.
- **Completion criteria:** Pass.
- **Estimated complexity:** M

### T-089: Verify all P6 checks pass
- **Phase:** P6
- **Title:** Verify all P6 checks pass
- **Dependencies:** T-088
- **Requirement IDs:** NFR-001, FR-024
- **Files to create/modify:** None
- **Description:** Local verify of lab behavior.
- **Tests to write:** None
- **Completion criteria:** Pass.
- **Estimated complexity:** S

## Phase 7 — Polish + Deploy

### T-090: Accessibility audit and fixes
- **Phase:** P7
- **Title:** Accessibility audit and fixes
- **Dependencies:** T-042, T-056, T-067, T-101
- **Requirement IDs:** FR-022, A11Y-001, A11Y-002, A11Y-003, A11Y-004, A11Y-005
- **Files to create/modify:** Multiple components
- **Description:** Fix a11y regressions via Lighthouse.
- **Tests to write:** None
- **Completion criteria:** No critical or serious automated accessibility findings remain; document any accepted findings and complete a manual keyboard/focus review.
- **Estimated complexity:** M
### T-091: Responsive layout fixes
- **Phase:** P7
- **Title:** Responsive layout fixes
- **Dependencies:** T-039, T-101
- **Requirement IDs:** FR-023, FR-022, A11Y-002
- **Files to create/modify:** `src/index.css`
- **Description:** Check mobile behaviors across views.
- **Tests to write:** None
- **Completion criteria:** No horizontal overflow at 375px viewport width, controls stacked without overlapping.
- **Estimated complexity:** M
### T-092: prefers-reduced-motion support
- **Phase:** P7
- **Title:** prefers-reduced-motion support
- **Dependencies:** T-027, T-101
- **Requirement IDs:** FR-022, A11Y-006
- **Files to create/modify:** `src/index.css`
- **Description:** Suppress transitions appropriately based on OS.
- **Tests to write:** Check the prefers-reduced-motion media rule and manually verify reduced-motion behavior.
- **Completion criteria:** With reduced motion requested, nonessential motion is disabled or shortened; normal behavior remains unchanged when the preference is not enabled.
- **Estimated complexity:** S
### T-093: Write E2E critical journey test
- **Phase:** P7
- **Title:** Write E2E critical journey test
- **Dependencies:** T-001, T-101
- **Requirement IDs:** FR-024
- **Files to create/modify:** `e2e/critical-journey.spec.ts`
- **Description:** Playwright script navigating the main application flows.
- **Tests to write:** 1 large E2E flow.
- **Completion criteria:** Runs correctly headlessly.
- **Estimated complexity:** L
### T-094: Write accessibility smoke test
- **Phase:** P7
- **Title:** Write accessibility smoke test
- **Dependencies:** T-093, T-101
- **Requirement IDs:** UI-13, FR-022, FR-024, A11Y-001, A11Y-002, A11Y-003, A11Y-004, A11Y-005
- **Files to create/modify:** `e2e/a11y.spec.ts`
- **Description:** Use Playwright + Axe to automate checks.
- **Tests to write:** 1 axe-core spec file.
- **Completion criteria:** Succeeds locally.
- **Estimated complexity:** S
### T-095: Create README.md
- **Phase:** P7
- **Title:** Create README.md
- **Dependencies:** T-000, T-027, T-089, T-094, T-101
- **Requirement IDs:** FR-025, NFR-002, NFR-003, DISC-001, UI-11
- **Files to create/modify:** `README.md`
- **Description:** Document setup, formulas, architecture, limitations, independent-project and synthetic/mock-AI disclosures, package rationale, and the performance methodology plus environment fields required to reproduce measurements.
- **Tests to write:** None
- **Completion criteria:** README covers setup, formulas, architecture, limitations, independent-project and synthetic/mock-AI disclosures, dependency rationale, and benchmark definitions/environment needed to interpret any recorded results.
- **Estimated complexity:** S
### T-096: Create state-flow diagram
- **Phase:** P7
- **Title:** Create state-flow diagram
- **Dependencies:** T-095, T-101
- **Requirement IDs:** FR-025
- **Files to create/modify:** `README.md`
- **Description:** Insert a Mermaid diagram in README showing the approved UI/action/reducer/domain/commit flow.
- **Tests to write:** None
- **Completion criteria:** The diagram renders and matches the approved canonical state and transaction flow.
- **Estimated complexity:** S
### T-097: Configure CI
- **Phase:** P7
- **Title:** Configure CI (.github/workflows/ci.yml)
- **Dependencies:** T-093, T-094, T-095, T-101
- **Requirement IDs:** FR-026, UI-14
- **Files to create/modify:** `.github/workflows/ci.yml`
- **Description:** Link testing to github action on push/PR.
- **Tests to write:** None
- **Completion criteria:** GHA runs scripts efficiently.
- **Estimated complexity:** M
### T-098: Production build verification
- **Phase:** P7
- **Title:** Production build verification
- **Dependencies:** T-097, T-096, T-101
- **Requirement IDs:** FR-026, NFR-006
- **Files to create/modify:** None
- **Description:** Verify minification and prod config via preview.
- **Tests to write:** None
- **Completion criteria:** Success.
- **Estimated complexity:** S
### T-099: Deploy (conditional on approved hosting)
- **Phase:** P7
- **Title:** Deploy to approved platform (Vercel provisional)
- **Dependencies:** T-098, T-101
- **Requirement IDs:** NFR-002
- **Files to create/modify:** `vercel.json` (only if Vercel approved; otherwise appropriate config for chosen host)
- **Description:** Deploy only after hosting decision is approved (not during reconnaissance); use approved platform; do not deploy unapproved or prematurely. If hosting remains undecided, record blocker instead of inventing deployment.
- **Tests to write:** None
- **Completion criteria:** App live only if hosting approved and permissions available; otherwise documented as deferred.
### T-100: Final Definition of Done checklist review
- **Phase:** P7
- **Title:** Final Definition of Done checklist review
- **Dependencies:** T-098, T-101
- **Requirement IDs:** NFR-002, UI-16
- **Files to create/modify:** None
- **Description:** Final visual and manual audit against the PRD, including a scope-integrity check for backend/auth/AI APIs/MCP, a review for secrets or real company/customer data, and coverage of required FR, NFR, UI and supplemental requirements.
- **Tests to write:** None
- **Completion criteria:** All required FR, NFR, UI and supplemental requirements have evidence; no unapproved scope additions, real customer/company data, secrets, backend, auth, AI APIs or MCP are present; remaining deviations are documented.
- **Estimated complexity:** S

### T-101: Verify Phase 7 entry gate
- **Phase:** P7
- **Title:** Verify P5 and P6 completion before polish/release work
- **Dependencies:** T-077, T-089
- **Requirement IDs:** None — sequencing gate; no direct product requirement
- **Files to create/modify:** None
- **Description:** Confirm the scenario-comparison phase (T-077) and performance-lab phase (T-089) have completed their required checks before any Phase 7 task starts. This is a planning/release gate, not application functionality.
- **Tests to write:** None
- **Completion criteria:** Both prerequisite phase-verification tasks are complete; if either is incomplete, Phase 7 work is blocked.
- **Estimated complexity:** S
