# Decisions and Risks

This document tracks all significant architectural decisions, unresolved questions requiring approval, project risks, and system assumptions for the Model Change Review Lab project.

---

## 1. Architecture Decision Records (ADRs)

> **Note on versions**: All package versions listed in the Dependency Matrix (ADR-001 and dependency table) are **provisional** until Phase 0 inspects the actual repository lockfile and confirms current official package documentation and React compatibility. Do not install or fix versions until Phase 0 completes.
>
> **PRD-mandated decisions**: ADR-002 (no full spreadsheet lib — §28.3), ADR-006 (Recharts — §15.1), ADR-007 (react-virtual — §12.3/§28.1), ADR-008 (semantic table — §29.6), ADR-009 (single undo — §8.5), ADR-011 (Enter gesture — §29.6), ADR-012 (direct value edit — §6.9) are explicitly defined by the PRD. ADR-003 (shadcn/ui) and ADR-004 (Tailwind) are recommendations for greenfield; apply only with approval if repo has existing equivalents. The remaining ADRs are project choices requiring approval only where noted.

### **ADR-001: Package Manager — npm (Approved for this workspace)**
* **Status**: Accepted (npm approved following Phase 0 reconnaissance)
* **Policy**: Preserve existing package manager if established in a repository; in greenfield setups, obtain approval before changing. Do not silently switch.
* **Context**: Reconnaissance confirmed a greenfield repository with Node.js v24.11.1 and npm 11.6.2 fully operational, while the system pnpm shim encountered a Corepack runtime error.
* **Decision**: Use `npm` (v11.6.2) as the approved package manager for this workspace, retaining `package-lock.json` as the authoritative lockfile.
* **Alternatives Considered**: `pnpm` (required Corepack repair), `yarn` 1.22.22, `bun` 1.2.23.
* **Consequences**: Standard, reliable dependency resolution without requiring external package manager shims; standard npm lifecycle scripts and lockfile preservation.
* **PRD Reference**: Technical constraints & Phase 0 approval.

### **ADR-002: No Full Spreadsheet Grid Library**
* **Status**: Accepted
* **Context**: Need a grid to display the 11×24 financial model.
* **Decision**: Implement a custom semantic HTML table grid.
* **Alternatives Considered**: AG Grid, Handsontable.
* **Consequences**: The grid is small enough that a full library is overkill. Avoids licensing concerns. The PRD explicitly excludes drag-fill/paste/formula parsing. Provides total control over keyboard navigation and accessibility.
* **PRD Reference**: §28.3

### **ADR-003: shadcn/ui with Radix Base (recommended for new repo; not mandated for existing)**
* **Status**: Recommended for new, empty repo; preserve existing primitives if repo already has them. Only migrate with explicit approval.
* **Context**: Need reliable UI components (button, dialog, tabs, tooltip) that are accessible and easy to customize.
* **Decision**: Use `shadcn/ui` if repo is greenfield and user approves; otherwise keep existing compatible primitives.
* **Alternatives Considered**: Hand-built CSS modules or fully managed component libraries (MUI, Chakra).
* **Consequences**: Consistent accessibility out of the box. Source-owned components allow tailoring to the exact design needed without fighting library constraints.
* **PRD Reference**: §28.1

### **ADR-004: Tailwind CSS v4 (greenfield recommendation; existing repo retains current)**
* **Status**: Recommended for greenfield; existing repo keeps current styling system unless user approves migration. PRD requires one system, not two competing systems (§28.1).
* **Context**: Need a styling solution that is fast, modern, and easy to theme.
* **Decision**: Use Tailwind v4 for greenfield after Phase 0 confirmation; do not migrate functioning repo solely for version chase.
* **Alternatives Considered**: CSS Modules, Styled Components.
* **Consequences**: CSS-first configuration, native Vite plugin integration, and no PostCSS config required. Token system managed via `@theme`. Faster iteration speed.
* **PRD Reference**: §28.1

### **ADR-005: useReducer + Context (No External State Library)**
* **Status**: Accepted
* **Context**: Need to manage application state (financial model, proposals, UI state).
* **Decision**: Use native React `useReducer` and `Context`.
* **Alternatives Considered**: Zustand, Redux Toolkit.
* **Consequences**: Reduces bundle size and third-party dependencies. The app has one primary state tree with clear action types. If context re-render performance becomes a measured issue, this can be reconsidered, but MVP stays native.
* **PRD Reference**: §15.4

### **ADR-006: Recharts for Scenario Chart**
* **Status**: Accepted
* **Context**: Need a charting library for the scenario vs baseline visualization.
* **Decision**: Use `Recharts` (v3.10.1+ for React 19 compatibility).
* **Alternatives Considered**: Victory, Nivo, Chart.js.
* **Consequences**: Recharts meets all requirements for the single required chart. May need a `react-is` package resolution override if using React 19.
* **PRD Reference**: §15.1

### **ADR-007: @tanstack/react-virtual for Performance Lab Only**
* **Status**: Accepted
* **Context**: Need to render a 10,000-row synthetic grid to demonstrate performance capability.
* **Decision**: Use `@tanstack/react-virtual`.
* **Alternatives Considered**: `react-window`, `react-virtuoso`.
* **Consequences**: Used strictly for the synthetic performance grid, not the 11-row financial model grid (where it would be unnecessary overhead). Use `useFlushSync: false` for React 19 compatibility.
* **PRD Reference**: §12.3, §28.1

### **ADR-008: Semantic HTML Table for Model Grid**
* **Status**: Accepted
* **Context**: How to mark up the primary data grid.
* **Decision**: Use real `<table>`, `<tr>`, `<th>`, and `<td>` elements.
* **Alternatives Considered**: `div` layouts with `role="grid"`.
* **Consequences**: Built-in screen reader accessibility without manually implementing the complex ARIA grid specification.
* **PRD Reference**: §29.6

### **ADR-009: Single-Level Undo**
* **Status**: Accepted
* **Context**: Need to allow users to revert the last accepted proposal.
* **Decision**: MVP will support a single-level undo (revert latest transaction only).
* **Alternatives Considered**: Multi-level undo history.
* **Consequences**: Simpler state management, clearer UX. Multi-level undo would require unbounded snapshot storage which is out of scope for the MVP.
* **PRD Reference**: §8.5

### **ADR-010: Snapshot-Based Undo (Not Inverse Operations)**
* **Status**: Accepted
* **Context**: How to implement the undo functionality.
* **Decision**: Store the full previous assumptions snapshot in a `TransactionRecord`.
* **Alternatives Considered**: Computing inverse mathematical operations.
* **Consequences**: More reliable than inverse operations which could diverge due to floating-point rounding. Memory cost is negligible for a 24-month, 11-row model.

### **ADR-011: Enter as Primary Edit Gesture**
* **Status**: Accepted
* **Context**: How users initiate editing on a grid cell.
* **Decision**: `Enter` key is the primary edit gesture for keyboard navigation.
* **Alternatives Considered**: Double-click (supported for mouse), `F2` (deferred to P1).
* **Consequences**: Provides one consistent standard gesture for data entry accessibility.
* **PRD Reference**: §29.6

### **ADR-012: Direct Value Editing for Proposal Operations**
* **Status**: Accepted
* **Context**: How users define changes in a proposal.
* **Decision**: Users type the new absolute value.
* **Alternatives Considered**: Delta adjustments (e.g., +50, -10%).
* **Consequences**: Simpler to validate, parse, and display. Reduces ambiguity during review.

### **ADR-013: Vercel for Deployment (provisional)**
* **Status**: Provisional recommendation pending Phase 0 and explicit approval.
* **Context**: Need a hosting platform for the SPA.
* **Decision**: Recommend Vercel; do not deploy during reconnaissance; confirm after repository/CI inspection and user approval.
* **Alternatives Considered**: Netlify, GitHub Pages.
* **Consequences**: Zero-config deployment for Vite static sites; must not occur during Phase 0 or unapproved.

### **ADR-014: Monotonic Revision Token Design**
* **Status**: Accepted
* **Context**: Need to ensure stale proposals cannot be accepted if the underlying model changes.
* **Decision**: Use a simple integer increment revision token that never rolls backward (even on undo).
* **Alternatives Considered**: Hashing the model state.
* **Consequences**: Prevents false resurrection of stale proposals if a new model state accidentally matches an old one. Extremely simple to implement.
* **PRD Reference**: §6.8

---

## 2. Unresolved Questions Requiring Approval (Do Not Approve Silently)

The following uncertainties remain **provisional** until the user provides explicit approval. They are not settled by this plan.

**Check list for user approval — required before implementation proceeds:**
- [ ] **UQ-001 Tab Order for Grid Cells:** Recommendation (Tab skips calculated cells) is provisional.
- [ ] **UQ-002 Reset Behavior When Proposal Is Pending:** Recommendation (Reset clears pending proposal) is provisional.
- [ ] **UQ-003 Proposal Edit — Can User Change Which Cells Are Affected?:** Recommendation (only edit values, not add/remove operations) is provisional.
- [ ] **UQ-004 Chart Y-Axis Scale:** Recommendation (auto-scale per metric) is provisional.
- [ ] **UQ-005 History Panel Location:** Recommendation (History tab + compact indicator on Model page) is provisional.

> **Instruction:** These must not be silently marked approved. If the user accepts a recommendation, update the checklist above and record the approval in `DECISIONS_AND_RISKS.md` with a timestamp/initials. Until then, implementations that touch tab order, reset logic, proposal operation sets, chart scaling, or history placement must remain flexible or ask at execution time.

### UQ-001 through UQ-005 (detailed — kept provisional)

**UQ-001: Tab Order for Grid Cells**
* **Ambiguity**: PRD says "Tab and Shift+Tab follow a logical order through editable cells." Does Tab skip calculated cells and go only through editable assumption cells?
* **Recommendation**: Yes, Tab skips calculated cells to speed up data entry.
* **Status**: **Requires user approval — provisional**. Do not implement final tab logic without approval.

**UQ-002: Reset Behavior When Proposal Is Pending**
* **Ambiguity**: PRD §14 item 14 states "confirmation explains that the working model and pending proposal state will reset." Does Reset also clear a pending proposal in progress?
* **Recommendation**: Yes, Reset should clear everything, including any unaccepted pending proposal state.
* **Status**: **Requires user approval — provisional**.

**UQ-003: Proposal Edit — Can User Change Which Cells Are Affected?**
* **Ambiguity**: PRD §6.9 says operations can be edited but doesn't specify whether users can add/remove cells.
* **Recommendation**: Users can only edit the values of existing operations, not add/remove.
* **Status**: **Requires user approval — provisional**.

**UQ-004: Chart Y-Axis Scale**
* **Ambiguity**: PRD doesn't specify auto-scale vs fixed scale across metrics.
* **Recommendation**: Auto-scaling per metric for readability.
* **Status**: **Requires user approval — provisional**.

**UQ-005: History Panel Location**
* **Ambiguity**: PRD §7.1 allows history on Model page if simpler; must have obvious inspectability.
* **Recommendation**: Full log in "History" tab + compact latest-change indicator on Model page.
* **Status**: **Requires user approval — provisional**.

---

## 3. Prioritized Risk Register

| Risk ID | Title | Likelihood | Impact | What Could Go Wrong | Detection Method | Mitigation | Blocks Impl? |
|---------|-------|------------|--------|---------------------|------------------|------------|--------------|
| **RISK-001** | Scope creep | High | Medium | Building too much spreadsheet functionality; scope expands and key story gets buried. | Project phase tracking; task lists extending beyond PRD. | Stick strictly to 11x24 finance grid; use a separate synthetic performance grid. | No |
| **RISK-002** | Proposal mutates model before acceptance | Low | High | Violates core trust proposition if working model changes before explicit approval. | Testing Reject and pending-review invariants. | Keep preview calculations on a strictly cloned snapshot in state. | No |
| **RISK-003** | Duplicate formulas in UI vs engine | Medium | High | Values diverge across grid, chart, and trace displays. | Visual mismatches; automated calculation tests failing. | Domain engine exclusively owns formulas; UI only consumes typed outputs. | No |
| **RISK-004** | Stale proposal accidentally accepted | Low | High | Demonstrates unsafe state handling and race conditions. | Checking revision tokens in tests. | Monotonic revision guard checked at the acceptance boundary. | No |
| **RISK-005** | Undo partially reverses multi-cell proposal | Low | High | Breaks atomicity and user confidence in system reliability. | Integration tests for full state restoration. | Group operations into one transaction per proposal; snapshot-based undo. | No |
| **RISK-006** | Trace disconnected from calculations | Medium | High | Trace becomes a pretty description rather than a source of truth, undermining trust. | Testing every reference path. | Derive trace edges directly from actual calculation definitions. | No |
| **RISK-007** | Misleading benchmark | Medium | High | Weakens credibility if performance claims are easily disproven. | Code review of benchmarking logic. | Define clear metrics, separate dataset preparation from render time, report p50/p95. | No |
| **RISK-008** | App imitates Drivetrain too closely | Low | High | Creates affiliation or IP confusion. | Visual comparison with actual product. | Use original design, synthetic data, no brand mimicry, and a clear disclaimer. | No |
| **RISK-009** | Historical reviews treated as current flaws | Low | High | Inaccurate representation of target company is reputationally poor. | PRD review. | State clearly they were historical public feedback used only as context. | No |
| **RISK-010** | AI-generated code hides broken invariant | Medium | High | Demo fails silently under scrutiny or review. | Code verification and test coverage. | Human manually verifies math, atomicity, trace, and undo logic. | No |
| **RISK-011** | shadcn/ui + Tailwind v4 setup issues | Medium | Medium | CSS conflicts or build errors due to v4 native Vite integration. | Build failure or visual regression. | Follow strictly to official v4 upgrade docs and test components early. | No |
| **RISK-012** | Recharts react-is version conflict | Medium | Low | React 19 incompatibilities causing warnings or crashes. | Console warnings during development. | Apply `react-is` overrides in `package.json` if needed. | No |
| **RISK-013** | Grid keyboard handling too complex | Medium | High | Custom grid navigation becomes buggy or inaccessible. | Manual keyboard testing (Tab, Enter, Arrows). | Keep rules simple (Tab skips non-editable cells) and rely on semantic HTML. | No |
| **RISK-014** | Performance timing unreliability | Medium | Medium | React 19 batched rendering masks true layout time. | Reviewing metric distribution across runs. | Use standard `performance.now()` wrapper and run multiple iterations. | No |
| **RISK-015** | Accessibility gaps discovered late | Medium | Medium | Missing key ARIA roles or focus states. | Lighthouse / axe-core audits. | Build with native `table` and Radix primitives from day 1. | No |

---

## 4. Assumptions Log

1. **State Persistence**: The application does not require persistent backend storage (database). All state (models, proposals, history) lives in memory during the session or in `localStorage` at most. A page refresh resetting state is acceptable unless specified otherwise.
2. **Tailwind v4 Vite Plugin**: We assume the new Tailwind CSS v4 Vite plugin works reliably with standard React setups without requiring legacy PostCSS configurations.
3. **Desktop-First Layout**: Given the 11x24 data grid, we assume the primary target platform for this prototype is desktop web. Mobile responsiveness is best-effort but not the primary focus for the grid interactions.
4. **Vercel Deployment**: Vercel's standard build environment (Node.js 20+) and zero-config static hosting is sufficient for this Vite React SPA.
5. **Chart Readability**: We assume plotting a single scenario versus the baseline on the chart is sufficient. Plotting multiple scenarios simultaneously is out of scope for the MVP.
6. **No Authentication**: The prototype is a public-facing portfolio piece. No authentication or user roles (e.g., admin vs viewer) are required.
7. **Number Formatting**: Standard USD currency formatting and percentages with 1 or 2 decimal places will cover all data types in the 11-row model. No complex internationalization (i18n) of number formats is required.