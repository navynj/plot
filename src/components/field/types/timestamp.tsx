import { Input } from '@/components/ui/input';
import { formatTimestamp } from '@/lib/formatTimestamp';

import { registerFieldUI } from '../registry';

registerFieldUI('timestamp', {
  render: ({ value }) => (value instanceof Date ? formatTimestamp(value) : null),
  edit: ({ def, value }) => (
    <Input
      type="datetime-local"
      name={def.key}
      defaultValue={value instanceof Date ? value.toISOString().slice(0, 16) : undefined}
    />
  ),
});
