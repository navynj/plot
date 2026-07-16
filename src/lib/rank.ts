/** Fractional lexicographic ranks over the alphabet a–z. Pure string math —
 *  no domain knowledge. Callers keep siblings ordered by comparing ranks as
 *  plain strings. */

const MIN = 97; // 'a'
const MAX = 122; // 'z'

/**
 * A rank strictly between `a` and `b` (null = unbounded side). Returns null
 * when no such rank exists (exhausted precision or unordered input) — the
 * caller is expected to rebalance the sibling set with `spreadRanks`.
 */
export function rankBetween(a: string | null, b: string | null): string | null {
  if (a !== null && b !== null && a >= b) return null;
  let prefix = '';
  for (let i = 0; i < 64; i++) {
    const ca = a !== null && i < a.length ? a.charCodeAt(i) : MIN - 1;
    const cb = b !== null && i < b.length ? b.charCodeAt(i) : MAX + 1;
    if (cb - ca >= 2) {
      const candidate = prefix + String.fromCharCode(Math.floor((ca + cb) / 2));
      if ((a === null || candidate > a) && (b === null || candidate < b)) return candidate;
      return null;
    }
    prefix += String.fromCharCode(ca === MIN - 1 ? MIN : ca);
  }
  return null;
}

/** `count` evenly spaced ranks, strictly ordered, with room between and
 *  around each — used to (re)balance a whole sibling set. */
export function spreadRanks(count: number): string[] {
  let width = 1;
  while (26 ** width < count + 2) width++;
  const total = 26 ** width;
  const ranks: string[] = [];
  for (let i = 1; i <= count; i++) {
    let v = Math.floor((i * total) / (count + 1));
    let rank = '';
    for (let w = 0; w < width; w++) {
      rank = String.fromCharCode(MIN + (v % 26)) + rank;
      v = Math.floor(v / 26);
    }
    ranks.push(rank);
  }
  return ranks;
}
