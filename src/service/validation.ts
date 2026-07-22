import type { FieldDef, FieldPrimitive, ValidationRule } from '@/db/schema';

import { ValidationError } from './errors';

/**
 * The ONE implementation of the declarative validation vocabulary (DESIGN §5,
 * bounded power). A rule attached to a field compares that field's value to
 * either another field's value or a constant, with a small op set. Checked at
 * save, BEFORE persisting (and before compute, so an inverted computed pair is
 * rejected before it is ever written).
 *
 * Empty is always legal (DESIGN §6-capture): a rule is SKIPPED whenever either
 * operand it compares is absent — required-ness is never a save gate, and a
 * rule can only speak about values that are actually there.
 *
 * `values` is the effective post-save state (stored values overlaid with the
 * edits being saved), keyed by field key. Throws the first ValidationError.
 */
export function validateValues(
  defs: FieldDef[],
  values: Record<string, FieldPrimitive | undefined>
): void {
  const byKey = new Map(defs.map((d) => [d.key, d]));
  for (const def of defs) {
    if (!def.validate?.length) continue;
    const a = values[def.key];
    if (isEmpty(a)) continue; // empty is always legal
    for (const rule of def.validate) {
      const b = rule.otherField !== undefined ? values[rule.otherField] : rule.value;
      if (isEmpty(b)) continue; // the compared operand is absent — skip
      if (!satisfies(rule.op, a, b as FieldPrimitive)) {
        throw new ValidationError(def.key, messageFor(rule, def, byKey.get(rule.otherField ?? '')));
      }
    }
  }
}

function isEmpty(v: unknown): v is null | undefined | '' {
  return v === null || v === undefined || v === '';
}

/** Order Date chronologically, everything else by its native comparison; a
 *  boolean only participates in eq/neq (an ordered op on a boolean is a no-op,
 *  never a violation — DESIGN's "booleans by equality only"). */
function comparable(v: FieldPrimitive): number | string | boolean {
  return v instanceof Date ? v.getTime() : v;
}

function satisfies(op: ValidationRule['op'], a: FieldPrimitive, b: FieldPrimitive): boolean {
  const x = comparable(a);
  const y = comparable(b);
  switch (op) {
    case 'eq':
      return x === y;
    case 'neq':
      return x !== y;
    default:
      // ordered comparison: booleans opt out (equality only)
      if (typeof x === 'boolean' || typeof y === 'boolean') return true;
      switch (op) {
        case 'gt':
          return x > y;
        case 'gte':
          return x >= y;
        case 'lt':
          return x < y;
        case 'lte':
          return x <= y;
      }
  }
}

const DATE_PHRASE: Record<ValidationRule['op'], string> = {
  gt: 'must be after',
  gte: 'must be on or after',
  lt: 'must be before',
  lte: 'must be on or before',
  eq: 'must equal',
  neq: 'must not equal',
};
const NUM_PHRASE: Record<ValidationRule['op'], string> = {
  gt: 'must be greater than',
  gte: 'must be at least',
  lt: 'must be less than',
  lte: 'must be at most',
  eq: 'must equal',
  neq: 'must not equal',
};

/** The rule's custom message, or a generated one from the field labels. */
function messageFor(rule: ValidationRule, def: FieldDef, other: FieldDef | undefined): string {
  if (rule.message) return rule.message;
  const target =
    rule.otherField !== undefined ? (other?.label ?? rule.otherField) : String(rule.value);
  // an ordered rule against a timestamp field reads "after/before"; numeric and
  // constant comparisons read "greater/less than"
  const dateish = other?.type === 'timestamp' || other?.type === 'date' || def.type === 'timestamp';
  const phrase = (dateish ? DATE_PHRASE : NUM_PHRASE)[rule.op];
  return `${def.label.toLowerCase()} ${phrase} ${target.toLowerCase()}`;
}
