import './fieldTypes';

import type { FieldDef, FieldPrimitive, FieldValue, Node, TypedFieldWrite } from '@/db/schema';
import { fieldValueRepo } from '@/repository/fieldValueRepo';
import { nodeRepo } from '@/repository/nodeRepo';

import { displayName } from '@/lib/identity';

import { describeCandidates, type NodeCandidate } from './candidates';
import { LinkTargetNotFoundError, LinkTargetOutOfScopeError, NodeNotFoundError } from './errors';
import { getFieldType } from './fieldRegistry';
import { applyComputedWrites } from './fieldTypes/computed';
import { resolveSchema, resolveSchemaFrom } from './inheritance';
import { validateValues } from './validation';

/**
 * Save a node's own values from raw (form) input, validated per field type via
 * the registry. Only keys in the node's resolved (worn) schema are considered.
 * An empty value clears the row — required-ness is NEVER a save gate (DESIGN
 * §6-capture: values are never forced; it surfaces in field triage instead).
 *
 * `editedKeys` scopes the write to the fields the form actually rendered — a
 * partial form (field triage) must not clear the schema keys it never showed.
 * Absent = the form rendered every worn field.
 */
export async function saveOwnValues(
  userId: string,
  nodeId: string,
  raw: Record<string, unknown>,
  editedKeys?: string[]
): Promise<void> {
  const node = await nodeRepo.byId(userId, nodeId);
  if (!node) throw new NodeNotFoundError(nodeId);

  const worn = await resolveSchema(userId, node);
  const defs = editedKeys ? worn.filter((d) => editedKeys.includes(d.key)) : worn;

  // Phase 1 — parse raw values: each rendered field becomes a typed write, or
  // null (clear the row). Link targets are validated here.
  const writes = new Map<string, TypedFieldWrite | null>();
  const edited: Record<string, FieldPrimitive | undefined> = {};
  for (const def of defs) {
    const entry = getFieldType(def.type);
    const parsed = entry.parse(raw[def.key], def);
    edited[def.key] = parsed ?? undefined;
    if (parsed === null) {
      writes.set(def.key, null);
      continue;
    }
    if (entry.valueColumn === 'linkValue' && typeof parsed === 'string') {
      const target = await nodeRepo.byId(userId, parsed);
      if (!target) throw new LinkTargetNotFoundError(def.key, parsed);
      // linkTargetParentId (FieldDef): the target must be a TREE child of the
      // declared parent — this is what keeps e.g. budget lines and expenses
      // on the same category axis (DESIGN §4)
      if (def.linkTargetParentId && target.parentId !== def.linkTargetParentId) {
        throw new LinkTargetOutOfScopeError(def.key, parsed, def.linkTargetParentId);
      }
    }
    // parse() returns the value shape its own column expects, so this cast
    // only re-states what the registry entry guarantees
    writes.set(def.key, { column: entry.valueColumn, value: parsed } as TypedFieldWrite);
  }

  // Phases 2–3 — validation rules and computed fields both reason about the
  // EFFECTIVE post-save state (stored values overlaid with the edits). Only pay
  // for the extra read when the worn schema actually declares one of them.
  const needsEffective = worn.some((d) => (d.validate?.length ?? 0) > 0 || d.type === 'computed');
  if (needsEffective) {
    const stored = await getOwnValues(userId, nodeId);
    const effective: Record<string, FieldPrimitive | undefined> = { ...stored };
    for (const def of defs) effective[def.key] = edited[def.key];
    // order matters: validate first, so an inverted computed pair is rejected
    // BEFORE the computed value is ever written (no overnight wraparound)
    validateValues(worn, effective);
    applyComputedWrites(worn, effective, writes);
  }

  // Phase 4 — persist. A null write clears the row; every other write upserts.
  for (const [key, write] of writes) {
    if (write === null) {
      await fieldValueRepo.deleteByKey(userId, nodeId, key);
      continue;
    }
    const saved = await fieldValueRepo.upsert(userId, nodeId, key, write);
    if (!saved) throw new NodeNotFoundError(nodeId);
  }
}

/** A node's own values keyed by field key; exactly one typed column is
 *  populated per row, so extraction needs no registry lookup. */
export async function getOwnValues(
  userId: string,
  nodeId: string
): Promise<Record<string, FieldPrimitive>> {
  const rows = await fieldValueRepo.readByNode(userId, nodeId);
  const values: Record<string, FieldPrimitive> = {};
  for (const row of rows) {
    const value = extractValue(row);
    if (value !== null) values[row.key] = value;
  }
  return values;
}

/** One show-on-main field of a node: its icon (lucide name), the def, and the
 *  raw value — plus a resolved `display` for link references (icon+name). */
export interface MainFieldValue {
  key: string;
  icon: string | null;
  def: FieldDef;
  value: FieldPrimitive;
  display?: string;
}

/**
 * The show-on-main field values for a set of nodes, batched (one values query,
 * one link-resolution query). Each node's worn schema is its DIRECT parent's
 * childSchema (depth-1, via resolveSchemaFrom — the one inheritance rule), so
 * the flags come from the same place as everywhere else. Nodes with no
 * show-on-main field, or none filled, are simply absent from the map.
 */
export async function getMainFieldsByNode(
  userId: string,
  nodes: Pick<Node, 'id' | 'parentId' | 'attached'>[]
): Promise<Map<string, MainFieldValue[]>> {
  const out = new Map<string, MainFieldValue[]>();
  if (nodes.length === 0) return out;

  // depth-1 worn schema, batched by distinct parent (fetch each parent once)
  const parentIds = [
    ...new Set(nodes.map((n) => n.parentId).filter((p): p is string => p !== null)),
  ];
  const parents = new Map<string, Pick<Node, 'childSchema'>>();
  await Promise.all(
    parentIds.map(async (pid) => {
      const p = await nodeRepo.byId(userId, pid);
      if (p) parents.set(pid, p);
    })
  );

  const mainDefsByNode = new Map<string, FieldDef[]>();
  for (const n of nodes) {
    const worn = resolveSchemaFrom(n.parentId ? (parents.get(n.parentId) ?? null) : null, {
      attached: n.attached,
    });
    const mainDefs = worn.filter((d) => d.showOnMain);
    if (mainDefs.length > 0) mainDefsByNode.set(n.id, mainDefs);
  }
  const ids = [...mainDefsByNode.keys()];
  if (ids.length === 0) return out;

  const rows = await fieldValueRepo.readByNodes(userId, ids);
  const valuesByNode = new Map<string, Record<string, FieldPrimitive>>();
  for (const row of rows) {
    const v = extractValue(row);
    if (v === null) continue;
    const m = valuesByNode.get(row.nodeId) ?? {};
    m[row.key] = v;
    valuesByNode.set(row.nodeId, m);
  }

  // resolve link values to their target's name in one batch — a reference must
  // never render as a raw id
  const linkIds = new Set<string>();
  for (const [nodeId, defs] of mainDefsByNode) {
    const values = valuesByNode.get(nodeId) ?? {};
    for (const d of defs) {
      const v = values[d.key];
      if (d.type === 'link' && typeof v === 'string') linkIds.add(v);
    }
  }
  const targets = new Map<string, string>();
  if (linkIds.size > 0) {
    for (const t of await nodeRepo.byIds(userId, [...linkIds])) {
      targets.set(t.id, `${t.displayIcon ? `${t.displayIcon} ` : ''}${displayName(t)}`);
    }
  }

  for (const [nodeId, defs] of mainDefsByNode) {
    const values = valuesByNode.get(nodeId) ?? {};
    const chips: MainFieldValue[] = [];
    for (const def of defs) {
      const value = values[def.key];
      if (value === undefined) continue;
      const display =
        def.type === 'link' && typeof value === 'string' ? targets.get(value) : undefined;
      chips.push({ key: def.key, icon: def.icon ?? null, def, value, display });
    }
    if (chips.length > 0) out.set(nodeId, chips);
  }
  return out;
}

/** Candidates for a link-type field's picker: children of the def's declared
 *  linkTargetParentId when scoped, every node otherwise. */
export async function getLinkCandidates(
  userId: string,
  def: Pick<FieldDef, 'linkTargetParentId'>
): Promise<NodeCandidate[]> {
  if (def.linkTargetParentId) {
    const children = await nodeRepo.findChildren(userId, def.linkTargetParentId);
    return describeCandidates(children, new Set());
  }
  const all = await nodeRepo.findTimeline(userId);
  return describeCandidates(all, new Set());
}

/** Link-type values render as their target's icon+title, never a raw id —
 *  one implementation for every surface that pre-populates editors. */
export async function getValueDisplays(
  userId: string,
  defs: FieldDef[],
  values: Record<string, FieldPrimitive>
): Promise<Record<string, string>> {
  const displays: Record<string, string> = {};
  for (const def of defs) {
    const value = values[def.key];
    if (def.type === 'link' && typeof value === 'string') {
      const target = await nodeRepo.byId(userId, value);
      if (target) {
        displays[def.key] =
          `${target.icon ? `${target.icon} ` : ''}${target.title ?? target.body ?? value}`;
      }
    }
  }
  return displays;
}

/** The one populated typed column of a field_value row, as a JS primitive. */
export function extractValue(row: FieldValue): FieldPrimitive | null {
  if (row.textValue !== null) return row.textValue;
  if (row.numberValue !== null) return Number(row.numberValue);
  if (row.boolValue !== null) return row.boolValue;
  if (row.dateValue !== null) return row.dateValue;
  if (row.linkValue !== null) return row.linkValue;
  return null;
}
