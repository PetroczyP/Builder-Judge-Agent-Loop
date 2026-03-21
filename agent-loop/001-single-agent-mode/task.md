# Task: Single-Agent Mode (Claude Code Only)

## Goal

Add a "single-agent" mode where Claude Code plays both builder and judge roles via its native subagent system, with session-isolated boundary via `context: fork`. Users who only have Claude Code can now use the full protocol.

## Scope

- Add agent mode selection to interactive setup (`single` vs `dual`)
- Create agent registry (`src/utils/agents.js`) as central data module
- Replace hardcoded agent names in templates with template variables
- Scaffold `.claude/agents/judge.md` subagent (with `context: fork` session isolation) for single-agent mode
- Scaffold `/loop.review` slash command for judge phase in single-agent mode
- Maintain backwards compatibility (`--yes` defaults to dual mode)

## Constraints

- No auto-cycling between builder and judge — coordinator (human) gates every transition
- Judge subagent runs in `context: fork` (session isolation) — same trust model as Codex in dual-agent mode
- Dual mode must produce identical output to v0.1.0
- Template strategy: use `{{VAR}}` substitution, not separate template variants

## Acceptance Criteria

- AC-1: `npx create-dual-agent-loop --yes` produces identical file set to v0.1.0 (backwards compat)
- AC-2: Interactive setup asks "Agent setup: Dual agent / Single agent" as first prompt
- AC-3: Single mode scaffolds `.claude/agents/judge.md` with `context: fork` wiring via `/loop.review` and session isolation from the builder (same trust model as Codex in dual-agent mode)
- AC-4: Single mode scaffolds `.claude/commands/loop.review.md` with full judge workflow
- AC-5: Single mode does NOT scaffold `CODEX.md`
- AC-6: Dual mode does NOT scaffold `judge.md` or `loop.review.md`
- AC-7: No unresolved `{{` variables remain in any rendered template (both modes)
- AC-8: `.dual-agent-loop.json` includes `agent_mode` field
- AC-9: `npm run scaffold-self` renders project files without artifacts
- AC-10: All tests pass (`node --test src/**/*.test.js`)

## Phase

release

## Open Decisions

None — all resolved during design.

## Spec Path

Design captured in plan file: `.claude/plans/dapper-honking-duckling.md`
