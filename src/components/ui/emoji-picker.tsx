'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// a quick-pick set of common glyphs; the text field covers anything else (on
// iOS it opens the native emoji keyboard — Apple's own icons)
const COMMON = [
  '💪', '🏃', '🚶', '🚴', '🏊', '🧗', '🧘', '🙏',
  '💧', '☕', '🥗', '🍎', '🥦', '💊', '😴', '🛌',
  '📖', '✍️', '💻', '🧠', '🎸', '🎨', '📷', '🎯',
  '🌱', '🧹', '🦷', '🚭', '📵', '☀️', '🌙', '✅',
  '💡', '💰', '🎬', '🎵', '⭐', '❤️', '🔥', '🏠',
];

export interface EmojiPickerProps {
  /** controlled value + change (habit editor, capture, header). */
  value?: string | null;
  onChange?: (emoji: string) => void;
  /** initial value for uncontrolled (form-only) use. */
  defaultValue?: string | null;
  /** form mode: emit a hidden input of this name so FormData.get(name) returns
   *  the emoji string, exactly like the plain text input it replaces. */
  name?: string;
  /** glyph shown (translucent) when empty — e.g. an inherited-icon preview. */
  placeholder?: string;
  /** trigger styling — pass a borderless/inline class to sit like a glyph, or a
   *  bordered class to read like a box. */
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

/** One shared emoji/icon picker for the whole app: a trigger showing the current
 *  glyph (or a translucent placeholder), opening a quick-pick grid plus a text
 *  field that takes any emoji (the device's native glyph — on iPhone, Apple's
 *  icons). Empty is allowed (no icon); the value is the raw emoji string, the
 *  same convention as `node.icon`. Works controlled (value/onChange) and/or in a
 *  form (name → hidden input). */
export function EmojiPicker({
  value,
  onChange,
  defaultValue,
  name,
  placeholder,
  className,
  disabled,
  'aria-label': ariaLabel = 'icon',
}: EmojiPickerProps) {
  const [open, setOpen] = React.useState(false);
  const controlled = value !== undefined;
  const [internal, setInternal] = React.useState(defaultValue ?? '');
  const current = (controlled ? (value ?? '') : internal) || '';

  const set = (emoji: string) => {
    if (!controlled) setInternal(emoji);
    onChange?.(emoji);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {name && <input type="hidden" name={name} value={current} />}
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            'inline-flex cursor-pointer items-center justify-center leading-none select-none disabled:cursor-not-allowed disabled:opacity-50',
            !current && 'text-muted-foreground/40',
            className
          )}
        >
          {current || placeholder || '🙂'}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <div className="grid grid-cols-8 gap-1">
          {COMMON.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                set(emoji);
                setOpen(false);
              }}
              className="hover:bg-muted flex size-7 items-center justify-center rounded text-lg"
              aria-label={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="mt-1 flex items-center gap-1">
          <Input
            value={current}
            onChange={(e) => set(e.target.value.slice(0, 8))}
            placeholder="or type any emoji…"
            aria-label="custom emoji"
          />
          {current && (
            <button
              type="button"
              onClick={() => set('')}
              className="text-muted-foreground hover:text-foreground shrink-0 px-1 text-xs"
            >
              clear
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
