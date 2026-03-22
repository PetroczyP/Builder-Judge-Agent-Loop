# AGENTS.md

Repository-wide instructions for all agents working in this repo.

## Code Style

- **JavaScript (ES Modules)** — `"type": "module"` in [package.json](package.json); use `import`/`export` everywhere
- Derive `__dirname` via `fileURLToPath(import.meta.url)` — no CJS globals
- Single quotes, 2-space indent, `const`/`let` only (never `var`), trailing commas in multi-line
- Prettier defaults; ESLint flat config extends `@eslint/js` recommended + `eslint-config-prettier`
- Named exports preferred (`export function …`); wrap errors with `new Error(msg, { cause: err })`
- Freeze registries with `Object.freeze()` — see [src/utils/agents.js](src/utils/agents.js) for the pattern

## Architecture

```
bin/create-dual-agent-loop.js   → thin entry, calls run() from src/index.js
src/index.js                    → parses --force/--yes, delegates to scaffold()
src/cli/scaffold.js             → core: prompts → config → template rendering → file writes
src/utils/agents.js             → AGENTS registry, getTemplateVars(), getFilesToScaffold()
src/templates/                  → Markdown/JSON with {{VAR}} placeholders (agents/, commands/, protocol/, task/)
agent-loop/                     → dogfooding instance of the protocol for THIS project
specs/                          → backlog and feature specs
```

**Template system**: Simple `split(key).join(value)` replacement — no template engine. Variables use `{{UPPER_SNAKE_CASE}}`. Null/undefined values throw immediately (fail-fast). See [scaffold.js loadTemplate()](src/cli/scaffold.js) for implementation.

**Agent modes**: `dual` (Claude Code builds, Codex judges → scaffolds `CODEX.md`) or `single` (Claude Code plays both roles → scaffolds `.claude/agents/judge.md`).

## Build and Test

```sh
npm install              # only runtime dep: enquirer
npm test                 # Node.js built-in test runner (node --test src/**/*.test.js)
npm run lint             # ESLint flat config
npm run lint:fix         # auto-fix
npm run format           # Prettier
npm run format:check     # CI-friendly check
npm run license:check    # allows MIT, ISC, BSD-2/3, Apache-2.0, 0BSD
npm run scaffold-self    # dogfooding — runs scripts/scaffold-self.js
```

No build/transpile step — source JS is shipped directly. Tests are co-located (`*.test.js` next to source) using `node:test` + `node:assert/strict`.

## Project Conventions

- **Package**: `create-dual-agent-loop` — `create-*` convention for `npm init dual-agent-loop`
- **Task folders**: `NNN-task-name/` (zero-padded 3-digit, kebab-case) under `agent-loop/`
- **Template vars**: `{{UPPER_SNAKE_CASE}}` — 10 variables including `{{COORDINATOR_NAME}}`, `{{BUILDER_AGENT_NAME}}`, etc.
- **Finding IDs**: `B-1` (blocker), `H-1` (high), `M-1` (medium), `L-1` (low)
- **Slash commands**: `loop.<verb>.md` in `.claude/commands/`
- **Protocol phases**: `specify → design → plan → build → test → release`
- **State machine**: `ready_for_builder → ready_for_judge → needs_revision | accepted | escalated`
- **CLAUDE.md** is append-only (never overwritten); all other files skip-if-exists unless `--force`
- **`files` in package.json**: only `bin/`, `src/`, `LICENSE`, `README.md` are published

## Security

- `execFileSync` (not `exec`) for `git config user.name` — avoids shell injection
- No credentials, API keys, or network calls — tool scaffolds only Markdown and JSON
- `npm run license:check` enforces an allowlist of OSS licenses for production deps

---

## Agent Loop

The **canonical builder / judge workflow** is in:

- `agent-loop/PROTOCOL.md`

If you are working on anything under `agent-loop/`, you MUST also read:

- this file (root `AGENTS.md`)
- `agent-loop/PROTOCOL.md`
- `agent-loop/ANTIPATTERNS.md`

### Builder / Judge Roles

- **Claude Code** is the builder
- **Codex** is the judge
- **Peter** is the coordinator and final decision-maker

Codex must not drift into being the primary builder when acting as judge.

### File Ownership in Agent Loop

When operating inside `agent-loop/`:

- Do not edit `builder.md` if you are acting as judge
- Do not edit `judge.md` if you are acting as builder
- Preserve round history — rounds may only be moved to archive files via the Context Management process, never deleted or modified in place
- Update `status.json` when the protocol requires it

### Quick Reference

**Builder (Claude Code):**
1. Read `task.md` for goal, scope, acceptance criteria
2. Read `judge.md` if it exists (previous round feedback)
3. Read **Phase Summaries** from both archive files (if they exist)
4. Perform context management checks (see PROTOCOL.md Context Management):
   - Phase compaction: if active file contains rounds from a prior phase, compact first
   - Round archival: if active file has 2+ rounds and you're writing round N >= 3, archive oldest
5. Append a new `## Round N — [phase]` section to `builder.md`
6. Update `status.json`: state → `ready_for_judge`
7. Do NOT edit `judge.md` or `judge-archive.md`

**Judge (Codex):**
1. Read `task.md` for goal, scope, acceptance criteria
2. Read `builder.md` (latest round)
3. Review any changed artifacts referenced by the builder
4. Read **Phase Summaries** from both archive files (if they exist)
5. Perform context management checks (see PROTOCOL.md Context Management):
   - Phase compaction: if active file contains rounds from a prior phase, compact first
   - Round archival: if active file has 2+ rounds and you're writing round N >= 3, archive oldest
6. Append a new `## Round N — [phase]` section to `judge.md` with verdict and findings
7. Update `status.json`: state → verdict value
8. Do NOT edit `builder.md` or `builder-archive.md`

### Boundaries

**Always do:** Read `task.md` first. Read Phase Summaries from archive files (if they exist). Use structured output from PROTOCOL.md. Use stable finding IDs (B-1, H-1, M-1, L-1). Perform context management checks before writing new rounds. Update `status.json` after writing. Check `agent-loop/ANTIPATTERNS.md` before finalizing each round.

**Ask Peter first:** Changing scope or ACs in `task.md`. Expanding beyond the original spec. Disagreeing for 2+ consecutive rounds on the same point.

**Never do:** Edit the other agent's artifact or archive. Skip reading `task.md`. Delete or modify rounds in place (archival via Context Management is the only permitted move). Make product/scope decisions.

## Review Expectations

When acting as reviewer or judge:

- Findings should be concrete and actionable
- Call out blockers and high-risk issues first
- Prefer evidence over assertion
- If no issues are found, say so explicitly

## Escalate to Peter When

- a scope decision is required
- specs conflict materially
- a requested change would expand the task
- the correct path depends on missing product context
- builder and judge have repeated unresolved disagreement (2+ rounds on same finding)

## Practical Rule

If a task is part of the builder / judge loop, follow the `agent-loop/` protocol.

If a task is normal repo work outside that loop, use this file as your main instructions.
