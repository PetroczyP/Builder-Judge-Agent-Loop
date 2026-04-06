import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Compute SHA-256 hex hash of a string.
 * @param {string} content
 * @returns {string} hex-encoded SHA-256 hash
 */
export function computeHash(content) {
  if (typeof content !== 'string') {
    throw new TypeError(`computeHash expected string, got ${typeof content}`);
  }
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Three-way comparison engine for upgrade decisions.
 *
 * Compares the stored baseline hash, the current file on disk, and the
 * incoming template content to decide what upgrade action to take.
 *
 * @param {object} opts
 * @param {string|null|undefined} opts.storedHash  - hash from file_hashes (null if not tracked)
 * @param {string|null|undefined} opts.diskContent - current file content on disk (null if missing)
 * @param {string} opts.newTemplateContent         - rendered template for the new version
 * @returns {{ action: 'overwrite'|'skip'|'conflict'|'create'|'conflict_prehash', newHash: string }}
 */
export function compareFile({ storedHash, diskContent, newTemplateContent }) {
  const newHash = computeHash(newTemplateContent);

  // Row 5: File missing on disk — always create (takes precedence)
  if (diskContent === null || diskContent === undefined) {
    return { action: 'create', newHash };
  }

  // Row 6: No stored hash (null/undefined/empty), file exists on disk — pre-hash conflict
  if (!storedHash) {
    return { action: 'conflict_prehash', newHash };
  }

  const diskHash = computeHash(diskContent);
  const userTouched = diskHash !== storedHash;
  const templateChanged = newHash !== storedHash;

  if (!userTouched && templateChanged) return { action: 'overwrite', newHash }; // Row 1: safe to overwrite
  if (!userTouched && !templateChanged) return { action: 'skip', newHash }; // Row 2: nothing to do
  if (userTouched && templateChanged) return { action: 'conflict', newHash }; // Row 3: conflict
  return { action: 'skip', newHash }; // Row 4: keep user's version
}

/**
 * Convergence pass — run at the start of each upgrade/resync.
 *
 * Checks pending_hashes entries to see if conflicts have been resolved
 * (i.e. the `.new` side-car file has been removed by the user).
 * Entries where the `.new` file still exists are skipped — the subsequent
 * three-way comparison handles them by overwriting the `.new` with the latest template.
 *
 * @param {Object} params
 * @param {Object} params.pendingHashes - map of dest → hash from pending_hashes
 * @param {Set<string>} params.currentManaged - set of dest paths still in current managed template set
 * @param {string} params.cwd - working directory
 * @param {(message: string) => Promise<boolean>} params.promptFn - called with a confirmation message; returns true if user confirmed the merge
 * @returns {Promise<{ promoted: Map<string, string>, regenerate: string[] }>}
 */
export async function convergencePass({ pendingHashes, currentManaged, cwd, promptFn }) {
  const promoted = new Map();
  const regenerate = [];

  for (const [dest, hash] of Object.entries(pendingHashes)) {
    if (!currentManaged.has(dest)) continue;

    const newFilePath = join(cwd, dest + '.new');
    if (existsSync(newFilePath)) continue;

    const confirmed = await promptFn(
      `${dest} had a pending conflict (${dest}.new has been removed).\nDid you merge the template changes?`,
    );
    if (confirmed) {
      promoted.set(dest, hash);
    } else {
      regenerate.push(dest);
    }
  }

  return { promoted, regenerate };
}
