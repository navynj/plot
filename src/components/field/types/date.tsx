import { Input } from '@/components/ui/input';

import { registerFieldUI } from '../registry';

const format = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

registerFieldUI('date', {
  render: ({ value }) => (value instanceof Date ? format.format(value) : null),
  edit: ({ def, value }) => (
    <Input
      type="date"
      name={def.key}
      defaultValue={value instanceof Date ? value.toISOString().slice(0, 10) : undefined}
    />
  ),
});
