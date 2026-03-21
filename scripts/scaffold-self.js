/**
 * scaffold-self.js
 *
 * Generates the project's own protocol files from src/templates/.
 * This makes src/templates/ the single source of truth.
 *
 * Usage: npm run scaffold-self
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTemplateVars, getFilesToScaffold } from '../src/utils/agents.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TEMPLATES = join(ROOT, 'src', 'templates');

// Config for this project's own dogfooding
let config;
try {
  config = JSON.parse(readFileSync(join(ROOT, '.dual-agent-loop.json'), 'utf-8'));
} catch (err) {
  console.error(`  Error reading .dual-agent-loop.json: ${err.message}`);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
}

// Validate required config keys before proceeding
const REQUIRED_KEYS = ['coordinator', 'release_mode', 'max_rounds'];
const missing = REQUIRED_KEYS.filter(k => !(k in config));
if (missing.length > 0) {
  console.error(`  Error: .dual-agent-loop.json is missing keys: ${missing.join(', ')}`);
  process.exit(1);
}

// Build full config object expected by getTemplateVars
const fullConfig = {
  coordinator: config.coordinator,
  agentMode: config.agent_mode || 'dual',
  builderAgent: config.builder || 'claude',
  judgeAgent: config.judge || ((config.agent_mode || 'dual') === 'single' ? 'claude' : 'codex'),
  releaseMode: config.release_mode,
  maxRounds: config.max_rounds,
};

const vars = getTemplateVars(fullConfig);

function render(content) {
  for (const [key, value] of Object.entries(vars)) {
    content = content.split(key).join(String(value));
  }
  return content;
}

function generate(templatePath, destPath) {
  try {
    const content = render(readFileSync(join(TEMPLATES, templatePath), 'utf-8'));
    mkdirSync(dirname(join(ROOT, destPath)), { recursive: true });
    writeFileSync(join(ROOT, destPath), content);
    console.log(`  generate  ${destPath}`);
  } catch (err) {
    console.error(`  Error generating ${destPath} from ${templatePath}: ${err.message}`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  }
}

console.log('\n  scaffold-self: generating project files from src/templates/\n');

// Generate all files for the configured agent mode
// Skip project-specific files that shouldn't be overwritten
// CLAUDE.md.section is handled separately by scaffold.js (append-not-overwrite logic)
// and is intentionally not regenerated here — it's project-specific once created.
const SKIP_DESTS = new Set(['specs/backlog.md']);
const files = getFilesToScaffold(fullConfig).filter(f => !SKIP_DESTS.has(f.dest));
for (const file of files) {
  generate(file.src, file.dest);
}

console.log('\n  Done. specs/backlog.md is not overwritten (project-specific).\n');
