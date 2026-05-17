"use client";

type PaginationProps = {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  loading?: boolean;
};

export function Pagination({
  page,
  totalPages,
  onPage,
  loading = false,
}: PaginationProps) {
  return (
    <div className="border-sand-200 flex items-center justify-between border-t px-5 py-3">
      <p className="text-petroleum-400 text-sm">
        Page {page + 1} of {totalPages}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onPage(Math.max(0, page - 1))}
          disabled={page === 0 || loading}
          className="border-sand-200 text-petroleum-500 hover:bg-sand-50 rounded-xl border px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <button
          onClick={() => onPage(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1 || loading}
          className="border-sand-200 text-petroleum-500 hover:bg-sand-50 rounded-xl border px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
