import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scaffold } from './cli/scaffold.js';
import { upgrade } from './cli/upgrade.js';
import { readConfig } from './utils/config.js';
import { compareVersions } from './utils/version.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let PKG_VERSION;
try {
  PKG_VERSION = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')).version;
} catch (err) {
  throw new Error(`Failed to read package.json: ${err.message}`, { cause: err });
}

export { PKG_VERSION };

export async function run(args) {
  const { subcommand, flags } = parseArgs(args);
  const cwd = process.cwd();

  if (subcommand && subcommand !== 'upgrade') {
    console.error(`\n  Error: Unknown subcommand "${subcommand}". Valid: upgrade\n`);
    process.exitCode = 1;
    return;
  }

  const result = readConfig(cwd);

  // Unreadable config (permission denied, locked) — distinct from corrupt
  if (result.status === 'unreadable') {
    console.error(
      `\n  Error: Cannot read .dual-agent-loop.json: ${result.error.message}\n`,
    );
    process.exitCode = 1;
    return;
  }

  // Corrupt config (invalid JSON, non-object) is always a hard error
  if (result.status === 'corrupt') {
    console.error(
      `\n  Error: Failed to parse .dual-agent-loop.json: ${result.error.message}\n`,
    );
    process.exitCode = 1;
    return;
  }

  // Upgrade subcommand requires existing config
  if (subcommand === 'upgrade' && result.status === 'missing') {
    console.error(
      '\n  Error: No existing setup found. Run npx create-dual-agent-loop to initialize.\n',
    );
    process.exitCode = 1;
    return;
  }

  // Bare run with no config → scaffold
  if (!subcommand && result.status === 'missing') {
    await scaffold(flags);
    return;
  }

  // Config found — downgrade guard (applies to both upgrade subcommand and bare run)
  const config = result.config;
  const configVersion = config.version || '0.0.0';
  if (compareVersions(configVersion, PKG_VERSION) > 0 && !flags.force) {
    console.error(
      `\n  Error: Config version (${configVersion}) is newer than installed package (${PKG_VERSION}).`,
    );
    console.error('  Install a newer version or use --force to overwrite.\n');
    process.exitCode = 1;
    return;
  }

  const promptFn = await createPromptFn(flags);

  // Bare run with older version → prompt for upgrade
  if (!subcommand && compareVersions(configVersion, PKG_VERSION) < 0) {
    if (!flags.nonInteractive) {
      const proceed = await promptFn(
        `Existing setup found (v${configVersion}). Upgrade to v${PKG_VERSION}?`,
      );
      if (!proceed) {
        console.log('\n  Upgrade skipped.\n');
        return;
      }
    }
    console.log(
      `\n  Existing setup found (v${configVersion}). Upgrading to v${PKG_VERSION}...\n`,
    );
  }

  const mergePromptFn = await createMergePromptFn(flags);
  await upgrade({ cwd, flags, config, promptFn, mergePromptFn, pkgVersion: PKG_VERSION });
}

export function parseArgs(args) {
  const flags = { force: false, nonInteractive: false };
  let subcommand = null;

  for (const arg of args) {
    if (arg === '--force' || arg === '-f') {
      flags.force = true;
    } else if (arg === '--yes' || arg === '-y') {
      flags.nonInteractive = true;
    } else if (!arg.startsWith('-') && !subcommand) {
      subcommand = arg;
    }
  }

  return { subcommand, flags };
}

async function loadEnquirer() {
  try {
    const Enquirer = (await import('enquirer')).default;
    return new Enquirer();
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'MODULE_NOT_FOUND') {
      return null;
    }
    throw err;
  }
}

async function createMergePromptFn(flags) {
  if (flags.nonInteractive) return null;

  const enquirer = await loadEnquirer();
  if (!enquirer) return null;

  return async () => {
    try {
      const { choice } = await enquirer.prompt({
        type: 'select',
        name: 'choice',
        message: 'How would you like to handle conflicts?',
        choices: [
          { name: 'claude', message: 'Let Claude Code review and merge (recommended)' },
          { name: 'manual', message: 'Manual merge' },
        ],
      });
      return choice;
    } catch (err) {
      if (err === '' || err === undefined) return 'manual';
      throw err;
    }
  };
}

async function createPromptFn(flags) {
  if (flags.nonInteractive) {
    return async () => true;
  }

  const enquirer = await loadEnquirer();
  if (!enquirer) {
    console.log('  (enquirer not installed — prompts will be auto-accepted; use --yes to suppress this message)\n');
    return async () => true;
  }

  return async (question) => {
    try {
      const { answer } = await enquirer.prompt({
        type: 'confirm',
        name: 'answer',
        message: question,
        initial: false,
      });
      return answer;
    } catch (err) {
      if (err === '' || err === undefined) return false;
      throw err;
    }
  };
}
