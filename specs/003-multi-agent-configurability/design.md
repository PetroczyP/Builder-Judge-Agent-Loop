# Design: Multi-Agent Configurability

**Created:** 2026-04-16

## Architecture Decision

Make `getFilesToScaffold` data-driven from registry fields instead of mode-branching. Adding a new agent in the future requires only a registry entry + template file, zero code changes.

### Alternatives Considered

1. **Keep mode branching, add copilot as third mode** — rejected because modes are a leaky abstraction; the real primitives are builder + judge agent selection.
2. **Builder + judge selection with mode as presentation** — selected. `agentMode` becomes a computed field (`builderAgent === judgeAgent ? 'single' : 'dual'`). UI prompts for judge directly.
3. **Full builder + judge matrix** — deferred. Only Claude can build in v1, so builder prompt would be a single-option menu.

### Registry Extension

Each agent gets new fields:
- `judgeTemplate` — path to template source
- `judgeDestination` — path to scaffold destination
- `needsReviewCommand` — whether to include `loop.review.md`

### Backwards Compatibility

`normalizeConfig` handles the migration:
1. Old config with `agent_mode: 'single'` → infer `judgeAgent: 'claude'`
2. Old config with `agent_mode: 'dual'` → infer `judgeAgent: 'codex'`
3. New config with explicit `judge` field → use directly
4. Always recompute `agentMode` from actual agents

### Validation

Validation at two boundaries:
- `normalizeConfig` — validates agent IDs against registry (catches bad config files)
- `getFilesToScaffold` / `getTemplateVars` — validates agents exist and have required capabilities

## Files Changed

- `src/utils/agents.js` — registry + 3 functions refactored
- `src/cli/scaffold.js` — `gatherConfig()` prompt flow
- `src/utils/config.js` — `normalizeConfig()` validation + falsy handling
- `src/cli/upgrade.js` — `detectRemovedFiles` parameter rename
- `AGENTS.md` — documentation update

## Files Created

- `src/templates/agents/copilot-judge.md` — Copilot judge instructions
