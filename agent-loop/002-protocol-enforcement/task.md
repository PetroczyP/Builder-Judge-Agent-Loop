# Task: Protocol Enforcement Improvements

## Goal

Tighten the command templates (`loop.build.md`, `loop.review.md`) and protocol documentation (`PROTOCOL.md`) to structurally enforce rules that agents currently skip: CoVe, anti-pattern checks, phase-skip justifications, test gates, and judge isolation. Also ensure judge model parity in single-agent mode.

## Scope

- No runtime behavior changes; JS changes limited to scaffolding/tests/tooling
- Files: `loop.build.md`, `loop.review.md`, `claude-judge.md`, `PROTOCOL.md` (all under `src/templates/`)
- Extend `status.json` schema with optional fields: `skipped_phases`, `preflight`, `review_context`

## Constraints

- All new `status.json` fields must be optional (backwards compatibility with existing tasks)
- No external enforcement mechanisms (no hooks, no code validation)
- No changes to the phase list or judge verdict rules

## Acceptance Criteria

- AC-1: `loop.build.md` includes phase-skip guardrails with justification requirements in CREATE mode
- AC-2: `loop.build.md` includes a pre-flight checklist step (CoVe + anti-pattern check) positioned before builder.md writing
- AC-3: CoVe distinguishes external claims (web search) from internal claims (repo search)
- AC-4: `loop.build.md` build phase includes a test gate with escape hatch for non-behavioral rounds
- AC-5: `loop.build.md` includes real timestamp enforcement with example command
- AC-6: builder.md template includes `### Anti-Pattern Check` section
- AC-7: `loop.review.md` includes isolation self-check as first step after command parsing
- AC-8: `loop.review.md` includes preflight verification step with tiered severity
- AC-9: `claude-judge.md` includes `model: inherit` in frontmatter
- AC-10: `PROTOCOL.md` documents phase-skip rules, extended status.json schema, and updated CoVe methods
- AC-11: All changes are backwards-compatible (existing tasks without new fields still work)

## Phase

specify (accepted)

## Open Decisions

None — design completed during brainstorming.

## Spec Path

`specs/002-protocol-enforcement/spec.md`
