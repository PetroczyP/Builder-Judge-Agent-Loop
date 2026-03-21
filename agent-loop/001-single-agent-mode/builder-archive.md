# Builder Archive — 001-single-agent-mode

## Phase Summaries
<!-- Agents read this section every round -->

### [build] Phase Summary (rounds 1-3, accepted)

#### Key Decisions
- D-1: Template variable substitution (`{{VAR}}`) instead of separate template variants — ~15 substitutions across 5 files
- D-2: Central agent registry (`src/utils/agents.js`) as single source of truth for agent metadata
- D-3: Judge subagent uses `context: fork` session isolation (not `permissionMode: plan`) — coordinator resolved this in Round 3 escalation, accepting trust-based boundary model matching Codex in dual mode
- D-4: Three-layer judge boundary: session isolation via `context: fork`, dedicated evaluation prompt, protocol file ownership rules

#### Findings Resolved
- B-1 (Round 1): `/loop.review` missing `context: fork` + `agent: judge` wiring → added frontmatter in Round 2
- H-1 (Round 1): `permissionMode: plan` blocked judge from writing judge.md/status.json → removed, added Edit/Write tools in Round 2
- H-1/AP-007 (Round 2): Builder changed requirement without escalating → coordinator resolved by updating task.md (Round 3)
- M-1 (Round 2): No tests for spec-critical wiring → added 2 regression tests in Round 3
- L-1 (Round 1): Stale `# CODEX.md` title and `judge` example → fixed to `# Judge Agent` and `/loop.review` in Round 2

#### Artifacts Produced
- `src/utils/agents.js` — Agent registry: AGENTS map, getTemplateVars(), getFilesToScaffold(), getNextSteps()
- `src/templates/agents/claude-judge.md` — Judge subagent with session isolation boundary
- `src/templates/commands/loop.review.md` — Judge workflow slash command with `context: fork` + `agent: judge`
- `src/cli/scaffold.test.js` — 28 tests covering registry, template vars, file lists, template rendering, and spec-critical wiring
- `src/cli/scaffold.js` — Modified: agent mode prompt, dynamic file lists, template vars
- `src/templates/protocol/PROTOCOL.md` — Modified: 4 template substitutions
- `src/templates/agents/AGENTS.md` — Modified: 5 template substitutions
- `src/templates/agents/CLAUDE.md.section` — Modified: 2 template substitutions
- `src/templates/agents/CHEATSHEET.md` — Modified: 3 template substitutions
- `src/templates/commands/loop.build.md` — Modified: 2 template substitutions
- `scripts/scaffold-self.js` — Modified: uses agent registry, skips project-specific files
- `.dual-agent-loop.json` — Modified: added `agent_mode: "dual"`, version `0.2.0`

#### Deferred / Out of Scope
- No live integration test of `context: fork` + `agent: judge` in a scaffolded project (depends on Claude Code runtime)
- Multi-agent configurability (Claude+Codex/Copilot selection) — deferred to backlog item #1

---

## Raw Archived Rounds
<!-- Agents read this section only when tracing specific findings or decisions -->

### [build] Round 1 — builder

#### Summary

Implemented single-agent mode for the dual-agent-loop CLI tool. Users who only have Claude Code can now run the full builder/judge protocol using Claude Code's native subagent system. The judge subagent runs in `permissionMode: plan` (read-only), providing a hard technical boundary between builder and judge roles. The coordinator (human) explicitly triggers each phase switch — no auto-cycling.

#### Design / Implementation Notes

**Architecture decisions:**
- Used template variables (`{{BUILDER_AGENT_NAME}}`, `{{JUDGE_AGENT_NAME}}`, etc.) instead of separate template variants — only ~15 substitutions across 5 files, avoids template drift
- Created a central agent registry (`src/utils/agents.js`) that encodes all agent metadata — display names, IDs, capabilities, file mappings, and command hints
- Judge subagent uses `permissionMode: plan` which physically prevents editing code files — this is a hard boundary, not just a prompt instruction
- Setup flow adds agent mode as the first interactive prompt; `--yes` defaults to `dual` for backwards compatibility

**Files created (4):**
- `src/utils/agents.js` — Agent registry: AGENTS map, getTemplateVars(), getFilesToScaffold(), getNextSteps()
- `src/templates/agents/claude-judge.md` — Judge subagent definition with YAML frontmatter (permissionMode: plan, tools: Read/Grep/Glob/Bash/WebSearch/WebFetch)
- `src/templates/commands/loop.review.md` — Full judge workflow as a slash command
- `src/cli/scaffold.test.js` — 26 tests covering registry, template vars, file lists, and template rendering

**Files modified (7):**
- `src/cli/scaffold.js` — Import agents.js, add agentMode prompt, dynamic file list via getFilesToScaffold(), agent template vars in loadTemplate(), dynamic next-steps output, config JSON with agent_mode/version bump
- `src/templates/protocol/PROTOCOL.md` — 4 substitutions (roles table, status.json example)
- `src/templates/agents/AGENTS.md` — 5 substitutions (role definitions, section headers)
- `src/templates/agents/CLAUDE.md.section` — 2 substitutions (builder/judge lines)
- `src/templates/agents/CHEATSHEET.md` — 3 substitutions (section headers, file descriptions)
- `src/templates/commands/loop.build.md` — 2 substitutions (judge invoke instructions)
- `scripts/scaffold-self.js` — Refactored to use agent registry, added skip for project-specific files (backlog.md)

#### Test Evidence

```
tests 26 | pass 26 | fail 0
```

#### Verification

- Checked: Claude Code subagent `permissionMode: plan` behavior — confirmed it restricts the agent to read-only operations
- Checked: Claude Code subagent YAML frontmatter format — valid fields
- Checked: Enquirer `select` prompt with `name`/`message` choice format — correct API
- Corrections: None

### [build] Round 2 — builder

#### Summary

Addressed all judge findings from Round 1. Fixed the `/loop.review` command to run inside the judge subagent via `context: fork` + `agent: judge` frontmatter. Revised the judge subagent to remove `permissionMode: plan` and replaced it with session isolation + prompt-based role boundary. Fixed stale CODEX.md title in the judge template.

#### Responses to Judge Findings

- B-1 (AP-001): Added `context: fork` and `agent: judge` to `loop.review.md` frontmatter.
- H-1: Removed `permissionMode: plan`, added Edit/Write tools, three-layer boundary model.
- L-1: Changed title to `# Judge Agent`, fixed example invocation.

#### Test Evidence

```
tests 26 | pass 26 | fail 0
```

### [build] Round 3 — builder

#### Summary

Coordinator resolved Round 2 escalation (Option B): drop `permissionMode: plan`, accept trust-based boundary model. Task requirements updated. Two new tests added per judge M-1.

#### Responses to Judge Findings

- B-1 (Round 2): Resolved by coordinator updating task.md.
- H-1/AP-007 (Round 2): Acknowledged — builder should have escalated.
- M-1 (Round 2): Added 2 regression tests for spec-critical wiring.

#### Test Evidence

```
tests 28 | pass 28 | fail 0
```
