'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// a quick-pick set of common habit glyphs; the text field below covers anything
// else (on iOS it opens the native emoji keyboard — Apple's own icons)
const COMMON = [
  '💪', '🏃', '🚶', '🚴', '🏊', '🧗', '🧘', '🙏',
  '💧', '☕', '🥗', '🍎', '🥦', '💊', '😴', '🛌',
  '📖', '✍️', '💻', '🧠', '🎸', '🎨', '📷', '🎯',
  '🌱', '🧹', '🦷', '🚭', '📵', '☀️', '🌙', '✅',
];

/** Emoji picker for a habit icon (NOT lucide — the user wants device-native
 *  glyphs, which on iPhone are Apple's own icons). A quick-pick grid plus a
 *  free text field that opens the native emoji keyboard. Stores the emoji
 *  string, exactly like `node.icon`. Leaf client component. */
export function EmojiPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange(emoji: string): void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 text-lg"
          aria-label="habit icon"
        >
          {value || '🙂'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <div className="grid grid-cols-8 gap-1">
          {COMMON.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onChange(emoji);
                setOpen(false);
              }}
              className="hover:bg-muted flex size-7 items-center justify-center rounded text-lg"
              aria-label={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
        <Input
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value.slice(0, 8))}
          placeholder="or type any emoji…"
          aria-label="custom emoji"
          className="mt-1"
        />
      </PopoverContent>
    </Popover>
  );
}
