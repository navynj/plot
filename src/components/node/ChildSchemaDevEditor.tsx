import type { FieldDef } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ChildSchemaDevEditorProps {
  childSchema: FieldDef[];
  action: (formData: FormData) => Promise<void>;
}

/** DEV-ONLY affordance (flagged in Phase 2): raw JSON editing of a node's
 *  childSchema so fields are testable end to end. The real schema-editing UX
 *  (layer insertion, inherit|new) belongs to triage phases. */
export function ChildSchemaDevEditor({ childSchema, action }: ChildSchemaDevEditorProps) {
  return (
    <details className="text-muted-foreground text-sm">
      <summary className="cursor-pointer select-none">child schema (dev)</summary>
      <form action={action} className="mt-2 flex flex-col gap-2">
        <Textarea
          name="childSchema"
          rows={6}
          className="font-mono text-xs"
          defaultValue={JSON.stringify(childSchema, null, 2)}
        />
        <Button type="submit" variant="outline" size="sm" className="self-start">
          Save child schema
        </Button>
      </form>
    </details>
  );
}
