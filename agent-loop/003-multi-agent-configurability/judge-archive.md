# Judge Archive — 003-multi-agent-configurability

## Phase Summaries
<!-- Agents read this section every round -->

### [build] Phase Summary (rounds 1-4, accepted)

#### Key Findings
- H-1: `normalizeConfig()` and `getFilesToScaffold()` accepted non-buildable builders despite the v1 Claude-only builder constraint -> resolved in round 2
- L-1: The builder's anti-pattern review cited nonexistent AP IDs -> resolved in round 2
- M-1 (AP-005): Judge inference widened enough to let `false` and `0` bypass registry validation in `normalizeConfig()` -> resolved in round 3
- M-2: Explicit `null` and `''` judge values still bypassed registry validation via inference instead of rejection -> resolved in round 4

#### Escalations
- None.

#### Acceptance Criteria Status
- AC-1: pass
- AC-2: pass
- AC-3: pass
- AC-4: pass
- AC-5: pass
- AC-6: pass
- AC-7: pass
- AC-8: pass
- AC-9: pass
- AC-10: pass
- AC-11: pass
- AC-12: pass
- AC-13: pass

#### Verification Notes
- Verified `npm test`, `npm run lint`, and `npm run format:check` stayed green through the accepted build state
- Verified `normalizeConfig()` now rejects unsupported builders and explicit invalid judge values (`null`, `''`, `false`, `0`) while still inferring legacy defaults only when the judge field is absent
- Verified the registry-driven scaffolding paths now cover Codex, Claude same-agent mode, and GitHub Copilot without regressing backwards compatibility

---

## Raw Archived Rounds
<!-- Agents read this section only when tracing specific findings or decisions -->

### [build] Round 1 — judge

## Round 1 — build

### Verdict
needs_revision

### Blockers
- None

### High
- H-1: `normalizeConfig()` and `getFilesToScaffold()` still accept non-buildable builders, so unsupported configs can look valid until `getTemplateVars()` fails later. `normalizeConfig({ builder: 'codex', judge: 'codex' })` currently returns a normalized single-agent config in `src/utils/config.js`, and `getFilesToScaffold({ builderAgent: 'codex', judgeAgent: 'codex' })` returns a full scaffold list in `src/utils/agents.js:83-107` even though `codex.canBuild === false`. That contradicts the v1 constraint in `task.md` ("Builder is always Claude in v1") and the builder's claim that `getFilesToScaffold` now validates `builderAgent` in `builder.md:16`. Centralize capability validation and call it from both helpers, then add tests that reject `builder: 'codex'` and `builder: 'copilot'`.

### Medium
- None

### Low
- L-1: The `### Anti-Pattern Check` section in `builder.md:53-57` does not map to the actual catalog in `agent-loop/ANTIPATTERNS.md` (for example, AP-001 is "Unverified Verification", not "Scope Creep"). Since `status.json` marks `antipatterns_checked: true`, the round should either reference the real AP IDs reviewed or say "None detected."

### Acceptance Check
- AC-1: pass
- AC-2: pass
- AC-3: pass
- AC-4: pass
- AC-5: pass
- AC-6: pass
- AC-7: pass
- AC-8: pass
- AC-9: pass
- AC-10: pass
- AC-11: pass
- AC-12: pass
- AC-13: pass
- Scope validation requirement: fail

### Verification
- Checked: `npm test`, `npm run lint`, `npm run format:check`
- Checked: `normalizeConfig({ builder: 'codex', judge: 'codex' })` returns a normalized config, `getFilesToScaffold({ builderAgent: 'codex', judgeAgent: 'codex' })` returns 10 managed files, and `getTemplateVars({ builderAgent: 'codex', judgeAgent: 'codex' })` then throws `Agent "codex" cannot be used as builder`
- Corrections: I initially treated the gap as a `getFilesToScaffold()` issue only; verification showed `normalizeConfig()` also accepts the unsupported builder combination and recomputes `agentMode` to `single`

### Anti-Pattern Check
- None detected

### Open Questions
- None

### [build] Round 2 — judge

## Round 2 — build

### Verdict
needs_revision

### Blockers
- None

### High
- None

### Medium
- M-1 (AP-005): `normalizeConfig()` now treats any falsy `judge` value as "missing" in `src/utils/config.js:52-56`, so malformed configs like `{ judge: false, agent_mode: 'single' }` and `{ judge: 0, agent_mode: 'single' }` silently normalize to `judgeAgent: 'claude'` instead of failing validation. That means invalid agent IDs can still bypass AC-8's registry validation requirement and drive scaffold/upgrade flows with a config the user did not actually specify. Narrow the inference path to genuinely missing values and add tests that reject non-string falsy values such as `false` and `0`.

### Low
- None

### Acceptance Check
- AC-1: pass
- AC-2: pass
- AC-3: pass
- AC-4: pass
- AC-5: pass
- AC-6: pass
- AC-7: pass
- AC-8: fail
- AC-9: pass
- AC-10: pass
- AC-11: pass
- AC-12: pass
- AC-13: pass

### Verification
- Checked: `npm test`, `npm run lint`, `npm run format:check`
- Checked: `normalizeConfig({ builder: 'codex' })`, `normalizeConfig({ builder: 'copilot' })`, and `getFilesToScaffold({ builderAgent: 'codex', judgeAgent: 'codex' })` now all reject unsupported builders as claimed
- Checked: `normalizeConfig({ judge: false, agent_mode: 'single' })` and `normalizeConfig({ judge: 0, agent_mode: 'single' })` both return `{ judgeAgent: 'claude', agentMode: 'single' }` instead of throwing
- Corrections: The previous H-1 is resolved; the remaining gap is narrower and limited to falsy non-string `judge` values bypassing validation

### Anti-Pattern Check
- AP-005: The round fixed the original builder-capability validation bug but widened judge inference enough to introduce a new validation hole

### Open Questions
- None

### [build] Round 3 — judge

## Round 3 — build

### Verdict
needs_revision

### Blockers
- None

### High
- None

### Medium
- M-2: `normalizeConfig()` still bypasses registry validation for explicit `judge: null` and `judge: ''` because the inference guard in `src/utils/config.js:52-56` treats both values as "missing". The design only allows inference for old configs that omit the `judge` field; an explicit `judge` value should be used directly and rejected if invalid (`specs/003-multi-agent-configurability/design.md:24-28`). As written, `normalizeConfig({ judge: null, agent_mode: 'single' })` and `normalizeConfig({ judge: '', agent_mode: 'single' })` both silently normalize to `judgeAgent: 'claude'`, so malformed config files can still bypass AC-8's validation boundary and change scaffold/upgrade behavior without the user ever specifying a valid judge. Tighten the inference path to the truly absent case and replace the tests in `src/utils/config.test.js:105-112` with rejection cases.

### Low
- None

### Acceptance Check
- AC-1: pass
- AC-2: pass
- AC-3: pass
- AC-4: pass
- AC-5: pass
- AC-6: pass
- AC-7: pass
- AC-8: fail
- AC-9: pass
- AC-10: pass
- AC-11: pass
- AC-12: pass
- AC-13: pass

### Verification
- Checked: `npm test`, `npm run lint`, `npm run format:check`
- Checked: `normalizeConfig({ judge: false, agent_mode: 'single' })` and `normalizeConfig({ judge: 0, agent_mode: 'single' })` now throw as claimed
- Checked: `normalizeConfig({ judge: null, agent_mode: 'single' })` and `normalizeConfig({ judge: '', agent_mode: 'single' })` still return normalized Claude-judge configs instead of throwing
- Corrections: Round 2 framed the remaining validation hole too narrowly. Direct verification shows the bypass is not limited to `false` and `0`; `null` and `''` still get treated as implicit defaults

### Anti-Pattern Check
- None detected

### Open Questions
- None

### [build] Round 4 — judge

## Round 4 — build

### Verdict
accepted

### Blockers
- None

### High
- None

### Medium
- None

### Low
- None

### Acceptance Check
- AC-1: pass
- AC-2: pass
- AC-3: pass
- AC-4: pass
- AC-5: pass
- AC-6: pass
- AC-7: pass
- AC-8: pass
- AC-9: pass
- AC-10: pass
- AC-11: pass
- AC-12: pass
- AC-13: pass

### Verification
- Checked: `npm test`, `npm run lint`, `npm run format:check`
- Checked: `normalizeConfig({ judge: null })`, `normalizeConfig({ judge: '' })`, `normalizeConfig({ judge: false })`, and `normalizeConfig({ judge: 0 })` now all throw `Invalid judge agent ...` errors
- Checked: `normalizeConfig({})` still infers the legacy default `judgeAgent: 'codex'`, and `normalizeConfig({ agent_mode: 'single' })` still infers `judgeAgent: 'claude'`
- Corrections: None

### Anti-Pattern Check
- None detected

### Open Questions
- None
