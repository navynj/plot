import { Input } from '@/components/ui/input';

import { registerFieldUI } from '../registry';

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

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
