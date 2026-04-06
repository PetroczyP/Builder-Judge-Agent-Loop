import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions } from './version.js';

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    assert.equal(compareVersions('1.2.3', '1.2.3'), 0);
  });

  it('returns 1 when major is greater', () => {
    assert.equal(compareVersions('2.0.0', '1.0.0'), 1);
  });

  it('returns -1 when major is lesser', () => {
    assert.equal(compareVersions('1.0.0', '2.0.0'), -1);
  });

  it('returns 1 when minor is greater', () => {
    assert.equal(compareVersions('1.3.0', '1.2.0'), 1);
  });

  it('returns -1 when minor is lesser', () => {
    assert.equal(compareVersions('1.2.0', '1.3.0'), -1);
  });

  it('returns 1 when patch is greater', () => {
    assert.equal(compareVersions('1.2.4', '1.2.3'), 1);
  });

  it('returns -1 when patch is lesser', () => {
    assert.equal(compareVersions('1.2.3', '1.2.4'), -1);
  });

  it('handles multi-digit segments', () => {
    assert.equal(compareVersions('1.10.0', '1.9.0'), 1);
  });

  it('treats missing segments as 0', () => {
    assert.equal(compareVersions('1.2.0', '1.2'), 0);
    assert.equal(compareVersions('1.2.1', '1.2'), 1);
    assert.equal(compareVersions('1.2', '1.2.1'), -1);
  });

  it('throws on non-numeric version segments', () => {
    assert.throws(() => compareVersions('1.0.0-beta', '1.0.0'), /Invalid version string/);
    assert.throws(() => compareVersions('1.0.0', 'latest'), /Invalid version string/);
    assert.throws(() => compareVersions('abc', '1.0.0'), /Invalid version string/);
  });
});
