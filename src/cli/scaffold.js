import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

export async function scaffold(flags) {
  const cwd = process.cwd();
  console.log('\n  create-dual-agent-loop\n');
  console.log('  Scaffolding the Builder/Judge dual-agent protocol...\n');

  const config = await gatherConfig(flags);

  const files = [
    // Protocol files
    { src: 'protocol/PROTOCOL.md', dest: 'agent-loop/PROTOCOL.md' },
    { src: 'protocol/ANTIPATTERNS.md', dest: 'agent-loop/ANTIPATTERNS.md' },

    // Slash commands
    { src: 'commands/loop.build.md', dest: '.claude/commands/loop.build.md' },
    { src: 'commands/loop.status.md', dest: '.claude/commands/loop.status.md' },
    { src: 'commands/loop.backlog.md', dest: '.claude/commands/loop.backlog.md' },
    { src: 'commands/loop.close.md', dest: '.claude/commands/loop.close.md' },

    // Agent configs
    { src: 'agents/CODEX.md', dest: 'CODEX.md' },
    { src: 'agents/AGENTS.md', dest: 'AGENTS.md' },
    { src: 'agents/CHEATSHEET.md', dest: 'CHEATSHEET.md' },

    // Backlog
    { src: 'task/backlog.md', dest: 'specs/backlog.md' },
  ];

  let created = 0;
  let skipped = 0;

  for (const file of files) {
    const destPath = join(cwd, file.dest);
    if (existsSync(destPath) && !flags.force) {
      console.log(`  skip     ${file.dest} (exists)`);
      skipped++;
      continue;
    }
    mkdirSync(dirname(destPath), { recursive: true });
    const content = loadTemplate(file.src, config);
    writeFileSync(destPath, content);
    console.log(`  create   ${file.dest}`);
    created++;
  }

  // CLAUDE.md — append, never overwrite
  const claudeMdPath = join(cwd, 'CLAUDE.md');
  const claudeSection = loadTemplate('agents/CLAUDE.md.section', config);
  if (existsSync(claudeMdPath)) {
    const existing = readFileSync(claudeMdPath, 'utf-8');
    if (existing.includes('Builder-Judge Workflow')) {
      console.log('  skip     CLAUDE.md (section already exists)');
    } else {
      appendFileSync(claudeMdPath, '\n' + claudeSection);
      console.log('  append   CLAUDE.md (added Builder-Judge Workflow section)');
      created++;
    }
  } else {
    writeFileSync(claudeMdPath, claudeSection);
    console.log('  create   CLAUDE.md');
    created++;
  }

  // Config file
  const configPath = join(cwd, '.dual-agent-loop.json');
  if (existsSync(configPath) && !flags.force) {
    console.log('  skip     .dual-agent-loop.json (exists)');
    skipped++;
  } else {
    writeFileSync(configPath, JSON.stringify({
      version: '0.1.0',
      coordinator: config.coordinator,
      release_mode: config.releaseMode,
      builder: 'claude',
      judge: 'codex',
      max_rounds: config.maxRounds,
      specs_dir: 'specs',
      loop_dir: 'agent-loop',
    }, null, 2) + '\n');
    console.log('  create   .dual-agent-loop.json');
    created++;
  }

  console.log(`\n  Done. ${created} created, ${skipped} skipped.\n`);
  console.log('  Next steps:');
  console.log('    1. Review CLAUDE.md and CODEX.md');
  console.log('    2. In Claude Code: /loop.build new <describe your first task>');
  console.log('    3. In Codex: judge <task-id>');
  console.log('');
}

async function gatherConfig(flags) {
  const defaults = {
    coordinator: getGitUserName() || 'Coordinator',
    releaseMode: 'github-pr',
    maxRounds: 5,
  };

  if (flags.nonInteractive) return defaults;

  let Enquirer;
  try {
    Enquirer = (await import('enquirer')).default;
  } catch {
    console.log('  (using defaults — install enquirer for interactive prompts)\n');
    return defaults;
  }

  const enquirer = new Enquirer();

  const answers = await enquirer.prompt([
    {
      type: 'input',
      name: 'coordinator',
      message: 'Coordinator name',
      initial: defaults.coordinator,
    },
    {
      type: 'select',
      name: 'releaseMode',
      message: 'Release mode',
      choices: ['github-pr', 'gitlab-mr', 'local'],
      initial: 0,
    },
    {
      type: 'numeral',
      name: 'maxRounds',
      message: 'Max rounds per phase',
      initial: defaults.maxRounds,
    },
  ]);

  return {
    coordinator: answers.coordinator || defaults.coordinator,
    releaseMode: answers.releaseMode || defaults.releaseMode,
    maxRounds: answers.maxRounds || defaults.maxRounds,
  };
}

function loadTemplate(name, config) {
  const filePath = join(TEMPLATES_DIR, name);
  let content = readFileSync(filePath, 'utf-8');
  content = content.replaceAll('{{COORDINATOR_NAME}}', config.coordinator);
  content = content.replaceAll('{{RELEASE_MODE}}', config.releaseMode);
  content = content.replaceAll('{{MAX_ROUNDS}}', String(config.maxRounds));
  return content;
}

function getGitUserName() {
  try {
    return execFileSync('git', ['config', 'user.name'], { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}
