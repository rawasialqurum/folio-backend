/**
 * Parses a human page-range string like "1-3,5,7-9" into a sorted, deduped
 * list of 0-based page indices. Ignores out-of-range or malformed pieces.
 */
function parsePageRanges(rangesStr, totalPages) {
  const indices = new Set();
  const parts = (rangesStr || '').split(',').map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    const match = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) continue;
    const start = parseInt(match[1], 10) - 1;
    const end = match[2] ? parseInt(match[2], 10) - 1 : start;
    for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
      if (i >= 0 && i < totalPages) indices.add(i);
    }
  }

  return Array.from(indices).sort((a, b) => a - b);
}

module.exports = { parsePageRanges };
