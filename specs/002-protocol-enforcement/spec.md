# Spec: Protocol Enforcement Improvements

**Created:** 2026-03-22
**Source:** Colleague field-test of npx setup — observed protocol shortcuts that the templates failed to prevent
**Priority:** P1

## Problem Statement

A colleague tested the tool via `npx create-dual-agent-loop` on their project. The builder agent:
- Skipped 3 of 6 phases (specify, design, plan) without justification or guardrails
- Did not perform Chain of Verification (CoVe), despite it being mandatory for the build phase
- Did not check ANTIPATTERNS.md, despite the protocol requiring both agents to check before each round
- Used placeholder timestamps in status.json (`00:00:00Z`)
- Wrote zero new tests despite TDD being specified in the build phase
- Referenced a spec file that was never created
- The judge review appeared to run in the same session as the build, bypassing `context: fork` isolation

The protocol has good rules. The command templates do not enforce them strongly enough. The agent takes shortcuts, and the tool lets it.

## Goals

1. Make the command templates structurally enforce the protocol's own rules
2. Give the judge concrete evidence to verify the builder's compliance
3. Preserve flexibility for legitimately small tasks (phase skipping with justification)
4. Ensure judge capability matches builder capability in single-agent mode

## Non-Goals

- No changes to core runtime behavior; functional changes are limited to command templates. JavaScript edits are restricted to supporting scaffolding (e.g., `scaffold.js` error wrapping), tests, scripts, and lint configuration.
- No hookify rules or external enforcement mechanisms
- No changes to the phase list itself (that is backlog item #2)
- No changes to the judge's evaluation criteria or verdict rules

## User Scenarios

### S1: Builder skips phases with justification (P1)
A builder creates a task for a small bug fix and starts at `build` phase, skipping `specify`, `design`, and `plan`. Each skipped phase has a concrete justification recorded in `status.json`. The judge verifies the justifications during review.

**Acceptance scenario:** `status.json` contains `skipped_phases` array with one entry per skipped phase, each with a non-generic justification referencing a concrete artifact or constraint. The judge checks these and flags any that are insufficient.

### S2: Builder performs CoVe with appropriate verification methods (P1)
A builder completes work in the `build` phase. Before writing builder.md, they run CoVe: listing verification questions, using web search for external claims and repo search for internal claims, and recording findings.

**Acceptance scenario:** builder.md `### Verification` section lists specific claims checked, the method used (web search vs repo search), and findings. `status.json.preflight.cove_completed` is `true`. The judge cross-references the flag against the evidence.

### S3: Builder checks ANTIPATTERNS.md (P1)
A builder finishes a round and checks ANTIPATTERNS.md before finalizing. The check is recorded in builder.md.

**Acceptance scenario:** builder.md contains `### Anti-Pattern Check` section listing AP-IDs reviewed and any violations detected. `status.json.preflight.antipatterns_checked` is `true`.

### S4: Judge verifies builder preflight compliance (P1)
A judge reviews a round and first checks whether the builder completed the preflight checklist before evaluating the content itself.

**Acceptance scenario:** The judge's review includes a preflight verification step. Missing or unsubstantiated preflight claims are flagged as findings:
- Missing CoVe for mandatory phases (specify, design, build): **H-severity**
- Missing CoVe for optional phases (test, release): **L-severity**
- Missing anti-pattern check (any phase): **L-severity**
- Wrong verification method for claim type (e.g., web search for internal claim): **L-severity**

### S5: Judge runs with model parity (P1)
A judge review is invoked via `/loop.review` in single-agent mode. The judge subagent runs on the same model as the builder.

**Acceptance scenario:** `claude-judge.md` frontmatter includes `model: inherit`. The judge runs at the same capability level as the builder.

### S6: Judge detects non-isolated invocation (P2)
A user pastes judge instructions into the same session as the builder instead of invoking `/loop.review`. The judge template detects this and refuses to proceed.

**Acceptance scenario:** `loop.review.md` includes an isolation self-check. When invoked via `context: fork`, the judge starts with a clean-slate context (no prior conversation history). The detection mechanism is: if the judge observes prior conversation turns, tool calls, or builder work above its prompt, it was NOT invoked via the slash command. In that case, it stops and instructs the user to invoke `/loop.review` properly. This is a best-effort safety net for the most common misuse case (pasting instructions into an active session) — it cannot prevent all forms of misuse.

### S7: Builder writes real timestamps (P2)
A builder updates `status.json` with actual ISO 8601 timestamps.

**Acceptance scenario:** `loop.build.md` includes explicit instruction to generate real timestamps with an example command, and explicitly prohibits placeholder values.

### S8: Build phase enforces test creation (P2)
A builder implements changes in the `build` phase and writes at least one new test covering the new behavior, not just running pre-existing tests.

**Acceptance scenario:** `loop.build.md` build phase includes a test gate requiring at least one new test. `### Test Evidence` in builder.md includes names of new tests. If the round does not introduce new behavior (e.g., refactoring, documentation, config-only changes, template-only changes), the builder may skip the test gate with a justification recorded in `### Test Evidence` explaining why no new test applies.

### S9: Skipped specify phase does not produce phantom spec references (P2)
A builder skips the `specify` phase. The resulting `task.md` does not reference a spec path that does not exist.

**Acceptance scenario:** `loop.build.md` CREATE mode conditionally includes spec path only when a matching spec exists or the specify phase was run.

### S10: Protocol documentation reflects new enforcement rules (P2)
A contributor reads PROTOCOL.md and finds the phase-skip rules, extended status.json schema, and updated CoVe section documented and consistent with the template behavior.

**Acceptance scenario:** PROTOCOL.md documents phase-skip rules with valid justification examples, the full status.json schema including new optional fields, and CoVe verification methods (web search for external, repo search for internal claims).

## Functional Requirements

### FR1: Phase-skip guardrails
- `loop.build.md` CREATE mode MUST allow starting at a later phase when justified
- Each skipped phase MUST be recorded in `status.json.skipped_phases` as `{ "phase": "<name>", "justification": "<concrete reason>" }`
- Generic justifications ("small change", "straightforward", "obvious") MUST be explicitly called out as insufficient
- `task.md` MUST NOT reference a spec path unless the specify phase was run or a matching spec already exists

### FR2: Pre-flight checklist
- `loop.build.md` MUST include a numbered pre-flight checklist step between phase work and builder.md writing
- The checklist MUST include CoVe and anti-pattern check as mandatory items for applicable phases
- CoVe MUST distinguish between external claims (web search) and internal claims (repo search)
- The checklist MUST update `status.json.preflight` flags only after completing the actual steps

### FR3: Anti-pattern check in builder template
- `loop.build.md` MUST include an anti-pattern check step (currently only in `loop.review.md`)
- builder.md round template MUST include `### Anti-Pattern Check` section

### FR4: Build phase test gate
- `loop.build.md` build phase MUST require at least one new test per round when the round introduces new behavior
- Running only pre-existing tests MUST be explicitly called out as insufficient when new behavior is introduced
- If a round does not introduce new behavior (refactoring, documentation, config-only, template-only changes), the builder MAY skip the test gate with a justification recorded in `### Test Evidence`

### FR5: Timestamp enforcement
- `loop.build.md` MUST include an example command for generating real timestamps
- Placeholder values MUST be explicitly prohibited

### FR6: Judge preflight verification
- `loop.review.md` MUST include a preflight verification step before content evaluation
- Missing or unsubstantiated preflight claims MUST be flagged with severity based on phase:
  - Missing CoVe for mandatory phases (specify, design, build): **H-severity**
  - Missing CoVe for optional phases (test, release): **L-severity**
  - Missing anti-pattern check (any phase): **L-severity**
  - Wrong verification method for claim type: **L-severity**
- Phase-skip justifications MUST be verified (referenced artifacts exist, justifications are specific)
- If 3 or more phases are skipped, the judge MUST flag as **H-severity** requiring strong justification for each
- Legacy tasks without preflight fields MUST be handled gracefully (note, don't block)

### FR7: Judge isolation self-check
- `loop.review.md` MUST include an isolation verification step as the first action after parsing the command
- The detection mechanism: `context: fork` creates a clean-slate subagent with no conversation history. If the judge observes prior conversation turns, tool calls, or builder work above its prompt, it was invoked incorrectly (e.g., instructions pasted into an active session). In that case, the judge MUST stop and instruct the user to invoke `/loop.review` properly
- This is a best-effort safety net for the most common misuse case — it cannot prevent all forms of misuse
- The judge MUST record `review_context` in status.json

### FR8: Judge model parity
- `claude-judge.md` MUST include `model: inherit` in frontmatter
- This ensures the judge runs on the same model as the builder in single-agent mode

### FR9: Protocol documentation updates (supports S10)
- `PROTOCOL.md` MUST document phase-skip rules with valid justification examples
- `PROTOCOL.md` MUST document the extended status.json schema including all new optional fields
- `PROTOCOL.md` MUST update the CoVe section to include both verification methods (web search for external claims, repo search for internal claims)

## Status.json Schema Extension

```json
{
  "task_id": "string",
  "phase": "string",
  "round": "number",
  "state": "string",
  "verdict": "string | null",
  "updated_at": "string (real ISO 8601, never placeholder)",
  "skipped_phases": [
    { "phase": "string", "justification": "string (must reference concrete artifact or constraint)" }
  ],
  "preflight": {
    "cove_completed": "boolean",
    "antipatterns_checked": "boolean"
  },
  "review_context": "string (context_fork | codex_agent)",
  "history": [
    { "round": "number", "phase": "string", "actor": "string", "verdict": "string | null", "timestamp": "string" }
  ]
}
```

All new fields (`skipped_phases`, `preflight`, `review_context`) are optional for backwards compatibility.

## Files Changed

| File | Nature of change |
|------|-----------------|
| `src/templates/commands/loop.build.md` | Phase-skip guardrails, CoVe reorder + checklist, antipattern check step, test gate, timestamp enforcement, spec path cleanup |
| `src/templates/commands/loop.review.md` | Isolation self-check, preflight verification, review_context recording |
| `src/templates/agents/claude-judge.md` | Add `model: inherit` to frontmatter |
| `src/templates/protocol/PROTOCOL.md` | Phase-skip rules, extended status.json schema, updated CoVe section |

JavaScript changes (e.g., in `src/cli/scaffold.js`, `src/utils/agents.js`, and related tests/tooling) are limited to supporting the updated templates and protocol metadata; no new runtime protocol-enforcement logic is added.

## Edge Cases

- **All phases skipped:** A builder tries to skip directly to `release`. The template does not prevent this, but per FR6, skipping 3 or more phases triggers H-severity review. Skipping 5 of 6 would require exceptionally strong justifications for each — the judge is expected to reject weak ones.
- **Legacy tasks:** Existing tasks created before this change will not have `preflight` or `skipped_phases` fields. The judge treats missing fields as "not provided" and evaluates content on its merits.
- **Dual-agent mode:** `model: inherit` only affects single-agent mode (`context: fork`). In dual-agent mode (Codex as judge), model selection is handled by the external agent's configuration.
- **CoVe for test/release phases:** CoVe remains optional for `test` and `release` phases. The anti-pattern check is mandatory for all phases.
- **Build round with no new behavior:** Refactoring, documentation, or config-only rounds may skip the test gate with a justification in `### Test Evidence`. The judge evaluates whether the justification is valid (e.g., a round that changes behavior but claims "refactoring only" should be flagged).
- **CoVe method mismatch:** A builder web-searches an internal architecture question or repo-searches an external API claim. The judge flags method mismatches as L-severity — wrong method is better than no verification, but the right method should be used.

## Success Criteria

1. A builder agent following the updated `loop.build.md` produces builder.md with `### Verification` (with methods) and `### Anti-Pattern Check` sections
2. A builder agent that skips phases records justifications in `status.json` that the judge can verify
3. A judge agent following the updated `loop.review.md` checks preflight evidence before evaluating content
4. The judge subagent runs on the same model as the builder in single-agent mode
5. All changes are backwards-compatible with existing tasks

## Verification Notes (CoVe on this spec)

| Claim | Method | Finding |
|-------|--------|---------|
| ANTIPATTERNS.md not referenced in loop.build.md | Grep repo | Confirmed: zero matches |
| CoVe section positioned after builder.md writing in loop.build.md | Read file | Confirmed: physically at line 198, after Step 5 content, despite heading saying "between Step 4 and Step 5" |
| `context: fork` creates clean-slate subagent, not conversation fork | Web search | Confirmed: spawns brand-new context with zero conversation history |
| `context: fork` defaults to Sonnet model | Web search | Confirmed: defaults to Sonnet unless `model:` specified in frontmatter |
| `date -u +"%Y-%m-%dT%H:%M:%SZ"` works on macOS/Linux | Bash test | Confirmed |
| New status.json fields won't break existing template logic | Grep repo | Confirmed: templates only read phase, round, state, verdict, history |
