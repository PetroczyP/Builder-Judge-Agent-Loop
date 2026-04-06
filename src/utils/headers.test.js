import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { managedFileHeader, removedFileHeader, updateHeaderToRemoved } from './headers.js';

describe('managedFileHeader', () => {
  it('returns an HTML comment block', () => {
    const header = managedFileHeader('agent-loop/PROTOCOL.md');
    assert.ok(header.startsWith('<!--'));
    assert.ok(header.includes('-->'));
  });

  it('contains the destination path', () => {
    const dest = 'agent-loop/PROTOCOL.md';
    const header = managedFileHeader(dest);
    assert.ok(header.includes(dest));
  });

  it('mentions all 4 options: merge manually, let Claude merge, ignore, reject', () => {
    const header = managedFileHeader('agent-loop/PROTOCOL.md');
    assert.ok(header.includes('Merge manually'), 'missing "Merge manually"');
    assert.ok(header.includes('Let Claude Code merge'), 'missing "Let Claude Code merge"');
    assert.ok(header.includes('Ignore for now'), 'missing "Ignore for now"');
    assert.ok(header.includes('Reject changes'), 'missing "Reject changes"');
  });

  it('mentions the file will be re-generated if deleted without merging', () => {
    const header = managedFileHeader('agent-loop/PROTOCOL.md');
    assert.ok(header.includes('re-generated'));
  });
});

describe('removedFileHeader', () => {
  it('returns an HTML comment block', () => {
    const header = removedFileHeader('.claude/commands/build.md');
    assert.ok(header.startsWith('<!--'));
    assert.ok(header.includes('-->'));
  });

  it('contains the destination path', () => {
    const dest = '.claude/commands/build.md';
    const header = removedFileHeader(dest);
    assert.ok(header.includes(dest));
  });

  it('mentions template was removed from current version', () => {
    const header = removedFileHeader('.claude/commands/build.md');
    assert.ok(header.includes('removed from the current version'));
  });

  it('mentions 2 options: merge into your copy, discard', () => {
    const header = removedFileHeader('.claude/commands/build.md');
    assert.ok(header.includes('Merge the relevant changes'), 'missing merge option');
    assert.ok(header.includes('Discard'), 'missing discard option');
  });

  it('warns this is the only copy and will NOT be re-generated', () => {
    const header = removedFileHeader('.claude/commands/build.md');
    assert.ok(header.includes('ONLY COPY'), 'missing ONLY COPY warning');
    assert.ok(header.includes('NOT be re-generated'), 'missing NOT be re-generated warning');
  });
});

describe('updateHeaderToRemoved', () => {
  it('replaces an existing managed header with the removed variant', () => {
    const dest = 'agent-loop/PROTOCOL.md';
    const body = '# Protocol\n\nSome content here.\n';
    const content = managedFileHeader(dest) + body;

    const updated = updateHeaderToRemoved(content, dest);

    assert.ok(updated.startsWith(removedFileHeader(dest)), 'should start with removed header');
    assert.ok(updated.endsWith(body), 'should preserve body content');
    assert.ok(!updated.includes('CONFLICT:'), 'should not contain managed header marker');
  });

  it('returns content unchanged when no managed header is present', () => {
    const content = '# Just a normal file\n\nNo header here.\n';
    const result = updateHeaderToRemoved(content, 'some/path.md');
    assert.equal(result, content);
  });

  it('preserves content after the header', () => {
    const dest = 'agent-loop/ANTIPATTERNS.md';
    const body = '# Anti-patterns\n\n- Do not skip tests\n- Do not hardcode\n';
    const content = managedFileHeader(dest) + body;

    const updated = updateHeaderToRemoved(content, dest);

    assert.ok(updated.includes(body), 'body content must be preserved');
  });
});
