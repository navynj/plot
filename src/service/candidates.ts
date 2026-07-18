import type { Node } from '@/db/schema';

export interface NodeCandidate {
  id: string;
  title: string;
  path: string;
}

export function labelOf(n: Node): string {
  return n.title ?? n.body ?? '(untitled)';
}

/** Describe nodes for a searchable picker: label + tree path, minus an
 *  excluded set. Shared by the parent picker (excludes the node's own
 *  subtree) and the collection/link pickers. */
export function describeCandidates(all: Node[], excluded: Set<string>): NodeCandidate[] {
  const byId = new Map(all.map((n) => [n.id, n]));
  const pathOf = (n: Node): string => {
    const parts: string[] = [];
    let current: Node | undefined = n.parentId ? byId.get(n.parentId) : undefined;
    for (let guard = 0; current && guard < 32; guard++) {
      parts.unshift(labelOf(current));
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return parts.join(' / ');
  };
  return all
    .filter((n) => !excluded.has(n.id))
    .map((n) => ({ id: n.id, title: labelOf(n), path: pathOf(n) }));
}
