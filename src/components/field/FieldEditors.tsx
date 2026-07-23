'use client';

import * as React from 'react';

import type { FieldDef, FieldPrimitive } from '@/db/schema';
import type { FieldSaveResult } from '@/app/node/[id]/actions';
import { SubmitButton } from '@/components/ui/submit-button';

import { FieldInputs } from './FieldInputs';

interface FieldEditorsProps {
  defs: FieldDef[];
  values: Record<string, FieldPrimitive>;
  /** server-resolved labels for reference values, keyed by field key */
  displays?: Record<string, string>;
  /** the node these defs' childSchema belongs to (the parent) — enables option
   *  create-in-place (B1). */
  schemaOwnerId?: string;
  /** success may redirect (never resolving) or resolve { ok:true }; a violated
   *  declarative rule resolves { ok:false } and surfaces inline (never a raw
   *  exception, DESIGN §5 bounded power) */
  action: (formData: FormData) => Promise<FieldSaveResult | void>;
}

/** One form over the node's worn schema; each field's editor comes from the
 *  registry. Empty inputs save fine — required-ness is never a save gate. A
 *  rule violation returns from the action and renders inline, keeping the
 *  entered values so the user can correct them. */
export function FieldEditors({ defs, values, displays, schemaOwnerId, action }: FieldEditorsProps) {
  const [error, setError] = React.useState<string | null>(null);
  return (
    <form
      action={async (formData) => {
        const result = await action(formData);
        setError(result && !result.ok ? result.error : null);
      }}
      className="flex flex-col gap-4"
    >
      <FieldInputs
        defs={defs}
        values={values}
        displays={displays}
        schemaOwnerId={schemaOwnerId}
      />
      {error && <p className="text-destructive text-xs">{error}</p>}
      <SubmitButton className="self-start">Save fields</SubmitButton>
    </form>
  );
}
