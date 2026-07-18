import { formatValue } from '../format';
import { registerLayout } from '../registry';

/** Date-keyed cells, weekday-aligned per month present in the data. Cells
 *  carry the day number and value in text ink; empty days stay recessive. */
registerLayout('calendar', ({ view }) => {
  if (view.kind !== 'aggregate') return null;
  const dated = view.buckets.filter((b) => /^\d{4}-\d{2}-\d{2}/.test(b.label));
  if (dated.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm">No date-keyed data to place.</p>;
  }
  const byDay = new Map(dated.map((b) => [b.label.slice(0, 10), b]));
  const months = [...new Set(dated.map((b) => b.label.slice(0, 7)))].sort();

  return (
    <div className="flex flex-col gap-4">
      {months.map((month) => {
        const [yearStr, monthStr] = month.split('-');
        const year = Number(yearStr);
        const monthIndex = Number(monthStr) - 1;
        const first = new Date(Date.UTC(year, monthIndex, 1));
        const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
        const lead = first.getUTCDay();
        return (
          <div key={month}>
            <p className="text-muted-foreground mb-1 text-xs font-medium">{month}</p>
            <div className="grid grid-cols-7 gap-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <span key={i} className="text-muted-foreground text-center text-[10px]">
                  {d}
                </span>
              ))}
              {Array.from({ length: lead }, (_, i) => (
                <span key={`lead-${i}`} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const day = `${month}-${String(i + 1).padStart(2, '0')}`;
                const bucket = byDay.get(day);
                return (
                  <div
                    key={day}
                    title={bucket ? `${day}: ${formatValue(bucket.value)}` : day}
                    className={`flex aspect-square flex-col items-center justify-center rounded-sm text-[10px] ${
                      bucket ? 'bg-muted font-medium' : 'text-muted-foreground/50'
                    }`}
                  >
                    <span>{i + 1}</span>
                    {bucket && <span className="tabular-nums">{formatValue(bucket.value)}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
});
