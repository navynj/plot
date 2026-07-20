'use client';

import { X } from 'lucide-react';
import * as React from 'react';

import { setEventDate } from '@/app/node/[id]/actions';
import { Button } from '@/components/ui/button';

/** eventDate — when it actually happened (optional for every node; date is
 *  storage, not identity). Clearable; capturedAt remains the fallback axis. */
export function EventDateControl({ nodeId, value }: { nodeId: string; value: string | null }) {
  const [day, setDay] = React.useState(value ?? '');
  return (
    <span className="text-muted-foreground flex items-center gap-1 text-xs">
      happened:
      <input
        type="date"
        value={day}
        onChange={(e) => {
          setDay(e.target.value);
          if (e.target.value) void setEventDate(nodeId, e.target.value);
        }}
        aria-label="event date"
        className="border-input bg-background h-7 rounded-md border px-2 text-xs"
      />
      {day !== '' && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="clear event date"
          onClick={() => {
            setDay('');
            void setEventDate(nodeId, null);
          }}
        >
          <X className="size-3" />
        </Button>
      )}
    </span>
  );
}
