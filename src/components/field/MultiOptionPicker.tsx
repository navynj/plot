'use client';

import { Check, Loader2, Plus } from 'lucide-react';
import * as React from 'react';

import { usePendingLock } from '@/components/hooks/usePendingLock';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface MultiOptionPickerProps {
  name: string;
  /** current stored value: the chosen options comma-joined */
  value: string | undefined;
  options: string[];
  fieldKey: string;
  /** present enables create-in-place ("add a choice"); absent = pick-only */
  schemaOwnerId?: string;
}

/** Editor for a multi-select option field (def.multiple): the fixed choices as
 *  toggleable chips, chosen ones filled. The selection submits comma-joined in a
 *  hidden input (what option.parse reads). Create-in-place appends a new choice
 *  to the parent's childSchema via the same validated path the single picker
 *  uses. */
export function MultiOptionPicker({
  name,
  value,
  options: initialOptions,
  fieldKey,
  schemaOwnerId,
}: MultiOptionPickerProps) {
  const [options, setOptions] = React.useState(initialOptions);
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set((value ?? '').split(',').map((s) => s.trim()).filter(Boolean))
  );
  const [adding, setAdding] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const { pending, run } = usePendingLock();

  const toggle = (o: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(o)) next.delete(o);
      else next.add(o);
      return next;
    });

  const addChoice = () =>
    run('add', async () => {
      const v = adding.trim();
      if (!v) return;
      const { addOptionAction } = await import('@/app/node/[id]/actions');
      const result = await addOptionAction(schemaOwnerId!, fieldKey, v);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOptions(result.options);
      setSelected((s) => new Set(s).add(v));
      setAdding('');
      setError(null);
    });

  return (
    <div className="flex flex-col gap-1.5">
      <input type="hidden" name={name} value={[...selected].join(',')} />
      <div className="flex flex-wrap gap-1.5">
        {options.length === 0 && (
          <span className="text-muted-foreground text-xs">No choices yet.</span>
        )}
        {options.map((o) => {
          const on = selected.has(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o)}
              className={cn(
                'flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs',
                on
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted/50'
              )}
            >
              {on && <Check className="size-3 shrink-0" />}
              {o}
            </button>
          );
        })}
      </div>
      {schemaOwnerId !== undefined && (
        <div className="flex items-center gap-1">
          <Input
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            placeholder="add a choice"
            aria-label="add option choice"
            className="h-7 flex-1 text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault(); // add the choice, never submit the fields form
                void addChoice();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="add choice"
            disabled={pending}
            onClick={() => void addChoice()}
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          </Button>
        </div>
      )}
      {error && <p className="text-destructive text-xs">blocked: {error}</p>}
    </div>
  );
}
