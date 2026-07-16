import { registerFieldType } from '../fieldRegistry';

registerFieldType('checkbox', {
  valueColumn: 'boolValue',
  // an absent/empty checkbox is false, not unset — a form cannot say "unset"
  parse(raw) {
    return raw === true || raw === 'on' || raw === 'true';
  },
});
