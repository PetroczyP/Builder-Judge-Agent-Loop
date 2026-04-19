# Task: Multi-Agent Configurability

## Goal

Replace hardcoded single/dual agent mode with explicit builder + judge agent selection. Add GitHub Copilot as a third judge option. Make file scaffolding data-driven from the agent registry.

## Scope

- Add `copilot` to AGENTS registry with template fields
- Refactor `getFilesToScaffold`, `getTemplateVars`, `getNextSteps` to be registry-driven
- Replace mode prompt with judge-agent selection in `gatherConfig()`
- Add agent validation to `normalizeConfig` and `getFilesToScaffold`
- Update `detectRemovedFiles` to use `judgeAgent` instead of `agentMode`
- Create copilot judge template

## Constraints

- Builder is always Claude in v1 (no builder selection prompt)
- `agent_mode` preserved as computed field for backwards compat
- `--yes` defaults unchanged
- No Gemini/Aider (deferred)

## Acceptance Criteria

See `specs/003-multi-agent-configurability/spec.md` for full AC list (AC-1 through AC-13).

## Phase

build (implementation complete, pending judge review)

## Spec Path

`specs/003-multi-agent-configurability/spec.md`
