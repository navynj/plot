import type { ReactNode } from 'react';

import type { FieldDef, FieldPrimitive, FieldType } from '@/db/schema';

/**
 * UI facet of the field-type registry (CLAUDE.md §2): type → render + edit.
 * The domain facet (valueColumn + parse) lives in `service/fieldRegistry` —
 * React cannot live below the component layer, so the one registry has two
 * homes. Adding a field type is one `registerFieldUI` call in its own file
 * under `components/field/types/` — never a `switch`.
 */
export interface FieldUIProps {
  def: FieldDef;
  value: FieldPrimitive | undefined;
  /** resolved human label for reference values (a link target's icon+title) —
   *  provided by the server, since a raw id must never render as the value */
  display?: string;
  /** the node whose childSchema this def belongs to (the parent). Lets the
   *  option editor's create-in-place append a new choice through the validated
   *  setChildSchema path. Absent → create-in-place is unavailable (pick-only). */
  schemaOwnerId?: string;
}

export interface FieldUIEntry {
  render(props: FieldUIProps): ReactNode;
  /** editors are plain form fields named by `def.key`; saving is one form */
  edit(props: FieldUIProps): ReactNode;
}

const registry = new Map<FieldType, FieldUIEntry>();

export function registerFieldUI(type: FieldType, entry: FieldUIEntry): void {
  registry.set(type, entry);
}

export function getFieldUI(type: FieldType): FieldUIEntry {
  const entry = registry.get(type);
  if (!entry) {
    throw new Error(`field UI not registered: ${type}`);
  }
  return entry;
}
