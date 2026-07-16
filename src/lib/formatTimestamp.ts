const formatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatTimestamp(date: Date): string {
  return formatter.format(date);
}
