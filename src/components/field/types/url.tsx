import { Input } from '@/components/ui/input';

import { registerFieldUI } from '../registry';

registerFieldUI('url', {
  render: ({ value }) =>
    typeof value === 'string' ? (
      <a href={value} className="underline" target="_blank" rel="noreferrer">
        {value}
      </a>
    ) : null,
  edit: ({ def, value }) => (
    <Input
      type="url"
      name={def.key}
      placeholder="https://…"
      defaultValue={typeof value === 'string' ? value : undefined}
    />
  ),
});
