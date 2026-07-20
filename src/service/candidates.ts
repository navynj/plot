import type { NodeRow } from '@/repository/nodeRepo';
import { displayName } from '@/lib/identity';

export interface NodeCandidate {
  id: string;
  title: string;
  path: string;
  /** resolved display icon (own → link target → ancestors), from the row */
  icon: string | null;
}

/** Describe nodes for a searchable picker: label + tree path, minus an
 *  excluded set. Shared by the parent picker (excludes the node's own
 *  subtree) and the collection/link pickers. */
export function describeCandidates(all: NodeRow[], excluded: Set<string>): NodeCandidate[] {
  const byId = new Map(all.map((n) => [n.id, n]));
  const pathOf = (n: NodeRow): string => {
    const parts: string[] = [];
    let current: NodeRow | undefined = n.parentId ? byId.get(n.parentId) : undefined;
    for (let guard = 0; current && guard < 32; guard++) {
      parts.unshift(displayName(current));
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return parts.join(' / ');
  };
  return all
    .filter((n) => !excluded.has(n.id))
    .map((n) => ({ id: n.id, title: displayName(n), path: pathOf(n), icon: n.displayIcon ?? null }));
}
