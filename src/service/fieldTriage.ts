import type { FieldDef, Node } from '@/db/schema';
import { fieldValueRepo } from '@/repository/fieldValueRepo';
import { nodeRepo } from '@/repository/nodeRepo';

import { resolveSchema, resolveSchemaFrom } from './inheritance';

/**
 * Field triage (DESIGN §6): the second ritual, for the second kind of
 * incompleteness — no structure. The queue is FULLY DERIVED, like the inbox:
 * a node queues iff its worn (direct-parent) schema declares required fields
 * with no stored field_value row. Optional gaps never queue — raw is legal
 * forever. Required-ness is a queue criterion only, never a save gate, and
 * nothing here is stored.
 */

export interface FieldTriageItem {
  node: Node;
  missingRequired: string[];
}

export async function getFieldTriageQueue(userId: string): Promise<FieldTriageItem[]> {
  const all = await nodeRepo.findTimeline(userId);
  const byId = new Map(all.map((n) => [n.id, n]));

  const candidates = all
    .map((node) => {
      const parent = node.parentId ? (byId.get(node.parentId) ?? null) : null;
      const required = resolveSchemaFrom(parent).filter((d) => d.required);
      return { node, required };
    })
    .filter((c) => c.required.length > 0);
  if (candidates.length === 0) return [];

  const rows = await fieldValueRepo.readByNodes(
    userId,
    candidates.map((c) => c.node.id)
  );
  const filled = new Set(rows.map((r) => `${r.nodeId}:${r.key}`));

  return candidates
    .map(({ node, required }) => ({
      node,
      missingRequired: required.filter((d) => !filled.has(`${node.id}:${d.key}`)).map((d) => d.key),
    }))
    .filter((item) => item.missingRequired.length > 0);
}

/** The fields still unfilled on one node, required first — the per-node flow.
 *  Includes optional fields (fillable, just never queue-worthy). */
export async function getUnfilledFields(userId: string, nodeId: string): Promise<FieldDef[]> {
  const node = await nodeRepo.byId(userId, nodeId);
  if (!node) return [];
  const worn = await resolveSchema(userId, node);
  if (worn.length === 0) return [];
  const rows = await fieldValueRepo.readByNode(userId, nodeId);
  const filled = new Set(rows.map((r) => r.key));
  return worn
    .filter((d) => !filled.has(d.key))
    .sort((a, b) => Number(b.required ?? false) - Number(a.required ?? false));
}
