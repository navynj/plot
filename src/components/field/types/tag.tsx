import { Input } from '@/components/ui/input';

import { registerFieldUI } from '../registry';

// free multi-value label, edited as a comma-separated list this phase
registerFieldUI('tag', {
  render: ({ value }) => (typeof value === 'string' ? value : null),
  edit: ({ def, value }) => (
    <Input
      name={def.key}
      placeholder="tag, another tag"
      defaultValue={typeof value === 'string' ? value : undefined}
    />
  ),
});
