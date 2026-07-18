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

/** The pure rule, for callers that already hold the direct parent (e.g. the
 *  field-triage queue batching over all nodes). Same single implementation —
 *  `resolveSchema` delegates here. */
export function resolveSchemaFrom(parent: Pick<Node, 'childSchema'> | null): FieldDef[] {
  return parent?.childSchema ?? [];
}

export async function resolveSchema(
  userId: string,
  node: Pick<Node, 'parentId'>
): Promise<FieldDef[]> {
  if (!node.parentId) return [];
  return resolveSchemaFrom(await nodeRepo.byId(userId, node.parentId));
}
