# Public Product Observations: Drivetrain Micro Demos & Public Workflow Research

**Inspection Date:** 2026-10-10  
**Inspector:** Model Change Review Lab Architecture Team  
**Requirement Reference:** PRD §27.1, §27.2, §27.3, §33.1 (T-000 Preflight / UI-15)

---

## 1. Scope & Research Objective

This document captures direct observations of Drivetrain's public product demonstrations, marketing materials, and documented capabilities as required by PRD §27.2. 

In accordance with PRD §27.2 and UI-15:
- Observations are strictly separated from hypotheses and interpretations.
- Demos where video playback or deep interactive inspection was not possible via headless/static fetch are honestly recorded as **“title/description inspected; full interaction not verified”**.
- No proprietary assets, logos, or internal implementation details are assumed or copied.
- The prototype remains an independent, synthetic, proof-of-impact project.

---

## 2. Public Demonstration Observations Table

| Source URL & Public Title | Inspection Date | What Was Directly Observed | Interpretation / Hypothesis | Implication for Independent Prototype | What We Explicitly Will Not Copy or Claim |
|---|---|---|---|---|---|
| `https://www.drivetrain.ai/micro-demos`<br/>**Headcount Planning** | 2026-10-10 | Page title and metadata describe short video of how finance teams build headcount forecasts, plan hires, start dates, and salaries. Video element dynamically rendered via Sanity CMS/Next.js; full player interaction not verified headless. | Headcount is modeled by combining individual or grouped roles with salary assumptions and period ramp dates to derive payroll and OpEx. | Our synthetic proposal A (“Hire 2 engineers from Q3”) realistically mirrors how headcount changes impact cost/runway across planning periods. | We will not build HRIS/ATS integrations, employee roster management, real payroll systems, or claim to reproduce Drivetrain's live headcount interface. |
| `https://www.drivetrain.ai/micro-demos`<br/>**Scenario Modeling** | 2026-10-10 | Described as building forecasts and running scenarios in minutes. Public marketing shows side-by-side or comparison views of alternative forecasts against baseline budgets. Video player interaction not verified headless. | Finance teams evaluate distinct scenarios against an immutable baseline or budget, needing variance/delta views across key metrics. | Enforces our dual-scenario model: an immutable `baseline` scenario compared against a mutable `working` scenario with per-period deltas. | We will not build multi-scenario tree management, branching workflows, or claim proprietary scenario algorithms. |
| `https://www.drivetrain.ai/micro-demos`<br/>**Formula Agent / Model Debugging & Explanation** | 2026-10-10 | Publicly highlights “Explain, write, and debug formulas in plain English” and “make sense of models (explain formula + show calculation)”. Direct client-side video player not verified headless. | The platform provides transparency into how derived cells are calculated and which predecessor cells feed into them. | Confirms our Trace Panel design: every calculated cell must deterministically resolve its exact formula label and input dependencies back to source assumptions. | We will not implement LLM-generated explanations, natural language formula parsing, or claim to replicate Drivetrain’s Formula Agent. |
| `https://www.drivetrain.ai/micro-demos`<br/>**Collaborative Planning** | 2026-10-10 | Described as enabling team collaboration on financial models with permissions and shared views. Video player interaction not verified headless. | Enterprise FP&A requires coordination across department heads and finance reviewers, with safeguards against simultaneous overwrites. | Justifies our transaction model, revision counters, and stale-proposal rejection guards (preventing stale proposals from overwriting newer edits). | We will not implement multi-user collaboration, WebSockets, access control lists, user accounts, or real-time presence. |
| `https://www.drivetrain.ai/micro-demos`<br/>**Reporting Agent / Live Dashboards** | 2026-10-10 | Demonstrates automated board-ready reporting, waterfall charts, and KPI visualization directly tied to underlying model metrics. Video player interaction not verified headless. | Visual charts are tightly coupled to tabular financial data and must update reactively when underlying scenario numbers change. | In Phase 5, our Scenario Comparison view pairs a Recharts line chart with a synchronous tabular delta table sharing the identical scenario delta calculations. | We will not build an automated dashboard generator, customizable chart designer, slide export, or PDF automation pipeline. |
| `https://www.drivetrain.ai/drive-ai`<br/>**Drive AI Overview & Model Building** | 2026-10-10 | Public product page details Drive AI agents (Modeling, Scenario, Reporting, Formula, Help) assisting finance teams while emphasizing governed access and deterministic model execution. Video interaction not verified headless. | Drivetrain positions AI as generating proposed logic or scenario parameters, while a separate deterministic calculation engine computes the financial numbers. | Grounds our core architectural separation: the MockProposalProvider generates candidate parameter changes, but human approval is mandatory, and a pure calculation engine executes all numbers. | We will not connect real LLMs/APIs, implement MCP servers, or claim any connection to Drivetrain’s proprietary AI engine. |

---

## 3. Synthesis & Boundary Invariants for the Independent Prototype

1. **Independent Work:** The prototype is entirely independent and synthetic, designed to demonstrate robust frontend software engineering patterns (immutability, determinism, atomic transactions, virtualization, accessibility).
2. **Deterministic Finance Engine:** All financial values are calculated by a pure, testable TypeScript calculation engine. AI does not perform math.
3. **Inspectable Proposals:** Changes are modeled as inspectable, structured `ProposalOperation` sets requiring explicit human review (Accept, Reject, Edit) before committing.
4. **Transparent Lineage:** Calculated outputs can be inspected in a Trace Panel to view exact formula relationships and dependencies.
5. **No Hallucinated Claims:** All public observations recorded above are grounded in verified public page titles and descriptions, noting that headless inspection cannot access interactive video playback.
