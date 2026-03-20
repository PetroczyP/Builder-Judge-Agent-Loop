import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { getTemplateVars, getFilesToScaffold, getNextSteps } from '../utils/agents.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

const PKG = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));

export async function scaffold(flags) {
  const cwd = process.cwd();
  console.log('\n  create-dual-agent-loop\n');

  const config = await gatherConfig(flags);
  console.log('  Scaffolding the Builder/Judge protocol...\n');
  const files = getFilesToScaffold(config);
  const vars = getTemplateVars(config);

  let created = 0;
  let skipped = 0;

  for (const file of files) {
    const destPath = join(cwd, file.dest);
    if (existsSync(destPath) && !flags.force) {
      console.log(`  skip     ${file.dest} (exists)`);
      skipped++;
      continue;
    }
    try {
      mkdirSync(dirname(destPath), { recursive: true });
      const content = loadTemplate(file.src, vars);
      writeFileSync(destPath, content);
    } catch (err) {
      throw new Error(`Failed to create ${file.dest}: ${err.message}`);
    }
    console.log(`  create   ${file.dest}`);
    created++;
  }

  // CLAUDE.md — append, never overwrite
  const claudeMdPath = join(cwd, 'CLAUDE.md');
  const claudeSection = loadTemplate('agents/CLAUDE.md.section', vars);
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
      version: PKG.version,
      coordinator: config.coordinator,
      agent_mode: config.agentMode,
      builder: config.builderAgent,
      judge: config.judgeAgent,
      release_mode: config.releaseMode,
      max_rounds: config.maxRounds,
      specs_dir: 'specs',
      loop_dir: 'agent-loop',
    }, null, 2) + '\n');
    console.log('  create   .dual-agent-loop.json');
    created++;
  }

  console.log(`\n  Done. ${created} created, ${skipped} skipped.\n`);
  for (const line of getNextSteps(config)) {
    console.log(line);
  }
  console.log('');
}

async function gatherConfig(flags) {
  const defaults = {
    coordinator: getGitUserName() || 'Coordinator',
    agentMode: 'dual',
    builderAgent: 'claude',
    judgeAgent: 'codex',
    releaseMode: 'github-pr',
    maxRounds: 5,
  };

  if (flags.nonInteractive) return defaults;

  let Enquirer;
  try {
    Enquirer = (await import('enquirer')).default;
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'MODULE_NOT_FOUND') {
      console.log('  (using defaults — install enquirer for interactive prompts)\n');
      return defaults;
    }
    throw err;
  }

  const enquirer = new Enquirer();

  let agentMode, answers;
  try {
    ({ agentMode } = await enquirer.prompt({
      type: 'select',
      name: 'agentMode',
      message: 'Agent setup',
      choices: [
        { name: 'dual', message: 'Dual agent (Claude Code builds, Codex judges)' },
        { name: 'single', message: 'Single agent (Claude Code plays both roles)' },
      ],
      initial: 0,
    }));

    answers = await enquirer.prompt([
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
  } catch {
    console.log('\n  Setup cancelled. Run again when ready.\n');
    process.exit(0);
  }

  const builderAgent = 'claude';
  const judgeAgent = agentMode === 'single' ? 'claude' : 'codex';

  return {
    coordinator: answers.coordinator || defaults.coordinator,
    agentMode,
    builderAgent,
    judgeAgent,
    releaseMode: answers.releaseMode || defaults.releaseMode,
    maxRounds: answers.maxRounds || defaults.maxRounds,
  };
}

function loadTemplate(name, vars) {
  const filePath = join(TEMPLATES_DIR, name);
  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new Error(`Missing template "${name}": ${err.message}`);
  }

  for (const [key, value] of Object.entries(vars)) {
    content = content.replaceAll(key, value);
  }

  return content;
}

function getGitUserName() {
  try {
    return execFileSync('git', ['config', 'user.name'], { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}
