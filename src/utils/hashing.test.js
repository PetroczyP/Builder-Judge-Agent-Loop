import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { computeHash, compareFile, convergencePass } from './hashing.js';

describe('computeHash', () => {
  it('returns the known SHA-256 hex digest of "hello"', () => {
    assert.equal(
      computeHash('hello'),
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });

  it('returns the known SHA-256 hex digest of an empty string', () => {
    assert.equal(
      computeHash(''),
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('produces a consistent hash for unicode content', () => {
    const hash1 = computeHash('\u{1F600}');
    const hash2 = computeHash('\u{1F600}');
    assert.equal(hash1, hash2);
    assert.equal(typeof hash1, 'string');
    assert.equal(hash1.length, 64);
  });

  it('is deterministic across multiple calls', () => {
    const input = 'determinism test';
    const results = Array.from({ length: 5 }, () => computeHash(input));
    for (const r of results) {
      assert.equal(r, results[0]);
    }
  });

  it('produces different hashes for different inputs', () => {
    const a = computeHash('alpha');
    const b = computeHash('beta');
    assert.notEqual(a, b);
  });
});

describe('compareFile', () => {
  const originalContent = 'original template content';
  const originalHash = computeHash(originalContent);
  const newContent = 'updated template content';
  const newHash = computeHash(newContent);

  it('Row 1: user did not touch, template changed → overwrite', () => {
    const result = compareFile({
      storedHash: originalHash,
      diskContent: originalContent,
      newTemplateContent: newContent,
    });
    assert.equal(result.action, 'overwrite');
    assert.equal(result.newHash, newHash);
  });

  it('Row 2: user did not touch, template unchanged → skip', () => {
    const result = compareFile({
      storedHash: originalHash,
      diskContent: originalContent,
      newTemplateContent: originalContent,
    });
    assert.equal(result.action, 'skip');
    assert.equal(result.newHash, originalHash);
  });

  it('Row 3: user customized, template changed → conflict', () => {
    const result = compareFile({
      storedHash: originalHash,
      diskContent: 'user edited this file',
      newTemplateContent: newContent,
    });
    assert.equal(result.action, 'conflict');
    assert.equal(result.newHash, newHash);
  });

  it('Row 4: user customized, template unchanged → skip', () => {
    const result = compareFile({
      storedHash: originalHash,
      diskContent: 'user edited this file',
      newTemplateContent: originalContent,
    });
    assert.equal(result.action, 'skip');
    assert.equal(result.newHash, originalHash);
  });

  it('Row 5: file missing on disk → create', () => {
    const result = compareFile({
      storedHash: originalHash,
      diskContent: null,
      newTemplateContent: newContent,
    });
    assert.equal(result.action, 'create');
    assert.equal(result.newHash, newHash);
  });

  it('Row 6: no stored hash, file exists on disk → conflict_prehash', () => {
    const result = compareFile({
      storedHash: null,
      diskContent: 'some existing content',
      newTemplateContent: newContent,
    });
    assert.equal(result.action, 'conflict_prehash');
    assert.equal(result.newHash, newHash);
  });

  it('Row 5: file missing on disk with undefined diskContent → create', () => {
    const result = compareFile({
      storedHash: originalHash,
      diskContent: undefined,
      newTemplateContent: newContent,
    });
    assert.equal(result.action, 'create');
    assert.equal(result.newHash, newHash);
  });

  it('Precedence: file missing on disk AND no stored hash → create (row 5 wins)', () => {
    const result = compareFile({
      storedHash: null,
      diskContent: null,
      newTemplateContent: newContent,
    });
    assert.equal(result.action, 'create');
    assert.equal(result.newHash, newHash);
  });

  it('newHash always contains the hash of newTemplateContent', () => {
    const content = 'arbitrary content for hash check';
    const expectedHash = computeHash(content);
    const scenarios = [
      { storedHash: originalHash, diskContent: originalContent, newTemplateContent: content },
      { storedHash: null, diskContent: null, newTemplateContent: content },
      { storedHash: null, diskContent: 'existing', newTemplateContent: content },
    ];
    for (const scenario of scenarios) {
      const result = compareFile(scenario);
      assert.equal(result.newHash, expectedHash);
    }
  });
});

describe('convergencePass', () => {
  it('.new still exists → skip (not in promoted, not in regenerate)', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'dal-test-'));
    const dest = 'agent-loop/PROTOCOL.md';
    // Create parent directories for the .new file
    const { mkdirSync } = await import('node:fs');
    const destDir = join(cwd, 'agent-loop');
    mkdirSync(destDir, { recursive: true });
    writeFileSync(join(cwd, dest + '.new'), 'conflict content');

    const promptCalls = [];
    const result = await convergencePass({
      pendingHashes: { [dest]: 'abc123' },
      currentManaged: new Set([dest]),
      cwd,
      promptFn: async (d) => { promptCalls.push(d); return true; },
    });

    assert.equal(result.promoted.size, 0);
    assert.equal(result.regenerate.length, 0);
    assert.equal(promptCalls.length, 0, 'promptFn should not be called when .new exists');
  });

  it('.new gone, promptFn returns true → promoted', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'dal-test-'));
    const dest = 'agent-loop/PROTOCOL.md';
    const hash = 'def456';

    const result = await convergencePass({
      pendingHashes: { [dest]: hash },
      currentManaged: new Set([dest]),
      cwd,
      promptFn: async () => true,
    });

    assert.equal(result.promoted.size, 1);
    assert.equal(result.promoted.get(dest), hash);
    assert.equal(result.regenerate.length, 0);
  });

  it('.new gone, promptFn returns false → regenerate', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'dal-test-'));
    const dest = 'agent-loop/PROTOCOL.md';

    const result = await convergencePass({
      pendingHashes: { [dest]: 'ghi789' },
      currentManaged: new Set([dest]),
      cwd,
      promptFn: async () => false,
    });

    assert.equal(result.promoted.size, 0);
    assert.deepEqual(result.regenerate, [dest]);
  });

  it('entry not in currentManaged → skip (promptFn not called)', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'dal-test-'));
    const dest = 'agent-loop/REMOVED.md';

    const promptCalls = [];
    const result = await convergencePass({
      pendingHashes: { [dest]: 'jkl012' },
      currentManaged: new Set(['agent-loop/OTHER.md']),
      cwd,
      promptFn: async (d) => { promptCalls.push(d); return true; },
    });

    assert.equal(result.promoted.size, 0);
    assert.equal(result.regenerate.length, 0);
    assert.equal(promptCalls.length, 0, 'promptFn should not be called for unmanaged files');
  });

  it('prompt message includes dest and merge confirmation text', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'dal-test-'));
    const dest = 'agent-loop/PROTOCOL.md';

    const promptMessages = [];
    await convergencePass({
      pendingHashes: { [dest]: 'abc123' },
      currentManaged: new Set([dest]),
      cwd,
      promptFn: async (msg) => { promptMessages.push(msg); return true; },
    });

    assert.equal(promptMessages.length, 1);
    assert.ok(
      promptMessages[0].includes(dest),
      'prompt should include the file path',
    );
    assert.ok(
      promptMessages[0].includes('pending conflict'),
      'prompt should mention pending conflict',
    );
    assert.ok(
      promptMessages[0].includes('merge'),
      'prompt should ask about merge',
    );
  });

  it('multiple entries: partial promotion (one yes, one no)', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'dal-test-'));
    const destA = 'agent-loop/PROTOCOL.md';
    const destB = 'agent-loop/ANTIPATTERNS.md';
    const hashA = 'hash-aaa';
    const hashB = 'hash-bbb';

    const responses = { [destA]: true, [destB]: false };
    const result = await convergencePass({
      pendingHashes: { [destA]: hashA, [destB]: hashB },
      currentManaged: new Set([destA, destB]),
      cwd,
      promptFn: async (msg) => {
        const dest = msg.includes(destA) ? destA : destB;
        return responses[dest];
      },
    });

    assert.equal(result.promoted.size, 1, 'only one should be promoted');
    assert.equal(result.promoted.get(destA), hashA, 'destA should be promoted');
    assert.deepEqual(result.regenerate, [destB], 'destB should be regenerated');
  });

  it('empty pendingHashes → empty promoted and empty regenerate', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'dal-test-'));

    const result = await convergencePass({
      pendingHashes: {},
      currentManaged: new Set(['agent-loop/PROTOCOL.md']),
      cwd,
      promptFn: async () => true,
    });

    assert.equal(result.promoted.size, 0);
    assert.equal(result.regenerate.length, 0);
  });
});

