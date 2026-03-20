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
| 10 | Use task-scoped paths in loop.review.md and loop.build.md templates — `agent-loop/<task-id>/task.md` instead of bare `task.md` | pr-review-002 | P3 | 2026-03-21 |

## Picked Up

| # | Description | Task ID | Picked |
|---|-------------|---------|--------|
| - | Single-agent mode — one agent plays both builder and judge roles | 001-single-agent-mode | 2026-03-20 |
