# Competitor Review: Compound Engineering Plugin

**Reviewed**: 2026-04-12
**Source**: https://github.com/EveryInc/compound-engineering-plugin

## What It Does

The compound engineering plugin is a Claude Code skill suite focused on making each unit of work compound — every task should make subsequent work easier. Key components:

1. **Knowledge capture (`ce:compound`)** — After completing work, captures the key problem-solution pair into `docs/solutions/` with YAML frontmatter (problem_type, tags, status). Creates a searchable knowledge base.
2. **Multi-persona review (`ce:review`)** — Dynamically selects from 17+ reviewer personas (correctness, testing, security, performance, adversarial, etc.) organized into always-on, conditional, and stack-specific tiers. Each persona is a separate agent with focused mandate and structured JSON output.
3. **Structured ideation (`ce:ideate`)** — Dispatches parallel ideation agents with different frames (user pain, inversion/removal, assumption-breaking, leverage/compounding), then applies adversarial filtering to surface top 5-7 actionable improvements.
4. **Environment health check (`ce-setup`)** — Runs comprehensive health check: CLI dependencies, plugin version, repo-local config, `.gitignore` coverage. Offers guided fixes.
5. **Document review gates** — Inside brainstorm and plan skills, dispatches parallel persona agents (coherence-reviewer, feasibility-reviewer, scope-guardian, security-lens, adversarial) to review documents before handoff.

## Comparison with dual-agent-loop

| Compound Engineering | dual-agent-loop | Gap? |
|---------------------|-----------------|------|
| `docs/solutions/` knowledge base with YAML frontmatter | `ANTIPATTERNS.md` for process mistakes only | Yes — no positive knowledge capture (what worked) |
| 17+ review personas, dynamically selected | Single monolithic judge | Yes — judge tries to cover all dimensions in one pass |
| Structured ideation with adversarial filtering | `specs/backlog.md` flat list, manually populated | Yes — no structured ideation process |
| `ce-setup` health check with guided fixes | No post-scaffold validation | Yes — broken state is undiagnosable |
| Document review gates before phase transitions | CoVe (general self-verification) | Partial — CoVe is self-review, not structured multi-lens |

## Transferable Ideas

### High Value (→ backlog items)

1. **Knowledge capture command (`/loop.compound` or `/loop.learnings`)** — After task closure, prompt the builder to document the key problem-solution pair into `docs/solutions/` or similar. The dual-agent-loop already captures anti-patterns (what NOT to do) but has no mechanism for documenting domain-specific solutions that were discovered during tasks.

2. **Multi-persona review catalog for the judge** — Extend the scaffolded `loop.review` command to support role-specific sub-reviews (correctness, testing, security, performance) based on what changed. Scaffold a `review-personas.md` catalog that projects can customize. Prerequisite: multi-agent configurability (#1 in backlog).

3. **`--check` flag for environment diagnostics** — Verify scaffolded protocol is correctly installed: required files exist, `status.json` valid, slash commands registered, agent-loop directory structure matches expected layout. Report missing/broken items with fix suggestions. Complements the upgrade experience (#13).

### Medium Value

4. **Structured ideation command (`/loop.ideate`)** — Scan codebase, dispatch parallel ideation agents with different frames, apply adversarial filtering, output to `specs/ideation/`. Would differentiate the tool but is not essential for core workflow.

5. **Document review gate before phase transitions** — Configurable gate that runs a lightweight review pass on phase artifacts (spec, design doc, plan) before the judge reviews the full round. Overlaps with the spec review checklist idea from the brainstorming skill review — could be combined.

## Not Transferable

- The compound plugin's tight integration with Every Inc's specific stack (Next.js, Prisma, etc.) and their `ce-setup` script's dependency checking. The dual-agent-loop is stack-agnostic.
- The 17-persona system at full scale would be over-engineered for a scaffolding tool. A simpler 4-5 persona catalog with the ability to add custom ones is the right scope.
- The `ce:compound-refresh` skill for periodically refreshing the knowledge base is premature — need the knowledge base first.
