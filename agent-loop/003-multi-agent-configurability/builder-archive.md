# Builder Archive — 003-multi-agent-configurability

## Phase Summaries
<!-- Agents read this section every round -->

### [build] Phase Summary (rounds 1-4, accepted)

#### Key Decisions
- D-1: `AGENTS` registry is the single source of truth for all agent capabilities and template paths
- D-2: `agentMode` is a computed field derived from `builderAgent === judgeAgent`, never used as a primary key
- D-3: Judge inference in `normalizeConfig` only fires when `judgeAgent === undefined` (field absent from config); any explicit value (null, "", false, 0) goes to validation
- D-4: `REMOVED_TEMPLATES` schema uses `judgeAgents: string[]` instead of `modes: string[]`

#### Findings Resolved
- H-1: `normalizeConfig` and `getFilesToScaffold` didn't validate `canBuild` capability → added capability checks to both, rejecting non-builder agents with helpful error messages
- L-1: Anti-pattern check referenced wrong AP IDs → fixed to match actual catalog
- M-1: `false`/`0` as judge values bypassed validation via falsy check → narrowed to `=== undefined || === null || === ''`
- M-2: `null`/`""` still silently inferred instead of rejecting → narrowed to `=== undefined` only

#### Artifacts Produced
- `src/utils/agents.js` — copilot entry, registry-driven helpers
- `src/cli/scaffold.js` — judge-agent selection prompt
- `src/utils/config.js` — agent validation in normalizeConfig
- `src/cli/upgrade.js` — judgeAgent-based removal detection
- `src/templates/agents/copilot-judge.md` — copilot judge template
- `src/cli/scaffold.test.js` — full rewrite for 3-agent model
- `src/utils/config.test.js` — copilot, capability, falsy rejection tests
- `AGENTS.md` — updated agent modes description

#### Deferred / Out of Scope
- `getNextSteps` hardcodes "CLAUDE.md" instead of deriving from builder (only matters if non-claude builders added)
- Upgrade test for copilot judge path (pr-test-analyzer suggestion, rating 6/10)

### [test] Phase Summary (round 1, accepted)

#### Test Coverage
- 237 tests pass, 0 failures, 72 suites
- 54 task-specific tests: 36 in scaffold.test.js, 18 in config.test.js
- Edge cases: capability enforcement, falsy rejection (null/""/false/0), registry immutability, template completeness, file existence, backwards compat

#### Residual Risks
- No dedicated interactive Copilot-selection test (existing `--yes` CLI E2E covers non-interactive path)
- `getNextSteps` hardcodes "CLAUDE.md" (deferred)
- No upgrade test for copilot judge path (low risk — same code path as codex)

#### Judge Correction
- Builder overstated E2E gap; `src/index.test.js` already covers `--yes` CLI scaffold path end-to-end

#### Deferred / Out of Scope
- None new

---

## Raw Archived Rounds
<!-- Agents read this section only when tracing specific findings or decisions -->

### [build] Round 1 — builder

## Round 1 — build

**Timestamp:** 2026-04-16T12:00:00Z

### What Changed

Implementation of backlog #1 (multi-agent configurability) across 8 files:

**Registry expansion (`src/utils/agents.js`):**
- Added `copilot` entry with `displayName`, `id`, `canBuild`, `canJudge`, commands, template paths
- Added `judgeTemplate`, `judgeDestination`, `needsReviewCommand` fields to all agents
- Removed `VALID_MODES` entirely
- Refactored `getFilesToScaffold` to be data-driven from registry (not mode-branching)
- Refactored `getTemplateVars` to use `builderAgent === judgeAgent` instead of mode check
- Refactored `getNextSteps` to use `judge.judgeDestination` instead of constructed path
- Added `builderAgent` validation to `getFilesToScaffold`
- Renamed `REMOVED_TEMPLATES` JSDoc schema from `modes` to `judgeAgents`

**CLI prompt flow (`src/cli/scaffold.js`):**
- Replaced `agentMode` select (dual/single) with `judgeAgent` select (codex/claude/copilot)
- Shows "Builder: Claude Code" as info text
- `agentMode` computed from builder/judge comparison
- Early-return paths derive `agentMode` instead of hardcoding `'dual'`

**Config normalization (`src/utils/config.js`):**
- Imported `AGENTS` for validation
- Changed judge inference from `=== undefined` to falsy check (handles `null`, `""`)
- Added validation of `builderAgent` and `judgeAgent` against registry with helpful error messages
- `agentMode` recomputed after all inference

**Upgrade (`src/cli/upgrade.js`):**
- `detectRemovedFiles` parameter renamed from `agentMode` to `judgeAgent`
- Filter changed from `r.modes.includes(agentMode)` to `r.judgeAgents.includes(judgeAgent)`

**New template (`src/templates/agents/copilot-judge.md`):**
- Mirrors CODEX.md structure adapted for GitHub Copilot

**Documentation (`AGENTS.md`):**
- Updated agent modes description to reflect judge-agent-selection model

**Tests:**
- `scaffold.test.js`: Full rewrite for 3-agent model (registry tests, file list tests, template rendering tests, all pass `builderAgent`)
- `config.test.js`: Added tests for copilot normalization, falsy judge handling, invalid agent validation

### Verification

- 231 tests pass, 0 failures
- ESLint clean
- Prettier clean

### Anti-Pattern Check

Reviewed catalog in `agent-loop/ANTIPATTERNS.md`:

- AP-001 (Unverified Verification): Ran `npm test`, `npm run lint`, `npm run format:check` — all green
- AP-002 (Cross-Document Contradiction): Updated AGENTS.md to match new agent-selection model
- AP-003 (Scope Creep Silence): Stayed within plan scope, deferred Gemini/Aider explicitly
- AP-004 (Assumption Without Spike): Verified backwards compat by testing old config shapes in normalizeConfig
- AP-005 (Incremental Fix, New Inconsistency): Updated REMOVED_TEMPLATES schema and detectRemovedFiles together
- AP-006 (Generic Finding): N/A (builder role)
- AP-007 (Task Redefinition Instead of Escalation): No scope changes made

Note: specify/design phases were written retroactively after implementation. Plan was created in plan mode before implementation but was not judge-reviewed.

### [build] Round 2 — builder

## Round 2 — build

**Timestamp:** 2026-04-18T10:30:00Z

### Addressed Findings

**H-1 (capability validation):** Added `canBuild` and `canJudge` capability checks to both `normalizeConfig()` and `getFilesToScaffold()`. `normalizeConfig({ builder: 'codex' })` now throws `Agent "codex" cannot be used as builder` with a list of valid builders. Same for `getFilesToScaffold({ builderAgent: 'codex', judgeAgent: 'codex' })`. Added 4 new tests (2 in config.test.js, 2 in scaffold.test.js).

**L-1 (anti-pattern IDs):** Fixed round 1 builder.md to reference actual catalog IDs from `agent-loop/ANTIPATTERNS.md` (AP-001 through AP-007).

### Verification

- 235 tests pass (4 new capability tests), 0 failures
- ESLint clean
- Prettier clean
- Verified: `normalizeConfig({ builder: 'codex' })` → throws
- Verified: `normalizeConfig({ builder: 'copilot' })` → throws
- Verified: `getFilesToScaffold({ builderAgent: 'codex', judgeAgent: 'codex' })` → throws

### [build] Round 3 — builder

## Round 3 — build

**Timestamp:** 2026-04-18T11:00:00Z

### Addressed Findings

**M-1 (falsy judge inference):** Narrowed the judge inference check from `!out.judgeAgent` (which treated `false`, `0` as missing) to `=== undefined || === null || === ''`. Now `false` and `0` pass through to registry validation and correctly throw `Invalid judge agent`. Added 2 new tests confirming both `false` and `0` are rejected.

### Verification

- 237 tests pass (2 new), 0 failures
- ESLint clean, Prettier clean
- Verified: `normalizeConfig({ judge: false })` → throws "Invalid judge agent"
- Verified: `normalizeConfig({ judge: 0 })` → throws "Invalid judge agent"
- Verified: `normalizeConfig({ judge: null })` → still infers correctly (codex)
- Verified: `normalizeConfig({ judge: '' })` → still infers correctly (codex)

### [build] Round 4 — builder

## Round 4 — build

**Timestamp:** 2026-04-18T14:00:00Z

### Addressed Findings

**M-2 (null/empty-string judge bypass):** Narrowed inference to `=== undefined` only. Now ANY explicit value — `null`, `""`, `false`, `0` — passes through to registry validation and throws. Inference only triggers when the `judge` field is completely absent from the config (old configs that predate the field). Updated tests: `null` and `""` now assert throws instead of silent inference.

### Verification

- 237 tests pass, 0 failures
- ESLint clean, Prettier clean
- Verified: `normalizeConfig({ judge: null })` → throws "Invalid judge agent"
- Verified: `normalizeConfig({ judge: '' })` → throws "Invalid judge agent"
- Verified: `normalizeConfig({})` → still infers codex (field absent = undefined)
- Verified: `normalizeConfig({ agent_mode: 'single' })` → still infers claude

### [test] Round 1 — builder

## Round 1 — test

**Timestamp:** 2026-04-19T10:00:00Z

### Summary

Test phase for multi-agent configurability. All implementation was completed and accepted in the build phase. This round documents test coverage, edge cases, and verification evidence.

### Test Coverage

237 tests pass, 0 failures across 72 suites. Lint clean, format clean.

Task-specific: 36 tests in scaffold.test.js (registry, file lists, template rendering, capabilities), 18 tests in config.test.js (normalization, validation, backwards compat, falsy rejection).

### Edge Cases Tested

1. Capability enforcement: codex/copilot as builder both throw
2. Falsy value rejection: null, "", false, 0 as judge all throw
3. Registry immutability: AGENTS object frozen
4. Template completeness: zero unresolved {{}} markers for all 3 judge configs
5. File existence: all template src paths resolve on disk
6. Backwards compatibility: old agent_mode configs normalize correctly

### Residual Risks

1. No interactive Copilot-selection test (--yes CLI E2E exists)
2. getNextSteps hardcodes "CLAUDE.md" (deferred)
3. No upgrade test for copilot judge path (low risk)
