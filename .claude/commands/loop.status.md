---
description: "Show status of one or all tasks. Usage: /loop.status [task-id]"
---

## User Input

```text
$ARGUMENTS
```

## Instructions

Read status information and present it clearly.

### If no task-id given:

1. Scan all `agent-loop/*/status.json` files
2. Present a summary table:

```
| Task ID | Phase | State | Round | Verdict | Updated |
|---------|-------|-------|-------|---------|---------|
| 001-... | build | ready_for_judge | 3 | null | 2026-03-20 |
| 002-... | specify | accepted | 2 | accepted | 2026-03-19 |
```

3. Highlight any tasks that are `escalated` or have exceeded the soft round limit (5)

### If task-id given:

1. Read `agent-loop/<task-id>/status.json`
2. Read `agent-loop/<task-id>/task.md` (just the goal and ACs)
3. If `judge.md` exists, read the latest round's verdict and findings summary
4. Present:
   - Task goal (from task.md)
   - Current phase, state, round
   - Latest verdict and finding counts (if judge has reviewed)
   - Phase history from status.json history array
   - Next suggested action (who needs to act: builder, judge, or coordinator)
