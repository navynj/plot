import { OptionFieldPicker } from '../OptionFieldPicker';
import { registerFieldUI } from '../registry';

registerFieldUI('option', {
  render: ({ value }) => (typeof value === 'string' ? value : null),
  // B1: the search + create-in-place picker (was a plain Select). A typed
  // value not in the list can be added to the parent's childSchema inline.
  edit: ({ def, value, schemaOwnerId }) => (
    <OptionFieldPicker
      name={def.key}
      value={typeof value === 'string' ? value : undefined}
      options={def.options ?? []}
      fieldKey={def.key}
      schemaOwnerId={schemaOwnerId}
    />
  ),
});
