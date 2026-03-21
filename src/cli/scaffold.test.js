import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTemplateVars, getFilesToScaffold, getNextSteps, AGENTS } from '../utils/agents.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const TEMPLATES = join(ROOT, 'src', 'templates');

// ── Agent Registry Tests ──────────────────────────────────────────

describe('AGENTS registry', () => {
  it('has claude and codex entries', () => {
    assert.ok(AGENTS.claude);
    assert.ok(AGENTS.codex);
  });

  it('claude can build and judge', () => {
    assert.equal(AGENTS.claude.canBuild, true);
    assert.equal(AGENTS.claude.canJudge, true);
  });

  it('codex can judge but not build', () => {
    assert.equal(AGENTS.codex.canBuild, false);
    assert.equal(AGENTS.codex.canJudge, true);
  });

  it('is frozen and cannot be mutated', () => {
    assert.ok(Object.isFrozen(AGENTS));
    assert.ok(Object.isFrozen(AGENTS.claude));
    assert.ok(Object.isFrozen(AGENTS.codex));
  });
});

// ── Template Variables Tests ──────────────────────────────────────

describe('getTemplateVars', () => {
  it('returns correct vars for dual mode', () => {
    const vars = getTemplateVars({
      agentMode: 'dual',
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

  it('returns correct vars for single mode', () => {
    const vars = getTemplateVars({
      agentMode: 'single',
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

  it('includes core vars (coordinator, release mode, max rounds)', () => {
    const vars = getTemplateVars({
      agentMode: 'dual',
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
      () => getTemplateVars({ agentMode: 'dual', builderAgent: 'unknown', judgeAgent: 'codex' }),
      /Unknown builder agent/,
    );
    assert.throws(
      () => getTemplateVars({ agentMode: 'dual', builderAgent: 'claude', judgeAgent: 'unknown' }),
      /Unknown judge agent/,
    );
  });

  it('throws when agent lacks required capability', () => {
    assert.throws(
      () => getTemplateVars({ agentMode: 'dual', builderAgent: 'codex', judgeAgent: 'codex' }),
      /cannot be used as builder/,
    );
  });

  it('uses sensible defaults for optional config fields', () => {
    const vars = getTemplateVars({
      agentMode: 'dual',
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
  it('throws on unsupported agent mode', () => {
    assert.throws(
      () => getFilesToScaffold({ agentMode: 'invalid' }),
      /Unsupported agent mode/,
    );
  });

  it('dual mode includes CODEX.md but not judge subagent', () => {
    const files = getFilesToScaffold({ agentMode: 'dual' });
    const dests = files.map(f => f.dest);

    assert.ok(dests.includes('CODEX.md'));
    assert.ok(!dests.includes('.claude/agents/judge.md'));
    assert.ok(!dests.includes('.claude/commands/loop.review.md'));
  });

  it('single mode includes judge subagent but not CODEX.md', () => {
    const files = getFilesToScaffold({ agentMode: 'single' });
    const dests = files.map(f => f.dest);

    assert.ok(!dests.includes('CODEX.md'));
    assert.ok(dests.includes('.claude/agents/judge.md'));
    assert.ok(dests.includes('.claude/commands/loop.review.md'));
  });

  it('all src paths resolve to existing template files', () => {
    for (const mode of ['single', 'dual']) {
      const files = getFilesToScaffold({ agentMode: mode });
      for (const file of files) {
        const fullPath = join(TEMPLATES, file.src);
        assert.ok(existsSync(fullPath), `${mode} mode references missing template: ${file.src}`);
      }
    }
  });

  it('both modes include common files', () => {
    const commonDests = [
      'agent-loop/PROTOCOL.md',
      'agent-loop/ANTIPATTERNS.md',
      'AGENTS.md',
      'CHEATSHEET.md',
      'specs/backlog.md',
      '.claude/commands/loop.build.md',
    ];

    for (const mode of ['single', 'dual']) {
      const dests = getFilesToScaffold({ agentMode: mode }).map(f => f.dest);
      for (const expected of commonDests) {
        assert.ok(dests.includes(expected), `${mode} mode missing ${expected}`);
      }
    }
  });
});

// ── Next Steps Tests ──────────────────────────────────────────────

describe('getNextSteps', () => {
  it('throws on unsupported agent mode', () => {
    assert.throws(
      () => getNextSteps({ agentMode: 'invalid' }),
      /Unsupported agent mode/,
    );
  });

  it('single mode mentions loop.review', () => {
    const lines = getNextSteps({ agentMode: 'single' });
    const text = lines.join('\n');
    assert.match(text, /loop\.review/);
    assert.match(text, /judge\.md/);
  });

  it('dual mode mentions Codex', () => {
    const lines = getNextSteps({ agentMode: 'dual' });
    const text = lines.join('\n');
    assert.match(text, /Codex/);
    assert.match(text, /CODEX\.md/);
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

  const dualConfig = {
    coordinator: 'TestCoord',
    agentMode: 'dual',
    builderAgent: 'claude',
    judgeAgent: 'codex',
    releaseMode: 'local',
    maxRounds: 5,
  };

  const singleConfig = {
    coordinator: 'TestCoord',
    agentMode: 'single',
    builderAgent: 'claude',
    judgeAgent: 'claude',
    releaseMode: 'local',
    maxRounds: 5,
  };

  const templatesToCheck = [
    'protocol/PROTOCOL.md',
    'agents/AGENTS.md',
    'agents/CLAUDE.md.section',
    'agents/CHEATSHEET.md',
    'agents/CODEX.md',
    'commands/loop.build.md',
  ];

  for (const template of templatesToCheck) {
    it(`no unresolved {{}} in ${template} (dual mode)`, () => {
      const content = renderTemplate(template, dualConfig);
      assert.ok(!content.includes('{{'), `Found unresolved {{ in ${template} (dual)`);
    });

    it(`no unresolved {{}} in ${template} (single mode)`, () => {
      const content = renderTemplate(template, singleConfig);
      assert.ok(!content.includes('{{'), `Found unresolved {{ in ${template} (single)`);
    });
  }

  it('single-mode templates have no unresolved {{}}', () => {
    const singleTemplates = ['agents/claude-judge.md', 'commands/loop.review.md'];
    for (const template of singleTemplates) {
      const content = renderTemplate(template, singleConfig);
      assert.ok(!content.includes('{{'), `Found unresolved {{ in ${template}`);
    }
  });

  it('dual mode PROTOCOL.md references Codex as judge', () => {
    const content = renderTemplate('protocol/PROTOCOL.md', dualConfig);
    assert.match(content, /\| \*\*Judge\*\* \| Codex/);
  });

  it('single mode PROTOCOL.md references Claude Code (judge mode) as judge', () => {
    const content = renderTemplate('protocol/PROTOCOL.md', singleConfig);
    assert.match(content, /\| \*\*Judge\*\* \| Claude Code \(judge mode\)/);
  });

  it('single mode CHEATSHEET references /loop.review', () => {
    const content = renderTemplate('agents/CHEATSHEET.md', singleConfig);
    assert.match(content, /\/loop\.review/);
  });

  it('dual mode loop.build suggests Codex for judge', () => {
    const content = renderTemplate('commands/loop.build.md', dualConfig);
    assert.match(content, /Send to Codex/);
  });

  it('single mode loop.build suggests /loop.review for judge', () => {
    const content = renderTemplate('commands/loop.build.md', singleConfig);
    assert.match(content, /\/loop\.review/);
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

// ── Config Version Tests ─────────────────────────────────────────

describe('config version', () => {
  it('scaffold uses the version from package.json', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
    const scaffoldSrc = readFileSync(join(ROOT, 'src', 'cli', 'scaffold.js'), 'utf-8');
    assert.ok(scaffoldSrc.includes('PKG.version'), 'scaffold.js must read version from package.json, not hardcode it');
    assert.ok(pkg.version, 'package.json must have a version field');
  });
});
