import { Checkbox } from '@/components/ui/checkbox';

import { registerFieldUI } from '../registry';

registerFieldUI('checkbox', {
  render: ({ value }) => (value === true ? '✓' : '—'),
  edit: ({ def, value }) => <Checkbox name={def.key} defaultChecked={value === true} />,
});
