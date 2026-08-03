import {
  memo,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState, TableSkeleton } from "./states";

export interface DataColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => string | number | null | undefined;
  className?: string;
  headerClassName?: string;
  /** Minimum column width, e.g. "12rem". */
  minWidth?: string;
  align?: "left" | "center" | "right";
  /** Hide this column below the given breakpoint on the desktop table. */
  hideBelow?: "sm" | "md" | "lg" | "xl";
}

const HIDE_CLASS: Record<NonNullable<DataColumn<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

const ALIGN_CLASS = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

export interface DataTableProps<T> {
  data: T[];
  columns: DataColumn<T>[];
  rowId: (row: T) => string;
  /** Enables the built-in search box. */
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  /** Extra filter controls rendered in the toolbar. */
  filters?: ReactNode;
  /** Export / bulk buttons rendered at the end of the toolbar. */
  actions?: ReactNode;
  /** Rendered above the table (e.g. bulk-action toolbar). */
  banner?: ReactNode;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
  /** Mobile card renderer. Defaults to a label/value list built from columns. */
  mobileCard?: (row: T) => ReactNode;
  /** Disable the responsive card view and always show the table. */
  disableMobileCards?: boolean;
  pageSize?: number;
  /** Set false to render every row (short tables). */
  paginate?: boolean;
  initialSort?: { id: string; dir: "asc" | "desc" };
  stickyHeader?: boolean;
  className?: string;
  /** Max height of the scroll area, e.g. "70vh". */
  maxHeight?: string;
  ariaLabel?: string;
}

export function DataTable<T>({
  data,
  columns,
  rowId,
  searchText,
  searchPlaceholder = "Search…",
  filters,
  actions,
  banner,
  selectable,
  selectedIds,
  onSelectionChange,
  onRowClick,
  loading,
  emptyTitle = "No records",
  emptyDescription,
  emptyIcon,
  emptyAction,
  mobileCard,
  disableMobileCards,
  pageSize = 25,
  paginate = true,
  initialSort,
  stickyHeader = true,
  className,
  maxHeight = "70vh",
  ariaLabel,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ id: string; dir: "asc" | "desc" } | null>(
    initialSort ?? null,
  );
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!searchText || !query.trim()) return data;
    const q = query.trim().toLowerCase();
    return data.filter((row) => searchText(row).toLowerCase().includes(q));
  }, [data, query, searchText]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.id === sort.id);
    if (!col?.sortValue) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filtered, sort, columns]);

  const totalPages = paginate ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const currentPage = Math.min(page, totalPages);
  const rows = useMemo(
    () =>
      paginate
        ? sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)
        : sorted,
    [sorted, currentPage, pageSize, paginate],
  );

  const selected = useMemo(() => new Set(selectedIds ?? []), [selectedIds]);
  const pageIds = rows.map(rowId);
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function toggleAll() {
    if (!onSelectionChange) return;
    if (allOnPageSelected) {
      onSelectionChange((selectedIds ?? []).filter((id) => !pageIds.includes(id)));
    } else {
      onSelectionChange(Array.from(new Set([...(selectedIds ?? []), ...pageIds])));
    }
  }

  function toggleRow(id: string) {
    if (!onSelectionChange) return;
    onSelectionChange(
      selected.has(id)
        ? (selectedIds ?? []).filter((x) => x !== id)
        : [...(selectedIds ?? []), id],
    );
  }

  function toggleSort(col: DataColumn<T>) {
    if (!col.sortValue) return;
    setSort((prev) =>
      prev?.id === col.id
        ? prev.dir === "asc"
          ? { id: col.id, dir: "desc" }
          : null
        : { id: col.id, dir: "asc" },
    );
  }

  const showToolbar = Boolean(searchText || filters || actions);

  return (
    <div className={cn("rounded-xl border border-border bg-card shadow-sm", className)}>
      {showToolbar ? (
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {searchText ? (
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="h-10 pl-9"
                />
              </div>
            ) : null}
            {filters}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div>
          ) : null}
        </div>
      ) : null}

      {banner}

      {loading ? (
        <TableSkeleton cols={Math.min(columns.length, 6)} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      ) : (
        <>
          {/* Mobile card view */}
          {!disableMobileCards ? (
            <ul className="divide-y divide-border md:hidden">
              {rows.map((row) => {
                const id = rowId(row);
                return (
                  <li key={id} className="p-4">
                    <div className="flex items-start gap-3">
                      {selectable ? (
                        <Checkbox
                          className="mt-1"
                          checked={selected.has(id)}
                          onCheckedChange={() => toggleRow(id)}
                          aria-label="Select row"
                        />
                      ) : null}
                      <div
                        className="min-w-0 flex-1"
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                      >
                        {mobileCard ? (
                          mobileCard(row)
                        ) : (
                          <dl className="space-y-1.5">
                            {columns.map((col) => (
                              <div
                                key={col.id}
                                className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-2 text-sm"
                              >
                                <dt className="truncate text-xs uppercase tracking-wide text-muted-foreground">
                                  {col.header}
                                </dt>
                                <dd className="min-w-0">{col.cell(row)}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {/* Desktop table */}
          <div
            className={cn(
              "w-full overflow-auto",
              !disableMobileCards && "hidden md:block",
            )}
            style={{ maxHeight }}
          >
            <table className="w-full caption-bottom text-sm" aria-label={ariaLabel}>
              <thead
                className={cn(
                  "bg-muted/60 backdrop-blur",
                  stickyHeader && "sticky top-0 z-10",
                )}
              >
                <tr className="border-b border-border">
                  {selectable ? (
                    <th scope="col" className="w-10 px-3 py-2.5">
                      <Checkbox
                        checked={allOnPageSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Select all rows on this page"
                      />
                    </th>
                  ) : null}
                  {columns.map((col) => (
                    <th
                      key={col.id}
                      scope="col"
                      style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                      className={cn(
                        "px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                        ALIGN_CLASS[col.align ?? "left"],
                        col.hideBelow && HIDE_CLASS[col.hideBelow],
                        col.headerClassName,
                      )}
                      aria-sort={
                        sort?.id === col.id
                          ? sort.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                    >
                      {col.sortValue ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(col)}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          {col.header}
                          {sort?.id === col.id ? (
                            sort.dir === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            )
                          ) : (
                            <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        col.header
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <DataTableRow
                    key={rowId(row)}
                    row={row}
                    id={rowId(row)}
                    columns={columns}
                    selectable={selectable}
                    selected={selected.has(rowId(row))}
                    onToggle={toggleRow}
                    onRowClick={onRowClick}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {paginate && sorted.length > pageSize ? (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-border p-3 sm:flex-row sm:p-4">
              <p className="text-xs text-muted-foreground">
                Showing {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, sorted.length)} of {sorted.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-9"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-9"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

const DataTableRow = memo(function DataTableRow<T>({
  row,
  id,
  columns,
  selectable,
  selected,
  onToggle,
  onRowClick,
}: {
  row: T;
  id: string;
  columns: DataColumn<T>[];
  selectable?: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
  onRowClick?: (row: T) => void;
}) {
  return (
    <tr
      className={cn(
        "border-b border-border last:border-0 transition-colors hover:bg-muted/40",
        selected && "bg-primary/5",
        onRowClick && "cursor-pointer",
      )}
      onClick={onRowClick ? () => onRowClick(row) : undefined}
    >
      {selectable ? (
        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggle(id)}
            aria-label="Select row"
          />
        </td>
      ) : null}
      {columns.map((col) => (
        <td
          key={col.id}
          className={cn(
            "px-3 py-2.5 align-middle",
            ALIGN_CLASS[col.align ?? "left"],
            col.hideBelow && HIDE_CLASS[col.hideBelow],
            col.className,
          )}
        >
          {col.cell(row)}
        </td>
      ))}
    </tr>
  );
}) as <T>(props: {
  row: T;
  id: string;
  columns: DataColumn<T>[];
  selectable?: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
  onRowClick?: (row: T) => void;
}) => ReactNode;