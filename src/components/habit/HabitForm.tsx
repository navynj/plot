'use client';

import * as React from 'react';

import {
  createHabitAction,
  habitForm,
  habitParentSchema,
  updateHabitAction,
} from '@/app/_habit/actions';
import type { FieldDef, FieldPrimitive } from '@/db/schema';
import { FieldInputs } from '@/components/field/FieldInputs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';

import { EmojiPicker } from './EmojiPicker';
import { HabitParentPicker } from './HabitParentPicker';

/** Add / edit a habit: emoji icon, title, target parent, and the preset field
 *  values for that parent's schema (reusing FieldInputs — the same editors a
 *  child of that parent wears). Saves through the thin habit actions. */
export function HabitForm({ habitId, onDone }: { habitId?: string; onDone(): void }) {
  const [icon, setIcon] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [logParentId, setLogParentId] = React.useState('');
  const [parentLabel, setParentLabel] = React.useState<string | null>(null);
  const [schema, setSchema] = React.useState<FieldDef[]>([]);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(Boolean(habitId));

  React.useEffect(() => {
    if (!habitId) return;
    let active = true;
    void habitForm(habitId).then((d) => {
      if (!active || !d) return;
      setIcon(d.icon);
      setTitle(d.title);
      setLogParentId(d.logParentId);
      setParentLabel(d.schema.length > 0 || d.logParentId ? 'current parent' : null);
      setValues(d.values);
      setSchema(d.schema);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [habitId]);

  const pickParent = async (id: string, label: string) => {
    setLogParentId(id);
    setParentLabel(label);
    setSchema(await habitParentSchema(id));
  };

  const submit = async (formData: FormData) => {
    const res = habitId
      ? await updateHabitAction(habitId, formData)
      : await createHabitAction(formData);
    if (!res.ok) return setError(res.error);
    setError(null);
    onDone();
  };

  if (loading) return <p className="text-muted-foreground text-sm">Loading…</p>;

  return (
    <form action={submit} className="flex flex-col gap-3">
      <input type="hidden" name="icon" value={icon ?? ''} />
      <input type="hidden" name="logParentId" value={logParentId} />
      <div className="flex items-end gap-2">
        <EmojiPicker value={icon} onChange={setIcon} />
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-muted-foreground text-xs">Title</label>
          <Input
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Meditate"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">Logs go under</label>
        <HabitParentPicker label={parentLabel} onPick={(id, l) => void pickParent(id, l)} />
      </div>
      {schema.length > 0 && (
        <div className="border-border flex flex-col gap-3 border-t pt-3">
          <p className="text-muted-foreground text-xs">Preset values (optional)</p>
          <FieldInputs
            defs={schema}
            values={values as Record<string, FieldPrimitive>}
            schemaOwnerId={logParentId}
          />
        </div>
      )}
      {error && <p className="text-destructive text-xs">{error}</p>}
      <div className="flex gap-2">
        <SubmitButton size="sm">{habitId ? 'Save habit' : 'Add habit'}</SubmitButton>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
