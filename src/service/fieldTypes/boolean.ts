import { registerFieldType } from '../fieldRegistry';

registerFieldType('boolean', {
  valueColumn: 'boolValue',
  parse(raw) {
    return raw === true || raw === 'on' || raw === 'true';
  },
});
