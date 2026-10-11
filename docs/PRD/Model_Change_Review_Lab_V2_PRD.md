# Product Requirements Document — Model Change Review Lab V2

**Version:** 2.0  
**Prepared:** 11 October 2026  
**Status:** Draft, grounded in a read-only audit of the current GitHub source  
**Repository:** [Satjeet2005/model-change-review-lab](https://github.com/Satjeet2005/model-change-review-lab)  
**Source revision inspected:** [`af1e6ce44395d0f73643bb670776ba70b38d92da`](https://github.com/Satjeet2005/model-change-review-lab/commit/af1e6ce44395d0f73643bb670776ba70b38d92da)  
**Parent specification:** [`docs/PRD/Model_Change_Review_Lab_PRD_v1.1_Extended.md`](https://github.com/Satjeet2005/model-change-review-lab/blob/master/docs/PRD/Model_Change_Review_Lab_PRD_v1.1_Extended.md)  
**Implementation target:** Existing React 19 + TypeScript + Vite application  
**Project boundary:** Independent portfolio prototype; not affiliated with Drivetrain

> **How to use this document:** V2 is a delta specification. It extends the verified implementation described below and the existing v1.1 PRD. It does not replace the existing application architecture or authorize a rewrite. The audit source is `Model_Change_Review_Lab_V2_Verified_Repository_Audit.md`. This PRD states desired V2 behavior, not a claim that V2 has already been implemented or tested.

---

## 0. Executive decision

V2 should turn the existing single-pending-proposal workflow into a small **Proposal Workspace** that supports independently editable proposal variants, accurate previewing, and comparison before acceptance.

The existing repository already has the expensive foundations: a pure 24-month calculation engine, one pending proposal, editable operation values, a three-KPI impact preview, atomic acceptance, a stale-revision guard, original-baseline-versus-working comparison, an explanation/trace graph, history/undo/reset, synthetic test data, virtualization, and automated tests. These must be reused.

V2 adds a controlled, in-memory layer above the current proposal model. The financial engine and canonical working-model state remain authoritative; proposal variants are private draft snapshots until the user explicitly accepts one.

### V2 outcomes

1. The user can create a proposal from an existing deterministic template and edit its proposed values without changing the live model.
2. The user can duplicate a proposal into an independent variant and edit that copy without affecting the original or other copies.
3. The user can compare the selected proposal against its **shared proposal-base snapshot** over all 24 months, not only M24 summary KPIs.
4. The user can compare up to two proposal variants against their shared base, with no more than three chart series in total.
5. The existing **original seed baseline vs. current working model** comparison remains unchanged in meaning and clearly separate in the UI.
6. Invalid/malformed proposal operation metadata cannot change one assumption while claiming another target in the diff, history, or trace.
7. A stale proposal stays inspectable but cannot be applied or presented as a fresh impact against a different model revision. Refresh is an explicit action and preserves the stale draft.
8. Finance-model limitations, input validation rules, and performance numbers are described honestly and consistently across code and documentation.

### The three comparisons must never be conflated

| Comparison | Reference scenario | What it answers | V2 location |
|---|---|---|---|
| **Proposal impact preview** | Shared proposal base vs. one selected variant | “What would this proposal change compared with the model this proposal was generated from?” | Proposal Workspace, one selected variant |
| **Proposal variant comparison** | Same shared proposal base vs. up to two selected variants | “Which of these alternatives has what downstream impact?” | Proposal Workspace, compare mode |
| **Existing scenario comparison** | Immutable app-start seed baseline vs. current working model | “How has the working model diverged from the original seed?” | Existing Scenario Compare tab, retained as-is |

The comparison base must be named visibly in the UI and represented explicitly in the data model. Never quietly substitute the current live model for an old proposal’s base snapshot.

---

## 1. Verified existing product — baseline for V2

This section is a compact source-derived baseline; the full file-by-file audit is separate.

### 1.1 Domain model and calculations already present

Relevant files:
- `src/domain/types.ts`
- `src/domain/seed.ts`
- `src/domain/calculation.ts`
- `src/domain/formatting.ts`
- `src/domain/trace.ts`
- `src/domain/scenarioComparison.ts`

The model has 24 monthly periods (`PeriodIndex` 1–24), two starting settings (`startingRevenueUsd`, `startingCashUsd`), and monthly assumptions for growth, engineering FTE, other FTE, loaded monthly cost per FTE, and other operating expense. The calculation engine `calculateModel()` is the one source of calculation truth. It returns revenue, total FTE, payroll, operating expense, EBITDA, ending cash and summary metrics.

Current formulas:
- Revenue M01 = starting revenue × (1 + growth M01); each later month compounds previous revenue by the current month’s growth rate.
- Total FTE = engineering FTE + other FTE.
- Payroll = total FTE × loaded monthly cost per FTE.
- Total operating expense = payroll + other operating expense.
- EBITDA = revenue − total operating expense.
- Ending cash M01 = starting cash + EBITDA M01; later ending cash = prior ending cash + current EBITDA.

**Financial-model disclosure:** ending cash is a simplified roll-forward using EBITDA. It is not a complete cash flow statement and does not model working capital, capital expenditure, taxes, financing, or other material cash movements. V2 must not change the engine or imply a full cash-flow forecast. Add a concise visible disclosure near ending-cash previews/comparison and retain it in the README.

Seed fixture values include $750,000 starting revenue, $3,000,000 starting cash, 2.5% monthly growth, $12,000 loaded monthly FTE cost, and stepped FTE assumptions. These are synthetic demonstration values.

### 1.2 Existing proposal workflow

Relevant files:
- `src/domain/proposals.ts`
- `src/domain/operations.ts`
- `src/domain/validation.ts`
- `src/domain/transactions.ts`
- `src/state/appState.ts`
- `src/state/appReducer.ts`
- `src/components/proposals/ProposalPromptSelector.tsx`
- `src/components/proposals/ProposalReviewPanel.tsx`
- `src/components/proposals/ProposalDiff.tsx`
- `src/components/proposals/ProposalPreviewKPIs.tsx`

The local `MockProposalProvider` offers three deterministic presets: hire two engineers from M07, increase growth by one percentage point from M07, and reduce other OpEx by 8% from M04. There is no external LLM/API call. `ProposalDiff` already permits editing proposed values while the target and period stay fixed. The review view shows a before/after diff, stale-revision messaging, validation state, Accept/Reject, and a three-KPI M24 preview. The preview clones assumptions and uses the canonical `calculateModel()` engine.

Current limits relevant to V2:
- `AppState` stores only one `pendingProposal`; there is no workspace collection.
- `ChangeProposal.id` is currently a template-like fixed ID, not a unique ID per generated instance. V2 needs a distinct per-instance identity so copies cannot collide.
- `ChangeProposal` contains `baseRevision` but not an immutable `baseAssumptions` snapshot or a reset snapshot for edited variants.
- The current preview calculates against current working assumptions rather than a stored proposal base. This is safe only while the proposal’s base revision still matches; after it becomes stale, the KPI preview should not be presented as a fresh impact against the new model.

### 1.3 Existing comparison, trace, history and reset

Relevant files:
- `src/pages/ScenarioPage.tsx`
- `src/domain/scenarioComparison.ts`
- `src/components/scenario/MetricSelector.tsx`
- `src/components/scenario/ScenarioChart.tsx`
- `src/components/scenario/ScenarioDeltaTable.tsx`
- `src/components/scenario/ScenarioSummaryCards.tsx`
- `src/domain/trace.ts`
- `src/components/trace/TracePanel.tsx`
- `src/components/history/HistoryPanel.tsx`
- `src/components/history/ResetDialog.tsx`
- `src/components/shell/AppShell.tsx`

Scenario Compare currently uses the immutable app-start seed baseline against the live working model. Its shared `calculateScenarioDelta()` result feeds chart, table and summary components. The chart exposes Revenue, EBITDA and Ending Cash, while the domain comparator also calculates other metrics. The trace index maps calculated outputs back to source assumptions/settings. Transactions save previous and new assumptions and revisions; undo restores a transaction snapshot and advances the revision; reset restores the original seed baseline through confirmation. Preserve this behavior.

### 1.4 Current validation and documentation mismatch

`src/domain/validation.ts` is the current runtime source of input constraints:

| Field | Runtime-valid range |
|---|---:|
| Starting revenue | $0–$1,000,000,000 |
| Starting cash | $0–$1,000,000,000 |
| Revenue growth per month | −50% to +50% |
| Engineering FTE / Other FTE | Integer 0–1,000 |
| Loaded monthly cost per FTE | $1–$100,000 |
| Other operating expense per month | $0–$1,000,000,000 |

The README validation table contains different bounds. V2 must align documentation to actual validation behavior. It must not widen constraints just to fit the old README; any proposed constraint change requires a separate explicit decision and tests.

### 1.5 Current performance-lab measurement concern

Relevant files:
- `src/features/performance/PerformanceLabPage.tsx`
- `src/features/performance/VirtualGrid.tsx`
- `src/features/performance/performanceMeasurements.ts`
- `src/features/performance/__tests__/virtualization.test.tsx`

The deterministic 10,000 × 24 synthetic dataset, virtualization, local sparse overrides, dataset-generation timing, grid-ready timing and 24-month canonical-model recomputation are established features. The problem is specifically the edit-latency measurement:
- a manually edited cell starts timing on cell click and ends on commit, thereby including user think/type time;
- “Collect 30 Edit Samples” times an in-memory property assignment on a local object, and calls `setOverrides()` only after the loop;
- those two unlike measures are combined into one sample array, and values are floored to at least 0.1 ms;
- README currently labels the metric “input-to-commit latency” and implies real React commit/layout samples.

V2 must remove the unsupported claim and mixed methodology. The minimal acceptable outcome is a truthful label/method that matches the code and no combined statistics from unlike samples. Do not spend the V2 iteration rebuilding the performance harness. A real keystroke-to-commit measurement can be implemented only if it can be captured with a clear, repeatable method in a tightly bounded change. If not, expose an accurately labelled mutation-duration metric and remove the misleading input-to-commit claim. Do not label it input-to-commit or paint latency.

### 1.6 Existing verification facilities

- Vitest and React Testing Library tests under `src/**/__tests__` and `*.test.tsx`.
- Playwright critical journey: `e2e/critical-journey.spec.ts`.
- Six Axe route scans: `e2e/a11y.spec.ts`.
- Playwright config: `playwright.config.ts`.
- CI: `.github/workflows/ci.yml` runs typecheck, lint, format, Vitest, production build and Playwright/Axe on push/PR.

The current source was audited through the GitHub API, but the checks were **not executed in this audit environment**. Never present source inspection or README numbers as a fresh passing test run.

---

## 2. Product principles and invariants carried forward

These are hard constraints from v1.1 and remain binding for V2.

1. **Independent prototype:** no Drivetrain affiliation, logos, copied screenshots, proprietary claims, or implied internal-product defect claims.
2. **Synthetic data only:** every financial figure is fabricated and illustrative, in USD.
3. **Simulated AI only:** proposal generation stays deterministic and local. No LLM/API/MCP/network integration.
4. **Canonical financial engine:** previews and scenarios call `calculateModel()`; formulas must not be duplicated in React components.
5. **Preview isolation:** generating, editing, copying or comparing variants never mutates canonical working assumptions, calculation output, trace state, revision or committed history.
6. **Explicit human approval:** no variant is applied without explicit user acceptance.
7. **Atomic transaction:** accepting a variant applies every operation or none. A validation failure must leave canonical assumptions and revision unchanged.
8. **Stale-revision safety:** acceptance and current-impact preview are not allowed if the selected proposal’s base revision differs from the current working revision.
9. **Immutable baseline:** the original baseline stays immutable for the existing Scenario Compare page. It is not reused as the proposal’s base unless the proposal was actually generated from that revision/data.
10. **Traceability:** calculated value dependencies continue to be derived from the current calculation model.
11. **Session-only data:** no persistence, backend, authentication or multi-user coordination is introduced.
12. **Honest performance reporting:** only publish measurements supported by actual instrumentation and a documented method.
13. **No unapproved deploy:** the presence of `netlify.toml` is not deployment authorization.
14. **Extend, do not rewrite:** reuse current state reducer/provider, operation editing, preview calculation, comparison domain function and UI styling patterns where sound.

---

## 3. Goals and non-goals

### 3.1 Goals

- Introduce a lightweight in-memory Proposal Workspace around the existing operation-based `ChangeProposal` model.
- Support one original proposal and up to two duplicates (three active variants maximum).
- Give each variant a stable unique identity, label, independent operation list, base revision/snapshot and reset-to-creation snapshot.
- Permit safe edits to proposed values; target assumptions and periods remain fixed.
- Support selected-variant impact preview over the full 24-month horizon.
- Support apples-to-apples comparison of at most two variants with the same base, plus a shared-base reference series.
- Preserve independent stale drafts and provide an explicit “Create fresh version” path using the current working model and revision.
- Preserve original baseline-vs-working comparison, transaction atomicity, undo/reset, trace, validation and accessibility.
- Strengthen operation identity and value validation.
- Fix high-impact documentation contradictions and performance-claim mismatch.

### 3.2 Non-goals

- No real AI, LLM, MCP, remote proposal provider or network connection.
- No database, localStorage persistence, backend, auth, collaboration or concurrent multi-user editing.
- No infinite scenario tree, arbitrary branching history or more than three active variants.
- No user-editable operation targets/periods, adding/removing arbitrary operation rows, or freeform formula entry.
- No modification of the existing financial calculation formulas or complete three-statement model.
- No rewrite of the model grid, trace implementation, existing baseline comparison or Performance Lab.
- No new charting library, state-management library, validation library, or other dependencies unless the implementation plan proves a blocker that cannot be solved with current dependencies and asks for approval.
- No deployment, domain setup or marketing page.
- No feature build before a repo-specific implementation plan is reviewed and approved.

---

## 4. Proposal Workspace data model

The exact interfaces must be finalized after the planning agent checks current imports and reducer assumptions. The conceptual requirements below are mandatory; implementation may choose the smallest shape that preserves them.

### 4.1 Workspace

A workspace represents a proposal set created against a single fixed base. Conceptually it has:

- unique workspace ID;
- immutable cloned `baseAssumptions` captured at proposal generation time;
- `baseRevision` captured at generation;
- source template identity or intent, separate from each proposal instance’s unique identity;
- creation metadata;
- a collection of active variants (maximum three);
- selected variant ID;
- optional archived stale workspace/draft reference if required to preserve the stale draft after explicit refresh.

The workspace base assumptions should be cloned once and treated as immutable. Do not independently mutate base assumptions through component state. Avoid redundant deep copies per variant unless a specific invariant requires it.

### 4.2 Proposal variant

Each variant conceptually contains:

- unique `id` generated per instance (never reuse the preset/template ID as the instance ID);
- human-readable `label` (e.g. “Original proposal”, “Hiring alternative”);
- optional `sourceTemplateId` (discriminated from unique instance ID);
- optional `duplicatedFromVariantId` lineage metadata;
- operations (`ProposalOperation[]`), independently owned and cloned;
- `baseRevision` equal to its workspace’s base revision;
- `createdAt` or creation sequence for stable ordering;
- an immutable reset snapshot of the operation values as they were when this variant was created.

Prefer a `resetOperations` or immutable original-operation snapshot over trying to reconstruct the initial values from the current edited array. `Reset edits` restores the variant’s own creation snapshot, not the workspace seed and not the latest values of its parent copy.

### 4.3 Operation metadata safety

Existing operation fields must remain explicit: `targetKey`, `targetPeriod`, `targetCellId`, `previousValue`, `proposedValue`, `displayUnit`, `changeLabel`. Harden their relationship before operations are applied.

For every operation:
- target is an editable setting or monthly **assumption**, never a calculated output;
- `targetKey` maps to a known allowed setting/assumption field;
- the `targetPeriod` is null only for the known setting fields; monthly assumption targets use a period in 1–24;
- `targetCellId` encodes the same field and month/setting as `targetKey` and `targetPeriod`;
- `displayUnit` matches the field (`usd`, `fte`, or `percent`);
- target is unique across the operation set by canonical field+period, not only by a possibly forged string ID;
- `proposedValue` is finite and passes `validateAssumptionValue`;
- `previousValue` is finite and equals the relevant assumption in the proposal base snapshot (exact numeric equality is sufficient for values generated from the same model object; if normalization is used, document and test it);
- the operation list is non-empty before acceptance;
- all validation is all-or-none and reports useful field-level errors.

Avoid parsing target identity in multiple UI components. Prefer a small domain helper or explicit mapping if the current code lacks a canonical way to parse and cross-check target IDs. Do not turn `targetKey: string` into a blind trust boundary.

### 4.4 Edit behavior

- A user can change only `proposedValue` for an existing operation.
- Target key, target period, target cell ID, `previousValue`, and display unit are not user-editable.
- The UI validates each edit before dispatch; the reducer/domain validates again at the acceptance boundary.
- A failed edit must not replace the last valid operation value.
- Any summary, impact preview, and comparison must recalculate from the current edited operation array via cloned assumptions and `calculateModel()`.
- Editing one variant must not change sibling variants, reset snapshots, the workspace base, or canonical model state.
- “Reset edits” restores that variant’s immutable creation snapshot and updates dependent preview/comparison data.

---

## 5. Workspace behavior and UX requirements

### 5.1 Entering the workspace

After the existing deterministic provider generates a proposal, the application initializes a workspace:
1. Capture a clone of `workingAssumptions` and the current `revision` as the workspace base.
2. Generate the original variant with a unique instance ID, fixed source template ID, operations, and reset snapshot.
3. Select the original variant by default.
4. Keep canonical assumptions, calculations, trace, revision and history unchanged.
5. Continue showing the visible “Simulated AI proposal” disclosure.

The proposal provider may continue to return `ChangeProposal`, but its instance identity must not depend on the template key. If a provider result is template-keyed today, normalize it into a fresh variant ID when inserting into the workspace instead of letting every generated instance/copy share the same `id`.

### 5.2 Create duplicate

- A duplicate is a deep, independently editable copy of the currently selected variant’s operations **at the time of duplication**.
- It inherits the exact same shared workspace base snapshot, base revision and source template context.
- It receives a new unique variant ID, a distinct default label such as “Variant 2” / “Variant 3”, lineage metadata if useful, and a new reset snapshot equal to the copied operations at duplicate time.
- Later edits to either copy do not affect the other.
- Duplicate action is disabled at three active variants; UI says that the workspace limit has been reached.
- The original variant may be edited and reset, but it cannot be deleted. Duplicate variants may be removed after a confirmation or lightweight inline confirmation if that matches existing UI patterns.
- Removing a selected duplicate selects a remaining variant predictably (prefer original first, otherwise the first remaining variant).
- Comparison must gracefully handle a single variant and equal variants.

### 5.3 Rename and selection

- Variant labels distinguish alternatives in tabs/cards/selector and chart legends.
- Renaming labels is optional and can be deferred if it extends scope materially; the initial version should at least show stable distinct labels.
- Selection changes only workspace UI state, never model state or revision.
- A selected variant must be unambiguous when accepting; the Accept button should include its label or otherwise make the selected variant conspicuous.

### 5.4 Reset edits versus reset model

These are different operations and must be unmistakably labeled:
- **Reset variant edits:** restores the selected variant’s operations to its creation snapshot, without changing base revision or canonical model.
- **Reset scenario:** existing global action that restores the working model to the immutable original baseline, increments revision, clears transaction history and closes pending workspace/drafts per the existing reset model. Update the confirmation text to state clearly that uncommitted proposal workspace drafts/variants will also be cleared. Because reset is destructive and already confirmed, do not add another confirmation layer for each proposal variant.

---

## 6. Proposal impact preview (one variant vs. its base)

### 6.1 Purpose

Answer: “If this variant were accepted against the model it was generated from, what would happen across the 24-month horizon?”

### 6.2 Base rules

- Use the immutable assumptions snapshot captured when the workspace was created.
- Derive proposed assumptions with the existing safe draft helper after stricter operation checks.
- Run both base and proposed assumptions through `calculateModel()`.
- Compute all deltas via a shared domain comparison structure rather than recalculating in chart/table UI components.
- Preview must not call the reducer’s commit pathway or mutate global state.

### 6.3 Stale rules

If `workspace.baseRevision !== state.revision`:
- label the workspace and selected proposal as **Stale**;
- disable Accept;
- disable **current/live** impact preview because applying the old operation list against a different model is misleading;
- retain an inspectable snapshot comparison of that stale proposal’s original base vs. its proposed results, with an explicit “Historical preview — proposal is stale and cannot be applied” label;
- offer the explicit refresh flow in Section 8.

Never silently substitute `state.workingAssumptions` as the reference assumptions for a stale proposal. If implementation complexity demands a smaller UI, it is acceptable to show the stale proposal diff and no chart until fresh versioning, but it is not acceptable to show a misleading comparison.

### 6.4 Visualization and data

Reuse existing Recharts and scenario comparison conventions:
- Metric selector: Revenue, EBITDA, Ending Cash.
- 24 monthly periods, M01–M24.
- A line chart showing the base series and the proposed variant series.
- An accessible data table immediately available as an equivalent to the chart, with monthly base value, proposal value, absolute delta, and percentage delta.
- Safe percentage handling: show an em dash when base value is zero; do not divide by zero.
- At-a-glance summary cards for M24 Revenue, M24 EBITDA and M24 Ending Cash, preserving the current familiar interaction.
- Clear title/subtitle stating the exact reference, e.g. “Proposal impact: Original proposal vs. proposal base (revision 4)”.
- Include the cash model limitation near Ending Cash values.
- Empty/equal data state must be clear; no false warning when series are identical.

### 6.5 Acceptance behavior

- Accept applies the selected variant’s entire operation list to the live working assumptions only if the workspace base revision is current and every operation passes validation against the workspace base.
- `commitTransaction()` remains the canonical atomic commit path; do not implement a second write path.
- The resulting transaction uses the canonical working model as its immediate `previousAssumptions` and the computed new assumptions as `newAssumptions`.
- Preserve enough provenance on the transaction to identify which proposal variant was accepted, the source template/intent if applicable, and the proposal base revision. Use optional typed metadata or a small provenance structure; avoid encoding machine-readable data only in `description`.
- On acceptance, sibling variants in that workspace become non-applicable/closed. Their stale-draft retention is optional unless needed to meet the preservation requirement; do not accidentally leave another sibling accept-ready after the canonical revision increments.
- History, model grid, summary KPIs, calculation trace and existing Scenario Compare should update synchronously from the same canonical transaction.
- One accepted variant creates one transaction, regardless of how many monthly operations are included, and undo restores the pre-transaction assumptions atomically.

---

## 7. Variant comparison (base plus up to two alternatives)

### 7.1 Purpose

Answer: “Which of these two proposal alternatives has the more attractive modeled impact, and how do their assumptions produce the difference?”

### 7.2 Comparison rules

- Compare no more than two proposal variants simultaneously.
- Both must belong to the same workspace and therefore share an identical base snapshot and base revision.
- The chart plots at most three series: shared proposal base + variant A + variant B.
- If only one variant is selected, plot the base + one variant.
- Do not compare variants based on different base revisions; block with an understandable explanation.
- All series are calculated from immutable cloned assumptions and `calculateModel()`.
- Reuse the existing `calculateScenarioDelta()` or extend its types/helper so chart, summary and table consume a single comparison result. Do not place model formulas in React chart code.
- The existing Scenario Compare page is not repurposed and remains original seed baseline vs current working model.

### 7.3 Comparison UI

- Visible title and explanation: “Proposal variants vs. shared proposal base · revision N”.
- Selection controls for at most two variants; selected labels are reflected in chart legend and table headings.
- Metric selector for Revenue, EBITDA and Ending Cash.
- Line chart with base and selected variants (maximum three series).
- Accessible data table with one month per row and base/variant values, absolute deltas, and safe percentage deltas.
- Summary comparisons for cumulative revenue and M24 ending cash are enough; do not create a dashboard of additional KPIs.
- If the variants are equal, state that they currently produce identical results.
- If a variant is invalid, do not silently omit it and show another scenario under its name; show validation feedback and disable/mark comparison unavailable until fixed.
- Data needs to derive from the current edit versions, never stale cached chart arrays.

---

## 8. Stale workspace and explicit refresh behavior

### 8.1 What makes a workspace stale

Any accepted/manual edit, undo, or global reset that advances the canonical revision can make an open workspace stale. Compare workspace base revision against the monotonic `AppState.revision` at both display/preview boundary and acceptance boundary.

### 8.2 What stays available

When stale:
- the original base snapshot and all variant operation lists remain inspectable;
- editing/renaming/resetting variant values may remain available as draft-only activity, but no stale version can be accepted or previewed as if based on the current live model;
- each chart/table view that remains available must say it represents the historical base snapshot, not the current working model;
- no stale proposal operation is merged automatically with live changes.

### 8.3 Create fresh version

Provide a clearly named action such as **Create fresh version from current model**:
1. Preserve the stale workspace and its variants so the user can inspect what is being superseded. The simplest adequate UI may move it into one “Previous stale draft” read-only/archived slot; it does not need a full archive browser.
2. Generate a new original proposal using the same known `sourceTemplateId`/intent and current `workingAssumptions` + `revision` when that source template is known.
3. For edited/custom draft variants without a known template generation recipe, do not pretend they can be semantically regenerated. Offer the safe path to create a fresh revision of the chosen variant by re-resolving its **same assumption targets and periods** against current assumptions only after an explicit user action and a domain check. This must be an explicit preview/review path, not auto-rebase; the planner should recommend the lowest-complexity design that still preserves the old draft.
4. Give the new workspace a new ID/base snapshot/base revision and distinct proposal instance/variant IDs.
5. Do not overwrite or clear the stale workspace before the fresh workspace has been created successfully.
6. If any target no longer maps safely or the base operation structure cannot be reproduced, stop and explain which operation needs user review. Do not silently drop an operation.

If the smallest safe design cannot support both template regeneration and edited-variant refreshing in this timebox, implement explicit regeneration from the original template first; keep the stale workspace preserved and report edited-variant carry-forward as a known limitation. Do not implement an unsafe generic rebase merely to claim completeness.

### 8.4 Workspace/session boundaries

The application is session-only. A page reload may reset proposal workspace state just as other in-memory state currently resets; do not add persistence. If there can be one active and one previous stale workspace, keep that contract explicit and bounded instead of building general history/branching.

---

## 9. Operation validation and state correctness

### 9.1 Domain validation responsibilities

Strengthen validation primarily in `src/domain/validation.ts`, with canonical parsing/mapping helpers in the domain layer if needed. Validate both at editing and accepting boundaries.

Required checks:
1. Known editable target field.
2. Valid setting/monthly period semantics.
3. Canonical `targetCellId` matches `targetKey` and `targetPeriod`.
4. `displayUnit` matches field type.
5. No duplicate logical target by canonical key + period.
6. `proposedValue` finite, numeric and within current runtime bounds.
7. `previousValue` matches the value in the workspace base snapshot.
8. No calculated-cell targets and no unknown object fields treated as model targets.
9. Non-empty operation set before acceptance.
10. All operations pass before any operation is applied.

Return structured, actionable errors without mutating any passed object.

### 9.2 Reducer defense-in-depth

- `PROPOSAL_EDIT_OPERATION` should ignore/reject an unknown target ID, reject invalid `proposedValue`, and never update the wrong operation.
- The UI should show the edit error and retain the prior valid draft value.
- Acceptance revalidates the full proposal workspace against its base snapshot and revision; UI disabled states are not the sole safety mechanism.
- If an operation set fails, canonical assumptions, calculated outputs, trace index, revision, and transaction history must be reference/data unchanged.

### 9.3 Trace and transaction provenance

- `buildTraceIndex()` continues to use canonical assumption/calculation structures, not proposal UI state.
- Preview may optionally show a “Why did this change?” panel for a selected calculated metric if it can reuse the current trace infrastructure without a new graph abstraction. This is a lower priority than variant correctness and can be deferred.
- Transaction records should include typed provenance for accepted proposal variants (variant ID, source template/intent, base revision, optionally label). Do not create a grade-Audit-Ledger feature; history remains in-memory and explicitly non-compliance-grade.

---

## 10. Documentation and performance accuracy

### 10.1 Required README reconciliation

Update only the relevant sections, preserving the existing project narrative and architecture unless a verified contradiction exists:
- validation table must match the actual runtime rules in Section 1.4;
- ending-cash simplified proxy is clearly disclosed wherever forecast cash is explained and near V2 preview/compare UI;
- proposal lifecycle diagram and architecture diagram must represent a multi-variant workspace and shared base without implying real AI;
- accepted-history documentation must match the implementation (the current reducer pops from a transaction list; “single-level undo snapshot” in the architecture diagram may be inconsistent with current stack behavior);
- performance edit metric and methodology corrected per Section 1.5;
- CI/test commands kept as commands, but counts/pass statements must identify their evidence/date or be removed if not freshly verified;
- Node support must resolve the currently documented Node 20/22/24 statements against package/CI/Netlify config. Prefer one primary supported and CI-tested version and document the production-host version separately if necessary.

### 10.2 Stale planning docs

`docs/reconnaissance.md` currently contains a historical greenfield assessment contradicted by current code. Mark it clearly as **superseded historical Phase 0 evidence** or replace it with a short notice pointing to the current implementation and V2 audit, without deleting its historical content without approval. Review references in `docs/implementation/IMPLEMENTATION_MASTER_PLAN.md` that describe the project as greenfield or unbuilt; update only the directly misleading current-facing statements in this V2 iteration or explicitly defer the larger documentation cleanup.

The parent v1.1 filename/headline version mismatch is a documentation issue. V2 metadata should cite it by path and avoid silently rewriting the parent document.

### 10.3 Performance reporting acceptance

- Do not combine in-memory assignment timing with manual edit elapsed time in one p50/p95 distribution.
- Do not describe the current collector as “real input-to-commit latency”.
- If measurements remain property-assignment timings, label the measure narrowly and explicitly (e.g. “In-memory synthetic override mutation duration”; this demonstrates assignment work only, not React/UI latency).
- If input-to-commit is retained as a metric, use real representative edits with a stable per-sample correlation ID and measure the appropriate React committed update boundary; separate human input time, event-handler time, React commit, and browser paint, and make the method visible.
- Avoid artificial 0.1 ms clamping that turns sub-resolution samples into a misleading precise measurement. Display precision/“below timer resolution” appropriately.
- Fix benchmark reruns so `VirtualGrid` can report grid-ready for each distinct run, either by keyed remount or per-run measurement identifier/reset.
- Do not add thresholds that fail CI nondeterministically across hardware. Structural virtualization checks remain more reliable.

---

## 11. Accessibility, responsive behavior and visual design

- Reuse existing buttons, badges, inline notices, status messaging, card, table and focus patterns.
- Every variant selector, duplication, delete/remove, reset-edits, refresh and accept/reject action must have a descriptive accessible name.
- The selected variant state must be exposed to assistive technology (e.g. tabs with tab semantics or a radio/select pattern with a clear label). Do not invent a bespoke keyboard interaction if a native pattern suffices.
- Keyboard users must be able to edit a value, see an error, cancel, reset, select comparison variants and accept/reject without a pointer.
- Announce important workspace state transitions (stale, invalid, created duplicate, removed variant, accepted) without moving focus unnecessarily.
- Tables must have captions and proper row/column headers. Charts must retain the accessible table alternative.
- Do not use color alone for positive/negative impact; retain signs, values and text labels.
- Preserve narrow-screen scroll containment. The workspace must not introduce page-level horizontal overflow; wide diff/comparison tables may scroll inside their own containers.
- Reduced-motion and existing visual style remain intact.
- Existing Axe scans remain; add coverage for the Proposal Workspace in the one-variant, three-variant, invalid and stale states where practical.

---

## 12. Acceptance criteria

### P0 — Essential V2 product behavior

**Workspace state**
- [ ] Generating any template creates a workspace with a deep-cloned base assumption snapshot and current base revision.
- [ ] Every variant has a distinct instance ID even when two variants use the same source template.
- [ ] Original + two duplicates is the active workspace maximum; duplicate control is disabled with clear messaging at the limit.
- [ ] Each duplicate has independent operations and its own reset-to-creation snapshot.
- [ ] Editing or resetting one variant changes no other variant and never mutates canonical model state.

**Preview and comparison**
- [ ] Selected-variant preview uses the workspace base snapshot and canonical calculation engine to produce monthly values/deltas for all 24 periods.
- [ ] Chart and table use the same typed comparison result; no formulas are implemented in chart/table components.
- [ ] Variant comparison selects no more than two variants from the same base, plots at most three series including base, and labels each scenario.
- [ ] Existing Scenario Compare remains immutable original seed baseline vs current working scenario.
- [ ] Zero-base percent changes display “—”; equal variants have a clear, non-error state.

**Safety**
- [ ] Accept applies only the selected variant when the base revision is current and operation metadata/value validation passes.
- [ ] A stale proposal cannot be accepted or previewed as though it were based on the live current model.
- [ ] An explicit fresh-version action preserves the stale draft and creates a new workspace/base revision, or a documented, approved minimal scope limitation is reported for non-template edited variants.
- [ ] Invalid operations cannot partially change canonical assumptions, calculations, trace, revision or history.
- [ ] Canonical target ID/key/period/unit/previous-value integrity is validated in the domain layer and tested.
- [ ] One acceptance creates one history transaction with typed proposal provenance; undo restores the exact pre-acceptance model and still increments revision.

### P1 — Credibility and product completion

- [ ] README validation ranges exactly match `validateAssumptionValue()`.
- [ ] The simplified ending-cash proxy disclosure is visible in the model/proposal/compare experience and the README.
- [ ] Performance labels/methodology describe exactly what code measures; no mixed p50/p95 sample set remains.
- [ ] Rerunning the benchmark can record a new grid-ready measurement.
- [ ] Historical greenfield docs are marked superseded or their stale assertions are fixed.
- [ ] Node version story between GitHub Actions, Netlify and README is reconciled.
- [ ] Critical journey, proposal workspace UI, and accessibility tests cover core state transitions.

### P2 — Optional if it fits the agreed timebox

- [ ] A minimal trace/explanation shortcut connects a proposal delta to the existing formula trace.
- [ ] Label renaming beyond stable generated labels.
- [ ] Extra chart filters or comparisons beyond the three metrics already offered.

Do not delay completing P0/P1 in order to implement P2.

---

## 13. Test and verification plan

The implementation agent must add tests alongside each change. Minimum matrix:

| Area | Required tests |
|---|---|
| Variant domain helpers | Unique IDs; deep copy; independent sibling operations; duplicate copies current edits; reset-to-creation snapshot; max-three cap |
| Proposal base and preview | Source base is cloned/immutable; proposal base + edited operation result matches `calculateModel`; no canonical mutation, revision change, history event or trace mutation during preview |
| Operation integrity | Forged `targetCellId`; key-period mismatch; setting/period mismatch; calculated target; wrong `displayUnit`; stale `previousValue`; duplicate logical target with different IDs; nonfinite/out-of-bounds values; valid set passes |
| Acceptance/revision | Correct variant committed; stale selected variant blocked; accepted sibling cannot remain applicable; transaction provenance retained; invalid operation causes zero mutation; undo restores old assumptions and revision advances |
| Variant comparison | One variant and two variants; correct common base; max two choices; mismatched workspace/revision blocked; shared result feeds chart/table; zero denominator; equal scenario state |
| Existing compare regression | Seed baseline immutability and baseline-vs-working semantics unchanged after variants are created/edited/accepted |
| Stale refresh | Preserve stale draft; generated workspace uses current working assumptions/revision; do not auto-drop invalid targets; old proposal not overwritten before successful refresh |
| Accessibility | keyboard editing, visible labels, status/error announcements, table header/caption, chart alternative, no serious Axe violations on workspace states |
| Performance Lab | separately labelled measurements; no mixed samples; sample correlation if true commit metric; rerun records new grid-ready result; overrides isolated from finance state |
| Docs/CI | typecheck, lint, format, Vitest, production build, E2E/Axe all run in target local/CI environment; report actual results and any failures accurately |

The audit did not execute tests or builds. The implementer must execute the configured checks before claiming they pass.

---

## 14. Suggested implementation order

The plan agent must inspect current exact types and tests and can adjust the smallest implementation details, but should preserve this dependency order:

1. **Domain contracts first:** settle proposal workspace/variant types and safe target identity validation; add pure tests before wiring UI.
2. **Reducer state transitions:** introduce workspace collection/selection and actions for duplicate, edit, reset variant, remove duplicate, select, accept selected variant, stale refresh. Keep canonical transactions centralized.
3. **Preview calculation:** create a reusable pure helper that produces base/variant `CalculatedModel`s and a comparison result via existing code; expose errors rather than silently substituting zeros.
4. **Workspace UI:** extend `ProposalReviewPanel` and `ProposalDiff` instead of replacing them; add variant selection/copy/reset and retain current Accept/Reject experience.
5. **Full-horizon proposal impact and two-variant comparison:** use existing chart/table conventions and make labels/reference revisions explicit; keep existing Scenario Compare tab untouched semantically.
6. **Stale flow and transaction provenance:** add the explicit fresh-version path and preserve stale draft before replacing active state; verify acceptance/undo/history.
7. **Small credibility fixes:** repair operation metadata checks; update README validation/cash/performance methodology; mark stale docs; fix benchmark rerun readiness and metric labelling.
8. **Tests, accessibility, verification:** expand existing suites, run the actual commands, inspect the full diff, and document exact evidence.

Avoid doing all the visual polish first. The priority is state invariants, math source, and review correctness.

---

## 15. Explicit implementation boundaries / stop conditions

Stop and ask for a decision before proceeding if any of these become necessary:
- adding a dependency;
- changing the calculation formulas or input range semantics;
- requiring persisted state/backend;
- changing the original baseline-vs-working Scenario Compare semantics;
- introducing arbitrary target editing or add/remove operations;
- adding more than three active proposal variants;
- automatic rebase/merge semantics for stale proposals;
- deploying the application or changing hosting configuration;
- a large redesign or refactor unrelated to V2 acceptance criteria.

A focused V2 is successful when a reviewer can compare two meaningful alternatives, see the 24-month effects, understand the comparison base, trust that no change occurred before acceptance, inspect a safe revision transition, and reproduce the tests. It is not measured by number of screens or lines of code.

---

## 16. Source references audited

Key files read in the inspected remote snapshot:
- `README.md`, `package.json`, `netlify.toml`, `.github/workflows/ci.yml`.
- `docs/PRD/Model_Change_Review_Lab_PRD_v1.1_Extended.md`, `docs/reconnaissance.md`, `docs/implementation/IMPLEMENTATION_MASTER_PLAN.md`.
- `src/domain/types.ts`, `seed.ts`, `calculation.ts`, `validation.ts`, `operations.ts`, `transactions.ts`, `proposals.ts`, `scenarioComparison.ts`, `trace.ts`, `formatting.ts`.
- `src/state/appState.ts`, `appReducer.ts`, `AppProvider.tsx`, `src/App.tsx`.
- `src/pages/ModelPage.tsx`, `ScenarioPage.tsx`, `src/components/proposals/*`, `src/components/scenario/*`, `src/components/history/*`, `src/components/shell/AppShell.tsx`, `src/features/performance/*`.
- Representative tests: `src/domain/__tests__/validation.test.ts`, `proposals.test.ts`, `trace.test.ts`, reducer and proposal lifecycle tests, history/scenario tests and `src/features/performance/__tests__/virtualization.test.tsx`.
- E2E: `e2e/critical-journey.spec.ts`, `e2e/a11y.spec.ts`, `playwright.config.ts`.

**Audit limitation:** The committed source and repository metadata were inspected remotely. A local checkout/build/test run was unavailable in the audit environment because it could not resolve `github.com`. This is a limitation of this audit environment, not a finding about the repository. All implementation checks remain pending until run in a working repo environment.
