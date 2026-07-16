import { capture } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** One text box, nothing else. Structure (category, fields) is deliberately
 *  absent — capture is raw by design (DESIGN §6-capture); triage comes later. */
export function CaptureForm() {
  return (
    <form action={capture} className="flex gap-2">
      <Input
        type="text"
        name="text"
        placeholder="Throw it in — organize later, or never"
        autoComplete="off"
      />
      <Button type="submit">Capture</Button>
    </form>
  );
}
