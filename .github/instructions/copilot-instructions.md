# Copilot Custom Instructions

## Project Overview

**create-dual-agent-loop** is a CLI tool (npm package) that scaffolds the Builder/Judge dual-agent collaboration protocol into any project. It provides a structured SDLC with quality gates powered by Claude Code (builder) and Codex (judge).

## Code Style

- **JavaScript ES Modules** — `"type": "module"` in package.json; use `import`/`export` everywhere
- Derive `__dirname` via `fileURLToPath(import.meta.url)` — no CommonJS globals (`require`, `module`, `__dirname`)
- Single quotes, 2-space indent, `const`/`let` only (never `var`), trailing commas in multi-line
- Prettier defaults; ESLint flat config extends `@eslint/js` recommended + `eslint-config-prettier`
- Named exports preferred (`export function …`)
- Wrap errors with `new Error(msg, { cause: err })`
- Freeze registries with `Object.freeze()` — see `src/utils/agents.js` for the pattern
- No build/transpile step — source JS is shipped directly
- Node.js ≥ 20.19.0 required

## Project Structure

```
bin/create-dual-agent-loop.js   → thin CLI entry point, calls run() from src/index.js
src/index.js                    → parses --force/--yes, delegates to scaffold()
src/cli/scaffold.js             → core: prompts → config → template rendering → file writes
src/utils/agents.js             → AGENTS registry, getTemplateVars(), getFilesToScaffold()
src/templates/                  → Markdown/JSON with {{VAR}} placeholders
agent-loop/                     → dogfooding instance of the protocol for THIS project
specs/                          → backlog and feature specs
```

## Template System

- Simple `split(key).join(value)` replacement — no template engine
- Variables use `{{UPPER_SNAKE_CASE}}` format (e.g. `{{COORDINATOR_NAME}}`, `{{BUILDER_AGENT_NAME}}`)
- Null/undefined values throw immediately (fail-fast)
- 10 template variables defined in `getTemplateVars()` in `src/utils/agents.js`

## Agent Modes

- **dual** — Claude Code builds, Codex judges → scaffolds `CODEX.md`
- **single** — Claude Code plays both roles → scaffolds `.claude/agents/judge.md`

## Testing

- Tests are co-located (`*.test.js` next to source)
- Use `node:test` + `node:assert/strict` (Node.js built-in test runner)
- Run with `npm test` (`node --test src/**/*.test.js`)

## Key Commands

```sh
npm install              # only runtime dep: enquirer
npm test                 # Node.js built-in test runner
npm run lint             # ESLint flat config
npm run lint:fix         # auto-fix
npm run format           # Prettier
npm run format:check     # CI check
npm run license:check    # allows MIT, ISC, BSD-2/3, Apache-2.0, 0BSD
npm run scaffold-self    # dogfooding — runs scripts/scaffold-self.js
```

## Security

- Use `execFileSync` (not `exec`) for spawning processes — avoids shell injection
- No credentials, API keys, or network calls — tool scaffolds only Markdown and JSON
- `npm run license:check` enforces an allowlist of OSS licenses for production deps

## Conventions

- **Package**: `create-dual-agent-loop` — `create-*` convention for `npm init dual-agent-loop`
- **Task folders**: `NNN-task-name/` (zero-padded 3-digit, kebab-case) under `agent-loop/`
- **Finding IDs**: `B-1` (blocker), `H-1` (high), `M-1` (medium), `L-1` (low)
- **Slash commands**: `loop.<verb>.md` in `.claude/commands/`
- **Protocol phases**: `specify → design → plan → build → test → release`
- **State machine**: `ready_for_builder → ready_for_judge → needs_revision | accepted | escalated`
- **CLAUDE.md** is append-only (never overwritten); all other files skip-if-exists unless `--force`
- **`files` in package.json**: only `bin/`, `src/`, `LICENSE`, `README.md` are published

## When Writing Code

- Always use ES module syntax (`import`/`export`)
- Follow the existing error-wrapping pattern: `new Error(msg, { cause: err })`
- For new registries or lookup objects, use `Object.freeze()`
- Place new tests in `*.test.js` files next to the source they test
- Use `node:` prefix for built-in modules (`node:fs`, `node:path`, `node:test`, etc.)
- Keep the dependency footprint minimal — only `enquirer` is a runtime dep
