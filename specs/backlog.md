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
| ~~12~~ | ~~Protocol enforcement improvements — phase-skip guardrails, CoVe enforcement, antipattern check in builder, test gate, timestamp enforcement, judge preflight verification, judge model parity~~ — done in task 002-protocol-enforcement (PR #2) | field-test-feedback | — | 2026-03-22 |
| ~~13~~ | ~~Upgrade experience for template updates~~ — 3/4 done in PR #5 (smart upgrade with three-way merge); remaining docs gap tracked in #23 | dogfooding-002 | — | 2026-03-22 |
| 14 | Add linting (ESLint + Prettier) for development — enforce consistent code style across JS source and test files | dogfooding-002 | P2 | 2026-03-22 |
| 15 | Spec/document review checklist for specify and design phases — scaffold a SPEC_REVIEW_CHECKLIST.md template (completeness, consistency, clarity, scope, YAGNI) that the builder runs before marking `ready_for_judge`; reduces round count by catching common deficiencies earlier | competitor-review | P2 | 2026-04-12 |
| 16 | Scope-size check at task creation — in `/loop.build new`, check whether the task implies multiple independent subsystems; prompt coordinator to decompose or justify proceeding; record decision in task.md; add corresponding judge preflight check | competitor-review | P2 | 2026-04-12 |
| 17 | Mandatory alternatives analysis in design phase — extend builder output format to include `### Alternatives Considered` section with 2-3 approaches and trade-offs; update judge's design-phase review focus to verify alternatives were genuinely explored | competitor-review | P2 | 2026-04-12 |
| 18 | Knowledge capture command (`/loop.learnings`) — after task closure, prompt builder to document key problem-solution pairs into a `docs/solutions/` directory with structured frontmatter (problem_type, tags); complements ANTIPATTERNS.md (what not to do) with positive knowledge (what worked) | competitor-review | P2 | 2026-04-12 |
| 19 | Multi-persona review catalog for the judge — extend `loop.review` to support role-specific sub-reviews (correctness, testing, security, performance) selected by what changed; scaffold a customizable `review-personas.md` catalog; depends on #1 (multi-agent configurability) | competitor-review | P2 | 2026-04-12 |
| 20 | `init-agent-loop --check` environment diagnostics — verify scaffolded protocol is correctly installed: required files exist, status.json valid, slash commands registered, directory structure matches expected layout; report missing/broken items with fix suggestions | competitor-review | P2 | 2026-04-12 |
| 21 | Structured ideation command (`/loop.ideate`) — scan codebase, dispatch parallel ideation agents with different frames (user pain, inversion, assumption-breaking, leverage), apply adversarial filtering, output actionable improvements to `specs/ideation/` | competitor-review | P3 | 2026-04-12 |
| 22 | AP-008: Monolithic Design Without Unit Boundaries — new anti-pattern for designs that produce no module/component boundaries or interface definitions; symptoms: files exceeding 300 lines with mixed responsibilities, no testability characteristics identified | competitor-review | P3 | 2026-04-12 |
| 23 | Document the `upgrade` command in README.md — add to "Other commands" table, usage examples, explain three-way merge behavior for customized files | #13-remainder | P2 | 2026-04-12 |

## Picked Up

| # | Description | Task ID | Picked |
|---|-------------|---------|--------|
| - | Single-agent mode — one agent plays both builder and judge roles | 001-single-agent-mode | 2026-03-20 |
| 12 | Protocol enforcement improvements | 002-protocol-enforcement | 2026-03-22 |
