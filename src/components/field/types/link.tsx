import { Input } from '@/components/ui/input';

import { registerFieldUI } from '../registry';

// minimal this phase: the target node id, entered as text; a real picker
// arrives with graph curation (Phase 4)
registerFieldUI('link', {
  render: ({ value }) => (typeof value === 'string' ? value : null),
  edit: ({ def, value }) => (
    <Input
      name={def.key}
      placeholder="node id"
      defaultValue={typeof value === 'string' ? value : undefined}
    />
  ),
});
