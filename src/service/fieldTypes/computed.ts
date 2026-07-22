import type { FieldDef, FieldPrimitive, TypedFieldWrite } from '@/db/schema';

import { registerFieldType } from '../fieldRegistry';

import { parseDurationMinutes } from './durationParse';

/**
 * Computed duration — a general derived field: its value is the difference of
 * two timestamp fields (`compute.to` − `compute.from`) in the same childSchema,
 * stored as MINUTES in numberValue exactly like `duration`, so aggregation is
 * unchanged. The `parse` here handles ONLY the manual fallback (used when the
 * two sources are not both filled); the actual computation is the compute rule
 * below, applied in the save path. Reuses the duration parser so entry forms
 * match ("8:30", "8h 30m", minutes).
 */
registerFieldType('computed', {
  valueColumn: 'numberValue',
  parse: (raw, def) => parseDurationMinutes(raw, def.key),
});

const MS_PER_MINUTE = 60_000;

/**
 * The compute rule (CLAUDE.md §3 — one place). For each computed field whose
 * two source timestamps are BOTH present in the effective (post-save) state,
 * override `writes` with the difference in minutes. This runs AFTER validation
 * (a `to > from` rule keeps the pair ordered, so the difference is positive —
 * NO overnight wraparound is added). When a source is missing the field is left
 * to its manual value (whatever phase-1 already put in `writes`).
 */
export function applyComputedWrites(
  worn: FieldDef[],
  effective: Record<string, FieldPrimitive | undefined>,
  writes: Map<string, TypedFieldWrite | null>
): void {
  for (const def of worn) {
    if (def.type !== 'computed' || !def.compute) continue;
    const from = effective[def.compute.from];
    const to = effective[def.compute.to];
    if (from instanceof Date && to instanceof Date) {
      const minutes = (to.getTime() - from.getTime()) / MS_PER_MINUTE;
      writes.set(def.key, { column: 'numberValue', value: minutes });
    }
  }
}
