import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { registerFieldUI } from '../registry';

registerFieldUI('option', {
  render: ({ value }) => (typeof value === 'string' ? value : null),
  edit: ({ def, value }) => (
    <Select name={def.key} defaultValue={typeof value === 'string' ? value : undefined}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {(def.options ?? []).map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
});
