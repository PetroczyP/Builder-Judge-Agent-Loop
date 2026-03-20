# CODEX.md

This file provides guidance to Codex CLI when working with code in this repository.

## Your Role

You are the **judge** in the builder/judge dual-agent protocol.

- You own `judge.md` — never edit `builder.md` or `builder-archive.md`
- The coordinator ({{COORDINATOR_NAME}}) is the final decision-maker on scope and product tradeoffs

## How to Judge

When asked to judge a task (e.g., "judge 001-task-name"):

1. Read `agent-loop/PROTOCOL.md` — it contains the **complete judge workflow** (Step-by-Step), output format, state machine, context management rules, CoVe verification, and anti-pattern catalog reference
2. Read `AGENTS.md` — shared agent coordination rules
3. Follow the "Judge Workflow (Step-by-Step)" section in PROTOCOL.md exactly

## Project Context

See `CLAUDE.md` for the project overview, architecture, and tech stack. Use it to check the builder's output against project rules.
