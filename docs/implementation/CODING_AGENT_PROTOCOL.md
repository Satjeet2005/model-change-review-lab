# Coding Agent Protocol

This document defines the strict operating protocol for coding agents executing tasks in the Model Change Review Lab project. Follow these instructions precisely for every implementation phase.

## 1. Agent Contract

Prepend this contract to every implementation prompt.

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
11. All financial formatting centralized in `src/domain/formatting.ts` per PRD §28.1 (`Intl.NumberFormat` wrapped in domain/formatting.ts). Format logic is domain-level (not JSX-owned) and independent of React/browser APIs.

UI and Dependency Extensions:
11. Phase 0 must include product and repository reconnaissance (files, package.json, scripts, UI primitives, etc.). Make no code changes until the reconnaissance summary and implementation plan are reviewed.
12. Do not allow package/version hallucinations: Read lockfile/package manager first. Use official docs. Do not invent/hallucinate versions. Keep versions in lockfile.
13. Build by product slice, not component count: Deliver an end-to-end slice (domain value + test -> UI -> error state -> regression test -> visual polish). Do not generate a whole component catalogue first.
14. Visual review is a required engineering step: Run locally, capture screenshots (for baseline, proposal diff, trace, etc.), inspect alignment/density/responsiveness, and fix issues.
15. Required phase outputs: For every phase, output a concise report containing changed files, delivered behaviors, exact test commands/results, dependencies added, limitations, manual checks, and proof invariants hold.
```

## 2. Task Execution Protocol

Step-by-step protocol for executing ANY task:

1. **Read** — Read the relevant PRD sections and implementation plan section for this phase. Read any referenced requirement IDs.
2. **Inspect** — Check current repository state: `git status`, directory contents, `package.json`, lockfile (identify package manager), available scripts, installed packages, framework versions. Read existing files that will be modified. Run `[package-manager] test` / `[package-manager] typecheck` / `[package-manager] lint` / `[package-manager] build` ONLY when the repository's actual package manager and prerequisites are confirmed; if commands are missing or prerequisites not installed, report unavailable rather than inventing failure. Do not assume `[package-manager]` — use the actual manager from the lockfile.
3. **Plan** — State the intended files to create/modify and the minimal change set. If proposing a new library, architecture change, formula change, or scope expansion → STOP and ask.
4. **Implement** — Write only the approved scope. Write tests alongside implementation.
5. **Verify** — Run `typecheck`, `lint`, `test`, `build` using the repository's verified package manager and only when prerequisites/scripts exist. Report actual observed results (pass / fail / unavailable / not run). Do not claim a command passed if it was not executed.
6. **Diff Review** — Inspect the full diff for unrelated changes, using the checklist.
7. **Report** — List files changed, behaviors implemented, tests run with results, known limitations, remaining work.
8. **Checkpoint** — Commit with a descriptive message. The repo must be in a working state.

## 3. Diff Review Checklist

After each phase, inspect the following:

- [ ] Formulas present only in domain layer?
- [ ] Canonical state never mutated before validated commit?
- [ ] Pending proposal operations don't mutate model values?
- [ ] Rejecting changes no model state?
- [ ] Baseline immutable?
- [ ] Revision/stale guard works through Undo and Reset?
- [ ] No real API/secret/data introduced?
- [ ] No false performance or test claims?
- [ ] No uncontrolled dependency growth?
- [ ] No unrelated files changed?

## 4. When to STOP and Ask

Stop and request human approval before:

- Proposing a new major library
- Changing formula/model semantics
- Adding backend/persistence/AI
- Altering transaction/history rules
- Removing a required feature
- Changing performance measurement definition
- Encountering a requirement conflict
- Missing prerequisite or dependency

## 5. Invariants to Preserve (ALWAYS)

1. Independent work (no Drivetrain affiliation claims)
2. Synthetic data only
3. Mock AI only (deterministic, labeled "Simulated AI proposal")
4. Human approval before applying proposal
5. All changes validated and atomic
6. One source of truth for calculations
7. Deterministic calculations
8. Traceability (no dangling trace edges)
9. Stale proposal safety
10. Measured, not invented, performance
11. Performance harness separate from finance model
12. No premature outreach

## 6. Dependency Rules

- Inspect `package.json` and lockfile first
- Before adding any package, state: capability needed, exact package + docs, why existing deps insufficient, bundle implications, smoke test
- No routine package upgrades unrelated to task
- Don't install competing packages
- Commit lockfile
- Never switch package manager

## 7. Code Style Rules

- Domain layer: zero React/browser imports
- All financial formatting through `src/domain/formatting.ts`; domain layer contains pure calculation/validation/trace/transaction/formatting logic.
- No formula implementation in React components
- Canonical state mutations only through reducer/dispatcher
- Typed function signatures for all public APIs
- Tests co-located or in `__tests__` directories
- Use semantic HTML where possible

## 8. Commit Rules

- Each phase leaves repo in working state
- Commit message format: `phase-N: brief description`
- Tests must pass before commit
- No WIP commits with broken tests

## 9. Phase Completion Report Template

```markdown
## Phase N Completion Report

### Files Changed
- list of files

### Behaviors Implemented
- list of behaviors

### Tests Added
- list of test files and counts

### Commands Run & Results
| Command | Result |
|---|---|
| [package-manager] typecheck | ✅ Pass |
| [package-manager] lint | ✅ Pass |
| [package-manager] test | ✅ 29/29 pass |
| [package-manager] build | ✅ Success |

### Dependencies Added
- package@version: reason

### Known Limitations
- list

### Remaining Work
- next phase items

### Manual Verification
- what was manually checked

### PRD Invariant Check
- [ ] Domain layer has no React imports
- [ ] No canonical state mutation outside reducer
- [ ] Baseline immutable
- [ ] No real AI/API calls
- [ ] No secrets or real data
```

## 10. Error Recovery

What to do when:

- **Tests fail:** Do not commit. Fix the breaking logic immediately or revert to the last working checkpoint. Check deterministic outputs.
- **Build fails:** Trace the exact error in the compiler output. Ensure types are fully satisfied. Do not bypass the build error.
- **Type errors:** Use TypeScript's explicit errors to guide the fix. Do not use `any` to bypass domain type contracts.
- **Dependency conflicts:** Check lockfile and package manager rules. Revert the newly added package rather than tearing down existing working packages.
- **Performance targets missed:** Stop and review the latest changes. Measure with the dedicated harness. Do not invent timing numbers. Re-evaluate rendering strategy or algorithmic complexity.