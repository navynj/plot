import { FIELD_TYPES, type FieldDef, type FieldType, type Node } from '@/db/schema';
import { nodeRepo, type UpdateNodePatch } from '@/repository/nodeRepo';

import { EmptyCaptureError, InvalidSchemaError, NodeNotFoundError } from './errors';

export interface CaptureInput {
  title?: string;
  body?: string;
}

/**
 * Raw means raw (DESIGN §6-capture): a captured node is title/body + capturedAt
 * only. No parent (stays in the inbox filter), no field values, no childSchema.
 * Structure arrives later via field triage (Phase 2) and position triage (Phase 3).
 */
export async function captureNode(userId: string, input: CaptureInput): Promise<Node> {
  const title = input.title?.trim() || null;
  const body = input.body?.trim() || null;
  if (!title && !body) {
    throw new EmptyCaptureError();
  }
  return nodeRepo.create({ userId, title, body, capturedAt: new Date() });
}

export async function updateNode(
  userId: string,
  id: string,
  patch: UpdateNodePatch
): Promise<Node> {
  const updated = await nodeRepo.update(userId, id, patch);
  if (!updated) {
    throw new NodeNotFoundError(id);
  }
  return updated;
}

export async function deleteNode(userId: string, id: string): Promise<void> {
  const deleted = await nodeRepo.softDelete(userId, id);
  if (!deleted) {
    throw new NodeNotFoundError(id);
  }
}

export function getNode(userId: string, id: string): Promise<Node | null> {
  return nodeRepo.byId(userId, id);
}

export function getTimeline(userId: string): Promise<Node[]> {
  return nodeRepo.findTimeline(userId);
}

export function getInbox(userId: string): Promise<Node[]> {
  return nodeRepo.findInbox(userId);
}

/** Declare the schema this node imposes on its children. Input is untrusted
 *  (dev JSON editor this phase) and validated into FieldDef[]. */
export async function setChildSchema(userId: string, id: string, input: unknown): Promise<Node> {
  const defs = parseFieldDefs(input);
  const updated = await nodeRepo.update(userId, id, { childSchema: defs });
  if (!updated) {
    throw new NodeNotFoundError(id);
  }
  return updated;
}

function parseFieldDefs(input: unknown): FieldDef[] {
  if (!Array.isArray(input)) throw new InvalidSchemaError('must be an array of field defs');
  const seen = new Set<string>();
  return input.map((item, i) => {
    if (typeof item !== 'object' || item === null) {
      throw new InvalidSchemaError(`def #${i} is not an object`);
    }
    const rec = item as Record<string, unknown>;
    const { key, label, type, required, options, linkTargetParentId } = rec;
    if (typeof key !== 'string' || key.trim() === '') {
      throw new InvalidSchemaError(`def #${i} needs a non-empty string key`);
    }
    if (seen.has(key)) throw new InvalidSchemaError(`duplicate key "${key}"`);
    seen.add(key);
    if (typeof type !== 'string' || !(FIELD_TYPES as readonly string[]).includes(type)) {
      throw new InvalidSchemaError(`def "${key}" has unknown type "${String(type)}"`);
    }
    if (options !== undefined && !(Array.isArray(options) && options.every(isString))) {
      throw new InvalidSchemaError(`def "${key}" options must be an array of strings`);
    }
    if (required !== undefined && typeof required !== 'boolean') {
      throw new InvalidSchemaError(`def "${key}" required must be a boolean`);
    }
    if (linkTargetParentId !== undefined && typeof linkTargetParentId !== 'string') {
      throw new InvalidSchemaError(`def "${key}" linkTargetParentId must be a string`);
    }
    const def: FieldDef = {
      key,
      label: typeof label === 'string' && label.trim() !== '' ? label : key,
      type: type as FieldType,
    };
    if (required !== undefined) def.required = required;
    if (options !== undefined) def.options = options as string[];
    if (linkTargetParentId !== undefined) def.linkTargetParentId = linkTargetParentId;
    return def;
  });
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}
