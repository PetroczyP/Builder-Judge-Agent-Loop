/**
 * Compare two version strings (x.y.z format).
 * Non-numeric segments (e.g. pre-release suffixes) cause an error.
 * @param {string} a
 * @param {string} b
 * @returns {-1 | 0 | 1}
 */
export function compareVersions(a, b) {
  const parse = (v) => {
    const parts = v.split('.').map(Number);
    for (const seg of parts) {
      if (!Number.isFinite(seg)) {
        throw new Error(`Invalid version string: "${v}"`);
      }
    }
    return parts;
  };
  const partsA = parse(a);
  const partsB = parse(b);
  const len = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < len; i++) {
    const segA = partsA[i] || 0;
    const segB = partsB[i] || 0;
    if (segA > segB) return 1;
    if (segA < segB) return -1;
  }

  return 0;
}
