/**
 * One pagination vocabulary for every record list in the app.
 *
 * <p>The lists page in the browser: the whole list arrives in a single call, the
 * search and the filters run over every record, and only the visible page is
 * rendered. Keeping the default size and the offered sizes here means no screen
 * can drift away from the others.</p>
 */

/** Records on the first page of any list. */
export const DEFAULT_PAGE_SIZE = 5;

/** What the pager's own dropdown offers, smallest first. */
export const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

/** The rows the current page renders, for the size picked in the dropdown. */
export function pageSlice<T>(rows: T[], pageIndex: number, pageSize: number): T[] {
  const start = Math.max(0, pageIndex) * pageSize;
  return rows.slice(start, start + pageSize);
}

/** First record number on the page, 1-based; 0 when there is nothing to show. */
export function rangeStartOf(total: number, pageIndex: number, pageSize: number): number {
  return total ? Math.min(total, Math.max(0, pageIndex) * pageSize + 1) : 0;
}

/** Last record number on the page. */
export function rangeEndOf(total: number, pageIndex: number, pageSize: number): number {
  return Math.min((Math.max(0, pageIndex) + 1) * pageSize, total);
}

/**
 * The last page a list of `total` records has. A reload can remove rows, so every
 * screen clamps its page index to this instead of sitting past the last page.
 */
export function lastPageOf(total: number, pageSize: number): number {
  return Math.max(0, Math.ceil(total / pageSize) - 1);
}
