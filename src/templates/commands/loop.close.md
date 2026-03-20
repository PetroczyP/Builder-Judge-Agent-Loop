---
description: "Close a task after release phase is accepted. Generates task-closure.md and handles release. Usage: /loop.close <task-id>"
---

## User Input

```text
$ARGUMENTS
```

## Instructions

Close a task after its release phase has been accepted by the judge. This generates `task-closure.md` and handles the release process.

### Step 1: Validate

1. Parse the task-id from `$ARGUMENTS`
2. Read `agent-loop/<task-id>/status.json`
3. Verify the phase is `release` and the verdict is `accepted`
4. If not, tell the user: "Cannot close — task is in phase `<phase>` with verdict `<verdict>`. The release phase must be accepted first."

### Step 2: Gather context

1. Read `task.md` — goal, acceptance criteria
2. Read `builder.md` — latest round (release summary)
3. Read `builder-archive.md` — Phase Summaries section (all decisions, deferred items)
4. Read `judge-archive.md` — Phase Summaries section (all findings, escalations)
5. Read `status.json` — full history

### Step 3: Generate task-closure.md

Write `agent-loop/<task-id>/task-closure.md`:

```markdown
# Task Closure: <task-id>

**Closed**: <today's date>
**Final Phase**: release
**Total Rounds**: <sum from history> across <phase count> phases

## What Was Planned
- [List each AC from task.md]

## What Was Delivered
- AC-1: pass | fail — [evidence from release round]
- AC-2: pass | fail — [evidence]

## Deviations from Plan
- [What changed from original spec/plan and why]
(or "None — delivered as planned")

## Leftovers → Backlog
- [Any deferred items from phase summaries that should become backlog items]
(or "None")

## Key Decisions Made
- [Extracted from all phase summaries in builder-archive.md]

## Anti-Patterns Encountered
- [Any AP-IDs that were triggered during this task]
(or "None")

## Artifacts Produced
- [List of files created or significantly modified]
```

### Step 4: Update backlog

If there are leftovers:
1. Read `specs/backlog.md`
2. Append each leftover as a new item with:
   - Source: `task-closure/<task-id>`
   - Priority: `P2` (default)
   - Added: today's date

### Step 5: Handle release

Read `.dual-agent-loop.json` for `release_mode`:

**github-pr**:
1. Create a descriptive commit with all changes from this task
2. Push to a branch named `<task-id>` (e.g., `001-cli-init`)
3. Create a PR using `gh pr create` with the task-closure summary as the body
4. Report the PR URL

**gitlab-mr**:
1. Same as github-pr but use `glab mr create`
2. Report the MR URL

**local**:
1. Create a commit with all changes (if this is a git repo)
2. Report completion

### Step 6: Report

Tell the user:
- Task is closed
- What was delivered vs planned
- Any leftovers added to backlog
- Release action taken (PR URL, MR URL, or commit hash)
