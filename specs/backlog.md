# Backlog

Items are added here from task closures, brainstorming, and ad-hoc ideas.
Use `/loop.backlog pick <number>` to promote an item to a task.

## Active Items

| # | Description | Source | Priority | Added |
|---|-------------|--------|----------|-------|
| 1 | Multi-agent configurability — Claude+Codex/Copilot builder/judge selection prompts, agent-specific instruction templates | task-001 | P1 | 2026-03-20 |
| 2 | Configurable phase list — let projects skip or add phases | manual | P3 | 2026-03-20 |
| 3 | GitHub Actions integration — auto-trigger judge on PR | manual | P3 | 2026-03-20 |
| 4 | Protocol-aware /loop.build — create task structure (task.md, status.json) before brainstorming/plan mode can activate, preventing protocol bypass | dogfooding-001 | P2 | 2026-03-20 |
| 5 | Hookify rule: ensure agent-loop task folder exists when /loop.build new is running — safety net if plan mode or other skills try to bypass task creation | dogfooding-001 | P2 | 2026-03-20 |
| 6 | Integration test for scaffold() — temp dir setup with nonInteractive flag, test file creation, CLAUDE.md append logic, skip-if-exists, --force flag | pr-review-001 | P2 | 2026-03-21 |
| 7 | Validate getFilesToScaffold src paths exist on disk — catch template path typos before runtime ENOENT | pr-review-001 | P3 | 2026-03-21 |
| 8 | JSDoc @param/@returns for all public functions in agents.js | pr-review-001 | P3 | 2026-03-21 |
| 9 | `--force` mode switching cleanup — remove opposite mode's managed files (CODEX.md vs .claude/agents/judge.md) when re-scaffolding in a different mode | pr-review-002 | P2 | 2026-03-21 |
| 10 | Error handling polish — use `{ cause: err }` in loadTemplate/scaffold error wrapping to preserve stack traces; hint DEBUG env var in entry point error output; add `@throws` JSDoc to agents.js public functions; clarify claude-judge.md write scope to mention judge-archive.md; add preflight template existence check before writing files | pr-review-toolkit | P3 | 2026-03-21 |
| ~~11~~ | ~~Use task-scoped paths in loop.review.md and loop.build.md templates~~ — done in PR #1 | pr-review-002 | — | 2026-03-21 |
| 12 | Protocol enforcement improvements — phase-skip guardrails, CoVe enforcement, antipattern check in builder, test gate, timestamp enforcement, judge preflight verification, judge model parity | field-test-feedback | P1 | 2026-03-22 |
| 13 | Upgrade experience for template updates — verify `upgrade` command handles updated templates (loop.build.md, loop.review.md, PROTOCOL.md, claude-judge.md) correctly; decide on diff/warn before overwriting user-customized files vs blunt replace; release notes should tell existing users to run upgrade; ensure old tasks with old templates keep working (no breaking changes, just missing new enforcement) | dogfooding-002 | P1 | 2026-03-22 |
| 14 | Add linting (ESLint + Prettier) for development — enforce consistent code style across JS source and test files | dogfooding-002 | P2 | 2026-03-22 |

## Picked Up

| # | Description | Task ID | Picked |
|---|-------------|---------|--------|
| - | Single-agent mode — one agent plays both builder and judge roles | 001-single-agent-mode | 2026-03-20 |
| 12 | Protocol enforcement improvements | 002-protocol-enforcement | 2026-03-22 |
