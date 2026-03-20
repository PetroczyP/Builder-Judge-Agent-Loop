# create-dual-agent-loop

Scaffold the **Builder/Judge dual-agent collaboration protocol** into any project. A structured SDLC with quality gates for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and [OpenAI Codex](https://openai.com/index/openai-codex/).

Workflow inspired by and compatible with [GitHub Spec-Kit](https://github.com/github/spec-kit) (MIT).

## What is this?

A development protocol where two AI agents collaborate on every task:

- **Builder** (Claude Code) — writes specs, designs, code, and tests
- **Judge** (Codex) — reviews, validates, and blocks or accepts each phase

A human **coordinator** has final authority on scope, tradeoffs, and escalations.

Every feature goes through structured phases with built-in quality gates:

```
specify → design → plan → build → test → release
```

The judge must accept each phase before the builder can proceed. This prevents hallucinations, scope creep, and low-quality output from reaching production.

## Quick Start

```bash
npx create-dual-agent-loop
```

Or using npm's init convention:

```bash
npm init dual-agent-loop
```

Answer a few questions (coordinator name, release mode, max rounds), and the protocol is scaffolded into your project.

## What gets created

```
your-project/
  agent-loop/
    PROTOCOL.md              # Complete protocol rules (single source of truth)
    ANTIPATTERNS.md           # Known mistakes catalog (7 universal patterns)
  .claude/commands/
    loop.build.md             # Builder slash command
    loop.status.md            # Status query
    loop.backlog.md           # Backlog management
    loop.close.md             # Task closure + release
  specs/
    backlog.md                # Idea backlog
  CODEX.md                    # Judge instructions (points to PROTOCOL.md)
  AGENTS.md                   # Shared agent coordination rules
  CHEATSHEET.md               # Human quick reference
  CLAUDE.md                   # Builder-Judge section (appended if file exists)
  .dual-agent-loop.json       # Configuration
```

## Usage

### Start a task (in Claude Code)

```
/loop.build new Add user authentication
```

This creates a task folder, writes a spec, and marks it ready for the judge.

### Judge the task (in Codex)

```
judge 001-user-auth
```

Codex reads the protocol, reviews the builder's work, and issues a verdict: `accepted`, `needs_revision`, or `escalated`.

### Continue building (in Claude Code)

```
/loop.build 001-user-auth
```

Address the judge's findings and submit the next round.

### Advance phases

```
/loop.build 001-user-auth design
```

### Other commands

| Command | What it does |
|---------|-------------|
| `/loop.status` | Show all task statuses |
| `/loop.backlog` | View the idea backlog |
| `/loop.backlog add <idea>` | Add an idea to the backlog |
| `/loop.backlog pick <#>` | Promote a backlog item to a task |
| `/loop.close <task-id>` | Generate closure report + release |

## How it works

### State machine

```
ready_for_builder → ready_for_judge    (builder writes round)
ready_for_judge   → needs_revision     (judge: try again)
ready_for_judge   → accepted           (judge: good to go)
ready_for_judge   → escalated          (judge: need human input)
needs_revision    → ready_for_judge    (builder fixes)
escalated         → any                (coordinator decides)
```

### State guards

Agents enforce turn-taking automatically:
- Builder refuses to work if the judge hasn't reviewed yet
- Judge refuses to review if the builder hasn't submitted yet
- After 5 rounds on a phase, both agents flag it (soft limit, not blocking)

### Chain of Verification (CoVe)

Built into every phase — not optional:
1. Generate the artifact
2. Self-question (3-5 verification questions targeting factual claims)
3. Web search for external claims (SDKs, APIs, library behavior)
4. Revise and document corrections

### Sliding window archiving

Active files (`builder.md`, `judge.md`) never grow unbounded:
- Phase compaction moves completed phases to archive files
- Within-phase archival keeps at most 2 rounds in the active file
- Phase summaries are read every round; raw archives only on demand

### Anti-pattern catalog

Seven universal patterns both agents check before every round:
- AP-001: Unverified Verification
- AP-002: Cross-Document Contradiction
- AP-003: Scope Creep Silence
- AP-004: Assumption Without Spike
- AP-005: Incremental Fix, New Inconsistency
- AP-006: Generic Finding
- AP-007: Task Redefinition Instead of Escalation

## Configuration

`.dual-agent-loop.json`:

```json
{
  "version": "0.1.0",
  "coordinator": "Your Name",
  "release_mode": "github-pr",
  "builder": "claude",
  "judge": "codex",
  "max_rounds": 5,
  "specs_dir": "specs",
  "loop_dir": "agent-loop"
}
```

### Release modes

| Mode | What `/loop.close` does |
|------|------------------------|
| `github-pr` | Commit → push branch → `gh pr create` |
| `gitlab-mr` | Commit → push branch → `glab mr create` |
| `local` | Commit (if git repo) → done |

## Existing projects

Running `npx create-dual-agent-loop` in a project that already has a `CLAUDE.md` will **append** the workflow section — it never overwrites your existing content. All other files are created only if they don't exist (use `--force` to overwrite).

## License

MIT
