import { Input } from '@/components/ui/input';

import { registerFieldUI } from '../registry';

registerFieldUI('text', {
  render: ({ value }) => (typeof value === 'string' ? value : null),
  edit: ({ def, value }) => (
    <Input name={def.key} defaultValue={typeof value === 'string' ? value : undefined} />
  ),
});
