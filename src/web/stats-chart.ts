/** Match the API's 30 calendar days, starting on its Vietnam-date `since`. */
export function dailySeries(
  rows: { day: string; clicks: number }[],
  since: string,
): [string, number][] {
  const counts = new Map<string, number>();
  for (const row of rows)
    counts.set(row.day, (counts.get(row.day) ?? 0) + row.clicks);

  // UTC arithmetic on date-only strings avoids the viewer's timezone and DST.
  const start = Date.parse(`${since}T00:00:00Z`);
  return Array.from({ length: 30 }, (_, index) => {
    const day = new Date(start + index * 86400000).toISOString().slice(0, 10);
    return [day, counts.get(day) ?? 0];
  });
}
