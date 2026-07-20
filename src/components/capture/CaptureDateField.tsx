'use client';

import { X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';

/**
 * The compact date control under every capture input. Always populated by the
 * precedence ladder: explicit pick > timeline-navigated day > today — the
 * shown date is stored as eventDate, today included (a visible picker makes
 * today a CHOSEN value). Null only via the explicit ✕: "no date" = a dateless
 * entry (idea, thought), which the timeline still shows via capturedAt.
 */
export function CaptureDateField({
  defaultDay,
}: {
  /** navigated day ?? today — computed server-side in the user's timezone.
   *  Parents reset the control after submit by changing the component key. */
  defaultDay: string;
}) {
  const [day, setDay] = React.useState<string>(defaultDay);

  return (
    <span className="text-muted-foreground flex items-center gap-1 text-xs">
      <input type="hidden" name="captureDate" value={day} />
      {day === '' ? (
        <>
          <span className="italic">no date</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setDay(defaultDay)}>
            set {defaultDay}
          </Button>
        </>
      ) : (
        <>
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value || day)}
            aria-label="capture date"
            className="border-input bg-background h-6 rounded-md border px-1.5 text-xs"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="clear date (dateless entry)"
            onClick={() => setDay('')}
          >
            <X className="size-3" />
          </Button>
        </>
      )}
    </span>
  );
}
