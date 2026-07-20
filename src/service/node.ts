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

import { reparent } from './triage';

import {
  EmptyCaptureError,
  InvalidSchemaError,
  InvalidViewSpecError,
  NodeNotFoundError,
} from './errors';

export interface CaptureInput {
  title?: string;
  body?: string;
  /** Contextual capture (DESIGN §6): position inherited from where the user
   *  is standing — the new node becomes a child of this context node. The
   *  user still only typed text; values are never forced. Absent = raw
   *  capture into the inbox. */
  contextParentId?: string;
  /** The temporal twin of contextual capture: viewing a day stamps it as the
   *  entry's eventDate. Absent (the common case, "today") leaves eventDate
   *  null — capturedAt speaks for it. */
  eventDate?: Date;
}

/**
 * Raw means raw (DESIGN §6-capture): a captured node is title/body + capturedAt
 * only. No field values, no childSchema. Position comes free from context when
 * a contextParentId is given (through triage.reparent — the single write path);
 * otherwise the node stays in the inbox filter.
 */
export async function captureNode(userId: string, input: CaptureInput): Promise<Node> {
  const title = input.title?.trim() || null;
  const body = input.body?.trim() || null;
  if (!title && !body) {
    throw new EmptyCaptureError();
  }
  let created = await nodeRepo.create({ userId, title, body, capturedAt: new Date() });
  if (input.eventDate) {
    created =
      (await nodeRepo.update(userId, created.id, { eventDate: input.eventDate })) ?? created;
  }
  if (input.contextParentId) {
    return reparent(userId, created.id, input.contextParentId);
  }
  return created;
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

/** The timeline PAGE's slice on the event axis: structural/constructed nodes
 *  derived out (SQL), overrides respected, optionally filtered to one day.
 *  Everything else (inbox/grid/detail/triage) sees all nodes. */
export function getTimelineVisible(
  userId: string,
  day: string | undefined,
  tz: string
): Promise<Node[]> {
  return nodeRepo.findTimelineVisible(userId, day, tz);
}

export function getInbox(userId: string): Promise<Node[]> {
  return nodeRepo.findInbox(userId);
}

export interface GridTile {
  node: Node;
  /** tree children + graph members — what the room holds */
  count: number;
}

export interface GridSection {
  root: Node;
  tiles: GridTile[];
}

/** The grid home, one level down: real use lives at level 2. Roots render as
 *  section headers; their children are the tiles (rank order). The inbox is
 *  not a tile — it stays a derived filter the page renders separately. */
export async function getGridSections(userId: string): Promise<GridSection[]> {
  const roots = await nodeRepo.findRoots(userId);
  return Promise.all(
    roots.map(async (root) => {
      const children = await nodeRepo.findChildren(userId, root.id);
      const tiles = await Promise.all(
        children.map(async (child) => {
          const [grand, members] = await Promise.all([
            nodeRepo.findChildren(userId, child.id),
            linkRepo.findTargets(userId, child.id),
          ]);
          return { node: child, count: new Set([...grand, ...members].map((n) => n.id)).size };
        })
      );
      return { root, tiles };
    })
  );
}

/** The capture chip row: pinned nodes first (stored preference), then the
 *  level-2 nodes (children of confirmed roots), deduped, rank order. */
export async function getCaptureChips(userId: string): Promise<Node[]> {
  const [pinned, roots] = await Promise.all([
    nodeRepo.findPinned(userId),
    nodeRepo.findRoots(userId),
  ]);
  const levelTwo = (
    await Promise.all(roots.map((root) => nodeRepo.findChildren(userId, root.id)))
  ).flat();
  return [...new Map([...pinned, ...levelTwo].map((n) => [n.id, n])).values()];
}

/** Grid inline add: a NEW ROOM under a section's root. Title, not body — a
 *  room is constructed structure, not a captured record (so the timeline's
 *  constructed rule keeps it out of the river, correctly). */
export async function addRoom(userId: string, rootId: string, title: string): Promise<Node> {
  const trimmed = title.trim();
  if (!trimmed) throw new EmptyCaptureError();
  const created = await nodeRepo.create({ userId, title: trimmed, capturedAt: new Date() });
  return reparent(userId, created.id, rootId);
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
