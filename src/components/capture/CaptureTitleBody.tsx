'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/** True for the Enter that only confirms an IME candidate (Korean/Japanese
 *  composition), which must never submit or insert a newline. */
function isComposingEnter(e: React.KeyboardEvent): boolean {
  return e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229);
}

interface CaptureTitleBodyProps {
  icon: string;
  onIconChange: (v: string) => void;
  /** the resolved parent icon, shown translucent as a placeholder — a preview
   *  of "leave blank and this inherits". Empty when no parent. */
  iconPlaceholder?: string;
  title: string;
  onTitleChange: (v: string) => void;
  titlePlaceholder: string;
  body: string;
  onBodyChange: (v: string) => void;
}

/**
 * B1 capture body: a leading emoji slot + a title input + an auto-growing body
 * textarea. ONE key grammar across all three, IME-safe:
 *   Enter always submits; Shift+Enter inserts a newline in the body; Shift+
 *   Enter in the title drops focus to the body. The Enter that confirms an IME
 *   candidate never submits (isComposing / legacy keyCode 229).
 * The textarea grows from one line with content and never shows a scrollbar.
 */
export function CaptureTitleBody({
  icon,
  onIconChange,
  iconPlaceholder,
  title,
  onTitleChange,
  titlePlaceholder,
  body,
  onBodyChange,
}: CaptureTitleBodyProps) {
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  // auto-grow: start one line, grow with content, no scrollbar
  React.useLayoutEffect(() => {
    const ta = bodyRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [body]);

  const submit = (e: React.KeyboardEvent) => e.currentTarget.closest('form')?.requestSubmit();

  const onTitleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    if (isComposingEnter(e)) {
      e.preventDefault(); // composition-confirm, not a submit
      return;
    }
    if (e.shiftKey) {
      e.preventDefault(); // "drop to next line" = move to the body
      bodyRef.current?.focus();
    }
    // plain Enter: let the input submit the form naturally
  };

  const onEmojiKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isComposingEnter(e)) e.preventDefault();
  };

  const onBodyKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return;
    if (isComposingEnter(e)) return; // let the IME confirm; never submit
    if (e.shiftKey) return; // newline (textarea default)
    e.preventDefault(); // plain Enter submits (textareas would otherwise newline)
    submit(e);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Input
          name="icon"
          value={icon}
          onChange={(e) => onIconChange(e.target.value)}
          onKeyDown={onEmojiKey}
          placeholder={iconPlaceholder}
          aria-label="icon"
          autoComplete="off"
          className={cn(
            'w-11 shrink-0 text-center',
            // the placeholder (inherited parent icon) reads as a translucent preview
            iconPlaceholder && !icon && 'placeholder:opacity-40'
          )}
        />
        <Input
          name="title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={onTitleKey}
          placeholder={titlePlaceholder}
          aria-label="title"
          autoComplete="off"
          className="flex-1"
        />
      </div>
      <Textarea
        ref={bodyRef}
        name="body"
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        onKeyDown={onBodyKey}
        placeholder="Details"
        aria-label="body"
        rows={1}
        className="min-h-0 resize-none overflow-hidden"
      />
    </div>
  );
}
