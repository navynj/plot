import type { FieldDef, FieldPrimitive, FieldType, FieldValueColumn } from '@/db/schema';

/**
 * Domain facet of the field-type registry (CLAUDE.md §2): type → value column
 * + validation. The UI facet (render/edit) lives in `components/field/registry`
 * because React cannot live below the component layer. Adding a field type is
 * one `registerFieldType` call in its own file under `service/fieldTypes/`,
 * plus its UI twin — never a `switch`.
 */
export interface FieldTypeEntry {
  valueColumn: FieldValueColumn;
  /**
   * Parse + validate a raw (form) value. Returns `null` for an empty value —
   * empty is always legal; required-ness is never a save gate (DESIGN
   * §6-capture: values are never forced). Throws FieldTypeMismatchError on a
   * value of the wrong shape.
   */
  parse(raw: unknown, def: FieldDef): FieldPrimitive | null;
}

const registry = new Map<FieldType, FieldTypeEntry>();

export function registerFieldType(type: FieldType, entry: FieldTypeEntry): void {
  registry.set(type, entry);
}

export function getFieldType(type: FieldType): FieldTypeEntry {
  const entry = registry.get(type);
  if (!entry) {
    throw new Error(`field type not registered: ${type}`);
  }
  return entry;
}
