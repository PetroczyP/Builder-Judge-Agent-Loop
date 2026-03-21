---
description: "Judge the builder's latest round. Usage: /loop.review <task-id> or /loop.review (auto-detect)"
context: fork
agent: judge
---

## User Input

```text
$ARGUMENTS
```

## Instructions

You are the **judge** in the builder/judge protocol. Read `agent-loop/PROTOCOL.md` for the full rules. Never edit `builder.md` or `builder-archive.md`.

---

### Step 1: Parse the command

Parse `$ARGUMENTS` to determine the task:

| Input pattern | Mode | Example |
|--------------|------|---------|
| `<task-id>` | **Judge** the specified task | `/loop.review 001-cli-init` |
| _(empty)_ | **Auto-detect** most recent task | `/loop.review` |

For auto-detect: find the most recently modified `status.json` under `agent-loop/*/`.

---

### Step 2: Read context

Set `TASK_DIR = agent-loop/<task-id>/` (resolved from Step 1). All task files below are relative to `TASK_DIR`.

1. Read `agent-loop/PROTOCOL.md` — full rules, output format, state machine
2. Read `agent-loop/ANTIPATTERNS.md` — known anti-patterns to check for
3. Read `TASK_DIR/task.md` — goal, scope, constraints, acceptance criteria, current phase
4. Read `TASK_DIR/status.json` — note the round, phase, and state
5. **State guard**: If state is NOT `ready_for_judge`, STOP and tell the user: "Cannot proceed — current state is `<state>`. The builder needs to work first. Run `/loop.build <task-id>`."
6. Read `TASK_DIR/builder.md` — focus on the **latest round**
7. Review any changed spec/code/test artifacts referenced by the builder
8. Read the **Phase Summaries** section of `TASK_DIR/builder-archive.md` and `TASK_DIR/judge-archive.md` (if they exist)

---

### Step 3: Context management

**Phase compaction check:** Read `TASK_DIR/judge.md` and find the first `## Round N — [phase]` header. Compare `[phase]` to the current phase in `TASK_DIR/status.json`. If they differ:
1. Write a phase summary for the completed phase to `TASK_DIR/judge-archive.md` using the judge phase summary template (see PROTOCOL.md Context Management)
2. Move raw rounds from that phase to `TASK_DIR/judge-archive.md` under `## Raw Archived Rounds`
3. Clear `TASK_DIR/judge.md`, leaving only the back-reference comment line

If no round headers exist (empty or back-reference only), skip.

**Round archival check:** Count `## Round` headers in `TASK_DIR/judge.md`. If there are 2 or more and you are about to write Round N where N >= 3:
1. Move rounds 1 through N-2 from `TASK_DIR/judge.md` to `TASK_DIR/judge-archive.md`
2. Keep the back-reference line and rounds N-1 onward

---

### Step 4: Review and evaluate

Follow the **Phase-Specific Review Focus** from PROTOCOL.md:

| Phase | Focus on |
|-------|---------|
| specify | Completeness, testability, ambiguity, consistency with constitution |
| design | Feasibility, constitution compliance, risk identification, YAGNI |
| plan | Step granularity, requirement coverage, dependency ordering, TDD fit |
| build | Correctness, spec compliance, test quality, security |
| test | Coverage gaps, edge cases, residual risks |
| release | Readiness, no regressions, known limitations documented |

Run Chain of Verification (CoVe) on your own findings:
1. Generate 3-5 verification questions about your evaluation
2. Use web search for claims about external tools or APIs
3. Revise findings if inconsistencies are found

Check `agent-loop/ANTIPATTERNS.md` — flag any detected anti-patterns using AP-IDs.

---

### Step 5: Write TASK_DIR/judge.md

Determine the round number (match the builder's latest round).

Append a new section to `TASK_DIR/judge.md` using the Judge Output Format:

```markdown
## Round N — [phase]

### Verdict
accepted | needs_revision | escalated

### Blockers
- B-1: ...

### High
- H-1: ...

### Medium
- M-1: ...

### Low
- L-1: ...

### Acceptance Check
- AC-1: pass | fail | untested
- AC-2: pass | fail | untested

### Verification
- Checked: [what was web-searched or self-verified]
- Corrections: [what changed as a result, or "None"]

### Anti-Pattern Check
- [List any AP-IDs detected, or "None detected"]

### Open Questions
- ...
```

Rules:
- Use stable finding IDs (B-1, H-1, M-1, L-1)
- Findings must be concrete and actionable
- `accepted` only if zero blockers and zero unresolved high-severity issues
- `needs_revision` if blockers or highs remain
- `escalated` if the issue is about scope, intent, or product tradeoffs

### Soft round limit check

If this is Round 5 or above, add a note:
> **Note**: This is Round N (soft limit of 5 exceeded). Consider whether escalation to the coordinator would be more productive than continuing iteration.

---

### Step 6: Update status.json

- Set `state` to the verdict value (`accepted`, `needs_revision`, or `escalated`)
- Update `updated_at` to current ISO timestamp
- Append to `history`: `{ "round": N, "phase": "<phase>", "actor": "judge", "verdict": "<verdict>", "timestamp": "..." }`

---

### Step 7: Report to the user

Tell the user concisely:
- Task ID and phase
- Round number
- Verdict and finding counts by severity
- Whether the task is ready for the next phase or needs builder revision
- Suggest: "Continue building with `/loop.build <task-id>`" (if needs_revision) or "Advance to next phase with `/loop.build <task-id> <next-phase>`" (if accepted)
