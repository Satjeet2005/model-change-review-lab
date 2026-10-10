# Test Strategy

## 1. Test Architecture Overview

This project follows a rigorous testing architecture designed to prevent regressions and validate complex financial calculations, structured according to the classic test pyramid.

- **Test Pyramid:**
  - **Unit Tests (Domain Level):** Core financial calculations, trace generation, and pure functions. Highest volume of tests, framework-agnostic.
  - **Component / Integration Tests:** React UI components, virtualized grid, and proposal lifecycles using React Testing Library.
  - **End-to-End (E2E) Tests:** Critical user journeys spanning from initial load to scenario modifications and validations.
- **Tools:** (versions provisional until Phase 0 repository inspection and official-doc verification)
  - Vitest 5.0.3 + jsdom
  - @testing-library/react 16.3.3
  - @testing-library/user-event 14.6.7
  - Playwright 1.64.0
  - @axe-core/playwright 4.13.0
- **Coverage Goals:**
  - **Mandatory PRD release gates (must pass):** Required domain calculation/unit tests for each phase pass; all PRD-critical interaction tests (proposal accept/reject, unstale guard, undo, trace resolution) pass; build succeeds; no fabricated performance data; disclosure visible.
  - **Recommended additional quality goals (not mandatory release gates):** High domain-coverage for calculation/validation paths; component tests for grid editing lifecycle and proposal UI; accessible-smoke check passes.
  - **Hard structural performance check:** fewer than 100 synthetic-grid body rows are mounted at once.
  - **Diagnostic timing targets (measure and report honestly — do not claim as guarantees):** Grid Ready < 500ms; Edit Latency p95 < 100ms; Model Recompute < 10ms. Measure in a production build with the environment logged; never pre-fill or fabricate results (see Performance Methodology §4).

---

## 2. Test Layers

### 2.1 Domain Unit Tests (Vitest, no React)
**Location:** `src/domain/__tests__/`

These tests validate the core calculation engine, proposals, and trace without rendering any UI.

| Test ID | Description | Test File | Regression Prevented |
|---|---|---|---|
| 1 | Seed function produces exactly 24 ordered periods with defaults | `seed.test.ts` | Missing or incorrect baseline data |
| 2 | Seed function returns fresh objects | `seed.test.ts` | State mutation across tests/sessions |
| 3 | `calculateModel` returns exactly 24 values for derived metrics | `engine.test.ts` | Incomplete calculations |
| 4 | Revenue formula M01 uses starting revenue and M01 growth | `engine.test.ts` | Faulty initial month revenue formula |
| 5 | Revenue formula M02+ uses previous revenue × (1 + current growth rate) | `engine.test.ts` | Compounding revenue calculation error |
| 6 | Payroll equals total FTE × loaded monthly cost | `engine.test.ts` | Faulty cost calculations |
| 7 | Total operating expense equals payroll + other OPEX | `engine.test.ts` | Excluded operational expenses |
| 8 | EBITDA equals revenue − total operating expense | `engine.test.ts` | Incorrect profit margin |
| 9 | Ending cash rolls forward previous ending cash + current EBITDA | `engine.test.ts` | Broken cash flow timeline |
| 10 | Money rounding is consistent at two decimal places | `src/domain/__tests__/formatting.test.ts` | Floating point errors / formatting consistency |
| 11 | Two calculations using equal inputs produce equal outputs/trace | `engine.test.ts` | Non-deterministic calculation engine |
| 12 | Calculation does not mutate input assumptions | `engine.test.ts` | Side-effects mutating base state |
| 13 | Each allowed validation boundary is tested at min/max/outside | `validation.test.ts` | Out-of-bounds user inputs accepted |
| 14 | Empty strings, whitespace, NaN, infinities, trailing garbage reject | `validation.test.ts` | Malformed inputs crashing the app |
| 15 | Fractional FTE rejects | `validation.test.ts` | Invalid FTE data representation |
| 16 | Proposal operation sets with duplicate/unknown targets reject | `proposals.test.ts` | Invalid proposal mutations |
| 17 | Valid operation set returns clone, original deeply equal | `proposals.test.ts` | Proposals mutating working model |
| 18 | Operation set with one invalid operation changes nothing | `proposals.test.ts` | Partial (corrupted) proposal application |
| 19 | Scenario delta handles zero baseline safely | `scenario.test.ts` | Division by zero or NaN renders |
| 20 | Cumulative revenue is sum across 24 monthly revenue values | `scenario.test.ts` | Faulty cumulative aggregation |
| 21 | Preset templates produce correct ordered operations & old values | `proposals.test.ts` | Broken predefined scenario templates |
| 22 | Hire proposal affects M07–M24 only | `proposals.test.ts` | Proposal period drift |
| 23 | Growth proposal adds exactly 0.01 for M07–M24 | `proposals.test.ts` | Miscalculated growth template |
| 24 | Opex proposal reduces M04–M24 to 92% of captured current value | `proposals.test.ts` | Miscalculated opex template |
| 25 | Proposal generation does not mutate working assumptions | `proposals.test.ts` | Template generation side-effects |
| 26 | Preview calculation equals calculation of cloned model + ops | `proposals.test.ts` | Drift between preview and actual application |
| 27 | Every calculated trace node points only to existing nodes | `trace.test.ts` | Broken formula trace DAG |
| 28 | Every trace dependency chain resolves to assumptions, no cycles | `trace.test.ts` | Circular dependencies in engine |
| 29 | Changing an assumption updates corresponding trace value | `trace.test.ts` | Stale dependency traces |
| FMT-1 | Formatting tests for large numbers, decimals, negatives, zeros | `src/domain/__tests__/formatting.test.ts` | Poor/incorrect string representations |

#### Critical Implementation Sketches

**Test 11: Determinism (Pseudocode)**
```typescript
test('Calculations are deterministic', () => {
  const inputA = createSeedData();
  const inputB = createSeedData(); // identical to inputA
  const resultA = calculateModel(inputA);
  const resultB = calculateModel(inputB);
  expect(resultA).toEqual(resultB);
});
```

**Test 17: Pure Application of Proposals (Pseudocode)**
```typescript
test('Valid operation set returns changed clone, original unmodified', () => {
  const original = createSeedData();
  const originalCopy = structuredClone(original);
  const operations = [{ period: 'M07', target: 'engineeringFte', value: 20 }];
  const result = applyProposalOperations(original, operations);
  
  expect(result.months.find(m => m.period === 7).engineeringFte).toBe(20); // M07 via ModelAssumptions.months
  expect(original).toEqual(originalCopy); // Deep equality check
});
```

### 2.2 Component/Integration Tests (Vitest + RTL)
**Location:** `src/components/**/__tests__/`, `src/domain/__tests__/`, `e2e/`

| Test ID | Description | Regression Prevented |
|---|---|---|
| 30 | Editable assumption cells enter/exit edit mode via keyboard | Broken accessibility/editing flow |
| 31 | Valid Enter commit updates model and recomputes | Ignored user input |
| 32 | Escape cancels draft and leaves canonical state identical | Stuck in edit mode / unwanted changes |
| 33 | Invalid Enter commit shows error and leaves model unchanged | Invalid state saved to store |
| 34 | Reject proposal leaves baseline/undo stack unchanged | Rejecting mutates model unexpectedly |
| 35 | Accept applies operations in transaction and updates metrics | Accept fails to propagate changes |
| 36 | Edit then Accept uses edited operation value, not template | Manual proposal edits discarded |
| 37 | Invalid edited operation disables Accept | Broken/invalid proposal application |
| 38 | Stale proposal cannot be accepted after direct edit/undo | Merge conflicts on stale state |
| 39 | Failed proposal provider leaves model unchanged, allows retry | Unrecoverable state on error |
| 40 | Repeated/double Accept cannot apply a proposal twice | Duplicate transactions in history |
| 41 | Undo after direct edit restores previous snapshot | Irreversible manual changes |
| 42 | Undo after accepted multi-cell proposal restores all cells | Partial state restoration |
| 43 | Reset restores initial seeded model, clears history | Broken hard-reset capability |
| 44 | Focus indicators exist for keyboard nav, kept when trace opens | A11y focus trapping bugs |
| 45 | Scenario chart and delta table consume identical comparison values | Desync between visual and table data |
| 46 | Switching chart metric updates chart and table consistently | Broken metric synchronization |
| 47 | Calculated cell selection opens trace panel with correct info | Broken trace UX flow |
| 48 | Virtualized grid shows <100 body rows for 10k dataset | DOM bloat / performance degradation |
| 49 | Editing virtualized cell persists when scrolling away and back | Data loss on scroll (virtualization bug) |
| 50 | Perf panel shows no fabricated measurement values before run | Misleading performance data |
| 51 | Measurement failure creates unavailable/error state, not 0ms | False performance reports |
| 52 | Responsive layout has no page-level horizontal overflow | Broken mobile viewport |

### 2.3 End-to-End Test (Playwright)
**Location:** `e2e/critical-journey.spec.ts`

**Critical Happy Path Journey (Test 53):**
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

### 2.4 Accessibility Tests
**Location:** `e2e/a11y.spec.ts`

Using `@axe-core/playwright` to scan the primary routes (Model Grid, Trace Panel, Proposal Draft View, Performance Lab). Validates contrast, ARIA landmarks, roles, and focus management. Manually verify `prefers-reduced-motion` behavior for nonessential transitions.

---

## 3. Coverage Map

| Feature Area | PRD Section | Test IDs | Layer |
|---|---|---|---|
| Domain Calculation | 6, 16.1 | 1 - 12 | Unit |
| Validation | 6, 16.1 | 13 - 15 | Unit |
| Proposals / Engine | 9, 16.1, 16.2 | 16 - 26 | Unit |
| Trace DAG | 9, 16.2 | 27 - 29 | Unit |
| Formatting | 16.1 | FMT-1 | Unit |
| Grid Editing Lifecycle | 16.3 | 30 - 33, 44 | Component |
| UI Proposal Lifecycle | 16.3 | 34 - 40 | Component |
| Undo / History | 16.3 | 41 - 43 | Component |
| Chart & Trace UI | 16.4 | 45 - 47 | Component |
| Perf Lab / Virtualization| 12, 16.4 | 48 - 52 | Component |
| Core User Journey | 16.5 | 53 (Journey) | E2E |

---

## 4. Performance Measurement Methodology (PRD §12)

Measurements must be collected using the application's internal Performance Lab module.

### Definitions and Methodology
- **A. Dataset generation time:** Time to prepare the fixed 10,000 × 24 synthetic dataset in memory. Kept completely separate from UI render time. If calculated lazily, this must be documented explicitly.
- **B. Time to grid ready:** Time from "Run benchmark" press to first committed layout of the synthetic grid (including headers and initial visible rows).
  - *Method:* `performance.mark` on click, and `performance.measure` executed within a React `useLayoutEffect` (or via React Profiler onCommit callback).
- **C. Edit keystroke-to-paint latency:** Time from input edit event to corresponding committed render.
  - *Method:* Needs 30+ samples. p50 and p95 percentiles will be calculated. The measurement strictly represents cell commit latency.
- **D. Model recomputation duration:** Duration of the domain calculation work for the 24-period model.
  - *Method:* Wrapper around `calculateModel` using `performance.now()`. Pure calculation time separated from React state updates.
- **E. DOM virtualization evidence:** The exact count of `<tr>` or equivalent row nodes inside the main scroll container body.

### Measurement Protocols
- **Build Mode:** All measurements must be taken in a **Production Build**. React Developer Mode includes strict-mode double renders and overhead that invalidate timings.
- **Environment Logging:** The recorded metrics must include User-Agent, Viewport Size, and Machine profile (e.g., Apple M2 Pro, 32GB RAM).
- **No Fabricated Data:** The lab must show "No measurements collected yet" initially. If a measurement fails, it displays an unavailable/error state (never `0 ms`).

### Targets (Diagnostic Objectives, not guarantees)
- **Grid Ready target (diagnostic):** < 500ms
- **Edit Latency (p95):** < 100ms
- **Model Recompute:** < 10ms

---

## 5. Test Commands

```bash
[package-manager] test                    # All unit + component tests (Vitest) — command established by Phase 0
[package-manager] test -- --run           # CI mode (no watch)
[package-manager] test -- --coverage      # Run tests with coverage report (diagnostic, not a mandatory gate)
[package-manager] test:e2e                # Playwright E2E journey tests — requires Phase 0 to install/verify Playwright and browsers
[package-manager] typecheck               # TypeScript compiler check (tsc --noEmit)
[package-manager] lint                    # ESLint source code checking
[package-manager] build                   # Validate production build succeeds
```

---

## 6. Quality Gates per Phase

Before marking any implementation phase as complete, the following gates must pass:
1. **Linting and Typechecking:** `[package-manager] lint` and `[package-manager] typecheck` emit zero errors.
2. **Unit & Component Testing:** `[package-manager] test -- --run` passes all specified tests for the phase (mandatory gates), with honest reporting of any failing or skipped tests. No fabricated pass claims.
3. **Build Check:** `[package-manager] build` creates a valid dist output without warnings or fatal memory issues.
4. **Acceptance Report:** All required PRD tests mapped to the phase must have an explicit "Pass" status reported. Pre-existing unrelated test failures must be explicitly documented, not ignored.

---

## 7. Regression Prevention

For each group of tests, the specific risk they mitigate:
- **Calculation Unit Tests:** Prevent silent data corruption in the core model. Ensures the fundamental math (EBITDA, Cash flow, compounding revenue) is immutable and correct.
- **Proposal Unit Tests:** Prevent corrupted transactions or operations modifying the wrong periods/cells. Guarantees safety of optimistic scenario testing.
- **Grid Integration Tests:** Prevent UI state drift. If the virtualized scroll drops user edits, or invalid inputs crash the application, these tests catch it.
- **E2E Tests:** Prevent broken "glue". It guarantees that while units work individually, a real user can still generate a proposal, edit it, accept it, and view traces in a real browser context.

---

## 8. Known Limitations

- **Accessibility:** Automated accessibility tests (`axe-core`) catch only structural issues (e.g., missing ARIA labels, contrast). They **do not** replace manual screen-reader testing (VoiceOver/NVDA) and keyboard navigation checks.
- **Performance:** Targets are heavily dependent on the client's hardware and browser engine. Passing performance thresholds on a high-end developer machine does not guarantee the same timings on mobile or older hardware.
- **Financial Completeness:** Passing these tests means the math matches the specific, simplified PRD formulas. It does not validate production-grade GAAP accounting or guarantee correctness beyond the prototype's defined scope.