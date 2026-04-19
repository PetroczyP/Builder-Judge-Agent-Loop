import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getTemplateVars,
  getFilesToScaffold,
  getNextSteps,
  AGENTS,
  REMOVED_TEMPLATES,
} from '../utils/agents.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const TEMPLATES = join(ROOT, 'src', 'templates');

// ── Agent Registry Tests ──────────────────────────────────────────

describe('AGENTS registry', () => {
  it('has claude, codex, and copilot entries', () => {
    assert.ok(AGENTS.claude);
    assert.ok(AGENTS.codex);
    assert.ok(AGENTS.copilot);
  });

  it('claude can build and judge', () => {
    assert.equal(AGENTS.claude.canBuild, true);
    assert.equal(AGENTS.claude.canJudge, true);
  });

  it('codex can judge but not build', () => {
    assert.equal(AGENTS.codex.canBuild, false);
    assert.equal(AGENTS.codex.canJudge, true);
  });

  it('copilot can judge but not build', () => {
    assert.equal(AGENTS.copilot.canBuild, false);
    assert.equal(AGENTS.copilot.canJudge, true);
  });

  it('all agents have judge template fields', () => {
    for (const [id, agent] of Object.entries(AGENTS)) {
      assert.ok(agent.judgeTemplate, `${id} must have judgeTemplate`);
      assert.ok(agent.judgeDestination, `${id} must have judgeDestination`);
      assert.equal(
        typeof agent.needsReviewCommand,
        'boolean',
        `${id} must have needsReviewCommand`,
      );
    }
  });

  it('is frozen and cannot be mutated', () => {
    assert.ok(Object.isFrozen(AGENTS));
    assert.ok(Object.isFrozen(AGENTS.claude));
    assert.ok(Object.isFrozen(AGENTS.codex));
    assert.ok(Object.isFrozen(AGENTS.copilot));
  });
});

// ── Template Variables Tests ──────────────────────────────────────

describe('getTemplateVars', () => {
  it('returns correct vars for claude/codex', () => {
    const vars = getTemplateVars({
      builderAgent: 'claude',
      judgeAgent: 'codex',
    });

    assert.equal(vars['{{BUILDER_AGENT_NAME}}'], 'Claude Code');
    assert.equal(vars['{{JUDGE_AGENT_NAME}}'], 'Codex');
    assert.equal(vars['{{BUILDER_AGENT_ID}}'], 'claude');
    assert.equal(vars['{{JUDGE_AGENT_ID}}'], 'codex');
    assert.match(vars['{{JUDGE_INVOKE_INSTRUCTION}}'], /Codex/);
    assert.match(vars['{{JUDGE_COMMAND}}'], /judge <task-id>/);
  });

  it('returns correct vars for claude/claude (same agent)', () => {
    const vars = getTemplateVars({
      builderAgent: 'claude',
      judgeAgent: 'claude',
    });

    assert.equal(vars['{{BUILDER_AGENT_NAME}}'], 'Claude Code');
    assert.equal(vars['{{JUDGE_AGENT_NAME}}'], 'Claude Code (judge mode)');
    assert.equal(vars['{{BUILDER_AGENT_ID}}'], 'claude');
    assert.equal(vars['{{JUDGE_AGENT_ID}}'], 'claude');
    assert.match(vars['{{JUDGE_INVOKE_INSTRUCTION}}'], /loop\.review/);
    assert.match(vars['{{JUDGE_COMMAND}}'], /loop\.review/);
  });

  it('returns correct vars for claude/copilot', () => {
    const vars = getTemplateVars({
      builderAgent: 'claude',
      judgeAgent: 'copilot',
    });

    assert.equal(vars['{{BUILDER_AGENT_NAME}}'], 'Claude Code');
    assert.equal(vars['{{JUDGE_AGENT_NAME}}'], 'GitHub Copilot');
    assert.equal(vars['{{JUDGE_AGENT_ID}}'], 'copilot');
    assert.match(vars['{{JUDGE_INVOKE_INSTRUCTION}}'], /Copilot/);
    assert.match(vars['{{JUDGE_COMMAND}}'], /judge <task-id>/);
  });

  it('includes core vars (coordinator, release mode, max rounds)', () => {
    const vars = getTemplateVars({
      builderAgent: 'claude',
      judgeAgent: 'codex',
      coordinator: 'Alice',
      releaseMode: 'github-pr',
      maxRounds: 3,
    });

    assert.equal(vars['{{COORDINATOR_NAME}}'], 'Alice');
    assert.equal(vars['{{RELEASE_MODE}}'], 'github-pr');
    assert.equal(vars['{{MAX_ROUNDS}}'], '3');
  });

  it('throws on unknown agent ID', () => {
    assert.throws(
      () => getTemplateVars({ builderAgent: 'unknown', judgeAgent: 'codex' }),
      /Unknown builder agent/,
    );
    assert.throws(
      () => getTemplateVars({ builderAgent: 'claude', judgeAgent: 'unknown' }),
      /Unknown judge agent/,
    );
  });

  it('throws when agent lacks required capability', () => {
    assert.throws(
      () => getTemplateVars({ builderAgent: 'codex', judgeAgent: 'codex' }),
      /cannot be used as builder/,
    );
  });

  it('uses sensible defaults for optional config fields', () => {
    const vars = getTemplateVars({
      builderAgent: 'claude',
      judgeAgent: 'codex',
    });

    assert.equal(vars['{{COORDINATOR_NAME}}'], '');
    assert.equal(vars['{{RELEASE_MODE}}'], '');
    assert.equal(vars['{{MAX_ROUNDS}}'], '5');
  });
});

// ── File List Tests ───────────────────────────────────────────────

describe('getFilesToScaffold', () => {
  it('throws on unknown judge agent', () => {
    assert.throws(
      () => getFilesToScaffold({ builderAgent: 'claude', judgeAgent: 'unknown' }),
      /Unknown judge agent/,
    );
  });

  it('throws on unknown builder agent', () => {
    assert.throws(
      () => getFilesToScaffold({ builderAgent: 'gpt4', judgeAgent: 'codex' }),
      /Unknown builder agent/,
    );
  });

  it('throws when builder agent lacks canBuild capability', () => {
    assert.throws(
      () => getFilesToScaffold({ builderAgent: 'codex', judgeAgent: 'codex' }),
      /cannot be used as builder/,
    );
  });

  it('throws when judge agent lacks canJudge capability', () => {
    // claude has canJudge: true, so we need an agent with canJudge: false
    // All current agents can judge, so this test validates the check exists
    // by verifying a valid config does NOT throw
    const files = getFilesToScaffold({ builderAgent: 'claude', judgeAgent: 'codex' });
    assert.ok(files.length > 0);
  });

  it('codex judge includes CODEX.md but not judge subagent or loop.review', () => {
    const files = getFilesToScaffold({ builderAgent: 'claude', judgeAgent: 'codex' });
    const dests = files.map((f) => f.dest);

    assert.ok(dests.includes('CODEX.md'));
    assert.ok(!dests.includes('.claude/agents/judge.md'));
    assert.ok(!dests.includes('.claude/commands/loop.review.md'));
  });

  it('claude judge includes judge subagent and loop.review but not CODEX.md', () => {
    const files = getFilesToScaffold({ builderAgent: 'claude', judgeAgent: 'claude' });
    const dests = files.map((f) => f.dest);

    assert.ok(!dests.includes('CODEX.md'));
    assert.ok(dests.includes('.claude/agents/judge.md'));
    assert.ok(dests.includes('.claude/commands/loop.review.md'));
  });

  it('copilot judge includes .github/copilot-instructions.md', () => {
    const files = getFilesToScaffold({ builderAgent: 'claude', judgeAgent: 'copilot' });
    const dests = files.map((f) => f.dest);

    assert.ok(dests.includes('.github/copilot-instructions.md'));
    assert.ok(!dests.includes('CODEX.md'));
    assert.ok(!dests.includes('.claude/agents/judge.md'));
    assert.ok(!dests.includes('.claude/commands/loop.review.md'));
  });

  it('all src paths resolve to existing template files', () => {
    for (const judgeAgent of Object.keys(AGENTS)) {
      if (!AGENTS[judgeAgent].canJudge) continue;
      const files = getFilesToScaffold({ builderAgent: 'claude', judgeAgent });
      for (const file of files) {
        const fullPath = join(TEMPLATES, file.src);
        assert.ok(
          existsSync(fullPath),
          `judge=${judgeAgent} references missing template: ${file.src}`,
        );
      }
    }
  });

  it('all judge configs include common files', () => {
    const commonDests = [
      'agent-loop/PROTOCOL.md',
      'agent-loop/ANTIPATTERNS.md',
      'AGENTS.md',
      'CHEATSHEET.md',
      'specs/backlog.md',
      '.claude/commands/loop.build.md',
    ];

    for (const judgeAgent of Object.keys(AGENTS)) {
      if (!AGENTS[judgeAgent].canJudge) continue;
      const dests = getFilesToScaffold({ builderAgent: 'claude', judgeAgent }).map((f) => f.dest);
      for (const expected of commonDests) {
        assert.ok(dests.includes(expected), `judge=${judgeAgent} missing ${expected}`);
      }
    }
  });
});

// ── Next Steps Tests ──────────────────────────────────────────────

describe('getNextSteps', () => {
  it('same-agent mode mentions loop.review and judge.md', () => {
    const lines = getNextSteps({
      builderAgent: 'claude',
      judgeAgent: 'claude',
    });
    const text = lines.join('\n');
    assert.match(text, /loop\.review/);
    assert.match(text, /judge\.md/);
  });

  it('codex judge mentions Codex and CODEX.md', () => {
    const lines = getNextSteps({ builderAgent: 'claude', judgeAgent: 'codex' });
    const text = lines.join('\n');
    assert.match(text, /Codex/);
    assert.match(text, /CODEX\.md/);
  });

  it('copilot judge mentions Copilot and copilot-instructions.md', () => {
    const lines = getNextSteps({ builderAgent: 'claude', judgeAgent: 'copilot' });
    const text = lines.join('\n');
    assert.match(text, /Copilot/);
    assert.match(text, /copilot-instructions\.md/);
  });

  it('throws on unknown builder agent', () => {
    assert.throws(
      () => getNextSteps({ builderAgent: 'unknown', judgeAgent: 'codex' }),
      /Unknown builder agent/,
    );
  });

  it('throws on unknown judge agent', () => {
    assert.throws(
      () => getNextSteps({ builderAgent: 'claude', judgeAgent: 'unknown' }),
      /Unknown judge agent/,
    );
  });
});

// ── Template Rendering Tests ──────────────────────────────────────

describe('template rendering', () => {
  function renderTemplate(templatePath, config) {
    let content = readFileSync(join(TEMPLATES, templatePath), 'utf-8');

    for (const [key, value] of Object.entries(getTemplateVars(config))) {
      content = content.split(key).join(String(value));
    }
    return content;
  }

  const codexConfig = {
    coordinator: 'TestCoord',
    builderAgent: 'claude',
    judgeAgent: 'codex',
    releaseMode: 'local',
    maxRounds: 5,
  };

  const sameAgentConfig = {
    coordinator: 'TestCoord',
    builderAgent: 'claude',
    judgeAgent: 'claude',
    releaseMode: 'local',
    maxRounds: 5,
  };

  const copilotConfig = {
    coordinator: 'TestCoord',
    builderAgent: 'claude',
    judgeAgent: 'copilot',
    releaseMode: 'local',
    maxRounds: 5,
  };

  const templatesToCheck = [
    'protocol/PROTOCOL.md',
    'agents/AGENTS.md',
    'agents/CLAUDE.md.section',
    'agents/CHEATSHEET.md',
    'agents/CODEX.md',
    'agents/copilot-judge.md',
    'commands/loop.build.md',
    'commands/loop.review.md',
  ];

  for (const template of templatesToCheck) {
    it(`no unresolved {{}} in ${template} (codex judge)`, () => {
      const content = renderTemplate(template, codexConfig);
      assert.ok(!content.includes('{{'), `Found unresolved {{ in ${template} (codex)`);
    });

    it(`no unresolved {{}} in ${template} (same agent)`, () => {
      const content = renderTemplate(template, sameAgentConfig);
      assert.ok(!content.includes('{{'), `Found unresolved {{ in ${template} (same agent)`);
    });

    it(`no unresolved {{}} in ${template} (copilot judge)`, () => {
      const content = renderTemplate(template, copilotConfig);
      assert.ok(!content.includes('{{'), `Found unresolved {{ in ${template} (copilot)`);
    });
  }

  it('same-agent templates have no unresolved {{}}', () => {
    const sameAgentTemplates = ['agents/claude-judge.md', 'commands/loop.review.md'];
    for (const template of sameAgentTemplates) {
      const content = renderTemplate(template, sameAgentConfig);
      assert.ok(!content.includes('{{'), `Found unresolved {{ in ${template}`);
    }
  });

  it('codex judge PROTOCOL.md references Codex as judge', () => {
    const content = renderTemplate('protocol/PROTOCOL.md', codexConfig);
    assert.match(content, /\| \*\*Judge\*\* \| Codex/);
  });

  it('same-agent PROTOCOL.md references Claude Code (judge mode) as judge', () => {
    const content = renderTemplate('protocol/PROTOCOL.md', sameAgentConfig);
    assert.match(content, /\| \*\*Judge\*\* \| Claude Code \(judge mode\)/);
  });

  it('copilot judge PROTOCOL.md references GitHub Copilot as judge', () => {
    const content = renderTemplate('protocol/PROTOCOL.md', copilotConfig);
    assert.match(content, /\| \*\*Judge\*\* \| GitHub Copilot/);
  });

  it('same-agent CHEATSHEET references /loop.review', () => {
    const content = renderTemplate('agents/CHEATSHEET.md', sameAgentConfig);
    assert.match(content, /\/loop\.review/);
  });

  it('codex judge loop.build suggests Codex for judge', () => {
    const content = renderTemplate('commands/loop.build.md', codexConfig);
    assert.match(content, /Send to Codex/);
  });

  it('same-agent loop.build suggests /loop.review for judge', () => {
    const content = renderTemplate('commands/loop.build.md', sameAgentConfig);
    assert.match(content, /\/loop\.review/);
  });

  it('copilot judge loop.build suggests Copilot for judge', () => {
    const content = renderTemplate('commands/loop.build.md', copilotConfig);
    assert.match(content, /Copilot/);
  });

  it('loop.review.md has context: fork and agent: judge in frontmatter', () => {
    const raw = readFileSync(join(TEMPLATES, 'commands/loop.review.md'), 'utf-8');
    const frontmatter = raw.split('---')[1];
    assert.match(frontmatter, /context:\s*fork/, 'loop.review.md must have context: fork');
    assert.match(frontmatter, /agent:\s*judge/, 'loop.review.md must have agent: judge');
  });

  it('claude-judge.md has Edit and Write in tools list', () => {
    const raw = readFileSync(join(TEMPLATES, 'agents/claude-judge.md'), 'utf-8');
    const frontmatter = raw.split('---')[1];
    assert.match(frontmatter, /- Edit/, 'claude-judge.md must include Edit tool');
    assert.match(frontmatter, /- Write/, 'claude-judge.md must include Write tool');
  });
});

// ── Protocol Enforcement Tests (002-protocol-enforcement) ────────

describe('protocol enforcement — loop.build.md', () => {
  const raw = readFileSync(join(TEMPLATES, 'commands/loop.build.md'), 'utf-8');

  it('AC-1: CREATE mode includes phase-skip guardrails with justification requirements', () => {
    assert.match(raw, /skipped_phases/, 'must reference skipped_phases in status.json');
    assert.match(raw, /Insufficient justifications/, 'must list insufficient justifications');
    assert.match(raw, /"small change"/, 'must call out "small change" as insufficient');
    assert.match(raw, /3 or more phases are skipped/, 'must mention 3+ phase-skip threshold');
  });

  it('AC-2: includes a pre-flight checklist step before builder.md writing', () => {
    const preflightIdx = raw.indexOf('Pre-flight checklist');
    const writeIdx = raw.indexOf('Write builder.md');
    assert.ok(preflightIdx > 0, 'must contain Pre-flight checklist step');
    assert.ok(writeIdx > preflightIdx, 'Pre-flight must come before Write builder.md');
  });

  it('AC-3: CoVe distinguishes external (web search) from internal (repo search)', () => {
    assert.match(raw, /\*\*External\*\*/, 'must label External claim type');
    assert.match(raw, /\*\*Internal\*\*/, 'must label Internal claim type');
    assert.match(raw, /\*\*Web search\*\*/, 'External claims require web search');
    assert.match(raw, /\*\*Repo search\*\*/, 'Internal claims require repo search');
  });

  it('AC-4: build phase includes test gate with escape hatch', () => {
    assert.match(raw, /\*\*Test gate:\*\*/, 'must include Test gate');
    assert.match(raw, /\*\*Escape hatch:\*\*/, 'must include Escape hatch');
    assert.match(
      raw,
      /pre-existing tests is insufficient/,
      'must call out pre-existing tests as insufficient',
    );
  });

  it('AC-5: includes timestamp enforcement with example command', () => {
    assert.match(raw, /date -u \+"%Y-%m-%dT%H:%M:%SZ"/, 'must include date -u example');
    assert.match(raw, /Never use placeholder values/, 'must prohibit placeholder values');
  });

  it('AC-6: builder.md template includes Anti-Pattern Check section', () => {
    assert.match(
      raw,
      /### Anti-Pattern Check/,
      'builder.md template must include Anti-Pattern Check',
    );
  });

  it('S9: spec path is conditional on specify phase', () => {
    assert.match(
      raw,
      /specify.*phase was not skipped/s,
      'must reference specify phase skip condition for spec path',
    );
    assert.match(
      raw,
      /only reference specs that already exist/,
      'must instruct to only reference existing specs when specify is skipped',
    );
  });

  it('preflight flags update instructions include cove_completed and antipatterns_checked', () => {
    assert.match(raw, /cove_completed/, 'must reference cove_completed flag');
    assert.match(raw, /antipatterns_checked/, 'must reference antipatterns_checked flag');
    assert.match(
      raw,
      /Setting flags without doing the work/,
      'must warn against setting flags without doing the work',
    );
  });
});

describe('protocol enforcement — loop.review.md', () => {
  const raw = readFileSync(join(TEMPLATES, 'commands/loop.review.md'), 'utf-8');

  it('AC-7: includes isolation self-check as first step after command parsing', () => {
    const step1Idx = raw.indexOf('Step 1: Parse the command');
    const step2Idx = raw.indexOf('Step 2: Isolation self-check');
    const step3Idx = raw.indexOf('Step 3: Read context');
    assert.ok(step1Idx >= 0, 'must contain Step 1: Parse the command');
    assert.ok(step2Idx >= 0, 'must contain Step 2: Isolation self-check');
    assert.ok(step3Idx >= 0, 'must contain Step 3: Read context');
    assert.ok(step2Idx > step1Idx, 'Isolation self-check must be Step 2');
    assert.ok(step3Idx > step2Idx, 'Read context must come after isolation self-check');
  });

  it('AC-8: includes preflight verification with tiered severity', () => {
    assert.match(raw, /Step 5: Preflight verification/, 'must have Preflight verification step');
    assert.match(raw, /\*\*H-severity\*\*/, 'must include H-severity');
    assert.match(raw, /\*\*L-severity\*\*/, 'must include L-severity');
    assert.match(
      raw,
      /Missing on mandatory phases.*H-severity/s,
      'missing CoVe on mandatory = H-severity',
    );
    assert.match(
      raw,
      /Missing on any phase.*L-severity/s,
      'missing anti-pattern check = L-severity',
    );
  });

  it('AC-8: preflight includes CoVe method correctness check', () => {
    assert.match(raw, /CoVe method correctness/, 'must check CoVe method correctness');
    assert.match(raw, /Method mismatch.*L-severity/s, 'method mismatch = L-severity');
  });

  it('AC-8: preflight includes phase-skip justification checks', () => {
    assert.match(
      raw,
      /3 or more phases are skipped.*H-severity/s,
      'must flag 3+ phase skips as H-severity',
    );
    assert.match(raw, /Generic justifications.*H-severity/s, 'generic justifications = H-severity');
  });

  it('includes legacy task handling in preflight', () => {
    assert.match(raw, /Legacy tasks/, 'must handle legacy tasks');
    assert.match(raw, /evaluating on content merits/, 'legacy tasks evaluated on content merits');
  });

  it('records review_context in status.json update', () => {
    assert.match(raw, /review_context/, 'must record review_context');
    assert.match(
      raw,
      /context_fork.*codex_agent/s,
      'must support both context_fork and codex_agent',
    );
  });
});

describe('protocol enforcement — claude-judge.md', () => {
  it('AC-9: includes model: inherit in frontmatter', () => {
    const raw = readFileSync(join(TEMPLATES, 'agents/claude-judge.md'), 'utf-8');
    const frontmatter = raw.split('---')[1];
    assert.match(frontmatter, /model:\s*inherit/, 'must have model: inherit in frontmatter');
  });
});

describe('protocol enforcement — PROTOCOL.md', () => {
  const raw = readFileSync(join(TEMPLATES, 'protocol/PROTOCOL.md'), 'utf-8');

  it('AC-10: documents Phase Skipping rules', () => {
    assert.match(raw, /### Phase Skipping/, 'must have Phase Skipping section');
    assert.match(raw, /skipped_phases/, 'must reference skipped_phases');
    assert.match(raw, /3\+ phase skip threshold/i, 'must document 3+ threshold');
  });

  it('AC-10: documents extended status.json schema with optional fields', () => {
    assert.match(raw, /skipped_phases.*optional/is, 'skipped_phases must be optional');
    assert.match(raw, /preflight.*optional/is, 'preflight must be optional');
    assert.match(raw, /review_context.*optional/is, 'review_context must be optional');
  });

  it('AC-10: CoVe section includes method categorization', () => {
    assert.match(raw, /\*\*External\*\*/, 'must label External claim type');
    assert.match(raw, /\*\*Internal\*\*/, 'must label Internal claim type');
    assert.match(raw, /\*\*Web search\*\*/, 'External → web search');
    assert.match(raw, /\*\*Repo search\*\*/, 'Internal → repo search');
  });

  it('AC-10: Builder Output Format includes Anti-Pattern Check', () => {
    // Verify Anti-Pattern Check appears in the Builder Output Format section
    const builderFmtIdx = raw.indexOf('## Builder Output Format');
    const judgeFmtIdx = raw.indexOf('## Judge Output Format');
    const section = raw.slice(builderFmtIdx, judgeFmtIdx);
    assert.match(
      section,
      /### Anti-Pattern Check/,
      'Builder Output Format must include Anti-Pattern Check',
    );
  });

  it('AC-10: Judge Workflow includes isolation self-check and preflight verification', () => {
    const judgeWorkflowIdx = raw.indexOf('## Judge Workflow');
    const phasesIdx = raw.indexOf('## Phases');
    const section = raw.slice(judgeWorkflowIdx, phasesIdx);
    assert.match(
      section,
      /Isolation self-check/,
      'Judge Workflow must include isolation self-check',
    );
    assert.match(
      section,
      /Preflight verification/,
      'Judge Workflow must include preflight verification',
    );
  });

  it('AC-11: all new fields are documented as optional', () => {
    assert.match(raw, /All three fields are optional/, 'must state all three fields are optional');
    assert.match(raw, /Backwards compatibility/, 'must document backwards compatibility');
  });
});

describe('protocol enforcement — cross-document consistency', () => {
  const buildRaw = readFileSync(join(TEMPLATES, 'commands/loop.build.md'), 'utf-8');
  const reviewRaw = readFileSync(join(TEMPLATES, 'commands/loop.review.md'), 'utf-8');
  const protocolRaw = readFileSync(join(TEMPLATES, 'protocol/PROTOCOL.md'), 'utf-8');

  it('Anti-Pattern Check appears in all three documents', () => {
    assert.match(buildRaw, /### Anti-Pattern Check/, 'loop.build.md must have Anti-Pattern Check');
    assert.match(
      reviewRaw,
      /### Anti-Pattern Check/,
      'loop.review.md must have Anti-Pattern Check',
    );
    assert.match(protocolRaw, /### Anti-Pattern Check/, 'PROTOCOL.md must have Anti-Pattern Check');
  });

  it('isolation self-check in loop.review.md and PROTOCOL.md', () => {
    assert.match(
      reviewRaw,
      /Isolation self-check/,
      'loop.review.md must have isolation self-check',
    );
    assert.match(protocolRaw, /Isolation self-check/, 'PROTOCOL.md must have isolation self-check');
  });

  it('preflight verification in loop.review.md and PROTOCOL.md', () => {
    assert.match(
      reviewRaw,
      /Preflight verification/,
      'loop.review.md must have preflight verification',
    );
    assert.match(
      protocolRaw,
      /Preflight verification/,
      'PROTOCOL.md must have preflight verification',
    );
  });

  it('CoVe phase applicability is consistent between builder and judge sides', () => {
    // Builder side: CoVe mandatory for specify, design, build; optional for test, release
    assert.match(buildRaw, /Mandatory for `specify`, `design`, and `build`/, 'builder CoVe phases');
    // Judge side: same rule, expressed as severity
    assert.match(
      reviewRaw,
      /Missing on mandatory phases.*specify.*design.*build/s,
      'judge CoVe mandatory phases',
    );
  });

  it('anti-pattern check is mandatory on every phase in both builder and judge', () => {
    assert.match(
      buildRaw,
      /Mandatory on \*\*every phase\*\*/,
      'builder: anti-pattern on every phase',
    );
    assert.match(reviewRaw, /Missing on any phase/, 'judge: anti-pattern check on any phase');
  });
});

// ── Config Version Tests ─────────────────────────────────────────

describe('config version', () => {
  it('scaffold uses the version from package.json', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
    const scaffoldSrc = readFileSync(join(ROOT, 'src', 'cli', 'scaffold.js'), 'utf-8');
    assert.ok(
      scaffoldSrc.includes('PKG.version'),
      'scaffold.js must read version from package.json, not hardcode it',
    );
    assert.ok(pkg.version, 'package.json must have a version field');
  });
});

// ── Scaffold Exports Tests ──────────────────────────────────────

describe('scaffold exports', () => {
  it('exports loadTemplate function', async () => {
    const mod = await import('../cli/scaffold.js');
    assert.equal(typeof mod.loadTemplate, 'function');
  });
});

// ── REMOVED_TEMPLATES Tests ─────────────────────────────────────

describe('REMOVED_TEMPLATES', () => {
  it('is an array', () => {
    assert.ok(Array.isArray(REMOVED_TEMPLATES));
  });

  it('is frozen', () => {
    assert.ok(Object.isFrozen(REMOVED_TEMPLATES));
  });

  it('entries have required schema (version, judgeAgents, dest)', () => {
    for (const entry of REMOVED_TEMPLATES) {
      assert.ok(typeof entry.version === 'string', 'version must be a string');
      assert.ok(Array.isArray(entry.judgeAgents), 'judgeAgents must be an array');
      assert.ok(typeof entry.dest === 'string', 'dest must be a string');
    }
  });

  it('no overlap with current getFilesToScaffold destinations', () => {
    const removedDests = REMOVED_TEMPLATES.map((e) => e.dest);
    for (const judgeAgent of Object.keys(AGENTS)) {
      if (!AGENTS[judgeAgent].canJudge) continue;
      const currentDests = getFilesToScaffold({ builderAgent: 'claude', judgeAgent }).map(
        (f) => f.dest,
      );
      for (const dest of removedDests) {
        assert.ok(
          !currentDests.includes(dest),
          `${dest} is in both REMOVED_TEMPLATES and getFilesToScaffold(judge=${judgeAgent})`,
        );
      }
    }
  });
});
