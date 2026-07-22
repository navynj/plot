import { ComputedFieldEdit } from '../ComputedFieldEdit';
import { registerFieldUI } from '../registry';

import { formatDuration } from './duration';

registerFieldUI('computed', {
  // a computed value is a duration — render it exactly like one
  render: ({ value }) => (typeof value === 'number' ? formatDuration(value) : null),
  // computed by default, manual only when a source is empty (see ComputedFieldEdit)
  edit: ({ def, value }) => <ComputedFieldEdit def={def} value={value} />,
});
