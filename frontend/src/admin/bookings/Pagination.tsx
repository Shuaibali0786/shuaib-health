import { ChevronLeft, ChevronRight } from "lucide-react";

/** "Showing 1–20 of 55 bookings" and the page buttons (at most five numbers around the current page). */
export function Pagination({ page, total, pageSize, onPage, noun = "bookings" }: { page: number; total: number; pageSize: number; onPage: (page: number) => void; noun?: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, index) => start + index);
  return (
    <div className="table-foot">
      <span data-testid="page-count">{total === 0 ? `No ${noun}` : `Showing ${first}–${last} of ${total} ${noun}`}</span>
      {pages > 1 ? (
        <nav className="pager" aria-label="Pages">
          <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <ChevronLeft className="i i-sm" aria-hidden="true" />
          </button>
          {numbers.map((number) => (
            <button key={number} type="button" aria-label={`Page ${number}`} aria-current={number === page ? "page" : undefined} onClick={() => onPage(number)}>
              {number}
            </button>
          ))}
          <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}>
            <ChevronRight className="i i-sm" aria-hidden="true" />
          </button>
        </nav>
      ) : null}
    </div>
  );
}
