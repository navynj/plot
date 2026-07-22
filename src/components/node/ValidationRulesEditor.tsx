'use client';

import { Plus, X } from 'lucide-react';

import { VALIDATION_OPS, type ValidationRule } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const OP_LABELS: Record<ValidationRule['op'], string> = {
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  eq: '=',
  neq: '≠',
};

const CONST = '__const__';

/** A field's declarative rules (DESIGN §5 bounded power): each compares this
 *  field to another field OR a constant, with a small op set. No free-form
 *  code — a picker over the bounded vocabulary. Empty operands never fire
 *  (§6-capture), so a rule is safe to declare even before values exist. */
export function ValidationRulesEditor({
  rules,
  siblings,
  onChange,
}: {
  rules: ValidationRule[];
  /** the other fields in this schema, offered as comparison targets */
  siblings: { key: string; label: string }[];
  onChange(rules: ValidationRule[]): void;
}) {
  const update = (i: number, rule: ValidationRule) =>
    onChange(rules.map((r, j) => (j === i ? rule : r)));
  const remove = (i: number) => onChange(rules.filter((_, j) => j !== i));
  const add = () =>
    onChange([
      ...rules,
      siblings[0] ? { op: 'gt', otherField: siblings[0].key } : { op: 'gte', value: 0 },
    ]);

  return (
    <div className="flex flex-col gap-1">
      {rules.map((rule, i) => {
        const targetIsConst = rule.otherField === undefined;
        return (
          <div key={i} className="flex items-center gap-1">
            <span className="text-muted-foreground/70 shrink-0">rule:</span>
            <Select value={rule.op} onValueChange={(op) => update(i, { ...rule, op: op as ValidationRule['op'] })}>
              <SelectTrigger size="sm" className="w-14">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VALIDATION_OPS.map((op) => (
                  <SelectItem key={op} value={op}>
                    {OP_LABELS[op]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={targetIsConst ? CONST : rule.otherField}
              onValueChange={(v) =>
                update(
                  i,
                  v === CONST
                    ? { op: rule.op, value: 0, ...(rule.message ? { message: rule.message } : {}) }
                    : { op: rule.op, otherField: v, ...(rule.message ? { message: rule.message } : {}) }
                )
              }
            >
              <SelectTrigger size="sm" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {siblings.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
                <SelectItem value={CONST}>a value…</SelectItem>
              </SelectContent>
            </Select>
            {targetIsConst && (
              <Input
                value={rule.value === undefined ? '' : String(rule.value)}
                onChange={(e) => update(i, { ...rule, value: coerce(e.target.value) })}
                aria-label="rule value"
                className="h-7 w-20 text-xs"
              />
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="remove rule"
              onClick={() => remove(i)}
            >
              <X className="size-3" />
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground/70 h-6 self-start px-1 text-xs"
        onClick={add}
      >
        <Plus className="size-3" /> rule
      </Button>
    </div>
  );
}

/** A constant is stored as a number when it reads as one, else a string
 *  (booleans go through the field's own type; this compact editor stays to the
 *  common numeric/text constant, e.g. amount ≥ 0). */
function coerce(raw: string): string | number {
  if (raw.trim() === '') return '';
  const n = Number(raw);
  return Number.isFinite(n) ? n : raw;
}
