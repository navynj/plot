'use client';

import { BarChart3, Loader2, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';

import { saveViewSpecAction } from '@/app/node/[id]/actions';
import { usePendingLock } from '@/components/hooks/usePendingLock';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { VIEW_LAYOUTS, type FieldDef, type ViewFilter, type ViewLayout, type ViewSpec } from '@/db/schema';

/**
 * The view editor (A') — retires the dev JSON textarea. The spec is BOUNDED
 * (DESIGN §5 bounded-power principle): lens + groupBy + layout + sort + filter
 * (+ overlayOwnField). This is a FORM over those fields, not a builder.
 *
 * BOUNDED-POWER GUARD — honor it or the Add-view monster comes back:
 *   Add ZERO options beyond the ViewSpec fields. NO color, size, spacing,
 *   arrangement, axis, or pixel controls — EVER. If a layout looks wrong, the
 *   fix is a better preset default in its layout renderer, NOT a knob here.
 *   Every choice below is a value the spec already carries; the app owns all
 *   visual composition. This sheet is built on that monster's grave; keep it
 *   dead.
 *
 * Candidates are derived from the node's childSchema (the schema its children
 * wear) so you can only pick fields that exist — an invalid lens/groupBy is
 * unreachable, not just rejected. Meta axes (eventDate / capturedAt) are
 * always available. The current spec's own keys are preserved as options even
 * if they aren't in childSchema (e.g. a graph-aggregation node).
 */

// aggregation-supported ops only (the engine rejects in/between) — offering
// them would let the sheet build a spec that saves but can't render
const FILTER_OP_OPTIONS: ViewFilter['op'][] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'];
const NUMBER_TYPES = new Set(['number', 'duration']);
const GROUP_TYPES = new Set(['link', 'option']);
const META = [
  { key: 'eventDate', label: 'Event date' },
  { key: 'capturedAt', label: 'Captured at' },
];
const NONE = '__none__';

interface Candidate {
  key: string;
  label: string;
}

export function ViewSpecEditor({
  nodeId,
  viewSpec,
  childSchema,
}: {
  nodeId: string;
  viewSpec: ViewSpec | null;
  childSchema: FieldDef[];
}) {
  const numberFields = React.useMemo(
    () => childSchema.filter((d) => NUMBER_TYPES.has(d.type)),
    [childSchema]
  );
  const groupFields = React.useMemo(
    () => childSchema.filter((d) => GROUP_TYPES.has(d.type)),
    [childSchema]
  );

  // candidate lists (deduped; current spec keys preserved)
  const lensOptions = React.useMemo<Candidate[]>(() => {
    const opts = [...numberFields.map((f) => ({ key: f.key, label: f.label })), ...META];
    if (viewSpec && !opts.some((o) => o.key === viewSpec.lens)) {
      opts.unshift({ key: viewSpec.lens, label: viewSpec.lens });
    }
    return opts;
  }, [numberFields, viewSpec]);
  const groupOptions = React.useMemo<Candidate[]>(
    () => [
      ...groupFields.map((f) => ({ key: f.key, label: f.label })),
      { key: 'eventDate', label: 'Event date (by day)' },
      { key: 'capturedAt', label: 'Captured (by day)' },
    ],
    [groupFields]
  );
  const overlayOptions = React.useMemo<Candidate[]>(
    () => numberFields.map((f) => ({ key: f.key, label: f.label })),
    [numberFields]
  );

  const defaults = React.useCallback(
    (): FormState => ({
      layout: numberFields[0] ? 'bar' : 'list',
      lens: numberFields[0]?.key ?? 'eventDate',
      groupBy: numberFields[0] ? (groupFields[0]?.key ?? '') : '',
      aggregate: '',
      sortBy: '',
      sortDir: 'asc',
      overlayOwnField: '',
      filters: [],
    }),
    [numberFields, groupFields]
  );

  const fromSpec = React.useCallback(
    (spec: ViewSpec | null): FormState =>
      spec
        ? {
            layout: spec.layout,
            lens: spec.lens,
            groupBy: spec.groupBy ?? '',
            aggregate: spec.aggregate ?? '',
            sortBy: spec.sort?.by ?? '',
            sortDir: spec.sort?.dir ?? 'asc',
            overlayOwnField: spec.overlayOwnField ?? '',
            filters: (spec.filter ?? []).map((f) => ({
              key: f.key,
              op: f.op,
              value: f.value === null || f.value === undefined ? '' : String(f.value),
            })),
          }
        : defaults(),
    [defaults]
  );

  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(() => fromSpec(viewSpec));
  const [error, setError] = React.useState<string | null>(null);
  const { pending, run } = usePendingLock();

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const build = (): ViewSpec => {
    const spec: ViewSpec = { lens: form.lens, layout: form.layout };
    if (form.groupBy) spec.groupBy = form.groupBy;
    if (form.aggregate) spec.aggregate = form.aggregate as ViewSpec['aggregate'];
    if (form.sortBy) spec.sort = { by: form.sortBy, dir: form.sortDir };
    if (form.overlayOwnField) spec.overlayOwnField = form.overlayOwnField;
    const filters = form.filters
      .filter((r) => r.key)
      .map((r): ViewFilter => ({ key: r.key, op: r.op, value: typedValue(r) }));
    if (filters.length) spec.filter = filters;
    return spec;
  };

  const save = (spec: ViewSpec | null) =>
    run('save', async () => {
      const result = await saveViewSpecAction(nodeId, spec);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setOpen(false);
    });

  // the filter value's JS type follows the chosen field's type, so a §8a
  // boolean filter (scheduled = false) is a real boolean, not "false"
  const typedValue = (r: FilterRow): boolean | number | string => {
    const def = childSchema.find((d) => d.key === r.key);
    if (def && (def.type === 'boolean' || def.type === 'checkbox')) return r.value === 'true';
    if (def && NUMBER_TYPES.has(def.type)) return Number(r.value);
    return r.value;
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setForm(fromSpec(viewSpec)); // re-sync with server state on open
          setError(null);
        }
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="text-muted-foreground">
          <BarChart3 className="size-3.5" />
          {viewSpec ? 'Edit view' : 'Add view'}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{viewSpec ? 'Edit view' : 'Add view'}</SheetTitle>
          <SheetDescription>
            Pick a lens and a layout preset. Views give freedom in what you gather and through
            which lens — the app owns all visual composition (no pixel controls, by design).
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          {/* LAYOUT — a segmented control over the six presets */}
          <Field label="Layout">
            <div className="flex flex-wrap gap-1">
              {VIEW_LAYOUTS.map((l) => (
                <Button
                  key={l}
                  type="button"
                  size="sm"
                  variant={form.layout === l ? 'default' : 'outline'}
                  onClick={() => set('layout', l)}
                >
                  {l}
                </Button>
              ))}
            </div>
          </Field>

          {/* LENS — number fields + meta axes */}
          <Field label="Lens">
            <PickSelect
              value={form.lens}
              onChange={(v) => set('lens', v)}
              options={lensOptions}
              ariaLabel="lens"
            />
          </Field>

          {/* GROUP BY — link/option fields + date meta (optional) */}
          <Field label="Group by">
            <PickSelect
              value={form.groupBy || NONE}
              onChange={(v) => set('groupBy', v === NONE ? '' : v)}
              options={[{ key: NONE, label: '(none)' }, ...groupOptions]}
              ariaLabel="group by"
            />
          </Field>

          {/* ADVANCED — sort / filter / overlay */}
          <details className="border-border rounded-md border px-3 py-2">
            <summary className="text-muted-foreground cursor-pointer text-xs select-none">
              Advanced (sort · filter · overlay)
            </summary>
            <div className="mt-3 flex flex-col gap-4">
              <Field label="Aggregate">
                <PickSelect
                  value={form.aggregate || NONE}
                  onChange={(v) => set('aggregate', v === NONE ? '' : v)}
                  options={[
                    { key: NONE, label: 'default (sum)' },
                    { key: 'sum', label: 'sum' },
                    { key: 'avg', label: 'avg' },
                    { key: 'count', label: 'count' },
                  ]}
                  ariaLabel="aggregate"
                />
              </Field>

              <Field label="Sort by">
                <div className="flex gap-2">
                  <PickSelect
                    value={form.sortBy || NONE}
                    onChange={(v) => set('sortBy', v === NONE ? '' : v)}
                    options={[{ key: NONE, label: '(default)' }, ...lensOptions, ...groupOptions]}
                    ariaLabel="sort by"
                  />
                  {form.sortBy && (
                    <PickSelect
                      value={form.sortDir}
                      onChange={(v) => set('sortDir', v as 'asc' | 'desc')}
                      options={[
                        { key: 'asc', label: 'asc' },
                        { key: 'desc', label: 'desc' },
                      ]}
                      ariaLabel="sort direction"
                    />
                  )}
                </div>
              </Field>

              <Field label="Overlay own field">
                <PickSelect
                  value={form.overlayOwnField || NONE}
                  onChange={(v) => set('overlayOwnField', v === NONE ? '' : v)}
                  options={[{ key: NONE, label: '(none)' }, ...overlayOptions]}
                  ariaLabel="overlay own field"
                />
              </Field>

              <Field label="Filter">
                <div className="flex flex-col gap-2">
                  {form.filters.map((r, i) => {
                    const def = childSchema.find((d) => d.key === r.key);
                    const isBool = def && (def.type === 'boolean' || def.type === 'checkbox');
                    return (
                      <div key={i} className="flex items-center gap-1">
                        <PickSelect
                          value={r.key || NONE}
                          onChange={(v) => updateFilter(setForm, i, { key: v === NONE ? '' : v })}
                          options={[
                            { key: NONE, label: 'field…' },
                            ...childSchema.map((d) => ({ key: d.key, label: d.label })),
                          ]}
                          ariaLabel={`filter ${i} field`}
                        />
                        <PickSelect
                          value={r.op}
                          onChange={(v) =>
                            updateFilter(setForm, i, { op: v as ViewFilter['op'] })
                          }
                          options={FILTER_OP_OPTIONS.map((op) => ({ key: op, label: op }))}
                          ariaLabel={`filter ${i} op`}
                        />
                        {isBool ? (
                          <PickSelect
                            value={r.value || 'false'}
                            onChange={(v) => updateFilter(setForm, i, { value: v })}
                            options={[
                              { key: 'true', label: 'true' },
                              { key: 'false', label: 'false' },
                            ]}
                            ariaLabel={`filter ${i} value`}
                          />
                        ) : (
                          <Input
                            value={r.value}
                            onChange={(e) => updateFilter(setForm, i, { value: e.target.value })}
                            placeholder="value"
                            aria-label={`filter ${i} value`}
                            className="h-8 w-24"
                          />
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`remove filter ${i}`}
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              filters: f.filters.filter((_, j) => j !== i),
                            }))
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() =>
                      setForm((f) => ({ ...f, filters: [...f.filters, { key: '', op: 'eq', value: '' }] }))
                    }
                  >
                    <Plus className="size-3.5" /> Add filter
                  </Button>
                </div>
              </Field>
            </div>
          </details>

          {error && <p className="text-destructive text-xs">blocked: {error}</p>}
        </div>

        <SheetFooter className="flex-row gap-2">
          <Button disabled={pending} onClick={() => save(build())}>
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            Save
          </Button>
          {viewSpec && (
            <Button
              variant="ghost"
              className="text-muted-foreground"
              disabled={pending}
              onClick={() => save(null)}
            >
              Remove view
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

interface FilterRow {
  key: string;
  op: ViewFilter['op'];
  value: string;
}
interface FormState {
  layout: ViewLayout;
  lens: string;
  groupBy: string;
  aggregate: string;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  overlayOwnField: string;
  filters: FilterRow[];
}

function updateFilter(
  setForm: React.Dispatch<React.SetStateAction<FormState>>,
  index: number,
  patch: Partial<FilterRow>
) {
  setForm((f) => ({
    ...f,
    filters: f.filters.map((r, j) => (j === index ? { ...r, ...patch } : r)),
  }));
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {children}
    </div>
  );
}

function PickSelect({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Candidate[];
  ariaLabel: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="w-auto min-w-28" aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.key} value={o.key}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
