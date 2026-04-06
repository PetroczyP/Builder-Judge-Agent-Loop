import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs, PKG_VERSION } from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), 'dal-index-test-'));
}

const BIN = join(__dirname, '..', 'bin', 'create-dual-agent-loop.js');

/**
 * Run the CLI in a child process and return { stdout, stderr, exitCode }.
 * Uses --yes to avoid interactive prompts.
 */
function runCli(cwd, args = []) {
  try {
    const stdout = execFileSync('node', [BIN, ...args], {
      cwd,
      encoding: 'utf-8',
      timeout: 15_000,
      env: { ...process.env, NO_COLOR: '1' },
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      exitCode: err.status ?? 1,
    };
  }
}

// ── parseArgs ──────────────────────────────────────────────────────

describe('parseArgs', () => {
  it('returns defaults for empty args', () => {
    const result = parseArgs([]);
    assert.deepEqual(result, {
      subcommand: null,
      flags: { force: false, nonInteractive: false },
    });
  });

  it('parses upgrade subcommand', () => {
    const result = parseArgs(['upgrade']);
    assert.equal(result.subcommand, 'upgrade');
    assert.equal(result.flags.force, false);
  });

  it('parses --force flag', () => {
    const result = parseArgs(['--force']);
    assert.equal(result.flags.force, true);
    assert.equal(result.subcommand, null);
  });

  it('parses -f shorthand', () => {
    const result = parseArgs(['-f']);
    assert.equal(result.flags.force, true);
  });

  it('parses --yes flag', () => {
    const result = parseArgs(['--yes']);
    assert.equal(result.flags.nonInteractive, true);
  });

  it('parses -y shorthand', () => {
    const result = parseArgs(['-y']);
    assert.equal(result.flags.nonInteractive, true);
  });

  it('parses subcommand with flags', () => {
    const result = parseArgs(['upgrade', '--force', '-y']);
    assert.equal(result.subcommand, 'upgrade');
    assert.equal(result.flags.force, true);
    assert.equal(result.flags.nonInteractive, true);
  });

  it('takes the first non-flag arg as subcommand', () => {
    const result = parseArgs(['upgrade', 'extra']);
    assert.equal(result.subcommand, 'upgrade');
  });

  it('ignores unknown flags', () => {
    const result = parseArgs(['--unknown', '-x']);
    assert.equal(result.subcommand, null);
    assert.equal(result.flags.force, false);
    assert.equal(result.flags.nonInteractive, false);
  });
});

// ── Unknown subcommand ────────────────────────────────────────────

describe('unknown subcommand', () => {
  it('prints error and exits 1 for unknown subcommand', () => {
    const cwd = makeTmpDir();
    const { stderr, exitCode } = runCli(cwd, ['foobar']);

    assert.equal(exitCode, 1);
    assert.ok(
      stderr.includes('Unknown subcommand'),
      `stderr should mention unknown subcommand, got: ${stderr}`,
    );
  });

  it('prints error even with existing config', () => {
    const cwd = makeTmpDir();
    runCli(cwd, ['--yes']); // scaffold first
    const { stderr, exitCode } = runCli(cwd, ['upgarde']); // typo

    assert.equal(exitCode, 1);
    assert.ok(stderr.includes('Unknown subcommand'));
  });
});

// ── Missing config.version ──────────────────────────────────────

describe('config without version field', () => {
  it('treats missing version as 0.0.0 and upgrades', () => {
    const cwd = makeTmpDir();
    runCli(cwd, ['--yes']); // scaffold first

    const configPath = join(cwd, '.dual-agent-loop.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    delete config.version;
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

    const { exitCode } = runCli(cwd, ['--yes']);
    assert.equal(exitCode, 0, 'should not crash on missing version');

    const updated = JSON.parse(readFileSync(configPath, 'utf-8'));
    assert.equal(updated.version, PKG_VERSION);
  });
});

// ── PKG_VERSION ────────────────────────────────────────────────────

describe('PKG_VERSION', () => {
  it('exports a valid semver-like string', () => {
    assert.ok(PKG_VERSION, 'PKG_VERSION should be truthy');
    assert.match(PKG_VERSION, /^\d+\.\d+\.\d+/, 'should match x.y.z');
  });

  it('matches package.json version', () => {
    const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf-8'));
    assert.equal(PKG_VERSION, pkg.version);
  });
});

// ── Routing: bare run + missing config → scaffold ──────────────────

describe('bare run with no config', () => {
  it('runs scaffold (creates agent-loop files)', () => {
    const cwd = makeTmpDir();
    const { stdout, exitCode } = runCli(cwd, ['--yes']);

    assert.equal(exitCode, 0, `expected exit 0, stderr: (see stdout)\nstdout: ${stdout}`);
    assert.ok(
      existsSync(join(cwd, '.dual-agent-loop.json')),
      'config file should be created by scaffold',
    );
    assert.ok(
      existsSync(join(cwd, 'agent-loop', 'PROTOCOL.md')),
      'protocol file should be created by scaffold',
    );
  });
});

// ── Routing: corrupt config → error ────────────────────────────────

describe('corrupt config', () => {
  it('prints error and exits 1 on bare run', () => {
    const cwd = makeTmpDir();
    writeFileSync(join(cwd, '.dual-agent-loop.json'), '{not valid json!!!');

    const { stderr, exitCode } = runCli(cwd, ['--yes']);
    assert.equal(exitCode, 1);
    assert.ok(
      stderr.includes('Failed to parse .dual-agent-loop.json'),
      `stderr should mention parse error, got: ${stderr}`,
    );
  });

  it('prints error and exits 1 on upgrade subcommand', () => {
    const cwd = makeTmpDir();
    writeFileSync(join(cwd, '.dual-agent-loop.json'), '{not valid json!!!');

    const { stderr, exitCode } = runCli(cwd, ['upgrade', '--yes']);
    assert.equal(exitCode, 1);
    assert.ok(
      stderr.includes('Failed to parse .dual-agent-loop.json'),
      `stderr should mention parse error, got: ${stderr}`,
    );
  });
});

// ── Routing: upgrade subcommand + missing config → error ───────────

describe('upgrade subcommand with no config', () => {
  it('prints error about missing setup', () => {
    const cwd = makeTmpDir();
    const { stderr, exitCode } = runCli(cwd, ['upgrade']);

    assert.equal(exitCode, 1);
    assert.ok(
      stderr.includes('No existing setup found'),
      `stderr should say no setup found, got: ${stderr}`,
    );
  });
});

// ── Routing: upgrade subcommand + found config → runs upgrade ──────

describe('upgrade subcommand with config', () => {
  it('runs upgrade flow successfully', () => {
    const cwd = makeTmpDir();

    // First: scaffold a real setup
    runCli(cwd, ['--yes']);
    assert.ok(existsSync(join(cwd, '.dual-agent-loop.json')), 'scaffold should create config');

    // Now run upgrade subcommand
    const { stdout, exitCode } = runCli(cwd, ['upgrade', '--yes']);
    assert.equal(exitCode, 0, `expected exit 0, stdout: ${stdout}`);

    const config = JSON.parse(readFileSync(join(cwd, '.dual-agent-loop.json'), 'utf-8'));
    assert.equal(config.version, PKG_VERSION);
  });
});

// ── Routing: bare run + config found + same version → resync ───────

describe('bare run with same-version config (resync)', () => {
  it('runs upgrade/resync silently', () => {
    const cwd = makeTmpDir();

    // Scaffold first
    runCli(cwd, ['--yes']);

    // Run bare again — same version, should resync
    const { stdout, exitCode } = runCli(cwd, ['--yes']);
    assert.equal(exitCode, 0, `expected exit 0, stdout: ${stdout}`);

    const config = JSON.parse(readFileSync(join(cwd, '.dual-agent-loop.json'), 'utf-8'));
    assert.equal(config.version, PKG_VERSION);
  });
});

// ── Routing: bare run + config found + older version → upgrade ─────

describe('bare run with older config version (upgrade)', () => {
  it('prints upgrade message and runs upgrade', () => {
    const cwd = makeTmpDir();

    // Scaffold first
    runCli(cwd, ['--yes']);

    // Downgrade the stored version
    const configPath = join(cwd, '.dual-agent-loop.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    config.version = '0.0.1';
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

    const { stdout, exitCode } = runCli(cwd, ['--yes']);
    assert.equal(exitCode, 0, `expected exit 0, stdout: ${stdout}`);
    assert.ok(
      stdout.includes('Existing setup found (v0.0.1)'),
      `should print upgrade message, got: ${stdout}`,
    );
    assert.ok(
      stdout.includes(`Upgrading to v${PKG_VERSION}`),
      `should mention target version, got: ${stdout}`,
    );

    const updated = JSON.parse(readFileSync(configPath, 'utf-8'));
    assert.equal(updated.version, PKG_VERSION);
  });
});

// ── Routing: bare run + config found + newer version → error ───────

describe('bare run with newer config version (downgrade protection)', () => {
  it('prints error and exits 1', () => {
    const cwd = makeTmpDir();

    // Scaffold first
    runCli(cwd, ['--yes']);

    // Bump the stored version beyond the package version
    const configPath = join(cwd, '.dual-agent-loop.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    config.version = '99.0.0';
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

    const { stderr, exitCode } = runCli(cwd, ['--yes']);
    assert.equal(exitCode, 1);
    assert.ok(
      stderr.includes('newer than installed package'),
      `stderr should mention downgrade, got: ${stderr}`,
    );
  });

  it('allows downgrade with --force', () => {
    const cwd = makeTmpDir();

    // Scaffold first
    runCli(cwd, ['--yes']);

    // Bump the stored version
    const configPath = join(cwd, '.dual-agent-loop.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    config.version = '99.0.0';
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

    const { stdout, exitCode } = runCli(cwd, ['--force', '--yes']);
    assert.equal(exitCode, 0, `expected exit 0, stdout: ${stdout}`);

    const updated = JSON.parse(readFileSync(configPath, 'utf-8'));
    assert.equal(updated.version, PKG_VERSION);
  });
});

// ── Routing: upgrade subcommand + newer config version → error ───

// ── H-1 regression: scaffold with pre-existing file → resync clean ──

describe('scaffold hashes skipped files so resync does not produce .new', () => {
  it('resync after scaffold with pre-existing AGENTS.md does not create .new', () => {
    const cwd = makeTmpDir();

    // Pre-create AGENTS.md before scaffold (simulates pre-existing file)
    writeFileSync(join(cwd, 'AGENTS.md'), 'pre-existing content');

    // Scaffold — AGENTS.md should be skipped but still hashed
    const { exitCode: initCode } = runCli(cwd, ['--yes']);
    assert.equal(initCode, 0);

    const config = JSON.parse(readFileSync(join(cwd, '.dual-agent-loop.json'), 'utf-8'));
    assert.ok(config.file_hashes['AGENTS.md'], 'skipped file should have a baseline hash');
    assert.ok(
      config.managed_files.includes('AGENTS.md'),
      'skipped file should be in managed_files',
    );

    // Resync (same version) — should NOT create AGENTS.md.new
    const { exitCode: resyncCode } = runCli(cwd, ['--yes']);
    assert.equal(resyncCode, 0);
    assert.ok(
      !existsSync(join(cwd, 'AGENTS.md.new')),
      'resync should NOT create .new for a file that was skipped at init',
    );
  });
});

// ── Routing: upgrade subcommand + newer config version → error ───

describe('upgrade subcommand with newer config version (downgrade protection)', () => {
  it('prints error and exits 1', () => {
    const cwd = makeTmpDir();

    // Scaffold first
    runCli(cwd, ['--yes']);

    // Bump the stored version beyond the package version
    const configPath = join(cwd, '.dual-agent-loop.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    config.version = '99.0.0';
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

    const { stderr, exitCode } = runCli(cwd, ['upgrade', '--yes']);
    assert.equal(exitCode, 1);
    assert.ok(
      stderr.includes('newer than installed package'),
      `stderr should mention downgrade, got: ${stderr}`,
    );
  });

  it('allows downgrade with upgrade --force', () => {
    const cwd = makeTmpDir();

    // Scaffold first
    runCli(cwd, ['--yes']);

    // Bump the stored version
    const configPath = join(cwd, '.dual-agent-loop.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    config.version = '99.0.0';
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

    const { stdout, exitCode } = runCli(cwd, ['upgrade', '--force', '--yes']);
    assert.equal(exitCode, 0, `expected exit 0, stdout: ${stdout}`);

    const updated = JSON.parse(readFileSync(configPath, 'utf-8'));
    assert.equal(updated.version, PKG_VERSION);
  });
});
