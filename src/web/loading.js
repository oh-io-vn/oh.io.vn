// @ts-check
/** Shared, non-interactive placeholders for content that actually waits on APIs.
 * @param {'account' | 'hint' | 'links' | 'admin' | 'stats'} kind
 */
export function skeleton(kind) {
  const line = '<span class="skeleton skeleton-line"></span>';
  const short = '<span class="skeleton skeleton-line skeleton-short"></span>';
  const control = '<span class="skeleton skeleton-control"></span>';
  const row = `<div class="skeleton-row"><div>${short}${line}${short}</div><div class="skeleton-actions">${control}${control}</div></div>`;
  const content = {
    account: control,
    hint: short + line,
    links: row.repeat(3),
    admin: `<div class="admin-grid">${`<div class="panel">${short}${row.repeat(3)}</div>`.repeat(2)}</div>`,
    stats: `${short}<div class="skeleton skeleton-chart"></div><div class="stats-grid">${`<div>${short}${line.repeat(3)}</div>`.repeat(2)}</div>`,
  }[kind];
  return `<div class="loading-placeholder loading-${kind}" role="status"><span class="sr-only">Đang tải${kind === "links" ? " link" : ""}…</span><div aria-hidden="true">${content}</div></div>`;
}
