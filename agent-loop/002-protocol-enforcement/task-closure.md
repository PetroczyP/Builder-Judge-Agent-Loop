# Task Closure — 002-protocol-enforcement

**Task:** Protocol Enforcement Improvements
**Completed:** 2026-03-22
**Phases:** specify (1 round) → design (3 rounds) → plan (1 round) → build (2 rounds) → test (1 round) → release
**Total rounds:** 10 (across all phases)

## Delivered vs. Planned

| Planned (tasks.md) | Delivered | Notes |
|---------------------|-----------|-------|
| T001: PROTOCOL.md — Phase Skipping + schema | Done | AC-10 (partial), AC-11 |
| T002: PROTOCOL.md — CoVe methods + Builder Output + Judge Workflow | Done | AC-10, AC-6 (partial) |
| T003: loop.build.md — phase-skip guardrails | Done | AC-1 |
| T004: loop.build.md — test gate | Done | AC-4 |
| T005: loop.build.md — pre-flight checklist | Done | AC-2, AC-3 |
| T006: loop.build.md — builder.md template + status.json + renumber | Done | AC-5, AC-6 |
| T007: loop.review.md — isolation, preflight, review_context, renumber | Done | AC-7, AC-8 |
| T008: claude-judge.md — `model: inherit` | Done | AC-9 |
| T009: AC verification pass | Done | All 11 ACs |
| T010: Backwards compatibility verification | Done | AC-11 |

**Completion: 10/10 tasks (100%)**

No tasks added, removed, or redefined during implementation.

## Acceptance Criteria Results

| AC | Status | Evidence |
|----|--------|----------|
| AC-1 | pass | Test: "CREATE mode includes phase-skip guardrails" |
| AC-2 | pass | Test: "pre-flight checklist step before builder.md writing" |
| AC-3 | pass | Test: "CoVe distinguishes external from internal" |
| AC-4 | pass | Test: "build phase includes test gate with escape hatch" |
| AC-5 | pass | Test: "timestamp enforcement with example command" |
| AC-6 | pass | Tests: "Anti-Pattern Check section" in loop.build.md and PROTOCOL.md |
| AC-7 | pass | Test: "isolation self-check as first step after command parsing" |
| AC-8 | pass | Tests: preflight verification with tiered severity, CoVe method correctness, phase-skip justifications |
| AC-9 | pass | Test: "model: inherit in frontmatter" |
| AC-10 | pass | Tests: Phase Skipping rules, extended schema, CoVe methods, Builder Output Format, Judge Workflow |
| AC-11 | pass | Test: "all new fields are documented as optional" |

**Result: 11/11 ACs pass**

## Test Summary

```
65 tests, 65 pass, 0 fail

Breakdown:
- 41 pre-existing tests (unchanged, all pass)
- 24 new protocol-enforcement tests:
  - 6 loop.build.md tests (AC-1 through AC-6)
  - 6 loop.review.md tests (AC-7, AC-8)
  - 1 claude-judge.md test (AC-9)
  - 6 PROTOCOL.md tests (AC-10, AC-11)
  - 5 cross-document consistency tests
```

## Files Changed

| File | Nature |
|------|--------|
| `src/templates/protocol/PROTOCOL.md` | Phase Skipping section, extended status.json schema, CoVe methods, Anti-Pattern Check in Builder Output Format, Judge Workflow updates |
| `src/templates/commands/loop.build.md` | Phase-skip guardrails, test gate, pre-flight checklist, Anti-Pattern Check, timestamp enforcement, step renumbering |
| `src/templates/commands/loop.review.md` | Isolation self-check, preflight verification, review_context, step renumbering |
| `src/templates/agents/claude-judge.md` | `model: inherit` in frontmatter |
| `src/cli/scaffold.test.js` | 24 new tests |

No JavaScript source code changes. Template-only enforcement.

## Known Limitations

- **Template-only enforcement**: All changes are advisory markdown instructions. No programmatic validation that agents follow the templates. This is by design (non-goal in spec).
- **Isolation self-check is best-effort**: The `context: fork` detection heuristic catches the most common misuse (pasting instructions into active session) but cannot prevent all forms of context sharing.
- **Legacy task compatibility**: Tasks created before this change work fine but don't get preflight verification benefits. The judge evaluates them on content merits.

## Deviations from Plan

None at the spec level — all 11 ACs delivered as specified. Two mid-phase corrections were made in response to judge findings but did not change the accepted spec:

- **Build phase (H-1)**: Initial `loop.build.md` Step 5 bundled CoVe and anti-pattern check under a single optional-for-test/release scope. Fixed in build Round 2 by splitting the scope so the anti-pattern check remains mandatory on every phase while CoVe stays optional only for test/release.
- **Design phase (3 rounds)**: Required two follow-up rounds to explicitly carry the 3+-phase-skip H-severity rule (R1 H-1) and the CoVe method-mismatch L-severity check (R2 M-1) from the spec into the judge-side enforcement path.

## Key Decisions Made

From spec/design phase summaries (see `builder-archive.md`):

- **D-1 (scope)**: Template-only changes in 4 files under `src/templates/`; no runtime behavior changes
- **D-2 (phase skipping)**: Allowed with per-phase justification; 3+ skips trigger H-severity finding
- **D-3 (CoVe)**: Categorize claims as external (web search) vs internal (repo search); judge flags method mismatches as L
- **D-4 (severity tiers)**: H for missing mandatory CoVe / 3+-phase skips; L for antipatterns and method mismatches
- **D-5 (isolation)**: Judge isolation via `context: fork` self-check (best-effort safety net)
- **D-6 (judge parity)**: `model: inherit` in `claude-judge.md` frontmatter for capability parity
- **D-7 (backwards compat)**: All new `status.json` fields (`skipped_phases`, `preflight`, `review_context`) optional; legacy tasks evaluated on content merits
- **D-2 (design)**: Pre-flight as standalone Step 5 — root cause fix for CoVe skipping (the misleading heading, not agent laziness)
- **D-7 (design)**: Test gate with escape hatch for non-behavioral rounds (template-only changes qualify)
- **D-8 (design)**: Phase-skip guardrails apply in CREATE mode only; ADVANCE mode is sequential by definition

## Anti-Patterns Encountered

Four instances across the task lifecycle, all resolved before final acceptance:

- **AP-002 (Cross-Document Contradiction) — design R1**: Added `### Anti-Pattern Check` to builder template but omitted from PROTOCOL.md change map. Resolved in R2.
- **AP-002 (Cross-Document Contradiction) — design R2**: CoVe method-mismatch check added on builder side but missing from judge-side preflight enforcement. Resolved in R3.
- **AP-002 (Cross-Document Contradiction) — build R1**: Builder and judge templates disagreed about whether anti-pattern check was mandatory in test/release phases. Resolved in R2 by splitting preflight scope.
- **AP-001 (Unverified Verification) — release R1**: Builder claimed "release round includes Verification section" when none existed. Self-caught and corrected in R2.

No new anti-patterns were added to `ANTIPATTERNS.md` during this task — all encounters were existing patterns successfully caught by the check.

## Backlog Leftovers

- Backlog item #13 (upgrade experience) is directly related: existing users need to run `upgrade` to get the updated templates. Already tracked, no new items needed.

## Deferred Items

None. All scope delivered as specified.
