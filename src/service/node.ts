import {
  FIELD_TYPES,
  VIEW_LAYOUTS,
  type FieldDef,
  type FieldType,
  type Node,
  type ViewFilter,
  type ViewLayout,
  type ViewSpec,
} from '@/db/schema';
import { linkRepo } from '@/repository/linkRepo';
import { nodeRepo, type UpdateNodePatch } from '@/repository/nodeRepo';

import {
  EmptyCaptureError,
  InvalidSchemaError,
  InvalidViewSpecError,
  NodeNotFoundError,
} from './errors';

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

export function getChildren(userId: string, id: string): Promise<Node[]> {
  return nodeRepo.findChildren(userId, id);
}

export function getTimeline(userId: string): Promise<Node[]> {
  return nodeRepo.findTimeline(userId);
}

export function getInbox(userId: string): Promise<Node[]> {
  return nodeRepo.findInbox(userId);
}

export interface GridTile {
  node: Node;
  /** tree children + graph members — what the room holds */
  count: number;
}

/** The grid home (DESIGN §6): confirmed roots as rooms. The inbox is not a
 *  tile here — it stays a derived filter the page renders separately (muted:
 *  un-triaged is not debt). */
export async function getGridTiles(userId: string): Promise<GridTile[]> {
  const roots = await nodeRepo.findRoots(userId);
  return Promise.all(
    roots.map(async (node) => {
      const [children, members] = await Promise.all([
        nodeRepo.findChildren(userId, node.id),
        linkRepo.findTargets(userId, node.id),
      ]);
      return { node, count: new Set([...children, ...members].map((n) => n.id)).size };
    })
  );
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

/** Set (or clear, with null) how this node visualizes its aggregate set.
 *  Input is untrusted (dev JSON editor this phase) and validated into a
 *  bounded ViewSpec — lens + layout preset, nothing pixel-level (DESIGN §5). */
export async function setViewSpec(userId: string, id: string, input: unknown): Promise<Node> {
  const spec = input === null ? null : parseViewSpec(input);
  const updated = await nodeRepo.update(userId, id, { viewSpec: spec });
  if (!updated) {
    throw new NodeNotFoundError(id);
  }
  return updated;
}

const FILTER_OPS = ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'in', 'between'] as const;
const AGGREGATE_OPS = ['sum', 'avg', 'count', 'none'] as const;

function parseViewSpec(input: unknown): ViewSpec {
  if (typeof input !== 'object' || input === null) {
    throw new InvalidViewSpecError('must be an object');
  }
  const rec = input as Record<string, unknown>;
  const { lens, groupBy, layout, sort, filter, aggregate, overlayOwnField } = rec;
  if (typeof lens !== 'string' || lens.trim() === '') {
    throw new InvalidViewSpecError('lens must be a non-empty field key');
  }
  if (typeof layout !== 'string' || !(VIEW_LAYOUTS as readonly string[]).includes(layout)) {
    throw new InvalidViewSpecError(`layout must be one of ${VIEW_LAYOUTS.join(' | ')}`);
  }
  const spec: ViewSpec = { lens, layout: layout as ViewLayout };
  if (groupBy !== undefined) {
    if (typeof groupBy !== 'string') throw new InvalidViewSpecError('groupBy must be a field key');
    spec.groupBy = groupBy;
  }
  if (sort !== undefined) {
    if (
      typeof sort !== 'object' ||
      sort === null ||
      typeof (sort as Record<string, unknown>).by !== 'string' ||
      !['asc', 'desc'].includes(String((sort as Record<string, unknown>).dir))
    ) {
      throw new InvalidViewSpecError('sort must be { by: key, dir: asc|desc }');
    }
    spec.sort = {
      by: String((sort as Record<string, unknown>).by),
      dir: (sort as { dir: 'asc' | 'desc' }).dir,
    };
  }
  if (aggregate !== undefined) {
    if (
      typeof aggregate !== 'string' ||
      !(AGGREGATE_OPS as readonly string[]).includes(aggregate)
    ) {
      throw new InvalidViewSpecError(`aggregate must be one of ${AGGREGATE_OPS.join(' | ')}`);
    }
    spec.aggregate = aggregate as ViewSpec['aggregate'];
  }
  if (overlayOwnField !== undefined) {
    if (typeof overlayOwnField !== 'string') {
      throw new InvalidViewSpecError('overlayOwnField must be a field key');
    }
    spec.overlayOwnField = overlayOwnField;
  }
  if (filter !== undefined) {
    if (!Array.isArray(filter)) throw new InvalidViewSpecError('filter must be an array');
    spec.filter = filter.map((f, i): ViewFilter => {
      if (typeof f !== 'object' || f === null) {
        throw new InvalidViewSpecError(`filter #${i} is not an object`);
      }
      const fr = f as Record<string, unknown>;
      if (typeof fr.key !== 'string' || fr.key === '') {
        throw new InvalidViewSpecError(`filter #${i} needs a field key`);
      }
      if (typeof fr.op !== 'string' || !(FILTER_OPS as readonly string[]).includes(fr.op)) {
        throw new InvalidViewSpecError(`filter #${i} op must be one of ${FILTER_OPS.join(' | ')}`);
      }
      return { key: fr.key, op: fr.op as ViewFilter['op'], value: fr.value };
    });
  }
  return spec;
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}
