'use client';

import { useDraggable } from '@dnd-kit/core';
import { ArrowUpRight, GripVertical, Trash2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { FIELD_TYPES, type FieldDef, type FieldType } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface SchemaRow {
  uid: number;
  def: FieldDef;
  /** loaded from the server: the type is FIXED (the storage column differs —
   *  re-typing would strand values); remove + add to change */
  persisted: boolean;
}

interface SchemaFieldRowProps {
  row: SchemaRow;
  isDragging: boolean;
  onChange(def: FieldDef): void;
  onRemove(): void;
  onPickScope(): void;
  scopeLabel: string | null;
  /** the per-type default-value editor, rendered by the sheet via the field
   *  registry (typed per the field's type) */
  defaultControl?: React.ReactNode;
}

export function SchemaFieldRow(props: SchemaFieldRowProps) {
  const { row, isDragging } = props;
  const { def } = row;
  const { listeners, attributes, setNodeRef, setActivatorNodeRef } = useDraggable({
    id: `schema-row-${row.uid}`,
    data: { uid: row.uid },
  });

  return (
    <div
      ref={setNodeRef}
      data-schema-row={row.uid}
      className={cn(
        'border-border flex flex-col gap-2 rounded-md border p-2',
        isDragging && 'opacity-40'
      )}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          aria-label={`reorder ${def.label}`}
          className="text-muted-foreground/60 hover:text-foreground focus-visible:ring-ring/60 cursor-grab touch-none rounded-sm p-0.5 focus-visible:ring-2 focus-visible:outline-none"
        >
          <GripVertical className="size-4" />
        </button>
        <Input
          value={def.label}
          onChange={(e) => props.onChange({ ...def, label: e.target.value })}
          aria-label="field label"
          className="h-8 flex-1"
        />
        <Select
          value={def.type}
          disabled={row.persisted}
          onValueChange={(t) => props.onChange({ ...def, type: t as FieldType })}
        >
          <SelectTrigger size="sm" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="text-muted-foreground flex items-center gap-1 text-xs">
          <Checkbox
            checked={def.required ?? false}
            onCheckedChange={(c) => props.onChange({ ...def, required: c === true })}
          />
          req
        </label>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`remove ${def.label}`}
          onClick={props.onRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      <div className="text-muted-foreground flex items-center gap-2 pl-6 text-xs">
        <span className="font-mono">{def.key}</span>
        {def.type === 'option' && (
          <Input
            value={(def.options ?? []).join(', ')}
            onChange={(e) =>
              props.onChange({
                ...def,
                options: e.target.value
                  .split(',')
                  .map((o) => o.trim())
                  .filter(Boolean),
              })
            }
            placeholder="choices, comma, separated"
            aria-label="option choices"
            className="h-7 flex-1 text-xs"
          />
        )}
        {def.type === 'link' && (
          <span className="flex items-center gap-0.5">
            <Button type="button" variant="outline" size="sm" onClick={props.onPickScope}>
              scope: {props.scopeLabel ?? 'any node'}
            </Button>
            {/* the schema relationship, navigable: tap goes to the scope node */}
            {def.linkTargetParentId && (
              <Button variant="ghost" size="icon-sm" asChild aria-label={`open ${props.scopeLabel ?? 'scope node'}`}>
                <Link href={`/node/${def.linkTargetParentId}`}>
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </Button>
            )}
          </span>
        )}
        {def.type === 'number' &&
          (['min', 'max', 'step'] as const).map((bound) => (
            <label key={bound} className="flex items-center gap-1">
              {bound}
              <Input
                type="number"
                step="any"
                value={def[bound] ?? ''}
                onChange={(e) =>
                  props.onChange({
                    ...def,
                    [bound]: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                aria-label={`${def.label} ${bound}`}
                className="h-7 w-16 text-xs"
              />
            </label>
          ))}
      </div>
      {props.defaultControl && (
        <div className="text-muted-foreground flex items-center gap-2 pl-6 text-xs">
          default:
          <div className="flex-1">{props.defaultControl}</div>
        </div>
      )}
    </div>
  );
}
