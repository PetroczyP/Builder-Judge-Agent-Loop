# CLAUDE.md

## Project Overview

**dual-agent-loop** is a CLI tool (npm package) that scaffolds the Builder/Judge dual-agent collaboration protocol into any project. Users install it, run `init-agent-loop`, and get a structured SDLC with quality gates powered by Claude Code (builder) and Codex (judge).

Workflow inspired by and compatible with [GitHub Spec-Kit](https://github.com/github/spec-kit) (MIT).

## Tech Stack

- Node.js (ES modules)
- Dependencies: `commander` (CLI), `enquirer` (interactive prompts)
- No runtime dependencies beyond file I/O — the tool scaffolds markdown and JSON files

## Project Structure

```
bin/                    # CLI entry point
src/
  cli/                  # Command implementations (init-agent-loop, status, backlog, new, upgrade)
  templates/            # Templatized protocol files, slash commands, agent configs
  utils/                # Template rendering, file ops, config R/W
agent-loop/             # Protocol files for THIS project (dogfooding)
specs/                  # Backlog and future specs
.claude/commands/       # Slash commands for THIS project (dogfooding)
```

## Builder-Judge Workflow

This project uses the dual-agent-loop protocol to build itself (dogfooding).

- **Builder**: Claude Code — use `/loop.build` commands
- **Judge**: Codex — use `judge <task-id>`
- **Coordinator**: Peter — final decision maker

See `agent-loop/PROTOCOL.md` for full rules.
See `AGENTS.md` for shared agent instructions.
See `agent-loop/ANTIPATTERNS.md` for known anti-patterns to avoid.

### Key rules:
- Never edit `judge.md` or `judge-archive.md`
- Always read `task.md` and `status.json` before working
- Check state guards: only work when state is `ready_for_builder` or `needs_revision`
- Run CoVe (Chain of Verification) before marking ready for judge
- Check ANTIPATTERNS.md before finalizing each round
