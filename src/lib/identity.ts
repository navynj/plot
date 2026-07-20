/** What a node CALLS itself on every surface. Since captures split their
 *  first line into title, `title` is the primary path; the body-first-line
 *  fallback covers legacy/edge rows only — a rendered "(untitled)" is now a
 *  signal, not a normal state. */
export function displayName(n: { title: string | null; body: string | null }): string {
  if (n.title) return n.title;
  const firstLine = n.body?.split('\n', 1)[0]?.trim();
  return firstLine || '(untitled)';
}
