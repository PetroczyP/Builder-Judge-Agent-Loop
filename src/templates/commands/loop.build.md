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
5. **Determine starting phase:** The default starting phase is `specify`. The builder MAY start at a later phase if each skipped phase has a concrete justification.
   - For each skipped phase, record in `status.json.skipped_phases`: `{ "phase": "<name>", "justification": "<reason>" }`
   - **Insufficient justifications** (these will be flagged by the judge): "small change", "straightforward", "obvious", "not needed", "simple task"
   - **Valid justification examples**:
     - "Existing spec at `specs/003-auth/spec.md` covers all requirements"
     - "Bug fix with reproduction steps in issue #47 — no design decisions needed"
     - "Single-file config change — scope is self-evident from the diff"
   - If 3 or more phases are skipped, each justification must be especially strong — the judge will flag this as H-severity
6. Write `task.md` with:
   - Goal (from the description)
   - Scope (from matching spec if found, otherwise infer from description)
   - Constraints (from constitution if it exists)
   - Acceptance criteria (from matching spec if found, otherwise draft from description)
   - Phase: the determined starting phase
   - Open decisions (flag anything ambiguous)
   - Spec path: **only include if** a matching spec already exists in `specs/` OR the `specify` phase was not skipped. Do NOT reference a spec path that does not exist.
7. Write `status.json` with state `ready_for_builder`, phase set to the starting phase, round 1. Include `skipped_phases` array if any phases were skipped.
8. **Then immediately proceed to the CONTINUE flow below** for the starting phase

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
4. **State guard**: If state is NOT `ready_for_builder` and NOT `needs_revision`, STOP and tell the user: "Cannot proceed — current state is `<state>`. The judge needs to review first. {{JUDGE_INVOKE_INSTRUCTION}}"
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

**Test gate:** Each build round that introduces new behavior MUST include at least one new test covering that behavior. Running only pre-existing tests is insufficient when new behavior is introduced.

**Escape hatch:** If the round does not introduce new behavior (refactoring, documentation, config-only changes, template-only changes), the builder MAY skip the test gate with a justification recorded in `### Test Evidence` explaining why no new test applies. Example: "Template-only markdown changes — no executable code to test."

**Builder.md records**: tasks completed (with IDs), test commands run and results (including names of new tests), files changed, any blockers

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

### Step 5: Pre-flight checklist

Before writing builder.md, complete these checks.

- **CoVe (5a)**: Mandatory for `specify`, `design`, and `build` phases. Optional for `test` and `release`.
- **Anti-pattern check (5b)**: Mandatory on **every phase**.

#### 5a. Chain of Verification (CoVe)

1. **Question**: Generate 3-5 verification questions about your own output — targeting factual claims and assumptions
2. **Categorize and verify**: For each question, determine the claim type and use the correct method:

   | Claim type | Examples | Required method |
   |------------|----------|----------------|
   | **External** | SDK behavior, API signatures, library features, tool capabilities, compatibility | **Web search** — check current docs, not training data |
   | **Internal** | Repo structure, existing code behavior, file contents, project conventions | **Repo search** — use Grep, Read, Glob to verify against actual code |

3. **Revise**: Fix any inconsistencies found. Record what was checked, the method used, and any corrections in the `### Verification` section of builder.md.

#### 5b. Anti-pattern check

1. Read `agent-loop/ANTIPATTERNS.md`
2. Scan your output for matches against cataloged anti-patterns
3. Record findings in the `### Anti-Pattern Check` section of builder.md, listing AP-IDs reviewed and any violations detected

#### 5c. Update preflight flags

After completing both checks, note that `status.json.preflight` will be set in the status.json update step:
- `cove_completed`: `true`
- `antipatterns_checked`: `true`

Only set these flags after actually completing the steps above. Setting flags without doing the work is itself an anti-pattern (AP-001).

---

### Step 6: Write builder.md

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
- Checked: [what was checked, method used (web search or repo search), and result]
- Corrections: [what changed as a result, or "None"]

### Anti-Pattern Check
- [List AP-IDs reviewed and any violations detected, or "None detected"]

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

---

### Step 7: Update TASK_DIR/status.json

- Set `state` to `"ready_for_judge"`
- Update `round` to the current round number
- Update `updated_at` to a **real** ISO 8601 timestamp. Generate it with: `date -u +"%Y-%m-%dT%H:%M:%SZ"`. **Never use placeholder values** like `00:00:00Z` or `2026-01-01T00:00:00Z`.
- Set `preflight.cove_completed` and `preflight.antipatterns_checked` based on the pre-flight checklist results (Step 5)
- Append to `history`: `{ "round": N, "phase": "<phase>", "actor": "builder", "verdict": null, "timestamp": "..." }` (use the same real timestamp)

---

### Step 8: Report to the user

Tell the user concisely:
- Task ID and phase
- Round number
- What you produced or changed (files list)
- That it's ready for the judge
- Suggest: "{{JUDGE_INVOKE_INSTRUCTION}}"
