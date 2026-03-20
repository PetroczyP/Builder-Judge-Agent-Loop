# Cheatsheet — dual-agent-loop

Quick reference for the coordinator.

## Commands

### In Claude Code (Builder)

| Command | What it does |
|---------|-------------|
| `/loop.build new <desc>` | Create a new task and start specify phase |
| `/loop.build <task-id>` | Continue current phase (address judge feedback) |
| `/loop.build <task-id> <phase>` | Advance to next phase |
| `/loop.build` | Auto-detect most recent active task |
| `/loop.status` | Show all tasks |
| `/loop.status <task-id>` | Show single task details |
| `/loop.backlog` | View backlog |
| `/loop.backlog add <idea>` | Add idea to backlog |
| `/loop.backlog pick <#>` | Promote backlog item to task |
| `/loop.close <task-id>` | Generate closure + release |

### In Codex (Judge)

| Command | What it does |
|---------|-------------|
| `judge <task-id>` | Judge the builder's latest round |

## Workflow

```
specify → design → plan → build → test → release
```

Each phase: builder produces → judge evaluates → accepted / needs_revision / escalated

## State Machine

```
ready_for_builder → ready_for_judge    (builder writes round)
ready_for_judge   → needs_revision     (judge: try again)
ready_for_judge   → accepted           (judge: good to go)
ready_for_judge   → escalated          (judge: need human input)
needs_revision    → ready_for_judge    (builder fixes)
escalated         → any                (you decide)
```

## When Things Get Stuck

- **5+ rounds on same phase**: Soft flag — maybe escalate or reconsider scope
- **Agents disagree on same finding for 2+ rounds**: Should auto-escalate to you
- **max_rounds hit**: Auto-escalates — you need to decide

## Files Per Task

```
agent-loop/NNN-task-name/
  task.md            ← you own this (goal, scope, ACs)
  builder.md         ← builder's work (append-only)
  judge.md           ← judge's reviews (append-only)
  builder-archive.md ← archived builder rounds + phase summaries
  judge-archive.md   ← archived judge rounds + phase summaries
  status.json        ← machine state
  task-closure.md    ← created at release
```
