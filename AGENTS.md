# AGENTS.md

Repository-wide instructions for all agents working in this repo.

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
