# UI Specification: Model Change Review Lab

This document provides a comprehensive UI specification for the Model Change Review Lab prototype, based on the PRD sections 7, 13, and 29.

## 1. Design System

### 1.1 Visual Direction
The interface uses a restrained, high-quality software-tool aesthetic appropriate for a technical/finance workflow (per PRD §13.1 and §29.1).
- **Aesthetic:** Neutral canvas, strong typography hierarchy, restrained accent color.
- **Structural:** Fine borders and generous alignment (avoiding over-carded designs).
- **Density:** Compact but legible numerical density.
- **Brand Policy:** No Drivetrain branding, logos, copied visuals, or proprietary elements.

### 1.2 Design Tokens (`src/index.css`)
All design tokens adhere to PRD §29.2:

**Colors:**
- **Canvas/Background:** neutral-50
- **Surface:** white
- **Elevated surface:** white with subtle shadow
- **Border:** neutral-200, subtle border: neutral-100
- **Primary text:** neutral-900
- **Secondary text:** neutral-600
- **Muted:** neutral-400
- **Primary action:** blue-600
- **Focus ring:** blue-500 (2px outline offset)
- **Selected:** blue-50 bg
- **Info:** blue-600
- **Success:** green-600
- **Warning:** amber-600
- **Error:** red-600

**Semantic Model Colors:**
*Note: Always pair with text/icon, never color-only.*
- **Editable assumption cell:** subtle blue-50 bg
- **Calculated output cell:** neutral bg (no edit affordance)
- **Pending proposal:** amber-50 bg with amber border
- **Accepted change:** green-50 bg briefly
- **Rejected state:** neutral (no change)
- **Stale proposal:** red-50 bg with red border + warning icon
- **Negative cash warning:** red text + warning icon

**Typography:**
- **Product title:** 20px semibold
- **Section title:** 16px semibold
- **Body:** 14px regular
- **Caption/metadata:** 12px regular
- **Numeric/table value:** 14px tabular-nums mono
- **Compact metadata:** 11px regular

**Spacing Scale:** 4, 8, 12, 16, 20, 24, 32, 48, 64px

**Layout Elements:**
- **Header height:** 56px
- **Grid row height:** 36px
- **Sticky header height:** 40px
- **Side panel width:** 360px (desktop)
- **Page max-width:** 1400px
- **Mobile breakpoint:** 768px

## 2. Screen Specifications

### 2.1 Application Shell
- **Header:** Contains the product title ("Model Change Review Lab"), a visible status disclosure badge ("Independent prototype · Synthetic data"), primary tabs, and undo/reset scenario buttons.
- **Tab Navigation:** Model | Scenario Compare | History | Performance Lab
- **Responsive:** Tabs stack or collapse into a dropdown on mobile viewports.

**Wireframe layout (Desktop):**
```text
+-------------------------------------------------------------------------------+
| [Title] [Disclosure Badge]       [Tabs: Model|Compare|History|Perf]   [Undo][Reset]|
+-------------------------------------------------------------------------------+
|                                                                               |
|  (Main Content Area - Max-width 1400px)                                       |
|                                                                               |
+-------------------------------------------------------------------------------+
```

### 2.2 Model Screen
The primary desktop view prioritizes the core planning grid and the proposal workflow.

**Layout Hierarchy (Top to Bottom):**
1. **Header + Navigation:** App shell header.
2. **Summary Strip:** 3-4 key metrics for M24 (e.g., Revenue, EBITDA, Ending Cash) showing working vs baseline deltas.
3. **Proposal Selector:** Toolbar with 3 preset intent buttons and a clarifying "Simulated AI proposal" label.
4. **Proposal Review Panel (Conditional):** Appears below the toolbar when a proposal is generated.
5. **Model Settings Row:** Compact area showing editable 'Starting Revenue' and 'Starting Cash'.
6. **Planning Grid:** The primary table UI consisting of 5 assumption rows + 6 calculated rows spanning 24 columns.
7. **Trace Panel (Conditional):** A right-side drawer (desktop) or bottom sheet (mobile) that opens when a derived output is clicked.

### 2.3 Planning Grid Detail
- **Column Structure:** Sticky Row Label (~200px) | M01 (~100px) | M02 | ... | M24
- **Row Groups:**
  - **"ASSUMPTIONS"** (Header row)
    - Revenue growth (%), Engineering FTE, Other FTE, Cost per FTE ($), Other OpEx ($)
  - **"CALCULATED"** (Header row/separator)
    - Revenue ($), Total FTE, Payroll ($), Total OpEx ($), EBITDA ($), Ending Cash ($)
- **Time Headers:** Displayed logically as Year/Quarter (e.g., Y1 Q1 above M01-M03).

### 2.4 Proposal Review Panel
(Per PRD §7.5 and §29.7)
- **Source Label:** "Simulated AI proposal" with the intent.
- **Summary:** Human-readable diff scope summary.
- **Change List:** Row/period, current vs proposed value, absolute/percentage delta.
- **Impact Preview:** Downstream preview metrics computed deterministically.
- **Revision Indicator:** States the base model revision.
- **Actions:** Accept (primary), Edit, Reject (destructive).
- **Stale Guard:** Visible warning if the base model has advanced, disabling "Accept".

### 2.5 Trace Panel
(Per PRD §7.7 and §29.8)
- Displays the selected metric, period, and formatted value.
- Shows the plain-text formula.
- Lists direct input assumptions / upstream dependencies with current values.
- Differentiates strictly between assumption inputs and derived metrics.
- Provides an accessible way to close or change the selection.

### 2.6 Scenario Comparison Screen
(Per PRD §7.8 and §29.9)
- **Selector:** Dropdown to pick metric (Revenue, EBITDA, or Ending Cash).
- **Chart:** One accessible line chart (Recharts) plotting baseline vs working scenario (M01-M24).
- **Data Table:** Accompanies the chart, showing baseline, working, absolute delta, and percentage delta.

### 2.7 Change History Screen
(Per PRD §7.9)
- Chronological list of committed transactions (newest first).
- Items specify "Accepted proposal" or "Manual cell edit" alongside a before/after summary.
- Interacts closely with the application-level Undo action.

### 2.8 Performance Lab Screen
(Per PRD §7.10 and §29.10)
- Clearly labeled as a synthetic UI rendering benchmark.
- Uses a distinct 10,000-row × 24-column virtualized grid (`@tanstack/react-virtual`).
- Exposes controls to "Run benchmark" and captures metrics for initial render vs interactions.
- Isolated from core finance calculations.

## 3. Component Inventory

| Component Name | Location (Expected) | Variants | Key Props | States (from §29.12) | Accessibility Requirements |
|---|---|---|---|---|---|
| `AppShell` | `src/components/shell/AppShell.tsx` | Default | `children` | Normal, mobile layout | Responsive landmark regions |
| `StatusBadge` | `src/components/ui/StatusBadge.tsx` | info, success, warning, error | `variant`, `label`, `icon` | N/A | High contrast |
| `MetricValue` | `src/components/app/MetricValue.tsx` | default, delta | `value`, `format`, `delta` | Negative/warning metric | Screen reader readable format |
| `Button` (wrapper)| `src/components/ui/Button.tsx` | primary, secondary, destructive, ghost | `variant`, `size`, `disabled` | Default, hover, focus, disabled, pending | Semantic `<button>`, focus ring |
| `EditableAssumptionCell`| `src/components/model/EditableAssumptionCell.tsx`| default | `value`, `rowId`, `period` | Idle, focused, editing, invalid draft, committed, changed-by-proposal, restored | Input `aria-label`, focus visible |
| `CalculatedCell` | `src/components/model/CalculatedCell.tsx` | default, trace-target | `value`, `isNegative` | Idle, selected for trace, changed after commit, negative/warning | Accessible action if selectable |
| `ProposalReviewPanel`| `src/components/proposals/ProposalReviewPanel.tsx` | default, mobile-sheet | `proposalId`, `status` | No proposal, generating, preview ready, edited, accepted, rejected, stale, validation error | Polite live region announcements |
| `SidePanel` / `Sheet`| `src/components/shell/SidePanel.tsx` | right-drawer, bottom-sheet | `isOpen`, `onClose` | Open, closed | Focus lock, Escape to close |
| `HistoryPanel` | `src/components/history/HistoryPanel.tsx` | empty, populated | `transactions` | Empty, populated, newest-first | Semantic chronological list; readable type and before/after summary |
| `ResetDialog` | `src/components/history/ResetDialog.tsx` | confirmation | `open`, `onConfirm`, `onCancel` | Open, closed | Accessible dialog semantics, keyboard focus management, explicit cancel/confirm actions |
| `ScenarioChart` | `src/components/scenario/ScenarioChart.tsx` | default | `metric`, `data` | Loaded, equal, deltas, empty | `aria-label`, data table alternative |

## 4. Interaction States Matrix
(Per PRD §29.12)

- **Assumption cell:**
  - *Idle:* Subtle blue-50 bg, formatted value.
  - *Focused:* 2px blue-500 focus ring.
  - *Editing:* Raw input visible, standard text editing caret.
  - *Invalid draft:* Red border, field-level error message tooltip.
  - *Committed:* Brief green-50 flash, returns to idle.
  - *Changed-by-proposal (Preview):* Amber text/border highlight.
  - *Restored-by-undo:* Brief UI flash indicating data reset.
- **Calculated cell:**
  - *Idle:* Neutral background, tabular numbers.
  - *Selected for trace:* Light blue-50 bg with subtle border.
  - *Changed after commit:* Highlight animation (flash).
  - *Negative/warning:* Red text + warning icon (not an error, just finance warning).
- **Proposal panel:**
  - *No proposal:* Empty state, instructional text.
  - *Generating:* Action buttons disabled, subtle progress indicator.
  - *Preview ready:* Diff table visible, Accept/Reject enabled.
  - *Edited:* Draft state active, Accept button re-validates.
  - *Accepted:* Live region announces success, panel may collapse.
  - *Rejected:* Panel clears, model remains unchanged.
  - *Stale:* Red-50 bg, Warning icon, "Accept" disabled.
  - *Validation error:* Inline error messaging on specific operations.
- **Action button:**
  - *Default:* Brand colors, standard padding.
  - *Hover:* Slightly darkened background.
  - *Focus:* 2px outline offset (blue-500).
  - *Disabled:* Opacity 50%, not focusable, cursor-not-allowed.
  - *Pending:* Spinner icon, text "Processing...".
- **Trace panel:**
  - *No selection:* Empty state guiding user to click an output.
  - *Selected output:* Metric details and formula visible.
  - *Valid deps:* List of clickable input references.
  - *Missing/Error:* "Trace unavailable" state.
- **Scenario chart:**
  - *Loaded:* Lines visible, tooltip active on hover.
  - *Equal baseline:* Single overlapping line or visually minimal delta.
  - *Positive/Negative delta:* Clear divergence using semantic colors safely.
  - *Zero baseline:* Shows "—" in percentage metrics.
  - *Empty:* Placeholder stating no data.
- **Performance Lab:**
  - *Idle:* Initial synthetic grid state.
  - *Running:* Disables interactions, shows measuring status.
  - *Completed:* Stats table populated.
  - *Failed:* "Measurement unavailable" state.
- **Navigation:**
  - *Normal:* Standard text color.
  - *Active:* Bold text, bottom border indicator.
  - *Focus:* Standard focus ring.
  - *Mobile:* Stacked or hamburger menu state.

## 5. Number Formatting Specification
(Per PRD §29.11)
Centralized through `Intl.NumberFormat` (en-US, USD illustrative).
- **Currency:** `$1,234,567.89` (show cents precisely where derived; omit strictly if unnecessary, trace shows exact cents).
- **Integer FTE:** `42` (no decimals allowed).
- **Percentage:** `2.5%` (rendered from 0.025 internal fraction).
- **Delta:** `+$12,345.67` or `-$12,345.67` (explicit signs).
- **Percentage delta:** `+2.3%` or `-2.3%`.
- **Missing/NA/Div-by-zero:** "—" (em dash).
- **Typography:** Applied with CSS `font-variant-numeric: tabular-nums`.
- **Edit mode:** Input fields display raw numerical data (e.g., `750000` instead of `$750,000`).

## 6. Keyboard Interaction Specification
(Per PRD §8.3-8.4, §29.6)
- **Arrow keys:** Move focus between cells when not editing. If editing, behaves as standard text caret movement without committing.
- **Enter (or F2):** Begins editing an assumption cell. While editing, pressing Enter validates and commits the value.
- **Escape:** Cancels an active edit, restoring the cell to its original un-mutated canonical state.
- **Tab / Shift+Tab:** Moves through editable inputs and interactive controls logically. Does not get trapped in the grid.
- **Space / Enter (on derived cells):** Opens the Trace Panel for that calculated cell.
- Focus rings MUST be visible for all keyboard navigations.

## 7. Responsive Behavior
(Per PRD §13.2, §29.5)
- **Wide (>1200px):** Full expanded layout. Trace panel opens as a persistent right-side drawer. Grid fully visible or gently scrolling.
- **Medium (768-1200px):** Horizontal grid scroll is enabled. Summary controls and toolbar stack vertically.
- **Mobile (<768px):** Panels (Proposal, Trace) become bottom sheets or stack sequentially above/below the main grid. Grid maintains horizontal scrolling (24 columns do not shrink to unreadable widths). No page-level horizontal overflow.

## 8. Accessibility Requirements
(Per PRD §13.3, §29.6)
- **Standard:** WCAG 2.2 AA target.
- **Focus Management:** Visible focus rings on all interactive elements. Returning focus safely after closing dialogs/panels.
- **Color Independence:** State changes (invalid, delta, stale) use icons or text alongside color.
- **Aria Labels:** Editable cells must have labels combining row name, period, and unit (e.g., "Engineering FTE, Month 07").
- **Error Association:** Feedback tied to inputs via `aria-describedby`.
- **Live Regions:** Status changes like "Proposal Accepted" or "Validation Failed" announce via polite `aria-live` regions.
- **Charts:** Include visually hidden text or explicit data-table alternatives.
- **Motion:** Transitions disabled or quickened if `prefers-reduced-motion` is active.

## 9. Empty, Loading, and Error States

### Grid / Model Screen
- **Empty:** N/A (Grid is seeded with deterministic data on load).
- **Loading:** N/A (Calculations are synchronous and local).
- **Error:** If grid calculations crash unexpectedly, show full page error boundary with "Reset to defaults" action.

### Proposal Review Panel
- **No data/selection:** "Select a preset to generate a simulated proposal."
- **Generating:** "Generating proposal..." with a spinner (buttons disabled).
- **Error/failure:** "Failed to generate proposal. Please try again." (No partial mutations).
- **Success/completion:** Live region announcement, brief success flash, then updates model state.
- **Stale:** "The model has changed since this proposal was generated." Warning icon, "Accept" disabled.

### Trace Panel
- **No data:** "Click on any calculated output in the grid to trace its formula."
- **Missing trace/error:** "Trace unavailable for this cell." (This should ideally fail tests in CI, but handled gracefully in UI).

### Scenario Comparison
- **No delta:** "Baseline equals working scenario."
- **Zero baseline:** Shows "—" in percentage differences to prevent division-by-zero errors.

### Performance Lab
- **Loading:** Shows deterministic row generation progress (if delayed).
- **Success:** Metrics table renders with real measurements.
- **Error:** "Measurement unavailable" (instead of silently failing with 0ms).