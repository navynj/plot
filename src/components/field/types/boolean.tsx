import { Checkbox } from '@/components/ui/checkbox';

import { registerFieldUI } from '../registry';

registerFieldUI('boolean', {
  render: ({ value }) => (value === true ? 'true' : 'false'),
  edit: ({ def, value }) => <Checkbox name={def.key} defaultChecked={value === true} />,
});
