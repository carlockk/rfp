'use client';

export default function PaginationControls({
  page,
  pageSize = 10,
  total,
  onPageChange = () => {}
}) {
  if (!total || total <= pageSize) {
    return null;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(total, currentPage * pageSize);

  const handleChange = (nextPage) => {
    const safePage = Math.min(Math.max(nextPage, 1), totalPages);
    if (safePage !== currentPage) {
      onPageChange(safePage);
    }
  };

  const getVisiblePages = () => {
    const maxButtons = 5;
    const pages = [];
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }
    for (let value = startPage; value <= endPage; value += 1) {
      pages.push(value);
    }
    return pages;
  };

  return (
    <div className="pagination">
      <span className="pagination__summary">
        Mostrando {start}-{end} de {total}
      </span>
      <div className="pagination__controls" role="group" aria-label="Paginación">
        <button
          type="button"
          className="pagination__button"
          disabled={currentPage === 1}
          onClick={() => handleChange(currentPage - 1)}
        >
          Anterior
        </button>
        {getVisiblePages().map((value) => (
          <button
            key={value}
            type="button"
            className="pagination__button"
            aria-current={value === currentPage ? 'page' : undefined}
            style={
              value === currentPage
                ? {
                    background: 'var(--accent)',
                    borderColor: 'var(--accent)',
                    color: '#fff'
                  }
                : undefined
            }
            onClick={() => handleChange(value)}
          >
            {value}
          </button>
        ))}
        <button
          type="button"
          className="pagination__button"
          disabled={currentPage === totalPages}
          onClick={() => handleChange(currentPage + 1)}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
