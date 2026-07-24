import type { FieldDef, FieldPrimitive } from '@/db/schema';
import type { MainFieldValue } from '@/service/field';
import { formatDuration } from '@/lib/formatDuration';

/** Shared display formatting for layout renderers. Round every displayed
 *  number (CLAUDE.md §6); values wear text tokens, never mark colors. */
const number = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });

export function formatValue(value: number): string {
  return number.format(value);
}

export function formatLens(value: unknown): string {
  if (value instanceof Date) {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(value);
  }
  if (typeof value === 'number') return number.format(value);
  if (typeof value === 'boolean') return value ? '✓' : '—';
  if (value === null || value === undefined) return '';
  return String(value);
}

/** A field's own value as display text, typed by its def. Duration and computed
 *  values read as durations ("8h 30m"); everything else falls to formatLens.
 *  A resolved reference (a link target's icon+name) is passed through as-is. */
export function formatFieldValue(def: FieldDef, value: FieldPrimitive, display?: string): string {
  if (display !== undefined) return display;
  if ((def.type === 'duration' || def.type === 'computed') && typeof value === 'number') {
    return formatDuration(value);
  }
  return formatLens(value);
}

/** A show-on-main chip: an icon plus one or more value pills. A multi-select
 *  option splits its comma-joined value into one pill per choice; every other
 *  field is a single pill. */
export function mainFieldChip(
  def: FieldDef,
  value: FieldPrimitive,
  display: string | undefined,
  icon: string | null
): { icon: string | null; values: string[] } {
  if (def.type === 'option' && def.multiple && display === undefined && typeof value === 'string') {
    const values = value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    return { icon, values: values.length > 0 ? values : [''] };
  }
  return { icon, values: [formatFieldValue(def, value, display)] };
}

/** Split a node's show-on-main values into: text `fields` (chips) and `checks`
 *  (checkbox fields → interactive toggles on the stream). One place so every
 *  list surface renders them the same way. */
export function mainFieldRow(
  nodeId: string,
  values: MainFieldValue[]
): {
  fields: { icon: string | null; values: string[] }[];
  checks: { icon: string | null; nodeId: string; fieldKey: string; checked: boolean; label: string }[];
} {
  const fields: { icon: string | null; values: string[] }[] = [];
  const checks: {
    icon: string | null;
    nodeId: string;
    fieldKey: string;
    checked: boolean;
    label: string;
  }[] = [];
  for (const f of values) {
    if (f.def.type === 'checkbox') {
      checks.push({
        icon: f.icon,
        nodeId,
        fieldKey: f.key,
        checked: f.value === true,
        label: f.def.label,
      });
    } else {
      fields.push(mainFieldChip(f.def, f.value, f.display, f.icon));
    }
  }
  return { fields, checks };
}
