import {
  FIELD_TYPES,
  VALIDATION_OPS,
  VIEW_LAYOUTS,
  type FieldDef,
  type FieldType,
  type Node,
  type ValidationRule,
  type ViewFilter,
  type ViewLayout,
  type ViewSpec,
} from '@/db/schema';
import { linkRepo } from '@/repository/linkRepo';
import { nodeRepo, type ChildSort, type NodeRow, type UpdateNodePatch } from '@/repository/nodeRepo';

export type { ChildSort };

import { dayInTz, isValidDay, shiftDay, startOfDayInTz } from '@/lib/day';
import { displayName } from '@/lib/identity';

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
  /** Birth record. Default 'captured' — this IS the capture path; the
   *  create-in-place actions that borrow it for naming+placement pass
   *  'constructed'. */
  origin?: 'captured' | 'constructed';
  /** own icon (B1 leading-emoji slot); absent → the icon ladder resolves it */
  icon?: string;
}

/**
 * Raw means raw (DESIGN §6-capture): a captured node is title/body + capturedAt
 * only. No field values, no childSchema. Position comes free from context when
 * a contextParentId is given (through triage.reparent — the single write path);
 * otherwise the node stays in the inbox filter.
 */
export async function captureNode(userId: string, input: CaptureInput): Promise<Node> {
  let title = input.title?.trim() || null;
  let body = input.body?.trim() || null;
  if (!title && !body) {
    throw new EmptyCaptureError();
  }
  // FIRST LINE IS THE NAME: a capture's first line becomes the node's title
  // ("Croissant (12pc)" is a name, not prose); anything after the newline
  // stays body, null for single-line captures. Callers that already named
  // the node (title given) skip the split.
  if (!title && body) {
    const newline = body.indexOf('\n');
    title = (newline === -1 ? body : body.slice(0, newline)).trim();
    body = newline === -1 ? null : body.slice(newline + 1).trim() || null;
  }
  let created = await nodeRepo.create({
    userId,
    title,
    body,
    icon: input.icon?.trim() || null,
    origin: input.origin ?? 'captured',
    capturedAt: new Date(),
  });
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

export function getNode(userId: string, id: string): Promise<NodeRow | null> {
  return nodeRepo.byId(userId, id);
}

/** Bulk set eventDate to a specific day (start of day in the user's tz) for
 *  many nodes — the multi-node twin of the single-node setEventDate. */
export async function bulkSetEventDate(
  userId: string,
  ids: string[],
  day: string,
  tz: string
): Promise<void> {
  if (ids.length === 0 || !isValidDay(day)) return;
  await nodeRepo.bulkSetEventDate(userId, ids, startOfDayInTz(day, tz));
}

/** Bulk shift each node's event day by N days (the "move to next day" action is
 *  N=+1). The base is the node's EFFECTIVE event day — `eventDate` if set, else
 *  `capturedAt` — read in the user's tz; the result is the START of (that day +
 *  N) in tz. The whole rule lives here, in one place (CLAUDE.md §3). */
export async function bulkShiftEventDateByDays(
  userId: string,
  ids: string[],
  days: number,
  tz: string
): Promise<void> {
  if (ids.length === 0) return;
  const nodes = await nodeRepo.byIds(userId, ids);
  const updates = nodes.map((n) => ({
    id: n.id,
    eventDate: startOfDayInTz(shiftDay(dayInTz(n.eventDate ?? n.capturedAt, tz), days), tz),
  }));
  await nodeRepo.setEventDates(userId, updates);
}

/** The node-detail Children list, ordered by date (default 'happened' — the
 *  event axis, like the stream). Manual rank order stays the repo default for
 *  triage/grid/chips; only this display surface sorts by date. */
export function getChildren(
  userId: string,
  id: string,
  sort: ChildSort = 'happened'
): Promise<NodeRow[]> {
  return nodeRepo.findChildren(userId, id, { sort });
}

/** A node's attached children (appendages — see A1): the quiet "Attached"
 *  area on its detail, never mixed with records. */
export function getAttachedChildren(userId: string, id: string): Promise<NodeRow[]> {
  return nodeRepo.findAttachedChildren(userId, id);
}

export function getTimeline(userId: string): Promise<NodeRow[]> {
  return nodeRepo.findTimeline(userId);
}

/** The timeline PAGE's slice on the event axis: structural/constructed nodes
 *  derived out (SQL), overrides respected, optionally filtered to one day.
 *  Everything else (inbox/grid/detail/triage) sees all nodes. */
export function getTimelineVisible(
  userId: string,
  day: string | undefined,
  tz: string
): Promise<NodeRow[]> {
  return nodeRepo.findTimelineVisible(userId, day, tz);
}

export function getInbox(userId: string): Promise<NodeRow[]> {
  return nodeRepo.findInbox(userId);
}

/** Live-children counts for a node set (bulk-action confirms). */
export function nodeChildCounts(userId: string, ids: string[]): Promise<Map<string, number>> {
  return nodeRepo.childCounts(userId, ids);
}

export interface GridTile {
  node: NodeRow;
  /** tree children + graph members — what the room holds */
  count: number;
}

export interface GridSection {
  root: NodeRow;
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

/** A capture chip: enough to render, know if it drills (has record children),
 *  and — once selected as the target — render its inline fields (B1). */
export interface ChipItem {
  id: string;
  icon: string | null;
  title: string;
  hasChildren: boolean;
  childSchema: FieldDef[];
}

export interface CaptureChipTiers {
  favorites: ChipItem[];
  ongoing: ChipItem[];
  topLevel: ChipItem[];
}

async function toChipItems(userId: string, nodes: NodeRow[]): Promise<ChipItem[]> {
  const counts = await nodeRepo.recordChildCounts(
    userId,
    nodes.map((n) => n.id)
  );
  return nodes.map((n) => ({
    id: n.id,
    icon: n.displayIcon ?? null,
    title: displayName(n),
    hasChildren: (counts.get(n.id) ?? 0) > 0,
    childSchema: n.childSchema ?? [],
  }));
}

/** The capture chip area (B2): three tiers — favorites, ongoing, and the
 *  confirmed top-level roots. Level-2 no longer auto-appears; you pin what you
 *  want reachable, and drill the rest (getChipChildren). */
export async function getCaptureChips(userId: string): Promise<CaptureChipTiers> {
  const [favorites, ongoing, roots] = await Promise.all([
    nodeRepo.findByPin(userId, 'favorite'),
    nodeRepo.findByPin(userId, 'ongoing'),
    nodeRepo.findRoots(userId),
  ]);
  const [f, o, t] = await Promise.all([
    toChipItems(userId, favorites),
    toChipItems(userId, ongoing),
    toChipItems(userId, roots),
  ]);
  return { favorites: f, ongoing: o, topLevel: t };
}

/** A chip's DRILLABLE children — the drill-down step (B2). Only non-leaf
 *  children (rooms that have their own record children) appear; a node's
 *  individual record-children (leaves) never spray as chips. Attached
 *  appendages are already excluded by findChildren. Selecting is decoupled from
 *  drilling: tapping a chip always selects it (its fields appear); this row is
 *  the optional "you can go deeper" reveal, never a replacement for selection. */
export async function getChipChildren(userId: string, parentId: string): Promise<ChipItem[]> {
  const children = await toChipItems(userId, await nodeRepo.findChildren(userId, parentId));
  return children.filter((c) => c.hasChildren);
}

export interface ScopeTarget {
  fieldKey: string;
  fieldLabel: string;
  id: string;
  icon: string | null;
  name: string;
}

/** The DISTINCT linkTargetParentId targets a childSchema's link fields point
 *  at — the schema relationship made navigable (nothing stored; this reads
 *  what's already declared). */
export async function getSchemaScopeTargets(
  userId: string,
  defs: FieldDef[]
): Promise<ScopeTarget[]> {
  const seen = new Set<string>();
  const out: ScopeTarget[] = [];
  for (const def of defs) {
    if (def.type !== 'link' || !def.linkTargetParentId || seen.has(def.linkTargetParentId)) {
      continue;
    }
    seen.add(def.linkTargetParentId);
    const target = await nodeRepo.byId(userId, def.linkTargetParentId);
    if (target) {
      out.push({
        fieldKey: def.key,
        fieldLabel: def.label,
        id: target.id,
        icon: target.displayIcon ?? null,
        name: displayName(target),
      });
    }
  }
  return out;
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

/** Append a new choice to an option field in a node's childSchema (B1 option
 *  create-in-place). Goes through the validated setChildSchema path; a choice
 *  that already exists is a no-op. Returns the field's options after. */
export async function addSchemaOption(
  userId: string,
  ownerId: string,
  fieldKey: string,
  option: string
): Promise<string[]> {
  const trimmed = option.trim();
  const owner = await nodeRepo.byId(userId, ownerId);
  if (!owner) throw new NodeNotFoundError(ownerId);
  const schema = owner.childSchema ?? [];
  const next = schema.map((d) => {
    if (d.key !== fieldKey || d.type !== 'option') return d;
    const opts = d.options ?? [];
    return opts.includes(trimmed) ? d : { ...d, options: [...opts, trimmed] };
  });
  if (trimmed !== '') await setChildSchema(userId, ownerId, next);
  return next.find((d) => d.key === fieldKey)?.options ?? [];
}

function parseFieldDefs(input: unknown): FieldDef[] {
  if (!Array.isArray(input)) throw new InvalidSchemaError('must be an array of field defs');
  const seen = new Set<string>();
  // every declared key, collected upfront so a rule's otherField (which may
  // reference a field defined later in the array) can be validated by name
  const allKeys = new Set(
    input
      .map((it) =>
        typeof it === 'object' && it !== null ? (it as Record<string, unknown>).key : undefined
      )
      .filter((k): k is string => typeof k === 'string' && k.trim() !== '')
  );
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
    const { multiple } = rec;
    if (multiple !== undefined && typeof multiple !== 'boolean') {
      throw new InvalidSchemaError(`def "${key}" multiple must be a boolean`);
    }
    if (linkTargetParentId !== undefined && typeof linkTargetParentId !== 'string') {
      throw new InvalidSchemaError(`def "${key}" linkTargetParentId must be a string`);
    }
    const { showOnMain, icon } = rec;
    if (showOnMain !== undefined && typeof showOnMain !== 'boolean') {
      throw new InvalidSchemaError(`def "${key}" showOnMain must be a boolean`);
    }
    if (icon !== undefined && typeof icon !== 'string') {
      throw new InvalidSchemaError(`def "${key}" icon must be a string`);
    }
    const { defaultValue } = rec;
    if (
      defaultValue !== undefined &&
      !['string', 'number', 'boolean'].includes(typeof defaultValue)
    ) {
      throw new InvalidSchemaError(`def "${key}" defaultValue must be a scalar`);
    }
    const { min, max, step } = rec;
    for (const [name, v] of [
      ['min', min],
      ['max', max],
      ['step', step],
    ] as const) {
      if (v !== undefined && (typeof v !== 'number' || Number.isNaN(v))) {
        throw new InvalidSchemaError(`def "${key}" ${name} must be a number`);
      }
    }
    if (typeof min === 'number' && typeof max === 'number' && min > max) {
      throw new InvalidSchemaError(`def "${key}": min must be ≤ max`);
    }
    if (typeof step === 'number' && step <= 0) {
      throw new InvalidSchemaError(`def "${key}": step must be > 0`);
    }
    if (typeof min === 'number' && typeof max === 'number' && typeof step === 'number') {
      const points = (max - min) / step;
      if (Math.abs(points - Math.round(points)) > 1e-9) {
        throw new InvalidSchemaError(`def "${key}": the min–max range must be step-divisible`);
      }
    }
    const validate = parseValidationRules(rec.validate, key, allKeys);
    const compute = parseCompute(rec.compute, key, allKeys);
    const def: FieldDef = {
      key,
      label: typeof label === 'string' && label.trim() !== '' ? label : key,
      type: type as FieldType,
    };
    if (required !== undefined) def.required = required;
    if (options !== undefined) def.options = options as string[];
    if (multiple !== undefined) def.multiple = multiple;
    if (linkTargetParentId !== undefined) def.linkTargetParentId = linkTargetParentId;
    if (defaultValue !== undefined) def.defaultValue = defaultValue as string | number | boolean;
    if (typeof min === 'number') def.min = min;
    if (typeof max === 'number') def.max = max;
    if (typeof step === 'number') def.step = step;
    if (validate !== undefined) def.validate = validate;
    if (compute !== undefined) def.compute = compute;
    if (showOnMain !== undefined) def.showOnMain = showOnMain;
    if (typeof icon === 'string') def.icon = icon;
    return def;
  });
}

/** Validate a computed field's `compute` config (untrusted): an object with
 *  string `from`/`to` (each referencing an existing field key in this schema)
 *  and an optional `unit` of 'minutes'. */
function parseCompute(
  input: unknown,
  key: string,
  allKeys: Set<string>
): FieldDef['compute'] {
  if (input === undefined) return undefined;
  if (typeof input !== 'object' || input === null) {
    throw new InvalidSchemaError(`def "${key}" compute must be an object`);
  }
  const c = input as Record<string, unknown>;
  for (const end of ['from', 'to'] as const) {
    if (typeof c[end] !== 'string' || !allKeys.has(c[end] as string)) {
      throw new InvalidSchemaError(
        `def "${key}" compute.${end} must reference an existing field key`
      );
    }
  }
  if (c.unit !== undefined && c.unit !== 'minutes') {
    throw new InvalidSchemaError(`def "${key}" compute.unit must be 'minutes'`);
  }
  const compute: NonNullable<FieldDef['compute']> = { from: c.from as string, to: c.to as string };
  if (c.unit !== undefined) compute.unit = 'minutes';
  return compute;
}

/** Validate a field's `validate` array (untrusted). Each rule's op is in the
 *  allowed set, exactly one of otherField/value is present, otherField (when
 *  present) references an existing field key, and message (when present) is a
 *  string. Bounded vocabulary — never free-form (DESIGN §5). */
function parseValidationRules(
  input: unknown,
  key: string,
  allKeys: Set<string>
): ValidationRule[] | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input)) throw new InvalidSchemaError(`def "${key}" validate must be an array`);
  return input.map((raw, j): ValidationRule => {
    if (typeof raw !== 'object' || raw === null) {
      throw new InvalidSchemaError(`def "${key}" validate #${j} is not an object`);
    }
    const r = raw as Record<string, unknown>;
    if (typeof r.op !== 'string' || !(VALIDATION_OPS as readonly string[]).includes(r.op)) {
      throw new InvalidSchemaError(
        `def "${key}" validate #${j} op must be one of ${VALIDATION_OPS.join(' | ')}`
      );
    }
    const hasOther = r.otherField !== undefined;
    const hasValue = r.value !== undefined;
    if (hasOther === hasValue) {
      throw new InvalidSchemaError(
        `def "${key}" validate #${j} needs exactly one of otherField / value`
      );
    }
    if (hasOther) {
      if (typeof r.otherField !== 'string' || !allKeys.has(r.otherField)) {
        throw new InvalidSchemaError(
          `def "${key}" validate #${j} otherField must reference an existing field key`
        );
      }
    } else if (!['string', 'number', 'boolean'].includes(typeof r.value)) {
      throw new InvalidSchemaError(`def "${key}" validate #${j} value must be a scalar`);
    }
    if (r.message !== undefined && typeof r.message !== 'string') {
      throw new InvalidSchemaError(`def "${key}" validate #${j} message must be a string`);
    }
    const rule: ValidationRule = { op: r.op as ValidationRule['op'] };
    if (hasOther) rule.otherField = r.otherField as string;
    else rule.value = r.value as string | number | boolean;
    if (r.message !== undefined) rule.message = r.message as string;
    return rule;
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
