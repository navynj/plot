import './fieldTypes';

import type { FieldDef, FieldPrimitive, FieldValue, TypedFieldWrite } from '@/db/schema';
import { fieldValueRepo } from '@/repository/fieldValueRepo';
import { nodeRepo } from '@/repository/nodeRepo';

import { describeCandidates, type NodeCandidate } from './candidates';
import { LinkTargetNotFoundError, LinkTargetOutOfScopeError, NodeNotFoundError } from './errors';
import { getFieldType } from './fieldRegistry';
import { resolveSchema } from './inheritance';

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
  for (const def of defs) {
    const entry = getFieldType(def.type);
    const parsed = entry.parse(raw[def.key], def);
    if (parsed === null) {
      await fieldValueRepo.deleteByKey(userId, nodeId, def.key);
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
    const write = { column: entry.valueColumn, value: parsed } as TypedFieldWrite;
    const saved = await fieldValueRepo.upsert(userId, nodeId, def.key, write);
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
