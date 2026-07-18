import type { ViewSpec } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ViewSpecDevEditorProps {
  viewSpec: ViewSpec | null;
  action: (formData: FormData) => Promise<void>;
}

/** DEV-ONLY affordance (flagged in Phase 6, same pattern as the childSchema
 *  editor): raw JSON editing of a node's viewSpec so views are testable end
 *  to end. Real spec-editing UX arrives with presets (Phase 9). */
export function ViewSpecDevEditor({ viewSpec, action }: ViewSpecDevEditorProps) {
  return (
    <details className="text-muted-foreground text-sm">
      <summary className="cursor-pointer select-none">view spec (dev)</summary>
      <form action={action} className="mt-2 flex flex-col gap-2">
        <Textarea
          name="viewSpec"
          rows={6}
          className="font-mono text-xs"
          placeholder='{"lens":"amount","groupBy":"category","layout":"bar"} — or "null" to clear'
          defaultValue={viewSpec ? JSON.stringify(viewSpec, null, 2) : ''}
        />
        <Button type="submit" variant="outline" size="sm" className="self-start">
          Save view spec
        </Button>
      </form>
    </details>
  );
}
