import { Input } from '@/components/ui/input';
import { formatDuration } from '@/lib/formatDuration';

import { registerFieldUI } from '../registry';

// re-exported for existing importers (the duration/computed UI + tests)
export { formatDuration };

registerFieldUI('duration', {
  render: ({ value }) => (typeof value === 'number' ? formatDuration(value) : null),
  edit: ({ def, value }) => (
    <Input
      name={def.key}
      placeholder="HH:MM or minutes"
      defaultValue={
        typeof value === 'number'
          ? `${Math.floor(value / 60)}:${String(Math.round(value % 60)).padStart(2, '0')}`
          : undefined
      }
    />
  ),
});
