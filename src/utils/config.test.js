import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CONFIG_DEFAULTS, normalizeConfig, readConfig, writeConfig } from './config.js';

// ── CONFIG_DEFAULTS Tests ────────────────────────────────────────

describe('CONFIG_DEFAULTS', () => {
  it('has expected keys', () => {
    assert.ok('coordinator' in CONFIG_DEFAULTS);
    assert.ok('agentMode' in CONFIG_DEFAULTS);
    assert.ok('builderAgent' in CONFIG_DEFAULTS);
    assert.ok('releaseMode' in CONFIG_DEFAULTS);
    assert.ok('maxRounds' in CONFIG_DEFAULTS);
  });

  it('does NOT have judgeAgent (mode-dependent)', () => {
    assert.ok(!('judgeAgent' in CONFIG_DEFAULTS));
  });

  it('is frozen', () => {
    assert.ok(Object.isFrozen(CONFIG_DEFAULTS));
  });
});

// ── normalizeConfig Tests ────────────────────────────────────────

describe('normalizeConfig', () => {
  it('converts snake_case keys to camelCase', () => {
    const stored = {
      coordinator: 'Alice',
      agent_mode: 'dual',
      builder: 'claude',
      judge: 'codex',
      release_mode: 'github-pr',
      max_rounds: 3,
    };
    const result = normalizeConfig(stored);
    assert.equal(result.coordinator, 'Alice');
    assert.equal(result.agentMode, 'dual');
    assert.equal(result.builderAgent, 'claude');
    assert.equal(result.judgeAgent, 'codex');
    assert.equal(result.releaseMode, 'github-pr');
    assert.equal(result.maxRounds, 3);
  });

  it('falls back to CONFIG_DEFAULTS for missing fields', () => {
    const result = normalizeConfig({});
    assert.equal(result.coordinator, CONFIG_DEFAULTS.coordinator);
    assert.equal(result.agentMode, CONFIG_DEFAULTS.agentMode);
    assert.equal(result.builderAgent, CONFIG_DEFAULTS.builderAgent);
    assert.equal(result.releaseMode, CONFIG_DEFAULTS.releaseMode);
    assert.equal(result.maxRounds, CONFIG_DEFAULTS.maxRounds);
  });

  it('mode-aware judge default: single mode defaults to claude', () => {
    const result = normalizeConfig({ agent_mode: 'single' });
    assert.equal(result.judgeAgent, 'claude');
  });

  it('mode-aware judge default: dual mode defaults to codex', () => {
    const result = normalizeConfig({ agent_mode: 'dual' });
    assert.equal(result.judgeAgent, 'codex');
  });

  it('mode-aware judge default: no mode (falls back to dual) defaults to codex', () => {
    const result = normalizeConfig({});
    assert.equal(result.judgeAgent, 'codex');
  });

  it('preserves existing judgeAgent if present (even in single mode)', () => {
    const result = normalizeConfig({ agent_mode: 'single', judge: 'codex' });
    assert.equal(result.judgeAgent, 'codex');
  });

  it('handles undefined input gracefully', () => {
    const result = normalizeConfig(undefined);
    assert.equal(result.agentMode, CONFIG_DEFAULTS.agentMode);
    assert.equal(result.judgeAgent, 'codex');
  });

  it('handles null input gracefully', () => {
    const result = normalizeConfig(null);
    assert.equal(result.agentMode, CONFIG_DEFAULTS.agentMode);
    assert.equal(result.judgeAgent, 'codex');
  });

  it('passes through fields not in the mapping', () => {
    const result = normalizeConfig({ version: '0.3.0', specs_dir: 'specs', loop_dir: 'agent-loop' });
    assert.equal(result.version, '0.3.0');
    assert.equal(result.specs_dir, 'specs');
    assert.equal(result.loop_dir, 'agent-loop');
  });
});

// ── readConfig Tests ─────────────────────────────────────────────

describe('readConfig', () => {
  it('returns { status: "found", config } when valid JSON file exists', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'dal-test-'));
    const data = { version: '0.3.0', coordinator: 'Alice', agent_mode: 'dual' };
    writeFileSync(join(tmp, '.dual-agent-loop.json'), JSON.stringify(data, null, 2) + '\n');

    const result = readConfig(tmp);
    assert.equal(result.status, 'found');
    assert.deepEqual(result.config, data);
  });

  it('returns { status: "missing" } when file does not exist', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'dal-test-'));
    const result = readConfig(tmp);
    assert.equal(result.status, 'missing');
  });

  it('returns { status: "corrupt", error } when file has invalid JSON', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'dal-test-'));
    writeFileSync(join(tmp, '.dual-agent-loop.json'), '{ not valid json');

    const result = readConfig(tmp);
    assert.equal(result.status, 'corrupt');
    assert.ok(result.error instanceof Error);
  });

  it('returns corrupt for non-object JSON (string)', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'dal-test-'));
    writeFileSync(join(tmp, '.dual-agent-loop.json'), '"hello"');

    const result = readConfig(tmp);
    assert.equal(result.status, 'corrupt');
    assert.ok(result.error.message.includes('JSON object'));
  });

  it('returns corrupt for non-object JSON (array)', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'dal-test-'));
    writeFileSync(join(tmp, '.dual-agent-loop.json'), '[1, 2, 3]');

    const result = readConfig(tmp);
    assert.equal(result.status, 'corrupt');
  });

  it('returns corrupt for non-object JSON (null)', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'dal-test-'));
    writeFileSync(join(tmp, '.dual-agent-loop.json'), 'null');

    const result = readConfig(tmp);
    assert.equal(result.status, 'corrupt');
  });

  it('returns raw parsed JSON, not normalized', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'dal-test-'));
    const data = { agent_mode: 'single', max_rounds: 7 };
    writeFileSync(join(tmp, '.dual-agent-loop.json'), JSON.stringify(data));

    const result = readConfig(tmp);
    assert.equal(result.status, 'found');
    assert.equal(result.config.agent_mode, 'single');
    assert.equal(result.config.max_rounds, 7);
    assert.equal(result.config.agentMode, undefined);
  });
});

// ── writeConfig Tests ────────────────────────────────────────────

describe('writeConfig', () => {
  it('writes JSON with 2-space indent and trailing newline', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'dal-test-'));
    const config = { version: '0.3.0', coordinator: 'Bob' };
    writeConfig(tmp, config);

    const raw = readFileSync(join(tmp, '.dual-agent-loop.json'), 'utf-8');
    assert.equal(raw, JSON.stringify(config, null, 2) + '\n');
  });

  it('merges config into original to preserve unknown fields', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'dal-test-'));
    const original = { version: '0.2.0', custom_field: 'keep-me', coordinator: 'Old' };
    const config = { version: '0.3.0', coordinator: 'New' };
    writeConfig(tmp, config, original);

    const raw = readFileSync(join(tmp, '.dual-agent-loop.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    assert.equal(parsed.custom_field, 'keep-me');
    assert.equal(parsed.version, '0.3.0');
    assert.equal(parsed.coordinator, 'New');
  });

  it('round-trips correctly (write then read returns same data)', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'dal-test-'));
    const config = { version: '0.3.0', agent_mode: 'single', max_rounds: 10 };
    writeConfig(tmp, config);

    const result = readConfig(tmp);
    assert.equal(result.status, 'found');
    assert.deepEqual(result.config, config);
  });

  it('works without original parameter', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'dal-test-'));
    const config = { coordinator: 'Solo' };
    writeConfig(tmp, config);

    const result = readConfig(tmp);
    assert.equal(result.status, 'found');
    assert.deepEqual(result.config, { coordinator: 'Solo' });
  });
});
