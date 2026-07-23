import { MultiOptionPicker } from '../MultiOptionPicker';
import { OptionFieldPicker } from '../OptionFieldPicker';
import { registerFieldUI } from '../registry';

registerFieldUI('option', {
  // multiple → the values as small chips; single → the value
  render: ({ def, value }) => {
    if (typeof value !== 'string' || value === '') return null;
    if (!def.multiple) return value;
    return (
      <span className="flex flex-wrap gap-1">
        {value
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
          .map((v) => (
            <span key={v} className="bg-muted rounded-full px-2 py-0.5 text-xs">
              {v}
            </span>
          ))}
      </span>
    );
  },
  // B1: the search + create-in-place picker (was a plain Select). A typed
  // value not in the list can be added to the parent's childSchema inline.
  // def.multiple → a toggleable-chip multi-select instead.
  edit: ({ def, value, schemaOwnerId }) =>
    def.multiple ? (
      <MultiOptionPicker
        name={def.key}
        value={typeof value === 'string' ? value : undefined}
        options={def.options ?? []}
        fieldKey={def.key}
        schemaOwnerId={schemaOwnerId}
      />
    ) : (
      <OptionFieldPicker
        name={def.key}
        value={typeof value === 'string' ? value : undefined}
        options={def.options ?? []}
        fieldKey={def.key}
        schemaOwnerId={schemaOwnerId}
      />
    ),
});
