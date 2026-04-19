import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AGENTS } from './agents.js';

const CONFIG_FILE = '.dual-agent-loop.json';

/**
 * Default configuration values (camelCase, internal format).
 * Does NOT include judgeAgent — inferred from agentMode for backward
 * compatibility with configs that predate the explicit judge field;
 * agentMode itself is derived, not primary.
 */
export const CONFIG_DEFAULTS = Object.freeze({
  coordinator: 'Coordinator',
  agentMode: 'dual',
  builderAgent: 'claude',
  releaseMode: 'github-pr',
  maxRounds: 5,
});

const SNAKE_TO_CAMEL = Object.freeze({
  agent_mode: 'agentMode',
  builder: 'builderAgent',
  judge: 'judgeAgent',
  release_mode: 'releaseMode',
  max_rounds: 'maxRounds',
});

/**
 * Convert a snake_case stored config to camelCase internal format.
 * Applies CONFIG_DEFAULTS for missing fields. For backward compatibility,
 * infers judgeAgent from agentMode when the judge field is absent;
 * then recomputes agentMode from the actual agent pair.
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

  // Infer judgeAgent from agentMode ONLY for old configs that omit the judge field entirely.
  // Any explicit value (even null, "", false, 0) passes through to validation below.
  if (out.judgeAgent === undefined) {
    if (out.agentMode !== 'single' && out.agentMode !== 'dual') {
      console.warn(
        `  Warning: unrecognized agent_mode "${out.agentMode}" in config — defaulting to dual`,
      );
    }
    out.judgeAgent = out.agentMode === 'single' ? 'claude' : 'codex';
  }

  // Validate agent IDs and capabilities against the registry.
  // Uses Object.hasOwn to avoid prototype chain lookups (e.g., 'constructor').
  const validAgents = Object.keys(AGENTS).join(', ');
  if (typeof out.builderAgent !== 'string' || !Object.hasOwn(AGENTS, out.builderAgent)) {
    throw new Error(
      `Invalid builder agent "${out.builderAgent}" in config. Valid agents: ${validAgents}`,
    );
  }
  if (!AGENTS[out.builderAgent].canBuild) {
    const builders = Object.entries(AGENTS)
      .filter(([, a]) => a.canBuild)
      .map(([id]) => id)
      .join(', ');
    throw new Error(
      `Agent "${out.builderAgent}" cannot be used as builder. Agents that can build: ${builders}`,
    );
  }
  if (typeof out.judgeAgent !== 'string' || !Object.hasOwn(AGENTS, out.judgeAgent)) {
    throw new Error(
      `Invalid judge agent "${out.judgeAgent}" in config. Valid agents: ${validAgents}`,
    );
  }
  if (!AGENTS[out.judgeAgent].canJudge) {
    const judges = Object.entries(AGENTS)
      .filter(([, a]) => a.canJudge)
      .map(([id]) => id)
      .join(', ');
    throw new Error(
      `Agent "${out.judgeAgent}" cannot be used as judge. Agents that can judge: ${judges}`,
    );
  }

  // Recompute agentMode to match actual agents (agentMode is derived, not primary)
  out.agentMode = out.builderAgent === out.judgeAgent ? 'single' : 'dual';

  return out;
}

/**
 * Read the config file from disk.
 * @param {string} cwd
 * @returns {{ status: 'found', config: object } | { status: 'missing' } | { status: 'unreadable', error: Error } | { status: 'corrupt', error: Error }}
 */
export function readConfig(cwd) {
  const filePath = join(cwd, CONFIG_FILE);

  if (!existsSync(filePath)) {
    return { status: 'missing' };
  }

  let raw;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch (err) {
    return { status: 'unreadable', error: err };
  }

  try {
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
