'use client';

import * as React from 'react';

import { EmojiPicker } from '@/components/ui/emoji-picker';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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
 * textarea. Key grammar, IME-safe:
 *   - Title: plain Enter submits the form (native input behavior); Shift+Enter
 *     drops focus to the body. The Enter that confirms an IME candidate never
 *     submits (isComposing / legacy keyCode 229).
 *   - Body: Enter inserts a NEWLINE (native textarea behavior) — it never
 *     submits. Submission is the Capture / "Add here" button only.
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

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {/* leading emoji slot: the shared picker in form mode (name="icon") +
            controlled so the parent's reset-after-submit still clears it. The
            inherited parent icon shows as the translucent placeholder. */}
        <EmojiPicker
          name="icon"
          value={icon}
          onChange={onIconChange}
          placeholder={iconPlaceholder}
          aria-label="icon"
          className="border-input bg-background h-8 w-11 shrink-0 rounded-lg border text-center text-base"
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
      {/* the body is the QUIET secondary area: no border, no focus ring, no
          background shift — it flows beneath the (bordered, primary) title so
          title-only captures feel complete and the body never pressures */}
      {/* Enter here inserts a newline (native textarea) — never submits; the
          IME confirm-Enter is handled natively too. Submit is the button. */}
      <Textarea
        ref={bodyRef}
        name="body"
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        placeholder="Details"
        aria-label="body"
        rows={1}
        className="min-h-0 resize-none overflow-hidden border-0 bg-transparent px-1 shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
      />
    </div>
  );
}
