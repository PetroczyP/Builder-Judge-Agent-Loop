# Judge Archive — 002-protocol-enforcement

## Phase Summaries
<!-- Agents read this section every round -->

### [design] Phase Summary (rounds 1-3, accepted)

#### Key Findings
- H-1: Judge preflight omitted the 3+-phase-skip H-severity rule from the accepted spec → resolved in round 2 and confirmed in round 3
- M-1 (R1): PROTOCOL builder output format omitted `### Anti-Pattern Check` despite the template adding it → resolved in round 2
- M-1 (R2): Judge-side preflight omitted the CoVe method-mismatch check required by the spec → resolved in round 3

#### Escalations
- None.

#### Acceptance Criteria Status
- AC-1: pass
- AC-2: pass
- AC-3: pass
- AC-4: pass
- AC-5: pass
- AC-6: pass
- AC-7: pass
- AC-8: pass
- AC-9: pass
- AC-10: pass
- AC-11: pass

#### Verification Notes
- Verified the accepted design now carries the FR6/S4 judge preflight rules for 3+-phase skips and CoVe method mismatches
- Verified PROTOCOL.md change maps now stay aligned with the template-side `### Anti-Pattern Check` requirement
- Verified the optional `skipped_phases`, `preflight`, and `review_context` fields remain backwards-compatible in the accepted design

### [plan] Phase Summary (round 1, accepted)

#### Key Findings
- None.

#### Escalations
- None.

#### Acceptance Criteria Status
- AC-1: pass
- AC-2: pass
- AC-3: pass
- AC-4: pass
- AC-5: pass
- AC-6: pass
- AC-7: pass
- AC-8: pass
- AC-9: pass
- AC-10: pass
- AC-11: pass

#### Verification Notes
- Verified `agent-loop/002-protocol-enforcement/tasks.md` mapped all 11 acceptance criteria across 10 tasks, preserved the accepted design ordering, and targeted valid artifacts under `src/templates/`

### [build] Phase Summary (rounds 1-2, accepted)

#### Key Findings
- H-1 (AP-002): Builder-side preflight guidance bundled CoVe and anti-pattern scope together, incorrectly making the anti-pattern check optional in `test` and `release` despite the accepted spec/design and judge-side enforcement requiring it on every phase → resolved in round 2

#### Escalations
- None.

#### Acceptance Criteria Status
- AC-1: pass
- AC-2: pass
- AC-3: pass
- AC-4: pass
- AC-5: pass
- AC-6: pass
- AC-7: pass
- AC-8: pass
- AC-9: pass
- AC-10: pass
- AC-11: pass

#### Verification Notes
- Verified the Round 2 `loop.build.md` fix split CoVe scope from anti-pattern scope so the anti-pattern check remains mandatory on every phase while CoVe stays optional only for `test` and `release`
- Verified `loop.build.md`, `loop.review.md`, `PROTOCOL.md`, and `claude-judge.md` remained aligned with the accepted spec/design after the build-phase correction

### [test] Phase Summary (round 1, accepted)

#### Key Findings
- L-1: The builder marked `preflight.cove_completed: true` in the test round without a `### Verification` section; accepted as non-blocking because CoVe is optional in `test`, but the inconsistency was explicitly noted for cleanup in the next phase

#### Escalations
- None.

#### Acceptance Criteria Status
- AC-1: pass
- AC-2: pass
- AC-3: pass
- AC-4: pass
- AC-5: pass
- AC-6: pass
- AC-7: pass
- AC-8: pass
- AC-9: pass
- AC-10: pass
- AC-11: pass

#### Verification Notes
- Verified `npm test` passed with 65/65 tests, matching the builder's reported test evidence
- Verified `src/cli/scaffold.test.js` contains the 24 new protocol-enforcement tests covering all 11 acceptance criteria plus cross-document consistency
- Verified the updated template and protocol files matched the new tests after the build-phase preflight-scope fix

---

## Raw Archived Rounds
<!-- Agents read this section only when tracing specific findings or decisions -->

## [design] Archived Rounds

### [design] Round 1 — judge

#### Verdict
needs_revision

#### Blockers
- None.

#### High
- H-1: The design does not carry forward the spec's explicit review rule that skipping 3 or more phases must trigger an H-severity finding with strong justification for each skipped phase. `specs/002-protocol-enforcement/spec.md:117-126` makes this part of FR6, but the design's `loop.review.md` change map only says "Verify builder compliance before content evaluation, tiered severity" (`specs/002-protocol-enforcement/design.md:107-110`) and nowhere captures the 3+-phase threshold or the required stronger review behavior. If implemented as written, the judge can satisfy the generic preflight step while still missing a core phase-skip guardrail from the accepted spec. Add this rule explicitly to the `loop.review.md` design and mirror it in the PROTOCOL update.

#### Medium
- M-1 (AP-002): The design adds `### Anti-Pattern Check` to the builder output in `loop.build.md` (`specs/002-protocol-enforcement/design.md:87-89`), but its `PROTOCOL.md` change map only lists phase skipping, status schema, CoVe categorization, and judge workflow updates (`specs/002-protocol-enforcement/design.md:135-142`). The current protocol Builder Output Format still has no `### Anti-Pattern Check` section (`src/templates/protocol/PROTOCOL.md:348-372`). That leaves the protocol documentation out of sync with the template behavior the task is trying to enforce, and `claude-judge.md` explicitly falls back to the protocol when `/loop.review` is not used (`src/templates/agents/claude-judge.md:43-44`). Update the PROTOCOL builder output format alongside the template change so the documentation stays consistent.

#### Low
- None.

#### Acceptance Check
- AC-1: pass
- AC-2: pass
- AC-3: pass
- AC-4: pass
- AC-5: pass
- AC-6: pass
- AC-7: pass
- AC-8: fail
- AC-9: pass
- AC-10: fail
- AC-11: pass

#### Verification
- Checked: `specs/002-protocol-enforcement/spec.md:117-126` requires preflight verification to validate skipped-phase justifications and to treat 3 or more skipped phases as H-severity.
- Checked: `specs/002-protocol-enforcement/design.md:107-110` only records a generic preflight verification step for `loop.review.md`; the 3+-phase escalation rule is not captured anywhere else in the design artifact.
- Checked: `specs/002-protocol-enforcement/design.md:87-89` adds `### Anti-Pattern Check` to the builder template, while `src/templates/protocol/PROTOCOL.md:348-372` still omits that section from the documented Builder Output Format.
- Checked: `src/templates/agents/claude-judge.md:43-44` routes non-command fallback behavior through `agent-loop/PROTOCOL.md`, so protocol/template drift here is user-visible.
- Corrections: None.

#### Anti-Pattern Check
- AP-002 detected on M-1: the design updates the template-side builder artifact but does not propagate the same requirement into the protocol documentation that defines the fallback workflow.

#### Open Questions
- While addressing M-1, decide whether to also make the PROTOCOL judge workflow explicitly include a "review and evaluate" step so the fallback path stays aligned with `/loop.review`; I did not score that separately because AC-10 does not require it directly.

### [design] Round 2 — judge

#### Verdict
needs_revision

#### Blockers
- None.

#### High
- None.

#### Medium
- M-1 (AP-002): The design still does not preserve the spec's requirement that the judge flag wrong CoVe verification methods as `L` severity. The accepted spec makes that explicit in both the user scenario and FR6 (`specs/002-protocol-enforcement/spec.md:54-59`, `specs/002-protocol-enforcement/spec.md:117-126`), but the Round 2 design's `loop.review.md` preflight breakdown only checks CoVe presence, anti-pattern presence, phase-skip justifications, and legacy-task handling (`specs/002-protocol-enforcement/design.md:113-136`). The only references to method categorization in the design are on the builder/protocol side (`specs/002-protocol-enforcement/design.md:26-33`, `specs/002-protocol-enforcement/design.md:87-89`, `specs/002-protocol-enforcement/design.md:150-154`). If implemented as written, the builder will record methods, but the judge workflow still has no explicit instruction to verify claim-type/method matches and emit the required `L` finding for mismatches. Add that check to the `loop.review.md` design and carry it into the PROTOCOL judge-workflow update so AC-8 is fully covered.

#### Low
- None.

#### Acceptance Check
- AC-1: pass
- AC-2: pass
- AC-3: pass
- AC-4: pass
- AC-5: pass
- AC-6: pass
- AC-7: pass
- AC-8: fail
- AC-9: pass
- AC-10: pass
- AC-11: pass

#### Verification
- Checked: `specs/002-protocol-enforcement/spec.md:54-59` and `specs/002-protocol-enforcement/spec.md:117-126` explicitly require the judge to flag wrong verification methods as `L` severity during preflight review.
- Checked: `specs/002-protocol-enforcement/design.md:113-136` defines the `loop.review.md` preflight step without any claim-type/method mismatch check.
- Checked: `specs/002-protocol-enforcement/design.md:26-33`, `specs/002-protocol-enforcement/design.md:87-89`, and `specs/002-protocol-enforcement/design.md:150-154` keep CoVe method categorization on the builder/protocol side, which confirms the omission is specifically on the judge-enforcement path.
- Checked: Official Claude Code docs still say omitted subagent `model` defaults to `inherit`, so I did not raise any additional AC-9 concern. Source: https://code.claude.com/docs/en/subagents
- Corrections: None.

#### Anti-Pattern Check
- AP-002 detected on M-1: the design carries the CoVe method rule into builder-side guidance but not into the judge-side enforcement path that is supposed to review it.

#### Open Questions
- None.

### [design] Round 3 — judge

#### Verdict
accepted

#### Blockers
- None.

#### High
- None.

#### Medium
- None.

#### Low
- None.

#### Acceptance Check
- AC-1: pass
- AC-2: pass
- AC-3: pass
- AC-4: pass
- AC-5: pass
- AC-6: pass
- AC-7: pass
- AC-8: pass
- AC-9: pass
- AC-10: pass
- AC-11: pass

#### Verification
- Checked: `specs/002-protocol-enforcement/design.md:109-126` now makes the judge preflight step explicit, including the 3+-phase-skip H-severity rule and the CoVe method-mismatch L-severity check required by `specs/002-protocol-enforcement/spec.md:54-59` and `specs/002-protocol-enforcement/spec.md:117-126`.
- Checked: `specs/002-protocol-enforcement/design.md:154-160` now carries the missing PROTOCOL updates, including the builder `### Anti-Pattern Check` section and judge-workflow parity for the fallback path.
- Checked: `specs/002-protocol-enforcement/design.md:71-75` and `specs/002-protocol-enforcement/design.md:164-195` preserve the builder-evidence/status-flag cross-check and keep `skipped_phases`, `preflight`, and `review_context` optional for backwards compatibility.
- Corrections: None.

#### Anti-Pattern Check
- None detected.

#### Open Questions
- None.

## [plan] Archived Rounds

### [plan] Round 1 — judge

#### Verdict
accepted

#### Blockers
- None.

#### High
- None.

#### Medium
- None.

#### Low
- None.

#### Acceptance Check
- AC-1: pass
- AC-2: pass
- AC-3: pass
- AC-4: pass
- AC-5: pass
- AC-6: pass
- AC-7: pass
- AC-8: pass
- AC-9: pass
- AC-10: pass
- AC-11: pass

#### Verification
- Checked: `agent-loop/002-protocol-enforcement/tasks.md` defines 10 concrete tasks that cover every acceptance criterion, with explicit AC mappings for implementation work (`T001`-`T008`) and verification work (`T009`-`T010`).
- Checked: `agent-loop/002-protocol-enforcement/tasks.md` preserves the accepted design ordering: same-file edits stay sequential (`PROTOCOL.md`, then `loop.build.md`), while disjoint-file work is called out as parallelizable (`loop.review.md` and `claude-judge.md`).
- Checked: `specs/002-protocol-enforcement/design.md` decisions `D-1` through `D-10` are reflected in the task breakdown, including the build-phase test-gate escape hatch, judge preflight severity rules, and legacy/backwards-compatibility handling.
- Checked: All four implementation target files referenced by the plan exist under `src/templates/`, so the plan is pointed at valid artifacts.
- Corrections: None.

#### Anti-Pattern Check
- None detected.

#### Open Questions
- None.

## [build] Archived Rounds

### [build] Round 1 — judge

#### Verdict
needs_revision

#### Blockers
- None.

#### High
- H-1 (AP-002): `src/templates/commands/loop.build.md:160` says both preflight checks are mandatory only for `specify`, `design`, and `build`, and optional for `test` and `release`. That makes the anti-pattern check optional in `test` and `release`, but the accepted spec and design require missing anti-pattern checks to remain findings on any phase (`specs/002-protocol-enforcement/spec.md:57`, `specs/002-protocol-enforcement/spec.md:122`, `specs/002-protocol-enforcement/spec.md:185`; `specs/002-protocol-enforcement/design.md:37`, `specs/002-protocol-enforcement/design.md:121`). The judge-side enforcement already reflects that rule (`src/templates/commands/loop.review.md:85`; `src/templates/protocol/PROTOCOL.md:358`), so the builder and judge templates now disagree about whether anti-pattern checks are required in `test` and `release`. Split Step 5 so CoVe alone becomes optional for those phases while the anti-pattern check remains mandatory on every phase.

#### Medium
- None.

#### Low
- None.

#### Acceptance Check
- AC-1: pass
- AC-2: fail
- AC-3: pass
- AC-4: pass
- AC-5: pass
- AC-6: pass
- AC-7: pass
- AC-8: pass
- AC-9: pass
- AC-10: pass
- AC-11: pass

#### Verification
- Checked: `src/templates/commands/loop.build.md:160-180` to confirm Step 5 currently scopes both preflight checks together and marks them optional in `test` and `release`.
- Checked: `specs/002-protocol-enforcement/spec.md:57`, `specs/002-protocol-enforcement/spec.md:122`, and `specs/002-protocol-enforcement/spec.md:185`, plus `specs/002-protocol-enforcement/design.md:37` and `specs/002-protocol-enforcement/design.md:121`, to confirm only CoVe is optional in `test` and `release`, while the anti-pattern check remains mandatory on every phase.
- Checked: `src/templates/commands/loop.review.md:85` and `src/templates/protocol/PROTOCOL.md:358` to confirm judge-side enforcement still treats missing anti-pattern checks as findings on any phase, which is what creates the implementation drift.
- Checked: the phase-skip guardrails, test gate, timestamp guidance, CoVe method categorization, `model: inherit`, and extended `status.json` schema updates in the four changed template files; those changes align with the accepted spec/design.
- Corrections: None.

#### Anti-Pattern Check
- AP-002 detected on H-1: the builder and judge instructions now disagree about whether anti-pattern checks are mandatory in `test` and `release`.

#### Open Questions
- None.

### [build] Round 2 — judge

#### Verdict
accepted

#### Blockers
- None.

#### High
- None.

#### Medium
- None.

#### Low
- None.

#### Acceptance Check
- AC-1: pass
- AC-2: pass
- AC-3: pass
- AC-4: pass
- AC-5: pass
- AC-6: pass
- AC-7: pass
- AC-8: pass
- AC-9: pass
- AC-10: pass
- AC-11: pass

#### Verification
- Checked: `src/templates/commands/loop.build.md:158-189` now splits Step 5 into separate CoVe and anti-pattern scope statements, restoring the accepted rule that CoVe is optional only for `test`/`release` while the anti-pattern check remains mandatory on every phase.
- Checked: `src/templates/commands/loop.review.md:73-92` and `src/templates/protocol/PROTOCOL.md:346-365` still match the accepted spec/design for preflight severity, so the builder-side fix no longer conflicts with the judge-side enforcement path.
- Checked: the other task artifacts touched in Round 1 still satisfy the accepted spec/design after the Round 2 edit: `src/templates/commands/loop.build.md:34-267`, `src/templates/commands/loop.review.md:32-186`, `src/templates/protocol/PROTOCOL.md:209-553`, and `src/templates/agents/claude-judge.md:1-14`.
- Corrections: None.

#### Anti-Pattern Check
- None detected.

#### Open Questions
- None.

## [test] Archived Rounds

### [test] Round 1 — judge

#### Verdict
accepted

#### Blockers
- None.

#### High
- None.

#### Medium
- None.

#### Low
- L-1: `agent-loop/002-protocol-enforcement/builder.md:35-109` includes test evidence and an anti-pattern review, and `agent-loop/002-protocol-enforcement/status.json:9-12` sets `preflight.cove_completed` to `true`, but the round omits the required `### Verification` section entirely. In the `test` phase CoVe is optional, so this is low severity, but if the builder sets `cove_completed` the round still needs a `### Verification` section showing what was checked and whether anything changed.

#### Acceptance Check
- AC-1: pass
- AC-2: pass
- AC-3: pass
- AC-4: pass
- AC-5: pass
- AC-6: pass
- AC-7: pass
- AC-8: pass
- AC-9: pass
- AC-10: pass
- AC-11: pass

#### Verification
- Checked: `npm test` locally; the suite passes with 65/65 tests, matching the builder's recorded output.
- Checked: `src/cli/scaffold.test.js:311-484` to confirm the builder added 24 protocol-enforcement tests covering all 11 acceptance criteria plus cross-document consistency checks.
- Checked: `src/templates/commands/loop.build.md:130-258`, `src/templates/commands/loop.review.md:73-176`, `src/templates/protocol/PROTOCOL.md:259-553`, and `src/templates/agents/claude-judge.md:1-14` to confirm the newly added tests line up with the actual template/protocol changes they are asserting.
- Checked: `agent-loop/002-protocol-enforcement/builder.md:84-109` against `agent-loop/002-protocol-enforcement/status.json:9-12` to verify preflight evidence; this is where the missing `### Verification` section shows up.
- Corrections: None.

#### Anti-Pattern Check
- None detected.

#### Open Questions
- None.
