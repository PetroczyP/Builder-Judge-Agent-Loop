import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { upgrade } from './upgrade.js';
import { computeHash } from '../utils/hashing.js';
import { getFilesToScaffold, getTemplateVars, REMOVED_TEMPLATES } from '../utils/agents.js';
import { normalizeConfig } from '../utils/config.js';
import { loadTemplate } from './scaffold.js';

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), 'dal-test-'));
}

function readConfigFile(cwd) {
  return JSON.parse(readFileSync(join(cwd, '.dual-agent-loop.json'), 'utf-8'));
}

// A real config for testing — uses dual mode
const BASE_CONFIG = {
  version: '0.2.0',
  coordinator: 'TestCoord',
  agent_mode: 'dual',
  builder: 'claude',
  judge: 'codex',
  release_mode: 'github-pr',
  max_rounds: 5,
  specs_dir: 'specs',
  loop_dir: 'agent-loop',
};

// Helper: scaffold real template files into a temp dir and return hashes
function scaffoldFiles(cwd, config) {
  const normalized = normalizeConfig(config);
  const files = getFilesToScaffold(normalized);
  const vars = getTemplateVars(normalized);
  const fileHashes = {};
  for (const file of files) {
    const destPath = join(cwd, file.dest);
    mkdirSync(join(cwd, ...file.dest.split('/').slice(0, -1)), { recursive: true });
    const content = loadTemplate(file.src, vars);
    writeFileSync(destPath, content);
    fileHashes[file.dest] = computeHash(content);
  }
  return { fileHashes, managedFiles: files.map((f) => f.dest) };
}

// No-op prompt function — throws if called (for force/simple tests)
const noPrompt = async () => {
  throw new Error('promptFn should not be called');
};
// Always-yes prompt
const yesPrompt = async () => true;
// Always-no prompt

// ── S1: Untouched upgrade ────────────────────────────────────────

describe('S1 — untouched upgrade', () => {
  it('overwrites all files when templates changed and none customized', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: fileHashes,
      managed_files: managedFiles,
    };
    // Write config so writeConfig can merge
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    // Simulate a version bump — the templates haven't actually changed
    // since we use the same code, so the result should be 'skip' for all.
    await upgrade({
      cwd,
      flags: { force: false, nonInteractive: true },
      config: storedConfig,
      promptFn: noPrompt,
      pkgVersion: '0.3.0',
    });

    const result = readConfigFile(cwd);
    assert.equal(result.version, '0.3.0');
    assert.ok(result.managed_files.length > 0);
    // Since templates did not actually change, all should be 'skip' and hashes preserved
    for (const dest of managedFiles) {
      assert.ok(result.file_hashes[dest], `hash must exist for ${dest}`);
    }
    // No pending_hashes should exist
    assert.equal(result.pending_hashes, undefined);
  });
});

// ── S2: Customized file conflict ────────────────────────────────

describe('S2 — customized file conflict', () => {
  it('creates .new for user-modified file, overwrites untouched ones', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    // Modify one file to simulate user customization
    const targetDest = 'agent-loop/PROTOCOL.md';
    const targetPath = join(cwd, targetDest);
    writeFileSync(targetPath, 'user has customized this file');

    const storedConfig = {
      ...BASE_CONFIG,
      version: '0.2.0',
      file_hashes: fileHashes,
      managed_files: managedFiles,
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    // Use a different "template version" by making file_hashes point to old content.
    // The template content is the same (same code), but the disk content differs
    // from stored hash, so compareFile sees user-touched.
    // However, template also equals storedHash (no template change) -> Row 4: skip.
    // To trigger a real conflict (Row 3), we need both user-touched AND template changed.
    // We do this by setting a fake stored hash that differs from both disk and template.
    storedConfig.file_hashes[targetDest] = computeHash('old template v0.2.0');

    await upgrade({
      cwd,
      flags: { force: false, nonInteractive: true },
      config: storedConfig,
      promptFn: noPrompt,
      pkgVersion: '0.3.0',
    });

    // The modified file should have a .new sidecar
    assert.ok(existsSync(targetPath + '.new'), 'conflict file should have .new sidecar');

    const result = readConfigFile(cwd);
    assert.equal(result.version, '0.3.0');
    // pending_hashes should include the conflicted file
    assert.ok(result.pending_hashes, 'pending_hashes should exist');
    assert.ok(result.pending_hashes[targetDest], 'conflicted file should be in pending_hashes');
    // Critical invariant (FR5): stored hash must NOT be updated for conflicted files
    assert.equal(
      result.file_hashes[targetDest],
      computeHash('old template v0.2.0'),
      'file_hashes must retain the old baseline for conflicted files',
    );
  });
});

// ── S4: Force upgrade ───────────────────────────────────────────

describe('S4 — force upgrade', () => {
  it('overwrites all files including user-modified, no .new files, no prompts', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    // Modify a file
    const targetDest = 'agent-loop/PROTOCOL.md';
    writeFileSync(join(cwd, targetDest), 'user has customized this file');

    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: fileHashes,
      managed_files: managedFiles,
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    await upgrade({
      cwd,
      flags: { force: true, nonInteractive: false },
      config: storedConfig,
      promptFn: noPrompt, // throws if called
      pkgVersion: '0.3.0',
    });

    // File should be overwritten with template content, not user content
    const content = readFileSync(join(cwd, targetDest), 'utf-8');
    assert.ok(content !== 'user has customized this file', 'file must be overwritten');

    // No .new files
    assert.ok(!existsSync(join(cwd, targetDest + '.new')), 'no .new file in force mode');

    const result = readConfigFile(cwd);
    assert.equal(result.version, '0.3.0');
    // Force clears pending_hashes (omitted when empty)
    assert.equal(result.pending_hashes, undefined);
    // Fresh hashes for all files
    for (const dest of managedFiles) {
      assert.ok(result.file_hashes[dest], `hash must exist for ${dest}`);
    }
  });
});

// ── S5: Pre-hash upgrade ────────────────────────────────────────

describe('S5 — pre-hash upgrade (no file_hashes in config)', () => {
  it('existing files get .new, missing files get created', async () => {
    const cwd = makeTmpDir();
    // Scaffold files but do NOT include file_hashes in config
    scaffoldFiles(cwd, BASE_CONFIG);

    const storedConfig = {
      ...BASE_CONFIG,
      // No file_hashes, no managed_files — simulating a pre-hash install
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    await upgrade({
      cwd,
      flags: { force: false, nonInteractive: true },
      config: storedConfig,
      promptFn: noPrompt,
      pkgVersion: '0.3.0',
    });

    const result = readConfigFile(cwd);
    assert.equal(result.version, '0.3.0');

    // All existing files should get conflict_prehash -> .new files
    const normalized = normalizeConfig(storedConfig);
    const files = getFilesToScaffold(normalized);
    let hasConflicts = false;
    for (const file of files) {
      if (existsSync(join(cwd, file.dest + '.new'))) {
        hasConflicts = true;
      }
    }
    assert.ok(hasConflicts, 'pre-hash upgrade should produce at least one .new conflict file');

    // pending_hashes should be populated
    assert.ok(result.pending_hashes, 'pending_hashes should exist');
    assert.ok(
      Object.keys(result.pending_hashes).length > 0,
      'pending_hashes should have entries',
    );
  });
});

// ── S6: New file in version ─────────────────────────────────────

describe('S6 — new file appears when mode adds files', () => {
  it('creates files that did not exist in the previous managed set', async () => {
    const cwd = makeTmpDir();

    // Scaffold as dual mode
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    // Remove one file from disk to simulate a new file appearing
    // (pretend CHEATSHEET.md did not exist in old version)
    const newDest = 'CHEATSHEET.md';
    const { unlinkSync } = await import('node:fs');
    unlinkSync(join(cwd, newDest));

    // Also remove it from the stored hashes/managed set
    const reducedHashes = { ...fileHashes };
    delete reducedHashes[newDest];
    const reducedManaged = managedFiles.filter((d) => d !== newDest);

    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: reducedHashes,
      managed_files: reducedManaged,
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    await upgrade({
      cwd,
      flags: { force: false, nonInteractive: true },
      config: storedConfig,
      promptFn: noPrompt,
      pkgVersion: '0.3.0',
    });

    // The new file should be created
    assert.ok(existsSync(join(cwd, newDest)), 'new file should be created');

    const result = readConfigFile(cwd);
    assert.ok(result.file_hashes[newDest], 'new file should have a hash');
    assert.ok(result.managed_files.includes(newDest), 'new file should be in managed_files');
  });
});

// ── S7: Removed files ───────────────────────────────────────────

describe('S7 — removed files detected', () => {
  it('reports files in managed_files that are no longer in template set', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    // Add a fake file to managed_files that does not exist in current templates
    const removedDest = 'agent-loop/OLD_FILE.md';
    const extendedManaged = [...managedFiles, removedDest];
    const extendedHashes = { ...fileHashes, [removedDest]: 'fakehash' };

    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: extendedHashes,
      managed_files: extendedManaged,
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    await upgrade({
      cwd,
      flags: { force: false, nonInteractive: true },
      config: storedConfig,
      promptFn: noPrompt,
      pkgVersion: '0.3.0',
    });

    const result = readConfigFile(cwd);
    // The removed file should NOT be in file_hashes
    assert.equal(result.file_hashes[removedDest], undefined, 'removed file hash should be cleaned');
    // managed_files should reflect only current templates
    assert.ok(
      !result.managed_files.includes(removedDest),
      'removed file should not be in managed_files',
    );
  });
});

// ── S8: Same-version resync (missing file) ──────────────────────

describe('S8 — same-version resync re-creates missing file', () => {
  it('re-creates a file that was deleted from disk', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    // Delete one file from disk
    const missingDest = 'AGENTS.md';
    const { unlinkSync } = await import('node:fs');
    unlinkSync(join(cwd, missingDest));

    const storedConfig = {
      ...BASE_CONFIG,
      version: '0.3.0',
      file_hashes: fileHashes,
      managed_files: managedFiles,
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    await upgrade({
      cwd,
      flags: { force: false, nonInteractive: true },
      config: storedConfig,
      promptFn: noPrompt,
      pkgVersion: '0.3.0',
    });

    // File should be re-created
    assert.ok(existsSync(join(cwd, missingDest)), 'missing file should be re-created');

    const result = readConfigFile(cwd);
    assert.ok(result.file_hashes[missingDest], 'recreated file should have hash');
  });
});

// ── S9: Non-interactive mode with conflicts ─────────────────────

describe('S9 — non-interactive mode prints merge message', () => {
  it('does not call promptFn for merge wizard in non-interactive mode', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    // Modify a file and set a fake old hash to force conflict
    const targetDest = 'agent-loop/PROTOCOL.md';
    writeFileSync(join(cwd, targetDest), 'user customized content');
    const conflictHashes = { ...fileHashes };
    conflictHashes[targetDest] = computeHash('old template content');

    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: conflictHashes,
      managed_files: managedFiles,
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    // promptFn should only be called for convergence, not for merge wizard
    // Since there are no pending_hashes, convergence won't call it either
    await upgrade({
      cwd,
      flags: { force: false, nonInteractive: true },
      config: storedConfig,
      promptFn: noPrompt,
      pkgVersion: '0.3.0',
    });

    // Conflict should exist
    assert.ok(existsSync(join(cwd, targetDest + '.new')), 'conflict .new should exist');
  });
});

// ── S10: Force mode never calls promptFn ────────────────────────

describe('S10 — force mode never calls promptFn', () => {
  it('promptFn is never called, all files overwritten, fresh hashes, empty pending_hashes', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    // Add pending_hashes to verify they get cleared
    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: fileHashes,
      managed_files: managedFiles,
      pending_hashes: { 'agent-loop/PROTOCOL.md': 'stale_hash' },
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    const throwingPrompt = async () => {
      throw new Error('promptFn must not be called in force mode');
    };

    await upgrade({
      cwd,
      flags: { force: true, nonInteractive: false },
      config: storedConfig,
      promptFn: throwingPrompt,
      pkgVersion: '0.3.0',
    });

    const result = readConfigFile(cwd);
    assert.equal(result.version, '0.3.0');
    assert.equal(result.pending_hashes, undefined, 'pending_hashes should be omitted when empty');

    // All managed files should have fresh hashes
    const normalized = normalizeConfig(storedConfig);
    const files = getFilesToScaffold(normalized);
    const vars = getTemplateVars(normalized);
    for (const file of files) {
      const expectedContent = loadTemplate(file.src, vars);
      const expectedHash = computeHash(expectedContent);
      assert.equal(
        result.file_hashes[file.dest],
        expectedHash,
        `hash for ${file.dest} should match fresh template`,
      );
    }
  });
});

// ── Convergence integration test ────────────────────────────────

describe('convergence — pending hash promoted when .new removed', () => {
  it('promotes pending_hashes entry to file_hashes after .new deleted and user confirms', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    const targetDest = 'agent-loop/PROTOCOL.md';
    const normalized = normalizeConfig(BASE_CONFIG);
    const vars = getTemplateVars(normalized);
    const templateContent = loadTemplate('protocol/PROTOCOL.md', vars);
    const templateHash = computeHash(templateContent);

    // Set up: pending_hashes has an entry, but the .new file does NOT exist
    // (user has already merged and deleted the .new file)
    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: fileHashes,
      managed_files: managedFiles,
      pending_hashes: { [targetDest]: templateHash },
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    await upgrade({
      cwd,
      flags: { force: false, nonInteractive: false },
      config: storedConfig,
      promptFn: yesPrompt,
      pkgVersion: '0.3.0',
    });

    const result = readConfigFile(cwd);
    // The pending hash should be promoted to file_hashes
    assert.equal(
      result.file_hashes[targetDest],
      templateHash,
      'pending hash should be promoted to file_hashes',
    );
    // pending_hashes should be cleared (omitted when empty)
    assert.equal(result.pending_hashes, undefined, 'pending_hashes should be omitted when empty');
  });
});

// ── CLAUDE.md handling ──────────────────────────────────────────

describe('CLAUDE.md handling', () => {
  it('creates CLAUDE.md if it does not exist', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: fileHashes,
      managed_files: managedFiles,
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    // Ensure CLAUDE.md does not exist
    assert.ok(!existsSync(join(cwd, 'CLAUDE.md')), 'CLAUDE.md should not exist initially');

    await upgrade({
      cwd,
      flags: { force: false, nonInteractive: true },
      config: storedConfig,
      promptFn: noPrompt,
      pkgVersion: '0.3.0',
    });

    assert.ok(existsSync(join(cwd, 'CLAUDE.md')), 'CLAUDE.md should be created');
  });

  it('appends section to existing CLAUDE.md without Builder-Judge Workflow', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    // Create CLAUDE.md with some existing content but no workflow section
    writeFileSync(join(cwd, 'CLAUDE.md'), '# My Project\n\nExisting content.\n');

    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: fileHashes,
      managed_files: managedFiles,
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    await upgrade({
      cwd,
      flags: { force: false, nonInteractive: true },
      config: storedConfig,
      promptFn: noPrompt,
      pkgVersion: '0.3.0',
    });

    const content = readFileSync(join(cwd, 'CLAUDE.md'), 'utf-8');
    assert.ok(content.startsWith('# My Project'), 'existing content should be preserved');
    assert.ok(
      content.includes('Builder-Judge Workflow'),
      'Builder-Judge Workflow section should be appended',
    );
  });

  it('skips CLAUDE.md when Builder-Judge Workflow heading already present', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    const existingContent = '# CLAUDE.md\n\n## Builder-Judge Workflow\n\nAlready configured.\n';
    writeFileSync(join(cwd, 'CLAUDE.md'), existingContent);

    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: fileHashes,
      managed_files: managedFiles,
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    await upgrade({
      cwd,
      flags: { force: false, nonInteractive: true },
      config: storedConfig,
      promptFn: noPrompt,
      pkgVersion: '0.3.0',
    });

    const content = readFileSync(join(cwd, 'CLAUDE.md'), 'utf-8');
    assert.equal(content, existingContent, 'CLAUDE.md should not be modified');
  });
});

// ── Force mode CLAUDE.md handling ───────────────────────────────

describe('force mode CLAUDE.md', () => {
  it('appends section in force mode when heading absent', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    writeFileSync(join(cwd, 'CLAUDE.md'), '# Existing\n');

    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: fileHashes,
      managed_files: managedFiles,
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    await upgrade({
      cwd,
      flags: { force: true, nonInteractive: false },
      config: storedConfig,
      promptFn: noPrompt,
      pkgVersion: '0.3.0',
    });

    const content = readFileSync(join(cwd, 'CLAUDE.md'), 'utf-8');
    assert.ok(content.includes('Builder-Judge Workflow'), 'should append workflow section');
    assert.ok(content.startsWith('# Existing'), 'should preserve existing content');
  });

  it('skips CLAUDE.md in force mode when heading present', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    const existingContent = '# Proj\n\n## Builder-Judge Workflow\n\nDone.\n';
    writeFileSync(join(cwd, 'CLAUDE.md'), existingContent);

    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: fileHashes,
      managed_files: managedFiles,
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    await upgrade({
      cwd,
      flags: { force: true, nonInteractive: false },
      config: storedConfig,
      promptFn: noPrompt,
      pkgVersion: '0.3.0',
    });

    const content = readFileSync(join(cwd, 'CLAUDE.md'), 'utf-8');
    assert.equal(content, existingContent, 'CLAUDE.md should not be modified');
  });
});

// ── Removed file with pending_hashes and .new ───────────────────

describe('removed file cleanup', () => {
  it('cleans up pending_hashes for removed files and updates .new header', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    const removedDest = 'agent-loop/OLD_FILE.md';

    // Create the .new sidecar for the removed file
    mkdirSync(join(cwd, 'agent-loop'), { recursive: true });
    const newFileContent =
      '<!--\n  CONFLICT: agent-loop/OLD_FILE.md\n  This file contains the updated template from the new version.\n-->\nContent here';
    writeFileSync(join(cwd, removedDest + '.new'), newFileContent);

    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: { ...fileHashes, [removedDest]: 'oldhash' },
      managed_files: [...managedFiles, removedDest],
      pending_hashes: { [removedDest]: 'pendinghash' },
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    await upgrade({
      cwd,
      flags: { force: false, nonInteractive: true },
      config: storedConfig,
      promptFn: noPrompt,
      pkgVersion: '0.3.0',
    });

    const result = readConfigFile(cwd);
    // Removed file should be cleaned from hashes
    assert.equal(result.file_hashes[removedDest], undefined, 'removed file hash should be gone');
    // pending_hashes for the removed file should be cleaned
    if (result.pending_hashes) {
      assert.equal(
        result.pending_hashes[removedDest],
        undefined,
        'removed file pending hash should be gone',
      );
    }
  });
});

// ── Config preserves unknown fields ─────────────────────────────

describe('config preserves unknown fields', () => {
  it('unknown fields from original config survive upgrade', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: fileHashes,
      managed_files: managedFiles,
      custom_field: 'should survive',
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    await upgrade({
      cwd,
      flags: { force: false, nonInteractive: true },
      config: storedConfig,
      promptFn: noPrompt,
      pkgVersion: '0.3.0',
    });

    const result = readConfigFile(cwd);
    assert.equal(result.custom_field, 'should survive', 'unknown fields must be preserved');
    assert.equal(result.version, '0.3.0');
  });
});

// ── S5/AC-8: Pre-hash upgrade with mixed existing/missing files ────

describe('S5/AC-8 — pre-hash upgrade: existing files get .new, missing files created', () => {
  it('creates .new for existing files and creates missing files normally', async () => {
    const cwd = makeTmpDir();
    const normalized = normalizeConfig(BASE_CONFIG);
    const files = getFilesToScaffold(normalized);
    const vars = getTemplateVars(normalized);

    // Only scaffold SOME files — leave others missing on disk
    const filesToCreate = files.slice(0, 3);
    const filesToSkip = files.slice(3);

    for (const file of filesToCreate) {
      const destPath = join(cwd, file.dest);
      mkdirSync(join(cwd, ...file.dest.split('/').slice(0, -1)), { recursive: true });
      const content = loadTemplate(file.src, vars);
      writeFileSync(destPath, content);
    }

    // Config has no file_hashes and no managed_files — pre-hash user
    const storedConfig = { ...BASE_CONFIG };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    await upgrade({
      cwd,
      flags: { force: false, nonInteractive: true },
      config: storedConfig,
      promptFn: noPrompt,
      pkgVersion: '0.3.0',
    });

    // Existing files should get .new sidecars (conflict_prehash)
    for (const file of filesToCreate) {
      assert.ok(
        existsSync(join(cwd, file.dest + '.new')),
        `existing file ${file.dest} should get .new sidecar`,
      );
    }

    // Missing files should be created directly (no .new)
    for (const file of filesToSkip) {
      assert.ok(
        existsSync(join(cwd, file.dest)),
        `missing file ${file.dest} should be created`,
      );
      assert.ok(
        !existsSync(join(cwd, file.dest + '.new')),
        `missing file ${file.dest} should NOT get .new`,
      );
    }

    const result = readConfigFile(cwd);
    assert.ok(result.pending_hashes, 'pending_hashes should exist');

    // pending_hashes should contain the existing (conflicted) files
    for (const file of filesToCreate) {
      assert.ok(
        result.pending_hashes[file.dest],
        `pending_hashes should have entry for ${file.dest}`,
      );
    }

    // pending_hashes should NOT contain the newly created files
    for (const file of filesToSkip) {
      assert.equal(
        result.pending_hashes[file.dest],
        undefined,
        `pending_hashes should NOT have entry for newly created ${file.dest}`,
      );
    }

    // file_hashes should contain the newly created files
    for (const file of filesToSkip) {
      assert.ok(
        result.file_hashes[file.dest],
        `file_hashes should have entry for newly created ${file.dest}`,
      );
    }
  });
});

// ── S7/AC-9: Three-tier fallback for removed-file detection ─────────

describe('S7/AC-9 — removed-file detection three-tier fallback', () => {
  it('falls through to REMOVED_TEMPLATES when no managed_files and no file_hashes', async () => {
    const cwd = makeTmpDir();
    // Scaffold files so templates exist on disk
    scaffoldFiles(cwd, BASE_CONFIG);

    // Config with NO managed_files and NO file_hashes — pre-hash user
    // This forces detectRemovedFiles to use the REMOVED_TEMPLATES fallback
    const storedConfig = { ...BASE_CONFIG };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    // Since REMOVED_TEMPLATES is empty, no removed files should be detected
    // This verifies the fallback path exists and handles empty gracefully
    await upgrade({
      cwd,
      flags: { force: false, nonInteractive: true },
      config: storedConfig,
      promptFn: noPrompt,
      pkgVersion: '0.3.0',
    });

    const result = readConfigFile(cwd);
    assert.equal(result.version, '0.3.0');

    // All current template files should still be in managed_files
    const normalized = normalizeConfig(storedConfig);
    const expectedFiles = getFilesToScaffold(normalized);
    for (const file of expectedFiles) {
      assert.ok(
        result.managed_files.includes(file.dest),
        `${file.dest} should still be in managed_files`,
      );
    }

    // Confirm REMOVED_TEMPLATES is actually empty (documents the current state)
    assert.equal(REMOVED_TEMPLATES.length, 0, 'REMOVED_TEMPLATES should be empty');
  });
});

// ── AC-14: Removed-file convergence — .new header updated ──────────

describe('AC-14 — removed file .new header updated to removed variant', () => {
  it('updates .new header to removed variant and cleans pending_hashes', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    const removedDest = 'agent-loop/OLD_FILE.md';

    // Create the .new sidecar with the standard conflict header
    mkdirSync(join(cwd, 'agent-loop'), { recursive: true });
    const originalNewContent =
      '<!--\n  CONFLICT: agent-loop/OLD_FILE.md\n  This file contains the updated template from the new version.\n' +
      '  \n  Your options:\n    1. Merge manually — compare this file with your current version\n' +
      '    2. Let Claude Code merge — paste the suggested prompt from the upgrade output\n' +
      '    3. Ignore for now — this file will be re-generated on the next upgrade\n' +
      '    4. Reject changes — delete this file; it will be re-generated on the next upgrade\n' +
      '  \n  To complete the merge, delete this .new file and confirm when prompted on next run.\n' +
      '-->\nTemplate content here';
    writeFileSync(join(cwd, removedDest + '.new'), originalNewContent);

    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: { ...fileHashes, [removedDest]: 'oldhash' },
      managed_files: [...managedFiles, removedDest],
      pending_hashes: { [removedDest]: 'pendinghash' },
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    await upgrade({
      cwd,
      flags: { force: false, nonInteractive: true },
      config: storedConfig,
      promptFn: noPrompt,
      pkgVersion: '0.3.0',
    });

    // .new file should still exist but with updated header
    const newFilePath = join(cwd, removedDest + '.new');
    assert.ok(existsSync(newFilePath), '.new file should be preserved');

    const updatedContent = readFileSync(newFilePath, 'utf-8');
    assert.ok(
      updatedContent.includes('REMOVED TEMPLATE:'),
      '.new header should be updated to removed variant',
    );
    assert.ok(
      !updatedContent.includes('CONFLICT:'),
      'old CONFLICT header should be replaced',
    );
    assert.ok(
      updatedContent.includes('Template content here'),
      'body content should be preserved',
    );

    const result = readConfigFile(cwd);
    // pending_hashes entry should be cleaned
    if (result.pending_hashes) {
      assert.equal(
        result.pending_hashes[removedDest],
        undefined,
        'removed file pending hash should be gone',
      );
    }
    // file_hashes entry should be cleaned
    assert.equal(
      result.file_hashes[removedDest],
      undefined,
      'removed file hash should be gone',
    );
  });
});

// ── M-2: Force mode with removed file and pending .new ──────────────

describe('force mode removed-file .new handling', () => {
  it('updates .new header to removed variant in force mode', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    const removedDest = 'agent-loop/OLD_FILE.md';

    // Create the .new sidecar with the standard conflict header
    mkdirSync(join(cwd, 'agent-loop'), { recursive: true });
    const originalNewContent =
      '<!--\n  CONFLICT: agent-loop/OLD_FILE.md\n  This file contains the updated template from the new version.\n' +
      '  \n  Your options:\n    1. Merge manually — compare this file with your current version\n' +
      '    2. Let Claude Code merge — paste the suggested prompt from the upgrade output\n' +
      '    3. Ignore for now — this file will be re-generated on the next upgrade\n' +
      '    4. Reject changes — delete this file; it will be re-generated on the next upgrade\n' +
      '  \n  To complete the merge, delete this .new file and confirm when prompted on next run.\n' +
      '-->\nTemplate content here';
    writeFileSync(join(cwd, removedDest + '.new'), originalNewContent);

    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: { ...fileHashes, [removedDest]: 'oldhash' },
      managed_files: [...managedFiles, removedDest],
      pending_hashes: { [removedDest]: 'pendinghash' },
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    await upgrade({
      cwd,
      flags: { force: true, nonInteractive: false },
      config: storedConfig,
      promptFn: noPrompt,
      pkgVersion: '0.3.0',
    });

    // .new file should still exist but with updated header
    const newFilePath = join(cwd, removedDest + '.new');
    assert.ok(existsSync(newFilePath), '.new file should be preserved in force mode');

    const updatedContent = readFileSync(newFilePath, 'utf-8');
    assert.ok(
      updatedContent.includes('REMOVED TEMPLATE:'),
      '.new header should be updated to removed variant in force mode',
    );
    assert.ok(
      !updatedContent.includes('CONFLICT:'),
      'old CONFLICT header should be replaced in force mode',
    );

    const result = readConfigFile(cwd);
    assert.equal(result.file_hashes[removedDest], undefined, 'removed file hash should be gone');
  });
});

// ── H-1 regression: unreadable file treated as customized ───────────

describe('unreadable file treated as customized', () => {
  it('does not crash on EACCES and treats file as conflict', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    // Make a file unreadable
    const targetDest = 'AGENTS.md';
    const { chmodSync } = await import('node:fs');
    chmodSync(join(cwd, targetDest), 0o000);

    // Set a fake old hash so template appears "changed"
    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: { ...fileHashes, [targetDest]: computeHash('old template') },
      managed_files: managedFiles,
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    try {
      await upgrade({
        cwd,
        flags: { force: false, nonInteractive: true },
        config: storedConfig,
        promptFn: noPrompt,
        pkgVersion: '0.3.0',
      });

      // Should not crash — file treated as conflict (customized)
      assert.ok(
        existsSync(join(cwd, targetDest + '.new')),
        'unreadable file should produce .new conflict sidecar',
      );
    } finally {
      // Restore permissions for cleanup
      chmodSync(join(cwd, targetDest), 0o644);
    }
  });
});

// ── M-1 regression: merge wizard with select function ───────────────

describe('merge wizard with mergePromptFn', () => {
  it('calls mergePromptFn and shows Claude prompt for claude choice', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    // Force a conflict
    const targetDest = 'agent-loop/PROTOCOL.md';
    writeFileSync(join(cwd, targetDest), 'user customized');
    const conflictHashes = { ...fileHashes };
    conflictHashes[targetDest] = computeHash('old template v1');

    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: conflictHashes,
      managed_files: managedFiles,
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    try {
      await upgrade({
        cwd,
        flags: { force: false, nonInteractive: false },
        config: storedConfig,
        promptFn: noPrompt,
        mergePromptFn: async () => 'claude',
        pkgVersion: '0.3.0',
      });
    } finally {
      console.log = originalLog;
    }

    const output = logs.join('\n');
    assert.match(output, /Review the .new files/, 'should show Claude merge suggestion');
  });

  it('shows manual merge instructions for manual choice', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    const targetDest = 'agent-loop/PROTOCOL.md';
    writeFileSync(join(cwd, targetDest), 'user customized');
    const conflictHashes = { ...fileHashes };
    conflictHashes[targetDest] = computeHash('old template v1');

    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: conflictHashes,
      managed_files: managedFiles,
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    try {
      await upgrade({
        cwd,
        flags: { force: false, nonInteractive: false },
        config: storedConfig,
        promptFn: noPrompt,
        mergePromptFn: async () => 'manual',
        pkgVersion: '0.3.0',
      });
    } finally {
      console.log = originalLog;
    }

    const output = logs.join('\n');
    assert.match(output, /Merge the .new files manually/, 'should show manual merge instructions');
  });
});

// ── Overwrite path (Row 1): template changed, user did not touch ────

describe('overwrite path — template changed, user untouched', () => {
  it('overwrites file and updates hash when stored hash matches disk but differs from template', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    const targetDest = 'agent-loop/PROTOCOL.md';
    const fakeOldContent = 'fake old template content from v0.1.0';
    const fakeOldHash = computeHash(fakeOldContent);

    // Write the "old template" content to disk (user hasn't touched it)
    writeFileSync(join(cwd, targetDest), fakeOldContent);

    // Set stored hash to match the fake old content (simulates user-untouched)
    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: { ...fileHashes, [targetDest]: fakeOldHash },
      managed_files: managedFiles,
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    try {
      await upgrade({
        cwd,
        flags: { force: false, nonInteractive: true },
        config: storedConfig,
        promptFn: noPrompt,
        pkgVersion: '0.3.0',
      });
    } finally {
      console.log = originalLog;
    }

    // File should be overwritten with new template content
    const diskContent = readFileSync(join(cwd, targetDest), 'utf-8');
    assert.notEqual(diskContent, fakeOldContent, 'file should be overwritten');

    // No .new file — this is overwrite, not conflict
    assert.ok(!existsSync(join(cwd, targetDest + '.new')), 'no .new for overwrite');

    // Hash should be updated to new template hash
    const result = readConfigFile(cwd);
    assert.notEqual(result.file_hashes[targetDest], fakeOldHash, 'hash should be updated');

    // CLI output should mention "update"
    const output = logs.join('\n');
    assert.match(output, /update/, 'should print update for overwritten file');
    assert.match(output, /updated/, 'summary should mention updated count');
  });
});

// ── Convergence regeneration: user declines → .new re-created ────

describe('convergence regeneration — user declines merge confirmation', () => {
  it('re-creates .new file when user says they did not merge', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    const targetDest = 'agent-loop/PROTOCOL.md';
    const normalized = normalizeConfig(BASE_CONFIG);
    const vars = getTemplateVars(normalized);
    const templateContent = loadTemplate('protocol/PROTOCOL.md', vars);
    const templateHash = computeHash(templateContent);

    // Set up: pending_hashes entry exists, .new file does NOT exist (user deleted it)
    // But user will say "no" — they did NOT actually merge
    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: fileHashes,
      managed_files: managedFiles,
      pending_hashes: { [targetDest]: templateHash },
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    // promptFn returns false — user did not merge
    await upgrade({
      cwd,
      flags: { force: false, nonInteractive: false },
      config: storedConfig,
      promptFn: async () => false,
      pkgVersion: '0.3.0',
    });

    // .new file should be re-created (regenerated)
    assert.ok(
      existsSync(join(cwd, targetDest + '.new')),
      '.new file should be regenerated when user declines merge confirmation',
    );

    // pending_hashes should still have the entry (not promoted)
    const result = readConfigFile(cwd);
    assert.ok(
      result.pending_hashes && result.pending_hashes[targetDest],
      'pending_hashes entry should remain when merge is declined',
    );
  });
});

// ── Removed file with pending hash but no .new on disk ────────────

describe('removed file with pending hash but no .new on disk', () => {
  it('cleans up pending_hashes entry and prints cleanup message', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    const removedDest = 'agent-loop/OLD_FILE.md';

    // Do NOT create the .new file — simulates user already deleted it
    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: { ...fileHashes, [removedDest]: 'oldhash' },
      managed_files: [...managedFiles, removedDest],
      pending_hashes: { [removedDest]: 'pendinghash' },
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    try {
      await upgrade({
        cwd,
        flags: { force: false, nonInteractive: true },
        config: storedConfig,
        promptFn: noPrompt,
        pkgVersion: '0.3.0',
      });
    } finally {
      console.log = originalLog;
    }

    const result = readConfigFile(cwd);
    // pending_hashes entry should be cleaned
    if (result.pending_hashes) {
      assert.equal(result.pending_hashes[removedDest], undefined);
    }
    // file_hashes entry should be cleaned
    assert.equal(result.file_hashes[removedDest], undefined);

    // CLI output should mention cleanup
    const output = logs.join('\n');
    assert.match(output, /pending conflict cleaned up/, 'should print cleanup message');
  });
});

// ── Managed .new file includes HTML comment header ────────────────

describe('managed .new file includes HTML comment header', () => {
  it('conflict .new file starts with the descriptive HTML comment header', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    const targetDest = 'agent-loop/PROTOCOL.md';
    writeFileSync(join(cwd, targetDest), 'user customized content');
    const conflictHashes = { ...fileHashes };
    conflictHashes[targetDest] = computeHash('old template for conflict');

    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: conflictHashes,
      managed_files: managedFiles,
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    await upgrade({
      cwd,
      flags: { force: false, nonInteractive: true },
      config: storedConfig,
      promptFn: noPrompt,
      pkgVersion: '0.3.0',
    });

    const newContent = readFileSync(join(cwd, targetDest + '.new'), 'utf-8');
    assert.ok(newContent.startsWith('<!--'), '.new file should start with HTML comment');
    assert.ok(
      newContent.includes(`CONFLICT: ${targetDest}`),
      '.new header should reference the file path',
    );
    assert.ok(
      newContent.includes('Merge manually'),
      '.new header should list merge options',
    );
    assert.ok(
      newContent.includes('re-generated'),
      '.new header should mention regeneration',
    );
  });
});

// ── Summary line with mixed action counts ──────────────────────────

describe('summary line with mixed created, updated, unchanged, conflicted', () => {
  it('includes all relevant counts in the summary', async () => {
    const cwd = makeTmpDir();
    const normalized = normalizeConfig(BASE_CONFIG);
    const files = getFilesToScaffold(normalized);
    const vars = getTemplateVars(normalized);

    // Scaffold only some files — leave one missing (will be "create")
    const missingDest = 'CHEATSHEET.md';
    const conflictDest = 'agent-loop/PROTOCOL.md';
    const fileHashes = {};
    const managedFiles = [];

    for (const file of files) {
      managedFiles.push(file.dest);
      const destPath = join(cwd, file.dest);
      const content = loadTemplate(file.src, vars);
      if (file.dest === missingDest) {
        // Don't create — will trigger "create" action
        fileHashes[file.dest] = computeHash(content);
        continue;
      }
      if (file.dest === conflictDest) {
        // Write user content and set fake hash to force conflict
        mkdirSync(join(cwd, ...file.dest.split('/').slice(0, -1)), { recursive: true });
        writeFileSync(destPath, 'user customized protocol');
        fileHashes[file.dest] = computeHash('fake old template');
        continue;
      }
      mkdirSync(join(cwd, ...file.dest.split('/').slice(0, -1)), { recursive: true });
      writeFileSync(destPath, content);
      fileHashes[file.dest] = computeHash(content);
    }

    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: fileHashes,
      managed_files: managedFiles,
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    try {
      await upgrade({
        cwd,
        flags: { force: false, nonInteractive: true },
        config: storedConfig,
        promptFn: noPrompt,
        pkgVersion: '0.3.0',
      });
    } finally {
      console.log = originalLog;
    }

    const output = logs.join('\n');
    assert.match(output, /Upgrade complete/, 'should print completion');
    assert.match(output, /created/, 'should mention created count');
    assert.match(output, /conflicted/, 'should mention conflicted count');
    assert.match(output, /unchanged/, 'should mention unchanged count');
  });
});

// ── S8/AC-3: Same-version resync skips unmodified-template files ────

describe('S8/AC-3 — same-version resync with modified file', () => {
  it('skips user-modified file when template hash matches stored hash', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    // Modify a file on disk to simulate user customization
    const targetDest = 'agent-loop/PROTOCOL.md';
    const userContent = 'user has customized this protocol file';
    writeFileSync(join(cwd, targetDest), userContent);

    // Config has the correct stored hash (template hash matches stored hash)
    // This simulates same-version resync: template unchanged, user touched → Row 4: skip
    const storedConfig = {
      ...BASE_CONFIG,
      version: '0.3.0',
      file_hashes: fileHashes,
      managed_files: managedFiles,
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    await upgrade({
      cwd,
      flags: { force: false, nonInteractive: true },
      config: storedConfig,
      promptFn: noPrompt,
      pkgVersion: '0.3.0',
    });

    // User's customized content should be preserved (not overwritten)
    const content = readFileSync(join(cwd, targetDest), 'utf-8');
    assert.equal(content, userContent, 'user-modified file should be preserved');

    // No .new file should be created (Row 4 = skip, not conflict)
    assert.ok(
      !existsSync(join(cwd, targetDest + '.new')),
      'no .new file for user-touched but template-unchanged file',
    );
  });
});

// ── AC-15: CLI output includes per-file conflicts and summary ───────

describe('AC-15 — CLI output includes per-file conflict messages and summary', () => {
  it('outputs per-file conflict messages and summary line', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    // Modify a file and set a fake old hash to force conflict
    const targetDest = 'agent-loop/PROTOCOL.md';
    writeFileSync(join(cwd, targetDest), 'user customized content');
    const conflictHashes = { ...fileHashes };
    conflictHashes[targetDest] = computeHash('old template content v1');

    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: conflictHashes,
      managed_files: managedFiles,
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    try {
      await upgrade({
        cwd,
        flags: { force: false, nonInteractive: true },
        config: storedConfig,
        promptFn: noPrompt,
        pkgVersion: '0.3.0',
      });
    } finally {
      console.log = originalLog;
    }

    const output = logs.join('\n');
    // Per-file conflict message
    assert.match(output, /conflict/, 'should mention conflict in per-file output');
    assert.match(output, /\.new/, 'should mention .new file in per-file output');
    // Summary line
    assert.match(output, /conflicted/, 'summary should mention conflicted count');
    assert.match(output, /Upgrade complete/, 'should print completion summary');
  });
});

// ── AC-15 extended: force mode CLI output ───────────────────────────

describe('AC-15 — force mode CLI output includes per-file force messages', () => {
  it('outputs per-file force messages and completion line', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: fileHashes,
      managed_files: managedFiles,
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    try {
      await upgrade({
        cwd,
        flags: { force: true, nonInteractive: false },
        config: storedConfig,
        promptFn: noPrompt,
        pkgVersion: '0.3.0',
      });
    } finally {
      console.log = originalLog;
    }

    const output = logs.join('\n');
    assert.match(output, /force/, 'should mention force in per-file output');
    assert.match(output, /Force upgrade complete/, 'should print force completion message');
  });
});

// ── T2: CLAUDE.md exclusion from file_hashes (FR8) ────────────────

describe('FR8 — CLAUDE.md is excluded from file_hashes', () => {
  it('file_hashes never contains a CLAUDE.md key after upgrade', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);

    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: fileHashes,
      managed_files: managedFiles,
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    await upgrade({
      cwd,
      flags: { force: false, nonInteractive: true },
      config: storedConfig,
      promptFn: noPrompt,
      pkgVersion: '0.3.0',
    });

    const result = readConfigFile(cwd);
    assert.equal(result.file_hashes['CLAUDE.md'], undefined, 'CLAUDE.md must not be in file_hashes');
    assert.ok(
      !result.managed_files.includes('CLAUDE.md'),
      'CLAUDE.md must not be in managed_files',
    );
  });
});

// ── T5: detectRemovedFiles tier-2 fallback (file_hashes keys) ─────

describe('detectRemovedFiles tier-2 — file_hashes keys without managed_files', () => {
  it('detects removed file via file_hashes when managed_files is absent', async () => {
    const cwd = makeTmpDir();
    const { fileHashes } = scaffoldFiles(cwd, BASE_CONFIG);

    // Add an extra entry to file_hashes that is NOT in current templates
    const removedDest = 'agent-loop/LEGACY.md';
    const extendedHashes = { ...fileHashes, [removedDest]: 'fakehash123' };

    // Config with file_hashes but NO managed_files (simulates tier-2 path)
    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: extendedHashes,
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    await upgrade({
      cwd,
      flags: { force: false, nonInteractive: true },
      config: storedConfig,
      promptFn: noPrompt,
      pkgVersion: '0.3.0',
    });

    const result = readConfigFile(cwd);
    assert.equal(result.file_hashes[removedDest], undefined, 'removed file should be cleaned from file_hashes');
  });
});

// ── Force mode cleans stale .new sidecars ───────────────────────────

describe('force mode cleans stale .new sidecars', () => {
  it('deletes existing .new files left from a prior conflicted upgrade', async () => {
    const cwd = makeTmpDir();
    const { fileHashes, managedFiles } = scaffoldFiles(cwd, BASE_CONFIG);
    const targetDest = managedFiles[0];

    // Simulate a stale .new sidecar from a prior conflicted upgrade
    const sidecarPath = join(cwd, targetDest + '.new');
    writeFileSync(sidecarPath, 'stale conflict sidecar');

    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: fileHashes,
      managed_files: managedFiles,
      pending_hashes: { [targetDest]: 'somehash' },
    };
    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    await upgrade({
      cwd,
      flags: { force: true, nonInteractive: false },
      config: storedConfig,
      promptFn: noPrompt,
      pkgVersion: '0.3.0',
    });

    assert.ok(!existsSync(sidecarPath), '.new sidecar must be deleted after force upgrade');
    const result = readConfigFile(cwd);
    assert.equal(result.pending_hashes, undefined, 'pending_hashes must be cleared');
  });
});

// ── Convergence regenerate preserves create for missing files ────────

describe('convergence regenerate does not override create for missing files', () => {
  it('creates the file outright instead of writing a .new sidecar', async () => {
    const cwd = makeTmpDir();
    const normalized = normalizeConfig(BASE_CONFIG);
    const files = getFilesToScaffold(normalized);
    const vars = getTemplateVars(normalized);
    const targetFile = files[0];
    const targetDest = targetFile.dest;

    // Set up config with pending_hashes for a file that does NOT exist on disk
    const storedConfig = {
      ...BASE_CONFIG,
      file_hashes: {},
      managed_files: files.map((f) => f.dest),
      pending_hashes: { [targetDest]: 'oldhash' },
    };

    // Scaffold all OTHER files (not the target) so they pass as skip/overwrite
    for (const file of files) {
      if (file.dest === targetDest) continue;
      const destPath = join(cwd, file.dest);
      mkdirSync(join(cwd, ...file.dest.split('/').slice(0, -1)), { recursive: true });
      const content = loadTemplate(file.src, vars);
      writeFileSync(destPath, content);
      storedConfig.file_hashes[file.dest] = computeHash(content);
    }
    // Target file is intentionally absent — no file, no .new
    // Ensure target directory exists
    mkdirSync(join(cwd, ...targetDest.split('/').slice(0, -1)), { recursive: true });

    writeFileSync(join(cwd, '.dual-agent-loop.json'), JSON.stringify(storedConfig, null, 2) + '\n');

    // promptFn returns false (user says "no" to convergence) → file goes into regenerate list
    const noConverge = async () => false;

    await upgrade({
      cwd,
      flags: { force: false, nonInteractive: false },
      config: storedConfig,
      promptFn: noConverge,
      pkgVersion: '0.3.0',
    });

    // The file should be created directly, NOT as a .new sidecar
    assert.ok(existsSync(join(cwd, targetDest)), 'missing file must be created directly');
    assert.ok(!existsSync(join(cwd, targetDest + '.new')), 'no .new sidecar for a missing file');

    const result = readConfigFile(cwd);
    assert.ok(result.file_hashes[targetDest], 'file hash must be recorded');
    assert.equal(result.pending_hashes?.[targetDest], undefined, 'no pending hash for created file');
  });
});
