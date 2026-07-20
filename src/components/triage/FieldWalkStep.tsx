import Link from 'next/link';
import * as React from 'react';

import type { FieldDef, FieldPrimitive } from '@/db/schema';
import type { NodeRow } from '@/repository/nodeRepo';
import { FieldEditors } from '@/components/field/FieldEditors';
import { Button } from '@/components/ui/button';
import { displayName } from '@/lib/identity';

interface FieldWalkStepProps {
  /** null = the queued id no longer resolves (deleted mid-walk) */
  node: NodeRow | null;
  defs: FieldDef[];
  values: Record<string, FieldPrimitive>;
  displays?: Record<string, string>;
  /** shown when there is nothing to edit — each queue source words its own
   *  honesty (parentless vs schema-less vs vanished) */
  emptyMessage: string;
  /** absent when defs is empty (nothing to save) */
  action: ((formData: FormData) => Promise<void>) | null;
  /** absent in the single-node (?node=) scope, where there is no "next" */
  skipHref: string | null;
  /** the worn schema's editor (ChildSchemaEditor mounted against the PARENT
   *  by the page) — schema gaps become visible exactly while filling */
  schemaEditor?: React.ReactNode;
}

/** ONE step of the field-filling walk — body for reference, the registry
 *  editors, save-partial or skip. The flow has two queue sources (the derived
 *  required-missing queue and a bulk selection) but exactly one step
 *  implementation: both entry points render this. */
export function FieldWalkStep({
  node,
  defs,
  values,
  displays,
  emptyMessage,
  action,
  skipHref,
  schemaEditor,
}: FieldWalkStepProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className="border-border rounded-lg border p-4">
        {node ? (
          <>
            <Link href={`/node/${node.id}`} className="text-sm font-medium hover:underline">
              {node.displayIcon && <span className="mr-1">{node.displayIcon}</span>}
              {displayName(node)}
            </Link>
            {node.body && (
              <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">{node.body}</p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">This item no longer exists.</p>
        )}
      </div>
      {schemaEditor && <div className="-mb-2 flex justify-end">{schemaEditor}</div>}
      {defs.length > 0 && action ? (
        <FieldEditors defs={defs} values={values} displays={displays} action={action} />
      ) : (
        node && <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      )}
      {skipHref && (
        <Button variant="ghost" size="sm" className="text-muted-foreground self-start" asChild>
          <Link href={skipHref}>Skip</Link>
        </Button>
      )}
    </section>
  );
}
