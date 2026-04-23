type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export function Pagination({ currentPage, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const pages = buildPages(safeCurrentPage, totalPages);
  const paginationClassName = ['glass-pagination', className].filter(Boolean).join(' ');

  return (
    <nav className={paginationClassName} aria-label="페이지 이동">
      <button
        className="glass-pagination__button"
        type="button"
        disabled={safeCurrentPage === 1}
        onClick={() => onPageChange(safeCurrentPage - 1)}
      >
        이전
      </button>

      <div className="glass-pagination__pages">
        {pages.map((page) => (
          <button
            key={page}
            className={`glass-pagination__button${page === safeCurrentPage ? ' is-active' : ''}`}
            type="button"
            onClick={() => onPageChange(page)}
          >
            {page}
          </button>
        ))}
      </div>

      <button
        className="glass-pagination__button"
        type="button"
        disabled={safeCurrentPage === totalPages}
        onClick={() => onPageChange(safeCurrentPage + 1)}
      >
        다음
      </button>
    </nav>
  );
}

function buildPages(currentPage: number, totalPages: number) {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  const adjustedStart = Math.max(1, end - 4);

  return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
}
