/**
 * Generate an HTML comment header for a managed .new conflict file.
 * @param {string} dest - destination path (e.g., 'agent-loop/PROTOCOL.md')
 * @returns {string}
 */
export function managedFileHeader(dest) {
  return [
    '<!--',
    `  CONFLICT: ${dest}`,
    '  This file contains the updated template from the new version.',
    '  ',
    '  Your options:',
    '    1. Merge manually — compare this file with your current version',
    '    2. Let Claude Code merge — paste the suggested prompt from the upgrade output',
    '    3. Ignore for now — this file will be re-generated on the next upgrade',
    '    4. Reject changes — delete this file; on the next upgrade you will be asked to confirm',
    '  ',
    `  To complete the merge, delete this .new file and confirm when prompted on next run.`,
    '-->',
    '',
  ].join('\n');
}

/**
 * Generate an HTML comment header for a removed-file .new artifact.
 * @param {string} dest - destination path
 * @returns {string}
 */
export function removedFileHeader(dest) {
  return [
    '<!--',
    `  REMOVED TEMPLATE: ${dest}`,
    '  This template has been removed from the current version.',
    '  This .new file is your ONLY COPY of the offered template changes.',
    '  It will NOT be re-generated on future upgrades.',
    '  ',
    '  Your options:',
    '    1. Merge the relevant changes into your copy of the original file',
    '    2. Discard — delete this file if you do not need the changes',
    '-->',
    '',
  ].join('\n');
}

// Must match the exact format produced by managedFileHeader().
// If that format changes, update this pattern accordingly.
const MANAGED_HEADER_PATTERN = /^<!--\r?\n\s+CONFLICT:.*?-->\r?\n/s;

/**
 * Replace a managed-file header with the removed-file variant.
 * If no managed header is found, returns content unchanged.
 * @param {string} content - file content with potential managed header
 * @param {string} dest - destination path
 * @returns {string}
 */
export function updateHeaderToRemoved(content, dest) {
  if (MANAGED_HEADER_PATTERN.test(content)) {
    return content.replace(MANAGED_HEADER_PATTERN, removedFileHeader(dest));
  }
  return content;
}
