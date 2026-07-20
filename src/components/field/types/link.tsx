import { LinkFieldPicker } from '../LinkFieldPicker';
import { registerFieldUI } from '../registry';

// searchable picker scoped to children of the def's linkTargetParentId
// (unscoped when the def declares none); enforcement lives in service/field
registerFieldUI('link', {
  render: ({ value, display }) => (typeof value === 'string' ? (display ?? value) : null),
  edit: ({ def, value, display }) => (
    <LinkFieldPicker
      name={def.key}
      scopeParentId={def.linkTargetParentId ?? null}
      value={typeof value === 'string' ? value : undefined}
      display={display}
    />
  ),
});
