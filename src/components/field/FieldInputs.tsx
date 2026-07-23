import '@/components/field/types';

import type { FieldDef, FieldPrimitive } from '@/db/schema';
import { Label } from '@/components/ui/label';

import { getFieldUI } from './registry';

export interface FieldInputsProps {
  defs: FieldDef[];
  values: Record<string, FieldPrimitive>;
  /** server-resolved labels for reference values, keyed by field key */
  displays?: Record<string, string>;
  /** the node these defs' childSchema belongs to (the parent) — enables option
   *  create-in-place (B1) */
  schemaOwnerId?: string;
}

/** The labeled per-field editors for a schema, plus the `__fieldKeys` marker the
 *  save path reads. NO form wrapper — the caller supplies the form, so this is
 *  reused inside both {@link FieldEditors} (the node value form) and the habit
 *  preset-values form. Empty inputs save fine (required-ness never gates). */
export function FieldInputs({ defs, values, displays, schemaOwnerId }: FieldInputsProps) {
  return (
    <>
      {/* the save path only touches the keys this form rendered — a partial
          form must never clear fields it didn't show */}
      <input type="hidden" name="__fieldKeys" value={defs.map((d) => d.key).join(',')} />
      {defs.map((def) => (
        <div key={def.key} className="flex flex-col gap-1.5">
          <Label htmlFor={def.key}>
            {def.label}
            {def.required && (
              <span className="text-destructive" aria-label="required">
                {' '}
                *
              </span>
            )}
          </Label>
          {getFieldUI(def.type).edit({
            def,
            // defaultValue is a PRE-FILL for new children: shown, and saved
            // as-is on submit like any value (not a phantom)
            value: values[def.key] ?? def.defaultValue,
            display: displays?.[def.key],
            schemaOwnerId,
          })}
        </div>
      ))}
    </>
  );
}
