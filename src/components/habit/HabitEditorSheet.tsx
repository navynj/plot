'use client';

import { CalendarCheck, Pencil, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';

import { deleteHabitAction } from '@/app/_habit/actions';
import type { HabitSummary } from '@/service/habit';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

import { HabitForm } from './HabitForm';

/** The habit editor, opened as a sheet from the stream (a product decision —
 *  not a dedicated page). Lists habits with add / edit / delete; deleting keeps
 *  the log entries a habit already made. */
export function HabitEditorSheet({ habits }: { habits: HabitSummary[] }) {
  const [open, setOpen] = React.useState(false);
  // null = the list; 'new' = the add form; an id = the edit form
  const [editing, setEditing] = React.useState<string | 'new' | null>(null);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setEditing(null);
      }}
    >
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground gap-1">
          <CalendarCheck className="size-4" /> Habits
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-3 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Habits</SheetTitle>
          <SheetDescription>
            Toggle these on the stream to log a day. Deleting a habit keeps the entries it already
            made.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-2 px-4">
          {editing !== null ? (
            <HabitForm
              habitId={editing === 'new' ? undefined : editing}
              onDone={() => setEditing(null)}
            />
          ) : (
            <>
              {habits.length === 0 && (
                <p className="text-muted-foreground text-sm">No habits yet — add one below.</p>
              )}
              {habits.map((h) => (
                <div
                  key={h.id}
                  className="border-border flex items-center gap-2 rounded-md border p-2"
                >
                  <span className="text-lg">{h.icon || '•'}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {h.title}
                    {h.disabled && (
                      <span className="text-muted-foreground text-xs"> · parent deleted</span>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`edit ${h.title}`}
                    onClick={() => setEditing(h.id)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <form action={deleteHabitAction.bind(null, h.id)}>
                    <Button variant="ghost" size="icon-sm" aria-label={`delete ${h.title}`} type="submit">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </form>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => setEditing('new')}
              >
                <Plus className="size-4" /> Add habit
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
