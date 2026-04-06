/**
 * Compare two dot-separated numeric version strings (e.g. "1.2.3", "0.3").
 * Accepts any number of segments; missing segments are treated as 0.
 * Non-digit segments (pre-release suffixes, empty segments, scientific notation) cause an error.
 * @param {string} a
 * @param {string} b
 * @returns {-1 | 0 | 1}
 */
export function compareVersions(a, b) {
  function parse(v) {
    if (typeof v !== 'string') {
      throw new Error(`Version must be a string, got ${typeof v}: ${JSON.stringify(v)}`);
    }
    const segments = v.split('.');
    for (const seg of segments) {
      if (!/^\d+$/.test(seg)) {
        throw new Error(`Invalid version string: "${v}"`);
      }
    }
    return segments.map(Number);
  }
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
