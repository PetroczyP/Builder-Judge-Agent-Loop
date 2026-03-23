# Implementation Tasks — 002-protocol-enforcement

**Spec:** `specs/002-protocol-enforcement/spec.md`
**Design:** `specs/002-protocol-enforcement/design.md`

## Phase 1: Protocol Documentation (defines rules, must come first)

- [X] [T001] Update PROTOCOL.md — Phase Skipping section + status.json schema
  - Add "Phase Skipping" section after "State Guards" with rules, valid/invalid justification examples, 3+-phase threshold
  - Extend status.json code block with `skipped_phases`, `preflight`, `review_context` optional fields
  - Add backwards-compatibility note for legacy tasks
  - File: `src/templates/protocol/PROTOCOL.md`
  - ACs: AC-10 (partial), AC-11

- [X] [T002] Update PROTOCOL.md — CoVe methods + Builder Output Format + Judge Workflow
  - Update CoVe section: add method categorization (external→web search, internal→repo search)
  - Add `### Anti-Pattern Check` section to Builder Output Format
  - Renumber Judge Workflow steps 1→8: add isolation self-check (Step 2), add preflight verification (Step 5) with tiered severity, 3+-phase escalation, CoVe method mismatch check
  - Add review_context to judge's status.json update step
  - File: `src/templates/protocol/PROTOCOL.md`
  - ACs: AC-10 (complete), AC-6 (partial)

## Phase 2: Builder Template (sequential — same file)

- [X] [T003] Add phase-skip guardrails to CREATE mode (Step 2)
  - Allow starting at a later phase with per-phase justification
  - Explicitly list insufficient generic justifications
  - Include valid justification examples
  - Write `skipped_phases` to status.json
  - Conditional spec path: only include if spec exists or specify phase runs
  - File: `src/templates/commands/loop.build.md`
  - ACs: AC-1

- [X] [T004] Add test gate to build phase section (Step 4)
  - Require at least one new test when round introduces new behavior
  - Call out "running only pre-existing tests" as insufficient
  - Add escape hatch for non-behavioral rounds (refactoring, docs, config, templates) with justification requirement in `### Test Evidence`
  - File: `src/templates/commands/loop.build.md`
  - ACs: AC-4

- [X] [T005] Create pre-flight checklist step (NEW Step 5)
  - Absorb existing CoVe step ("Verification step between Step 4 and Step 5")
  - Remove old CoVe section after absorbing
  - Add CoVe method categorization: external→web search, internal→repo search
  - Add mandatory anti-pattern check for all phases
  - Specify CoVe is mandatory for specify/design/build, optional for test/release
  - File: `src/templates/commands/loop.build.md`
  - ACs: AC-2, AC-3

- [X] [T006] Update builder.md template + status.json update + renumber steps
  - Add `### Anti-Pattern Check` section to builder.md round template (Step 6)
  - Add timestamp enforcement with `date -u` example command + prohibit placeholders (Step 7)
  - Add `preflight` flags to status.json update instructions (Step 7)
  - Renumber all steps: 1-7 → 1-8 (per design D-1)
  - Update step headers throughout the file
  - File: `src/templates/commands/loop.build.md`
  - ACs: AC-5, AC-6

## Phase 3: Judge Template + Agent Config (parallelizable)

- [X] [T007] [P] Update loop.review.md — isolation, preflight, review_context, renumber
  - Add isolation self-check as NEW Step 2 (after command parsing, before read context)
  - Add preflight verification as NEW Step 5 (after context management, before review)
  - Preflight checks: CoVe completion (tiered severity), CoVe method correctness (L-severity), anti-pattern check (L-severity), phase-skip justifications (H for generic/3+), legacy task handling
  - Add review_context recording to status.json update step
  - Renumber all steps: 1-7 → 1-9 (per design)
  - File: `src/templates/commands/loop.review.md`
  - ACs: AC-7, AC-8

- [X] [T008] [P] Add `model: inherit` to claude-judge.md frontmatter
  - Add `model: inherit` line to YAML frontmatter
  - File: `src/templates/agents/claude-judge.md`
  - ACs: AC-9

## Phase 4: Verification

- [X] [T009] AC verification pass — confirm all 11 ACs via grep/read
  - AC-1: Grep loop.build.md for phase-skip + justification in CREATE mode
  - AC-2: Grep loop.build.md for pre-flight checklist step
  - AC-3: Grep loop.build.md for "web search" and "repo search" in CoVe
  - AC-4: Grep loop.build.md for test gate in build phase
  - AC-5: Grep loop.build.md for timestamp command example
  - AC-6: Grep loop.build.md + PROTOCOL.md for "Anti-Pattern Check"
  - AC-7: Grep loop.review.md for isolation self-check
  - AC-8: Grep loop.review.md for preflight verification + tiered severity
  - AC-9: Grep claude-judge.md for "model: inherit"
  - AC-10: Grep PROTOCOL.md for phase-skip rules + new schema fields + CoVe methods
  - AC-11: Verify no new required fields in status.json; templates handle missing fields

- [X] [T010] Backwards compatibility verification
  - Confirm all new status.json fields (`skipped_phases`, `preflight`, `review_context`) are documented as optional
  - Confirm no template logic breaks when these fields are absent
  - Grep for any hardcoded reads of new fields that lack fallback handling

## Dependency Graph

```
T001 ─→ T002 ─┐
               ├─→ T003 ─→ T004 ─→ T005 ─→ T006 ─┐
               │                                    ├─→ T009 ─→ T010
               ├─→ T007 ──────────────────────────┤
               └─→ T008 ──────────────────────────┘
```

- T001 → T002: Same file, sequential sections
- T002 → T003/T007/T008: Protocol docs define rules before templates enforce them
- T003 → T004 → T005 → T006: Same file (loop.build.md), sequential sections, renumbering last
- T007 and T008: Different files, parallelizable with each other and with Phase 2
- T009 → T010: Verification after all implementation

## Parallel Execution Opportunities

- **Phase 2 + Phase 3**: T003-T006 (loop.build.md) can run in parallel with T007 (loop.review.md) and T008 (claude-judge.md) — different files, no conflicts
- **T007 + T008**: Always parallelizable (different files)
- **Within Phase 2**: T003-T006 are sequential (same file, edits build on each other)
- **Within Phase 1**: T001-T002 are sequential (same file)

## MVP Scope

All 10 tasks are required for the task's acceptance criteria. No tasks can be deferred — each maps to at least one AC. The smallest meaningful deliverable is the full set.
