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

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TEMPLATES = join(ROOT, 'src', 'templates');

// Config for this project's own dogfooding
const config = JSON.parse(readFileSync(join(ROOT, '.dual-agent-loop.json'), 'utf-8'));

const vars = {
  '{{COORDINATOR_NAME}}': config.coordinator,
  '{{RELEASE_MODE}}': config.release_mode,
  '{{MAX_ROUNDS}}': String(config.max_rounds),
};

function render(content) {
  for (const [key, value] of Object.entries(vars)) {
    content = content.replaceAll(key, value);
  }
  return content;
}

function generate(templatePath, destPath) {
  const content = render(readFileSync(join(TEMPLATES, templatePath), 'utf-8'));
  mkdirSync(dirname(join(ROOT, destPath)), { recursive: true });
  writeFileSync(join(ROOT, destPath), content);
  console.log(`  generate  ${destPath}`);
}

console.log('\n  scaffold-self: generating project files from src/templates/\n');

// Protocol files
generate('protocol/PROTOCOL.md', 'agent-loop/PROTOCOL.md');
generate('protocol/ANTIPATTERNS.md', 'agent-loop/ANTIPATTERNS.md');

// Slash commands
generate('commands/loop.build.md', '.claude/commands/loop.build.md');
generate('commands/loop.status.md', '.claude/commands/loop.status.md');
generate('commands/loop.backlog.md', '.claude/commands/loop.backlog.md');
generate('commands/loop.close.md', '.claude/commands/loop.close.md');

// Agent configs
generate('agents/CODEX.md', 'CODEX.md');
generate('agents/AGENTS.md', 'AGENTS.md');
generate('agents/CHEATSHEET.md', 'CHEATSHEET.md');

console.log('\n  Done. CLAUDE.md and specs/backlog.md are not overwritten (project-specific).\n');
