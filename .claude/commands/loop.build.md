---
description: "Builder/judge protocol: create new tasks, continue existing ones, or advance phases. Usage: /loop.build new <description>, /loop.build <task-id> [phase], /loop.build (auto-detect)"
---

## User Input

```text
$ARGUMENTS
```

## Instructions

You are the **builder** in the builder/judge protocol. Read `agent-loop/PROTOCOL.md` for the full rules. Never edit `judge.md`.

---

### Step 1: Parse the command

Parse `$ARGUMENTS` to determine the mode:

| Input pattern | Mode | Example |
|--------------|------|---------|
| `new <description>` | **Create** a new task | `/loop.build new CLI init command` |
| `<task-id> <phase>` | **Advance** to a new phase | `/loop.build 001-cli-init plan` |
| `<task-id>` | **Continue** the current phase | `/loop.build 001-cli-init` |
| _(empty)_ | **Auto-detect** most recent task | `/loop.build` |

For auto-detect: find the most recently modified `status.json` under `agent-loop/*/`.

Once the task is resolved, set `TASK_DIR = agent-loop/<task-id>/`. All task file references below use this convention.

---

### Step 2: Handle each mode

#### Mode: CREATE (`new`)

1. Determine the next available task number by scanning existing `agent-loop/NNN-*/` folders
2. Generate a short kebab-case name from the description (e.g., "cli-init-command")
3. Create the folder: `agent-loop/NNN-short-name/`
4. Check if a matching spec already exists in `specs/` (by name similarity)
5. Write `task.md` with:
   - Goal (from the description)
   - Scope (from matching spec if found, otherwise infer from description)
   - Constraints (from constitution if it exists)
   - Acceptance criteria (from matching spec if found, otherwise draft from description)
   - Phase: `specify`
   - Open decisions (flag anything ambiguous)
   - Spec path (if a matching spec exists, reference it)
6. Write `status.json` with state `ready_for_builder`, phase `specify`, round 1
7. **Then immediately proceed to the CONTINUE flow below** for the `specify` phase

#### Mode: ADVANCE (`<task-id> <phase>`)

1. Read `TASK_DIR/status.json` — verify current phase is `accepted` or that user is explicitly requesting phase change
2. Update `TASK_DIR/status.json`: set `phase` to the new phase, reset `round` to 1, set state to `ready_for_builder`
3. Reset `verdict` to null
4. **Then immediately proceed to the CONTINUE flow below**

Valid phases in order: `specify` → `design` → `plan` → `build` → `test` → `release`

#### Mode: CONTINUE (default)

This is the core builder loop. Read the task context and produce output appropriate for the current phase.

---

### Step 3: Read task context

1. Read `TASK_DIR/task.md` — goal, scope, constraints, acceptance criteria
2. Read `TASK_DIR/status.json` — current phase, round, state
3. If the state is `accepted` and no phase override was given, tell the user the current phase is done and suggest the next phase. Do not proceed further.
4. **State guard**: If state is NOT `ready_for_builder` and NOT `needs_revision`, STOP and tell the user: "Cannot proceed — current state is `<state>`. The judge needs to review first. Send to Codex with `judge <task-id>`"
5. If `TASK_DIR/judge.md` exists, read the **latest round** — note every finding by ID (B-1, H-1, M-1, L-1)
6. Read **Phase Summaries** from both `TASK_DIR/builder-archive.md` and `TASK_DIR/judge-archive.md` (if they exist)

---

### Step 4: Do phase-appropriate work

#### Phase: `specify` — Feature Specification

1. If a spec already exists (referenced in `TASK_DIR/task.md`), read it as the starting point
2. If no spec exists, draft one with:
   - User scenarios with priorities (P1, P2, P3) and acceptance scenarios
   - Functional requirements (testable, unambiguous)
   - Key entities with fields and relationships
   - Success criteria (measurable)
   - Edge cases
3. Write/update the spec file at `specs/NNN-feature-name/spec.md`

**Builder.md records**: spec path, any clarifications needed, remaining risks

#### Phase: `design` — Technical Design & Research

1. Read the spec
2. Identify unknowns and technical decisions
3. Research best practices for each technology choice
4. Define data models, interfaces, contracts as needed
5. Document design decisions with rationale

**Builder.md records**: design decisions, research findings, data model summary

#### Phase: `plan` — Implementation Tasks

1. Read spec and design artifacts
2. Generate ordered implementation tasks:
   - Use strict checklist format: `- [ ] [T001] [P?] Description with file path`
   - `[P]` marker if parallelizable
   - Group by implementation phase
3. Include: dependency graph, parallel execution opportunities, MVP scope suggestion

**Builder.md records**: task count, phases, parallel opportunities, dependency summary

#### Phase: `build` — Implementation

1. Read tasks.md and execute tasks in order
2. Follow TDD: write failing test → implement → refactor
3. Mark completed tasks as `[X]` in tasks.md
4. Report progress after each completed task

**Builder.md records**: tasks completed (with IDs), test commands run and results, files changed, any blockers

#### Phase: `test` — Verification & Hardening

1. Run full test suite and record results verbatim
2. Check coverage — identify untested paths
3. Add edge case tests
4. Run linting / type checking if applicable
5. Verify all acceptance criteria can be demonstrated

**Builder.md records**: test output, coverage metrics, edge cases added, AC verification

#### Phase: `release` — Final Readiness

1. Summarize what was built vs. what was planned (tasks.md completion status)
2. List all tests and their pass/fail status
3. Check every acceptance criterion from `TASK_DIR/task.md` — mark pass/fail with evidence
4. Note any deferred items, known limitations, or tech debt
5. Identify any leftovers that should go to `specs/backlog.md`

**Builder.md records**: AC checklist, test summary, deferred items, leftovers for backlog

---

### Step 5: Write builder.md

Determine the round number:
- If `TASK_DIR/builder.md` doesn't exist: Round 1
- Otherwise: increment from the last round in the file

**Context management** (before writing):
- Phase compaction: if active file contains rounds from a prior phase, compact first (see PROTOCOL.md)
- Round archival: if active file has 2+ rounds and you're writing Round N >= 3, archive oldest rounds

Append (never overwrite) a new section:

```markdown
## Round N — [phase]

### Summary
- ...

### Changes Since Last Round
- ... (omit for Round 1)

### Design / Implementation Notes
- ...

### Test Evidence
- ... (omit if no tests yet)

### Responses to Judge Findings
- H-1: addressed by ...
- M-2: declined because ...
(omit for Round 1 or if no TASK_DIR/judge.md exists)

### Verification
- Checked: [what was web-searched or CoVe self-verified]
- Corrections: [what changed as a result, or "None"]

### Remaining Risks
- ...
```

Rules:
- **Append only** — never modify previous rounds
- Respond to **every** judge finding using their IDs
- If declining a finding, state the reason
- Include evidence: spec references, test output, diffs
- Make deltas easy to review — the judge should not need to re-read everything

### Soft round limit check

If this is Round 5 or above, add a note at the top of the round:
> **Note**: This is Round N (soft limit of 5 exceeded). Consider whether escalation would be more productive than continuing iteration.

### Verification step (between Step 4 and Step 5)

Before writing builder.md, run Chain of Verification:

1. **Question**: Generate 3-5 verification questions about your own output — targeting factual claims about external tools, SDKs, APIs, library behavior, or compatibility
2. **Web search**: For each question involving an external tool or API, search current documentation. Do not rely solely on training data.
3. **Revise**: Fix any inconsistencies. Record what was checked and corrected in the `### Verification` section of builder.md.

This is mandatory for `specify`, `design`, and `build` phases. Optional for `test` and `release`.

---

### Step 6: Update TASK_DIR/status.json

- Set `state` to `"ready_for_judge"`
- Update `round` to the current round number
- Update `updated_at` to current ISO timestamp
- Append to `history`: `{ "round": N, "phase": "<phase>", "actor": "builder", "verdict": null, "timestamp": "..." }`

---

### Step 7: Report to the user

Tell the user concisely:
- Task ID and phase
- Round number
- What you produced or changed (files list)
- That it's ready for the judge
- Suggest: "Send to Codex with `judge <task-id>`"
