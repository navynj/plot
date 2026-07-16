import '@/components/field/types';

import type { FieldDef, FieldPrimitive } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

import { getFieldUI } from './registry';

interface FieldEditorsProps {
  defs: FieldDef[];
  values: Record<string, FieldPrimitive>;
  action: (formData: FormData) => Promise<void>;
}

/** One form over the node's worn schema; each field's editor comes from the
 *  registry. Empty inputs save fine — required-ness is never a save gate. */
export function FieldEditors({ defs, values, action }: FieldEditorsProps) {
  return (
    <form action={action} className="flex flex-col gap-4">
      {defs.map((def) => (
        <div key={def.key} className="flex flex-col gap-1.5">
          <Label htmlFor={def.key}>
            {def.label}
            {def.required && <span className="text-muted-foreground text-xs"> (required)</span>}
          </Label>
          {getFieldUI(def.type).edit({ def, value: values[def.key] })}
        </div>
      ))}
      <Button type="submit" className="self-start">
        Save fields
      </Button>
    </form>
  );
}
