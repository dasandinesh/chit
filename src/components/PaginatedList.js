import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

// Keep filtering and totals in the parent; paginate only the displayed rows.
export default function PaginatedList({ items, children, label = "Records", resetKey = "", footerPagination = false }) {
  const [page, setPage] = useState(1);
  const [footerTarget, setFooterTarget] = useState(null);
  const [pageSize, setPageSize] = useState(10);
  const sizeId = useId();
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;

  useEffect(() => {
    setFooterTarget(footerPagination ? document.getElementById("pagination-footer") : null);
  }, [footerPagination]);

  useEffect(() => { setPage(1); }, [resetKey]);
  useEffect(() => { setPage(previous => Math.min(previous, pageCount)); }, [pageCount]);

  const pagination = (
      <nav className="list-pagination" aria-label={`${label} pagination`}>
        <div className="pagination-summary" aria-live="polite">
          {items.length ? `${start + 1}–${Math.min(start + pageSize, items.length)} of ${items.length}` : "No records"}
        </div>
        <div className="pagination-controls">
          <label htmlFor={sizeId}>Rows</label>
          <select id={sizeId} value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>
            {[10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
          </select>
          <button type="button" aria-label={`${label}: first page`} disabled={currentPage === 1} onClick={() => setPage(1)}>First</button>
          <button type="button" aria-label={`${label}: previous page`} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
          <span>Page {currentPage} of {pageCount}</span>
          <button type="button" aria-label={`${label}: next page`} disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
          <button type="button" aria-label={`${label}: last page`} disabled={currentPage === pageCount} onClick={() => setPage(pageCount)}>Last</button>
        </div>
      </nav>
  );

  return (
    <div className="paginated-list">
      {children(items.slice(start, start + pageSize), start)}
      {footerTarget ? createPortal(pagination, footerTarget) : pagination}
    </div>
  );
}
