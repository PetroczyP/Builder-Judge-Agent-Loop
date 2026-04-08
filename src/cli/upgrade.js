import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  unlinkSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { computeHash, compareFile, convergencePass } from '../utils/hashing.js';
import { normalizeConfig, writeConfig } from '../utils/config.js';
import { getFilesToScaffold, getTemplateVars, REMOVED_TEMPLATES } from '../utils/agents.js';
import { managedFileHeader, updateHeaderToRemoved } from '../utils/headers.js';
import { loadTemplate } from './scaffold.js';

// Step 1: Force upgrade (early return)
export async function upgrade({ cwd, flags, config, promptFn, mergePromptFn, pkgVersion }) {
  const normalized = normalizeConfig(config);
  const files = getFilesToScaffold(normalized);
  const vars = getTemplateVars(normalized);
  const managedFiles = files.map((f) => f.dest);
  const currentManagedSet = new Set(managedFiles);

  const fileHashes = { ...(config.file_hashes || {}) };
  let pendingHashes = { ...(config.pending_hashes || {}) };

  if (flags.force) {
    for (const file of files) {
      const destPath = join(cwd, file.dest);
      try {
        mkdirSync(dirname(destPath), { recursive: true });
        const content = loadTemplate(file.src, vars);
        writeFileSync(destPath, content);
        fileHashes[file.dest] = computeHash(content);
        console.log(`  force    ${file.dest}`);
      } catch (err) {
        throw new Error(`Failed to write ${file.dest}: ${err.message}`, { cause: err });
      }
    }
    pendingHashes = {};

    // Clean up stale .new sidecars from prior conflicted upgrades
    for (const file of files) {
      const sidecar = join(cwd, file.dest + '.new');
      if (existsSync(sidecar)) {
        try {
          unlinkSync(sidecar);
          console.log(`  clean    ${file.dest}.new (stale sidecar removed)`);
        } catch (err) {
          console.warn(`  warn     ${file.dest}.new (could not remove: ${err.message})`);
        }
      }
    }

    handleClaudeMd(cwd, vars);

    const removed = detectRemovedFiles(config, currentManagedSet, cwd, normalized.agentMode);
    handleRemovedFiles(removed, config, pendingHashes, fileHashes, cwd);

    writeConfig(
      cwd,
      {
        version: pkgVersion,
        file_hashes: fileHashes,
        pending_hashes: Object.keys(pendingHashes).length > 0 ? pendingHashes : undefined,
        managed_files: managedFiles,
      },
      config,
    );

    console.log(`\n  Force upgrade complete.\n`);
    return;
  }

  // Step 2: Convergence pass
  const { promoted, regenerate } = await convergencePass({
    pendingHashes: config.pending_hashes || {},
    currentManaged: currentManagedSet,
    cwd,
    promptFn,
  });

  // Apply convergence results
  for (const [dest, hash] of promoted) {
    fileHashes[dest] = hash;
    delete pendingHashes[dest];
  }

  // Step 3-4: Render templates and three-way compare
  const conflicts = [];
  let created = 0;
  let overwritten = 0;
  let skipped = 0;

  for (const file of files) {
    const content = loadTemplate(file.src, vars);
    const destPath = join(cwd, file.dest);

    // Check if this file needs regeneration from convergence
    const forceRegenerate = regenerate.includes(file.dest);

    let diskContent = null;
    if (existsSync(destPath)) {
      try {
        diskContent = readFileSync(destPath, 'utf-8');
      } catch (err) {
        // Sentinel that will never match any template hash,
        // causing compareFile to treat this as user-modified (conflict).
        diskContent = '\0UNREADABLE';
        console.warn(`  warn     ${file.dest} (unreadable: ${err.message})`);
      }
    }

    const result = compareFile({
      storedHash: fileHashes[file.dest] || null,
      diskContent,
      newTemplateContent: content,
    });

    // Override action if convergence says regenerate — but not for missing files,
    // which should be created outright rather than written as a .new sidecar.
    const action = forceRegenerate && result.action !== 'create' ? 'conflict' : result.action;

    try {
      switch (action) {
        case 'create':
          mkdirSync(dirname(destPath), { recursive: true });
          writeFileSync(destPath, content);
          fileHashes[file.dest] = result.newHash;
          delete pendingHashes[file.dest];
          console.log(`  create   ${file.dest}`);
          created++;
          break;

        case 'overwrite':
          writeFileSync(destPath, content);
          fileHashes[file.dest] = result.newHash;
          delete pendingHashes[file.dest];
          console.log(`  update   ${file.dest}`);
          overwritten++;
          break;

        case 'skip':
          skipped++;
          break;

        case 'conflict':
        case 'conflict_prehash': {
          const newFilePath = destPath + '.new';
          const headerContent = managedFileHeader(file.dest) + content;
          writeFileSync(newFilePath, headerContent);
          pendingHashes[file.dest] = result.newHash;
          console.log(`  conflict ${file.dest} → ${file.dest}.new`);
          conflicts.push(file.dest);
          break;
        }
      }
    } catch (err) {
      throw new Error(`Failed to write ${file.dest}: ${err.message}`, { cause: err });
    }
  }

  // Step 5: CLAUDE.md handling
  handleClaudeMd(cwd, vars);

  // Step 6: Removed-file detection
  const removed = detectRemovedFiles(config, currentManagedSet, cwd, normalized.agentMode);
  handleRemovedFiles(removed, config, pendingHashes, fileHashes, cwd);

  // Step 7: Merge wizard
  if (conflicts.length > 0) {
    console.log(`\n  ${conflicts.length} file(s) have conflicts:\n`);
    for (const dest of conflicts) {
      console.log(`    ${dest}.new`);
    }
    console.log('');

    if (!flags.nonInteractive && mergePromptFn) {
      const choice = await mergePromptFn();
      if (choice === 'claude') {
        console.log('\n  Suggested prompt for Claude Code:');
        console.log(
          `  "Review the .new files and merge the template changes into the originals."\n`,
        );
      } else {
        console.log('\n  Merge the .new files manually, then delete them.');
        console.log('  On the next run, you will be prompted to confirm each merge.\n');
      }
    } else {
      console.log('  (non-interactive mode — merge .new files manually)\n');
    }
  }

  // Step 8: Save config
  writeConfig(
    cwd,
    {
      version: pkgVersion,
      file_hashes: fileHashes,
      pending_hashes: Object.keys(pendingHashes).length > 0 ? pendingHashes : undefined,
      managed_files: managedFiles,
    },
    config,
  );

  const summary = [];
  if (created > 0) summary.push(`${created} created`);
  if (overwritten > 0) summary.push(`${overwritten} updated`);
  if (skipped > 0) summary.push(`${skipped} unchanged`);
  if (conflicts.length > 0) summary.push(`${conflicts.length} conflicted`);
  if (removed.length > 0) summary.push(`${removed.length} removed`);
  console.log(`\n  Upgrade complete. ${summary.join(', ')}.\n`);
}

function handleClaudeMd(cwd, vars) {
  const claudeMdPath = join(cwd, 'CLAUDE.md');
  const claudeSection = loadTemplate('agents/CLAUDE.md.section', vars);
  try {
    if (existsSync(claudeMdPath)) {
      const existing = readFileSync(claudeMdPath, 'utf-8');
      if (!/^#{1,6}\s+Builder-Judge Workflow\b/m.test(existing)) {
        appendFileSync(claudeMdPath, '\n' + claudeSection);
        console.log('  append   CLAUDE.md (added Builder-Judge Workflow section)');
      }
    } else {
      writeFileSync(claudeMdPath, claudeSection);
      console.log('  create   CLAUDE.md');
    }
  } catch (err) {
    throw new Error(`Failed to update CLAUDE.md: ${err.message}`, { cause: err });
  }
}

function detectRemovedFiles(config, currentManagedSet, cwd, agentMode) {
  const filter = (list) => list.filter((dest) => !currentManagedSet.has(dest));

  if (Array.isArray(config.managed_files) && config.managed_files.length > 0) {
    return filter(config.managed_files);
  }
  if (
    config.file_hashes &&
    typeof config.file_hashes === 'object' &&
    !Array.isArray(config.file_hashes) &&
    Object.keys(config.file_hashes).length > 0
  ) {
    return filter(Object.keys(config.file_hashes));
  }
  // Pre-hash user with neither — fall back to REMOVED_TEMPLATES filtered by mode
  return filter(
    REMOVED_TEMPLATES.filter(
      (r) => r.modes.includes(agentMode) && existsSync(join(cwd, r.dest)),
    ).map((r) => r.dest),
  );
}

/**
 * Process removed files. Mutates pendingHashes and fileHashes (working copies
 * that will be written to the new config). originalConfig is the saved config
 * from disk (read-only reference for checking prior pending state).
 */
function handleRemovedFiles(removed, originalConfig, pendingHashes, fileHashes, cwd) {
  const originalPending = originalConfig.pending_hashes || {};
  for (const dest of removed) {
    const newFilePath = join(cwd, dest + '.new');
    try {
      if (originalPending[dest]) {
        if (existsSync(newFilePath)) {
          const existingContent = readFileSync(newFilePath, 'utf-8');
          writeFileSync(newFilePath, updateHeaderToRemoved(existingContent, dest));
          console.log(`  removed  ${dest} (template removed — .new preserved as your only copy)`);
        } else {
          console.log(`  removed  ${dest} (template removed — pending conflict cleaned up)`);
        }
      } else {
        console.log(`  removed  ${dest} (template no longer managed)`);
      }
      delete pendingHashes[dest];
      delete fileHashes[dest];
    } catch (err) {
      console.warn(`  warn     ${dest} (removed-file handling failed: ${err.message})`);
    }
  }
}
