import { capture } from '@/app/actions';

/** One text box, nothing else. Structure (category, fields) is deliberately
 *  absent — capture is raw by design (DESIGN §6-capture); triage comes later. */
export function CaptureForm() {
  return (
    <form action={capture} className="flex gap-2">
      <input
        type="text"
        name="text"
        placeholder="Throw it in — organize later, or never"
        autoComplete="off"
        className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
      />
      <button
        type="submit"
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
      >
        Capture
      </button>
    </form>
  );
}
