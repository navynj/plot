'use client';

import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';

interface SubmitButtonProps extends React.ComponentProps<typeof Button> {
  /** icon-only buttons swap their icon for the spinner (same footprint);
   *  labeled buttons keep the label visible beside it */
  iconOnly?: boolean;
}

/**
 * The submit button for every mutating form: reads useFormStatus().pending →
 * disabled + spinner beside the label (no layout collapse). Also blocks
 * RE-SUBMISSION at the form level while pending — a disabled button does not
 * reliably stop Enter's implicit submission (and multi-button forms never
 * stop it), so a submit listener preventDefaults in-flight repeats. Inputs
 * stay editable; only submission is gated. When the action settles (success
 * OR throw), pending clears and the button re-enables.
 */
export function SubmitButton({ iconOnly, children, disabled, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const ref = React.useRef<HTMLButtonElement>(null);
  const pendingRef = React.useRef(pending);
  React.useEffect(() => {
    pendingRef.current = pending;
  });
  React.useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const block = (e: Event) => {
      if (pendingRef.current) e.preventDefault();
    };
    form.addEventListener('submit', block);
    return () => form.removeEventListener('submit', block);
  }, []);

  return (
    <Button ref={ref} type="submit" disabled={pending || disabled} {...props}>
      {pending && iconOnly ? (
        <Loader2 className="animate-spin" />
      ) : (
        <>
          {pending && <Loader2 className="animate-spin" />}
          {children}
        </>
      )}
    </Button>
  );
}
