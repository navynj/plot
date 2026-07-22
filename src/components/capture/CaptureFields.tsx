'use client';

import '@/components/field/types';

import type { FieldDef } from '@/db/schema';
import { getFieldUI } from '@/components/field/registry';
import { Label } from '@/components/ui/label';

/**
 * B1 inline parent-schema fields at capture time. When a parent chip is
 * selected and its childSchema is non-empty, its fields render here via the
 * SAME registry editors the Fill-fields walk uses. Filling is optional —
 * capture always succeeds; `defaultValue` pre-fills (Expense's inOut =
 * 'expense' finally shows at capture). Not wrapped in its own form (the
 * capture form owns submission); `__fieldKeys` scopes the save.
 */
export function CaptureFields({
  parentId,
  childSchema,
}: {
  parentId: string;
  childSchema: FieldDef[];
}) {
  if (childSchema.length === 0) return null;
  return (
    <div className="border-border bg-muted/30 flex max-h-64 flex-col gap-3 overflow-y-auto rounded-md border p-3">
      <input type="hidden" name="__fieldKeys" value={childSchema.map((d) => d.key).join(',')} />
      {childSchema.map((def) => (
        <div key={def.key} className="flex flex-col gap-1">
          <Label htmlFor={def.key} className="text-xs">
            {def.label}
            {def.required && <span className="text-muted-foreground"> (required)</span>}
          </Label>
          {getFieldUI(def.type).edit({ def, value: def.defaultValue, schemaOwnerId: parentId })}
        </div>
      ))}
    </div>
  );
}
