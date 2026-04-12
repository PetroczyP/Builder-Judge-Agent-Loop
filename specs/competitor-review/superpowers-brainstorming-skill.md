# Competitor Review: Superpowers Brainstorming Skill

**Reviewed**: 2026-04-12
**Source**: `superpowers:brainstorming` skill (installed in this project via superpowers plugin)

## What It Does

The brainstorming skill is a rigid, multi-phase workflow for creative/design work. It enforces:

1. **Structured spec writing** — a spec-document-reviewer subagent loop (up to 3 iterations) checks completeness, consistency, clarity, scope, and YAGNI before presenting the spec
2. **Scope gating** — before asking detailed questions, it checks whether the request describes multiple independent subsystems and flags decomposition immediately
3. **Alternatives-first design** — requires proposing 2-3 approaches with trade-offs before settling on one
4. **Sectional presentation** — presents design sections one at a time, gets approval after each, scales detail to complexity
5. **Isolation-first architecture** — mandates that systems are broken into units with clear purpose, well-defined interfaces, independently testable

## Comparison with dual-agent-loop

| Brainstorming Skill | dual-agent-loop | Gap? |
|---------------------|-----------------|------|
| Spec-document-reviewer subagent loop | CoVe (self-verification) — general purpose, not spec-focused | Yes — no spec-specific quality checklist |
| Scope decomposition check before detailed work | No equivalent — relies on coordinator/judge to notice scope bloat | Yes — scope check should happen at task creation |
| Alternatives-first design (2-3 approaches) | Design phase asks for "technical decisions with rationale" but doesn't require alternatives | Yes — alternatives section should be mandatory |
| Sectional approval within long phases | Each round is an indivisible unit | Partial — optimization for complex tasks |
| Isolation-first architecture mandate | No equivalent anti-pattern cataloged | Minor — could be AP-008 |

## Transferable Ideas

### High Value (→ backlog items)

1. **Spec review checklist for specify phase** — Adapt the spec-document-reviewer checklist (completeness, consistency, clarity, scope, YAGNI) as a template file scaffolded into projects. The builder runs it before marking `ready_for_judge` in the specify phase. Lightweight, high impact.

2. **Scope-size check at task creation** — In `/loop.build new`, add a step that checks whether the task implies multiple independent subsystems. Prompt the coordinator to decompose or explicitly justify proceeding. Record the decision in `task.md`.

3. **Mandatory alternatives analysis in design phase** — Extend builder output format for the design phase to include a `### Alternatives Considered` section. Update judge's design-phase review focus to verify alternatives were genuinely explored.

### Medium Value

4. **AP-008: Monolithic Design Without Unit Boundaries** — New anti-pattern entry for designs that produce no module/component boundaries, no interface definitions. Based on the "design for isolation and clarity" principle.

5. **Sectional approval for complex designs** — Allow the builder to present design output in sections and request partial acknowledgment. Reduces blast radius of judge findings on large designs. Should be optional and only for tasks flagged as complex.

## Not Transferable

- The brainstorming skill's multi-round question-asking phase (asking 3 questions at a time) is specific to human-interactive brainstorming. The dual-agent-loop's specify phase already handles this through builder/judge rounds.
- The skill's "present options conversationally" style doesn't apply — the protocol's structured markdown output is better for auditability.
