import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CONFIG_FILE = '.dual-agent-loop.json';

/**
 * Default configuration values (camelCase, internal format).
 * Does NOT include judgeAgent — that depends on agentMode.
 */
export const CONFIG_DEFAULTS = Object.freeze({
  coordinator: 'Coordinator',
  agentMode: 'dual',
  builderAgent: 'claude',
  releaseMode: 'github-pr',
  maxRounds: 5,
});

const SNAKE_TO_CAMEL = {
  agent_mode: 'agentMode',
  builder: 'builderAgent',
  judge: 'judgeAgent',
  release_mode: 'releaseMode',
  max_rounds: 'maxRounds',
};

/**
 * Convert a snake_case stored config to camelCase internal format.
 * Applies CONFIG_DEFAULTS for missing fields and infers judgeAgent from agentMode.
 * @param {object|null|undefined} stored
 * @returns {object}
 */
export function normalizeConfig(stored) {
  const raw = stored ?? {};

  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const mapped = SNAKE_TO_CAMEL[key];
    if (mapped) {
      out[mapped] = value;
    } else {
      out[key] = value;
    }
  }

  for (const [key, fallback] of Object.entries(CONFIG_DEFAULTS)) {
    if (out[key] === undefined) {
      out[key] = fallback;
    }
  }

  if (out.judgeAgent === undefined) {
    out.judgeAgent = out.agentMode === 'single' ? 'claude' : 'codex';
  }

  return out;
}

/**
 * Read the config file from disk.
 * @param {string} cwd
 * @returns {{ status: 'found', config: object } | { status: 'missing' } | { status: 'corrupt', error: Error }}
 */
export function readConfig(cwd) {
  const filePath = join(cwd, CONFIG_FILE);

  if (!existsSync(filePath)) {
    return { status: 'missing' };
  }

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const config = JSON.parse(raw);
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return { status: 'corrupt', error: new Error('Config must be a JSON object') };
    }
    return { status: 'found', config };
  } catch (err) {
    return { status: 'corrupt', error: err };
  }
}

/**
 * Write the config file to disk, merging into original to preserve unknown fields.
 * @param {string} cwd
 * @param {object} config
 * @param {object} [original={}]
 */
export function writeConfig(cwd, config, original = {}) {
  const merged = { ...original, ...config };
  const filePath = join(cwd, CONFIG_FILE);
  try {
    writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n');
  } catch (err) {
    throw new Error(`Failed to write ${CONFIG_FILE}: ${err.message}`, { cause: err });
  }
}
