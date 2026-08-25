"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export type FilterColumn = {
  key: string;
  header: string;
  filter?: boolean;
  hrefKey?: string;
  className?: string;
};

function FilterIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 5h16l-6.5 8v5l-3 1.5v-6.5L4 5z" className={active ? "fill-current" : ""} />
    </svg>
  );
}

export function FilterableTable({
  columns,
  rows,
  rowKey = "id",
  empty = "No rows to show.",
  minWidthClass = "min-w-[36rem]",
  pageSize = 10,
  showColumnFilters = true,
  searchPlaceholder,
}: {
  columns: FilterColumn[];
  rows: Array<Record<string, string>>;
  rowKey?: string;
  empty?: string;
  minWidthClass?: string;
  pageSize?: number;
  showColumnFilters?: boolean;
  searchPlaceholder?: string;
}) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const visibleRows = useMemo(() => {
    const tokens = search
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return rows.filter((row) => {
      const matchesColumns = columns.every((column) => {
        if (column.filter === false) return true;
        const query = filters[column.key]?.trim().toLowerCase() ?? "";
        if (!query) return true;
        return (row[column.key] ?? "").toLowerCase().includes(query);
      });
      if (!matchesColumns) return false;
      if (tokens.length === 0) return true;
      const haystack = columns
        .filter((column) => column.filter !== false)
        .map((column) => (row[column.key] ?? "").toLowerCase())
        .join(" ");
      return tokens.every((token) => haystack.includes(token));
    });
  }, [columns, filters, rows, search]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));

  const rowIds = useMemo(() => rows.map((row) => row[rowKey] ?? "").join("|"), [rows, rowKey]);

  useEffect(() => {
    setPage(1);
  }, [rowIds, filters, pageSize, search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const from = visibleRows.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, visibleRows.length);
  const pageRows = visibleRows.slice((page - 1) * pageSize, page * pageSize);

  const hasActiveFilters = columns.some(
    (column) => column.filter !== false && Boolean(filters[column.key]?.trim()),
  );

  const pageButtons = useMemo(() => {
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    const items: number[] = [];
    for (let i = start; i <= end; i++) items.push(i);
    return items;
  }, [page, totalPages]);

  return (
    <div className="med-card overflow-hidden">
      {showColumnFilters || searchPlaceholder ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border px-3 py-2">
          {searchPlaceholder ? (
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              className="mr-auto h-10 w-full max-w-md rounded-lg border border-border px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
            />
          ) : null}
          {showColumnFilters ? (
            <button
              type="button"
              aria-label={filtersOpen ? "Hide filters" : "Show filters"}
              aria-pressed={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${
                filtersOpen || hasActiveFilters
                  ? "bg-primary-light text-primary-dark"
                  : "text-text-secondary hover:bg-app-bg hover:text-text-primary"
              }`}
            >
              <FilterIcon active={hasActiveFilters} />
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className={`med-table w-full ${minWidthClass} text-left`}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.header}</th>
              ))}
            </tr>
            {showColumnFilters && filtersOpen ? (
              <tr>
                {columns.map((column) => (
                  <th key={`${column.key}-filter`} className="!h-auto !pb-2 !font-normal">
                    {column.filter === false ? null : (
                      <input
                        value={filters[column.key] ?? ""}
                        onChange={(event) =>
                          setFilters((current) => ({ ...current, [column.key]: event.target.value }))
                        }
                        placeholder={`Filter ${column.header}`}
                        className="h-8 w-full min-w-[5.5rem] rounded-md border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-primary"
                      />
                    )}
                  </th>
                ))}
              </tr>
            ) : null}
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td className="!h-auto py-8 text-text-secondary" colSpan={columns.length}>
                  {rows.length === 0 ? empty : "No rows match the current filters."}
                </td>
              </tr>
            ) : (
              pageRows.map((row, index) => (
                <tr key={row[rowKey] || String(index)}>
                  {columns.map((column) => {
                    const href = column.hrefKey ? row[column.hrefKey] : "";
                    const value = row[column.key] ?? "";
                    return (
                      <td key={column.key} className={column.className ?? ""}>
                        {href ? (
                          <Link className="font-medium text-primary hover:underline" href={href}>
                            {value}
                          </Link>
                        ) : (
                          value
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-text-secondary">
          {visibleRows.length === 0
            ? "No records"
            : `Showing ${from}–${to} of ${visibleRows.length}`}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            className="h-9 rounded-lg border border-border px-3 text-xs font-medium text-text-primary disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          {pageButtons.map((item) => (
            <button
              key={item}
              type="button"
              className={`h-9 min-w-8 rounded-lg px-2 text-xs font-medium ${
                item === page
                  ? "bg-primary text-white"
                  : "border border-border text-text-primary hover:bg-app-bg"
              }`}
              onClick={() => setPage(item)}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            className="h-9 rounded-lg border border-border px-3 text-xs font-medium text-text-primary disabled:opacity-40"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
