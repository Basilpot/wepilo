import * as React from "react";
import { MoreHorizontal, Search, ChevronLeft, ChevronRight, Inbox, SearchX } from "@/components/icons";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type Column<T> = {
  key: string;
  header?: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  headClassName?: string;
  align?: "left" | "right";
  /** Leave this column out of the stacked phone layout. */
  hideOnMobile?: boolean;
};

export type PageSizeOption = number;

export type DataTablePagination = {
  page: number;
  totalPages: number;
  total?: number;
  limit?: number;
  onPage: (page: number) => void;
  onLimit?: (limit: number) => void;
  pageSizeOptions?: PageSizeOption[];
};

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  isLoading = false,
  error,
  onRetry,
  emptyTitle = "No results.",
  emptyHint,
  emptyAction,
  emptyIcon: EmptyIcon = Inbox,
  onRowClick,
  search,
  searchPlaceholder = "Search…",
  searchable = true,
  toolbar,
  pagination,
  maxHeight,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string | number;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyHint?: string;
  emptyAction?: React.ReactNode;
  emptyIcon?: React.ComponentType<{ className?: string }>;
  onRowClick?: (row: T) => void;
  search?: { value: string; onChange: (value: string) => void };
  searchPlaceholder?: string;
  /** Turn off the automatic search box on a table that loads all its rows. */
  searchable?: boolean;
  toolbar?: React.ReactNode;
  pagination?: DataTablePagination;
  maxHeight?: string;
}) {
  const colCount = columns.length;

  // Tables that load every row at once get a search box for free. It matches the short text and number
  // fields of each row. Server-searched or paginated tables bring their own `search` instead.
  const [localQuery, setLocalQuery] = React.useState("");
  const autoSearch = !search && !pagination && searchable;
  const q = localQuery.trim().toLowerCase();
  const sourceRows = rows;
  rows = React.useMemo(() => {
    if (!autoSearch || !q) return sourceRows;
    return sourceRows.filter((row) =>
      Object.values(row as Record<string, unknown>).some(
        (v) => (typeof v === "string" && v.length <= 160 && v.toLowerCase().includes(q)) || (typeof v === "number" && String(v).includes(q)),
      ),
    );
  }, [sourceRows, autoSearch, q]);
  const activeSearch = search ?? (autoSearch ? { value: localQuery, onChange: setLocalQuery } : undefined);
  // With nothing to list, column headings only add noise above the empty state.
  const isEmpty = !isLoading && !error && rows.length === 0;

  return (
    <div>
      {(activeSearch || toolbar) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {activeSearch ? (
            <div className="relative w-full sm:w-80">
              <Input
                type="search"
                aria-label={searchPlaceholder.replace(/…$/, "")}
                placeholder={searchPlaceholder}
                value={activeSearch.value}
                onChange={(e) => activeSearch.onChange(e.target.value)}
                className="w-full pl-8 shadow-none"
              />
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          ) : (
            <span />
          )}
          {toolbar}
        </div>
      )}

      {!isEmpty && !error && (
        <MobileRows columns={columns} rows={rows} getRowId={getRowId} isLoading={isLoading} onRowClick={onRowClick} />
      )}
      <div className={cn(!isEmpty && !error && "hidden sm:block")}>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className={cn("overflow-x-auto", maxHeight && "overflow-y-auto")} style={maxHeight ? { maxHeight } : undefined}>
          <Table>
            <TableHeader className={cn("bg-muted/50", isEmpty && "hidden")}>
              <TableRow className="hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={cn(
                      "h-10 text-xs font-semibold tracking-wide text-muted-foreground first:pl-5 last:pr-5",
                      col.headClassName,
                      col.align === "right" && "text-right",
                      col.align === "left" && "text-left",
                    )}
                  >
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {error && !isLoading ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={colCount} className="h-48 text-center">
                    <div role="alert" className="flex flex-col items-center gap-3">
                      <span className="text-sm text-foreground">{error}</span>
                      {onRetry && (
                        <Button variant="outline" size="sm" onClick={onRetry}>
                          Try again
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    {columns.map((col) => (
                      <TableCell key={col.key} className={cn("py-3.5 first:pl-5 last:pr-5", col.className)}>
                        <Skeleton className="h-4 w-full max-w-48" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length ? (
                rows.map((row) => (
                  <TableRow
                    key={getRowId(row)}
                    className={cn("transition-colors duration-150", onRowClick && "cursor-pointer hover:bg-primary/[0.035] focus-visible:bg-muted/50 focus-visible:outline-none")}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.key === "Enter" && e.target === e.currentTarget) onRowClick(row);
                          }
                        : undefined
                    }
                  >
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={cn(
                          "py-3.5 first:pl-5 last:pr-5",
                          col.className,
                          col.align === "right" && "text-right",
                          col.align === "left" && "text-left",
                        )}
                      >
                        {col.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={colCount} className="h-64 text-center whitespace-normal">
                    <div className="mx-auto flex max-w-sm flex-col items-center justify-center">
                      <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        {search?.value ? <SearchX className="size-5" /> : <EmptyIcon className="size-5" />}
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {activeSearch?.value ? `No matches for “${activeSearch.value}”` : emptyTitle}
                      </span>
                      <span className="mt-1 text-sm text-muted-foreground">
                        {search?.value ? "Check the spelling, try a shorter or different word, or clear the search to see the full list again." : emptyHint}
                      </span>
                      {search?.value ? (
                        <Button variant="outline" size="sm" className="mt-4" onClick={() => search.onChange("")}>
                          Clear search
                        </Button>
                      ) : emptyAction ? (
                        <div className="mt-4">{emptyAction}</div>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      </div>

      {pagination && <TablePagination pagination={pagination} />}
    </div>
  );
}

/**
 * Phones get one card per row instead of a table that scrolls sideways: the first column is the
 * card's heading, the rest are labelled lines, and an actions column sits in the corner.
 */
function MobileRows<T>({
  columns,
  rows,
  getRowId,
  isLoading,
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string | number;
  isLoading: boolean;
  onRowClick?: (row: T) => void;
}) {
  const [lead, ...rest] = columns;
  const actions = rest.find((c) => c.key === "actions");
  const details = rest.filter((c) => c.key !== "actions" && !c.hideOnMobile);

  if (isLoading) {
    return (
      <div className="space-y-2 sm:hidden">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <ul className="space-y-2 sm:hidden">
      {rows.map((row) => (
        <li key={getRowId(row)}>
          <div
            role={onRowClick ? "button" : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            onKeyDown={onRowClick ? (e) => e.key === "Enter" && e.target === e.currentTarget && onRowClick(row) : undefined}
            className={cn(
              "rounded-2xl border bg-card p-4 transition-colors",
              onRowClick && "cursor-pointer active:bg-muted/50",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">{lead.cell(row)}</div>
              {actions && <div className="-mt-1 -mr-2 shrink-0">{actions.cell(row)}</div>}
            </div>
            {details.length > 0 && (
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t pt-3 text-sm">
                {details.map((col) => (
                  <div key={col.key} className="contents">
                    <dt className="text-muted-foreground">{col.header}</dt>
                    <dd className="min-w-0 text-right [&>*]:ml-auto">{col.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TablePagination({ pagination }: { pagination: DataTablePagination }) {
  const pageSizeOptions = pagination.pageSizeOptions ?? [10, 20, 30, 50];
  if (pagination.totalPages <= 0 || pagination.total === 0) return null;
  const smallest = Math.min(...pageSizeOptions);
  // One page that fits in the smallest page size: a count is all that's useful.
  const navigable = pagination.totalPages > 1 || (pagination.total ?? 0) > smallest;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
      <span className="tabular-nums">
        {typeof pagination.total === "number" && pagination.limit
          ? pagination.total === 0
            ? "No results"
            : navigable
              ? `${(pagination.page - 1) * pagination.limit + 1}–${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total}`
              : `${pagination.total} ${pagination.total === 1 ? "item" : "items"}`
          : typeof pagination.total === "number"
            ? `${pagination.total} ${pagination.total === 1 ? "item" : "items"} in total`
            : `Page ${pagination.page} of ${pagination.totalPages}`}
      </span>
      {navigable && (
      <div className="flex items-center gap-2">
        {pagination.onLimit && pagination.limit && (
          <Select value={String(pagination.limit)} onValueChange={(v) => pagination.onLimit!(Number(v))}>
            <SelectTrigger size="sm" className="w-[4.5rem]" aria-label="How many rows to show on each page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Go to the previous page"
          disabled={pagination.page <= 1}
          onClick={() => pagination.onPage(pagination.page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="tabular-nums">
          {pagination.page} / {pagination.totalPages}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Go to the next page"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => pagination.onPage(pagination.page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      )}
    </div>
  );
}

export type RowAction = {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
  disabled?: boolean;
  variant?: "default" | "destructive";
  separatorBefore?: boolean;
  hidden?: boolean;
};

export function RowActions({ actions, label = "Open menu" }: { actions: RowAction[]; label?: string }) {
  const visible = actions.filter((a) => !a.hidden);
  if (!visible.length) return null;
  return (
    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={label}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48 [&_[role=menuitem]]:whitespace-nowrap">
          {visible.map((a, i) => (
            <React.Fragment key={`${a.label}-${i}`}>
              {a.separatorBefore && <DropdownMenuSeparator />}
              <DropdownMenuItem
                variant={a.variant}
                disabled={a.disabled}
                onClick={a.onSelect}
                className="cursor-pointer"
              >
                {a.icon && <a.icon className="h-4 w-4" />}
                {a.label}
              </DropdownMenuItem>
            </React.Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
