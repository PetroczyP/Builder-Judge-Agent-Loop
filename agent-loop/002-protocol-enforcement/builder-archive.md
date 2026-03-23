# Builder Archive — 002-protocol-enforcement

## Phase Summaries
<!-- Agents read this section every round -->

### [specify] Phase Summary (round 1, accepted)

#### Key Decisions
- D-1: Scope limited to template-only changes in 4 files under `src/templates/`
- D-2: Phase skipping allowed with per-phase justification (not blanket approval)
- D-3: CoVe verification distinguishes external (web search) vs internal (repo search) claims
- D-4: Judge preflight verification with tiered severity (H for missing mandatory CoVe, L for antipatterns)
- D-5: Judge isolation via `context: fork` self-check (best-effort safety net)
- D-6: `model: inherit` in claude-judge.md for capability parity
- D-7: All new status.json fields optional for backwards compatibility

#### Findings Resolved
- None (accepted in round 1)

#### Artifacts Produced
- `specs/002-protocol-enforcement/spec.md` — full feature spec with 10 user scenarios, 9 functional requirements, status.json schema extension, edge cases

#### Deferred / Out of Scope
- None

### [design] Phase Summary (rounds 1-3, accepted)

#### Key Decisions
- D-1: Clean step renumbering (sequential 1-8, not sub-steps) — agents skip sub-steps
- D-2: Pre-flight as standalone Step 5 — root fix for CoVe skipping (misleading heading was the cause)
- D-3: CoVe method categorization: external→web search, internal→repo search
- D-4: Tiered severity: H for missing CoVe on mandatory phases, L on optional; L for method mismatches
- D-5: Isolation detection best-effort via `context: fork` clean-slate check
- D-6: `model: inherit` explicit despite being default — intent documentation + greppable
- D-7: Test gate with escape hatch for non-behavioral rounds
- D-8: Phase-skip in CREATE mode only (ADVANCE is sequential by definition)
- D-9: Legacy graceful handling — missing fields = evaluate on content merits
- D-10: Preflight evidence in builder.md + flags in status.json — judge cross-references both

#### Findings Resolved
- H-1: 3+-phase-skip escalation rule missing from design → added to loop.review.md preflight and PROTOCOL.md change maps
- M-1 (R1): Builder Output Format in PROTOCOL.md missing `### Anti-Pattern Check` → added to change map with sync note
- M-1 (R2): CoVe method mismatch check missing from judge-side preflight → added as item 2 in preflight verification

#### Artifacts Produced
- `specs/002-protocol-enforcement/design.md` — full technical design with 10 decisions, change maps for 4 files, status.json schema, step renumbering tables

#### Deferred / Out of Scope
- PROTOCOL.md judge workflow kept intentionally compact (no separate "review and evaluate" step) — operational detail stays in loop.review.md

### [plan] Phase Summary (round 1, accepted)

#### Key Decisions
- 10 tasks across 4 phases: Protocol docs → Builder template → Judge template + agent config → Verification
- Phase 2 (loop.build.md) ∥ Phase 3 (loop.review.md, claude-judge.md) — parallelizable
- No TDD: template-only changes invoke escape hatch (D-7); verification via grep/read checks
- All 10 tasks required — no deferrable items, each maps to at least one AC

#### Findings Resolved
- None (accepted in round 1)

#### Artifacts Produced
- `agent-loop/002-protocol-enforcement/tasks.md` — 10 ordered tasks with dependency graph, parallel opportunities, AC coverage

#### Deferred / Out of Scope
- None

### [build] Phase Summary (rounds 1-2, accepted)

#### Key Decisions
- All 10 tasks (T001-T010) implemented across 4 template files in Round 1
- Build-phase test gate escape hatch used: template-only markdown changes, no executable code (per D-7)

#### Findings Resolved
- H-1 (AP-002): Builder-side preflight scope statement bundled CoVe and anti-pattern check together, making anti-pattern check optional for test/release contrary to spec → split into separate scope bullets

#### Artifacts Produced
- `src/templates/protocol/PROTOCOL.md` — Phase Skipping section, extended status.json schema, CoVe methods, Anti-Pattern Check in Builder Output Format, Judge Workflow with isolation self-check and preflight verification
- `src/templates/commands/loop.build.md` — Phase-skip guardrails, test gate, pre-flight checklist (Step 5), Anti-Pattern Check, timestamp enforcement
- `src/templates/commands/loop.review.md` — Isolation self-check (Step 2), preflight verification (Step 5), review_context
- `src/templates/agents/claude-judge.md` — `model: inherit` in frontmatter

#### Deferred / Out of Scope
- None

### [test] Phase Summary (round 1, accepted)

#### Key Decisions
- 24 new tests added to `src/cli/scaffold.test.js` covering all 11 ACs and cross-document consistency
- No linting configured (no eslint/prettier in package.json) — noted, not blocked

#### Findings Resolved
- L-1: builder.md test round set `cove_completed: true` but omitted `### Verification` section. CoVe optional for test phase; low severity, noted by judge but not blocking.

#### Artifacts Produced
- 24 new tests in `src/cli/scaffold.test.js` (6 loop.build.md, 6 loop.review.md, 1 claude-judge.md, 6 PROTOCOL.md, 5 cross-document consistency)

#### Deferred / Out of Scope
- None

---

## Raw Archived Rounds
<!-- Agents read this section only when tracing specific findings or decisions -->

### [test] Round 1 — builder

#### Summary
- Ran full test suite: 41/41 existing tests pass
- Added 24 new tests covering all 11 ACs and cross-document consistency
- Full suite: 65/65 pass, 0 fail
- All acceptance criteria verified with evidence

#### Anti-Pattern Check
- AP-001 (Unverified Verification): Not violated — CoVe optional for test phase; all AC claims backed by actual test results
- AP-002 (Cross-Document Contradiction): Not violated — 5 cross-document consistency tests confirm alignment
- AP-003 (Scope Creep Silence): Not violated — tests added to existing test file, within scope
- AP-005 (Incremental Fix, New Inconsistency): N/A — Round 1 of test phase
- AP-007 (Task Redefinition): Not violated — no edits to task definitions

### [build] Round 1 — builder

#### Summary
- Implemented all 10 tasks (T001-T010) across 4 files
- All tasks marked complete in tasks.md
- All 11 acceptance criteria verified via grep/read checks (T009)
- Backwards compatibility confirmed — all new fields optional with legacy handling (T010)

#### Verification
- Checked: `model: inherit` valid — web search (external claim, confirmed in judge-archive.md round 2)
- Checked: Anti-Pattern Check consistency across PROTOCOL.md and loop.build.md — repo search (Grep)
- Checked: Step numbering in all 3 files — repo search (Grep), confirmed sequential
- Checked: Preflight verification consistency — repo search (Grep), identical 5-item list
- Corrections: None

### [build] Round 2 — builder

#### Summary
- Fixed H-1 (AP-002): Split preflight scope statement in loop.build.md Step 5
- CoVe remains optional for test/release, anti-pattern check now explicitly mandatory on every phase

#### Verification
- Checked: All three template files agree on anti-pattern check scope — repo search (Grep)
- Corrections: None

### [plan] Round 1 — builder

#### Summary
- Generated 10 ordered implementation tasks in `agent-loop/002-protocol-enforcement/tasks.md`
- 4 phases, 2 parallel opportunities, all ACs mapped
- No TDD — template-only changes, escape hatch per D-7

#### Verification
- Checked: task.md AC list (11 items) — Read task.md, confirmed all mapped
- Checked: design.md change map — Read design.md, confirmed all change map rows covered
- Checked: Dependency ordering — renumbering (T006) must be last within loop.build.md
- Corrections: None

### [design] Round 1 — builder

#### Summary
- Created technical design document at `specs/002-protocol-enforcement/design.md`
- 10 design decisions documented with rationale (D-1 through D-10)
- Detailed change map for all 4 template files with step renumbering tables

#### Verification
- Checked: `model: inherit` valid — Web search confirmed
- Checked: `context: fork` creates blank context — Web search confirmed
- Checked: No existing code references new status.json fields — Grep confirmed
- Corrections: None

### [design] Round 2 — builder

#### Summary
- Addressed H-1 (3+-phase threshold) and M-1 (Builder Output Format in PROTOCOL.md)
- Updated design.md change maps for both loop.review.md and PROTOCOL.md

### [design] Round 3 — builder

#### Summary
- Addressed M-1 (CoVe method mismatch on judge side)
- Added item 2 "CoVe method correctness" to judge preflight verification
- Updated PROTOCOL.md Judge Workflow row

---

### [specify] Round 1 — builder

#### Summary
- Spec written at `specs/002-protocol-enforcement/spec.md` based on colleague field-test feedback
- 10 user scenarios (S1-S10), 9 functional requirements (FR1-FR9)

#### Verification
- Checked: ANTIPATTERNS.md missing from loop.build.md — Grep confirmed
- Checked: `context: fork` behavior — Web search confirmed
- Checked: `date -u` cross-platform — Bash test confirmed
- Corrections: Fixed CoVe position description
