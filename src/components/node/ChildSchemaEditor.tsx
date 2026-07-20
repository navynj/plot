'use client';

import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Plus, SlidersHorizontal } from 'lucide-react';
import * as React from 'react';

import '@/components/field/types';
import '@/service/fieldTypes';

import type { FieldDef } from '@/db/schema';
import { saveChildSchemaAction } from '@/app/node/[id]/actions';
import { getFieldUI } from '@/components/field/registry';
import { FieldTypeMismatchError } from '@/service/errors';
import { getFieldType } from '@/service/fieldRegistry';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

import { SchemaFieldRow, type SchemaRow } from './SchemaFieldRow';

/** label → camelCase key ("Practice Time" → practiceTime). Unicode-friendly. */
function keyFromLabel(label: string): string {
  const words = label
    .trim()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  if (words.length === 0) return '';
  return words
    .map((w, i) =>
      i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1)
    )
    .join('');
}

/** "Edit fields": the real childSchema editor (retires the dev JSON textarea).
 *  Reorder by drag; types are fixed after creation; removal never deletes
 *  data. All writes go through the validated setChildSchema service path. */
export function ChildSchemaEditor({
  nodeId,
  childSchema,
}: {
  nodeId: string;
  childSchema: FieldDef[];
}) {
  const initialRows = React.useCallback(
    () => childSchema.map((def, i) => ({ uid: i, def, persisted: true })),
    [childSchema]
  );
  const [rows, setRows] = React.useState<SchemaRow[]>(initialRows);
  const [nextUid, setNextUid] = React.useState(childSchema.length);
  const [open, setOpen] = React.useState(false);
  const [newLabel, setNewLabel] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [scopePickFor, setScopePickFor] = React.useState<number | null>(null);
  const [scopeCandidates, setScopeCandidates] = React.useState<
    { id: string; title: string; path: string }[] | null
  >(null);
  const [scopeLabels, setScopeLabels] = React.useState<Record<string, string>>({});
  const [draggingUid, setDraggingUid] = React.useState<number | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const update = (uid: number, def: FieldDef) =>
    setRows((rs) => rs.map((r) => (r.uid === uid ? { ...r, def } : r)));

  const addField = () => {
    const label = newLabel.trim();
    if (!label) return;
    const key = keyFromLabel(label);
    if (!key) return setError('label needs at least one letter');
    if (rows.some((r) => r.def.key === key)) return setError(`a field with key "${key}" exists`);
    setError(null);
    setRows((rs) => [...rs, { uid: nextUid, def: { key, label, type: 'text' }, persisted: false }]);
    setNextUid((n) => n + 1);
    setNewLabel('');
  };

  const save = async (formData: FormData) => {
    let defs: FieldDef[];
    try {
      defs = rows.map((r) => {
        // the default editor is a real registry editor; parse its submitted
        // value through the SERVICE facet so defaults are typed like values
        const raw = formData.get(`__default_${r.uid}`);
        const parsed =
          raw === null || raw === '' ? null : getFieldType(r.def.type).parse(raw, r.def);
        const def = { ...r.def };
        if (parsed === null || parsed instanceof Date) delete def.defaultValue;
        else def.defaultValue = parsed;
        return def;
      });
    } catch (err) {
      if (err instanceof FieldTypeMismatchError) return setError(`default: ${err.message}`);
      throw err;
    }
    const result = await saveChildSchemaAction(nodeId, defs);
    if (!result.ok) return setError(result.error);
    setError(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const openScopePicker = async (uid: number) => {
    setScopePickFor(uid);
    if (scopeCandidates === null) {
      const { parentCandidates } = await import('@/app/triage/actions');
      setScopeCandidates(await parentCandidates([]));
    }
  };

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setRows(initialRows()); // re-sync with server state on open
            setNextUid(childSchema.length);
          }
        }}
      >
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="text-muted-foreground self-start">
            <SlidersHorizontal className="size-3.5" />
            Edit fields ({childSchema.length})
          </Button>
        </SheetTrigger>
        <SheetContent className="flex w-full flex-col gap-3 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Fields for children</SheetTitle>
            <SheetDescription>
              The template children of this node wear. Types are fixed after creation (storage
              differs per type) — to change one, remove the field and add it anew. Removing a field
              never deletes data: stored values stay with each child and resurface if the same key
              is ever re-declared.
            </SheetDescription>
          </SheetHeader>

          <form action={save} className="contents">
            <DndContext
              sensors={sensors}
              onDragStart={(e) => setDraggingUid((e.active.data.current as { uid: number }).uid)}
              onDragMove={(e) => {
                const rect = e.active.rect.current.translated;
                if (!rect) return;
                const centerY = rect.top + rect.height / 2;
                setRows((rs) => {
                  const from = rs.findIndex((r) => r.uid === draggingUid);
                  if (from < 0) return rs;
                  const els = Array.from(
                    document.querySelectorAll<HTMLElement>('[data-schema-row]')
                  );
                  let to = rs.length - 1;
                  for (let i = 0; i < els.length; i++) {
                    const b = els[i]!.getBoundingClientRect();
                    if (centerY < b.top + b.height / 2) {
                      to = i;
                      break;
                    }
                  }
                  if (to === from) return rs;
                  const next = [...rs];
                  const [moved] = next.splice(from, 1);
                  next.splice(to, 0, moved!);
                  return next;
                });
              }}
              onDragEnd={() => setDraggingUid(null)}
              onDragCancel={() => setDraggingUid(null)}
            >
              <div className="flex flex-col gap-2 px-4">
                {rows.length === 0 && (
                  <p className="text-muted-foreground text-sm">No fields yet — add one below.</p>
                )}
                {rows.map((row) => (
                  <SchemaFieldRow
                    key={row.uid}
                    row={row}
                    isDragging={draggingUid === row.uid}
                    onChange={(def) => update(row.uid, def)}
                    onRemove={() => setRows((rs) => rs.filter((r) => r.uid !== row.uid))}
                    onPickScope={() => void openScopePicker(row.uid)}
                    scopeLabel={
                      row.def.linkTargetParentId
                        ? (scopeLabels[row.def.linkTargetParentId] ?? row.def.linkTargetParentId)
                        : null
                    }
                    defaultControl={getFieldUI(row.def.type).edit({
                      def: { ...row.def, key: `__default_${row.uid}` },
                      value: row.def.defaultValue,
                    })}
                  />
                ))}
              </div>
            </DndContext>

            <div className="flex gap-2 px-4">
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="New field label"
                aria-label="new field label"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    addField();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addField} aria-label="add field">
                <Plus className="size-4" />
              </Button>
            </div>

            {error && <p className="text-destructive px-4 text-xs">{error}</p>}
            <SheetFooter>
              <SubmitButton className="w-full">{saved ? 'Saved ✓' : 'Save fields'}</SubmitButton>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <CommandDialog
        open={scopePickFor !== null}
        onOpenChange={(next) => !next && setScopePickFor(null)}
        title="Link scope"
        description="Children of the chosen node become the field's candidates"
      >
        <Command>
          <CommandInput placeholder="Search a node…" />
          <CommandList>
            <CommandEmpty>{scopeCandidates === null ? 'Loading…' : 'No match.'}</CommandEmpty>
            <CommandGroup heading="Scope to children of">
              {(scopeCandidates ?? []).map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.title} ${c.path}`}
                  onSelect={() => {
                    const uid = scopePickFor!;
                    setScopeLabels((m) => ({ ...m, [c.id]: c.title }));
                    setRows((rs) =>
                      rs.map((r) =>
                        r.uid === uid ? { ...r, def: { ...r.def, linkTargetParentId: c.id } } : r
                      )
                    );
                    setScopePickFor(null);
                  }}
                >
                  <span className="truncate">{c.title}</span>
                  {c.path && (
                    <span className="text-muted-foreground ml-auto truncate text-xs">{c.path}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
