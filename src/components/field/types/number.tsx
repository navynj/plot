import { Input } from '@/components/ui/input';

import { registerFieldUI } from '../registry';

const format = new Intl.NumberFormat();

registerFieldUI('number', {
  render: ({ value }) => (typeof value === 'number' ? format.format(value) : null),
  edit: ({ def, value }) => (
    <Input
      type="number"
      step="any"
      name={def.key}
      defaultValue={typeof value === 'number' ? value : undefined}
    />
  ),
});
