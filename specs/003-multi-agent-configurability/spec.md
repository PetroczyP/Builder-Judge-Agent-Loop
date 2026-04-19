# Spec: Multi-Agent Configurability

**Created:** 2026-04-16
**Source:** Backlog #1 (task-001 closure)
**Priority:** P1

## Problem Statement

The CLI hardcodes Claude as builder and Codex as judge (or Claude as both in single mode). Users cannot choose alternative judge agents. The `AGENTS` registry has only two entries and `gatherConfig()` hardcodes the assignment. Users interested in GitHub Copilot as their judge agent have no path.

## Goals

1. Allow users to select their judge agent during `init-agent-loop` setup
2. Support Copilot as a third judge option alongside Codex and Claude
3. Drive file scaffolding from the agent registry (data-driven, not mode-branching)
4. Maintain backwards compatibility with existing configs that use `agent_mode`

## Non-Goals

- No builder selection (Claude-only in v1)
- No Gemini or Aider support (deferred)
- No runtime behavior changes beyond scaffolding

## Scope

- **Builder**: Claude-only, no builder selection prompt
- **New judge agents**: Copilot only
- **UX**: Replace single/dual mode prompt with builder + judge selection
- **`agent_mode`**: Keep as computed field for backwards compat

This means: 3 judge options (Claude, Codex, Copilot), 1 builder (Claude), 1 new template file.

## Acceptance Criteria

- AC-1: `AGENTS` registry includes `copilot` entry with correct capabilities and template fields
- AC-2: All agents have `judgeTemplate`, `judgeDestination`, `needsReviewCommand` fields
- AC-3: `getFilesToScaffold` is driven by registry fields, not mode branching
- AC-4: `getTemplateVars` validates both builder and judge agents and capabilities
- AC-5: Interactive prompt shows judge selection (Codex/Claude/Copilot) instead of mode (dual/single)
- AC-6: `--yes` flag defaults unchanged (claude builder, codex judge)
- AC-7: `normalizeConfig` handles old configs with only `agent_mode` field
- AC-8: `normalizeConfig` validates agent IDs against the registry
- AC-9: `agentMode` is always recomputed from actual agents (derived, not primary)
- AC-10: Copilot judge template exists and renders correctly with all template variables
- AC-11: `REMOVED_TEMPLATES` schema uses `judgeAgents` (not `modes`)
- AC-12: `detectRemovedFiles` filters by `judgeAgent` (not `agentMode`)
- AC-13: All tests pass, lint clean, format clean
