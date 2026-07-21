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
 * - THE ONE EXCEPTION (A1): an `attached` child wears nothing either. It sits
 *   in the tree under its parent but is an appendage, not an instance of the
 *   parent's schema (e.g. `Expense categories` under `Expense`). The tree
 *   link has two flavors — inheriting (default) and attached (no schema) —
 *   and "inheritance is decided by the link, not the node" now covers this
 *   flag. Its OWN children still inherit its OWN childSchema normally.
 */

/** The pure rule, for callers that already hold the direct parent (e.g. the
 *  field-triage queue batching over all nodes). Same single implementation —
 *  `resolveSchema` delegates here. Pass the child's `attached` flag so the
 *  exception is honored without a second fetch. */
export function resolveSchemaFrom(
  parent: Pick<Node, 'childSchema'> | null,
  opts: { attached?: boolean } = {}
): FieldDef[] {
  if (opts.attached) return [];
  return parent?.childSchema ?? [];
}

export async function resolveSchema(
  userId: string,
  node: Pick<Node, 'parentId' | 'attached'>
): Promise<FieldDef[]> {
  if (!node.parentId || node.attached) return [];
  return resolveSchemaFrom(await nodeRepo.byId(userId, node.parentId));
}
