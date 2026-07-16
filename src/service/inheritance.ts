import type { FieldDef, Node } from '@/db/schema';
import { nodeRepo } from '@/repository/nodeRepo';

/**
 * The ONE implementation of the depth-1 inheritance rule (CLAUDE.md §3):
 * a node wears exactly its DIRECT parent's `childSchema`, unconditionally.
 *
 * - Never walks ancestors: a grandparent's schema is invisible.
 * - Never resolves *through* an inherit node: `inherit` at layer insertion is
 *   a snapshot COPY onto the new node's own `childSchema`; `schemaMode` is a
 *   record of that choice and the read path ignores it. Later edits to the
 *   original ancestor's schema therefore do not propagate — intended.
 * - A parentless node wears nothing.
 */
export async function resolveSchema(
  userId: string,
  node: Pick<Node, 'parentId'>
): Promise<FieldDef[]> {
  if (!node.parentId) return [];
  const parent = await nodeRepo.byId(userId, node.parentId);
  return parent?.childSchema ?? [];
}
