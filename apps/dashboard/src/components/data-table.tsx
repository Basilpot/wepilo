import * as React from "react";
import { MoreHorizontal, Search, ChevronLeft, ChevronRight, Inbox, SearchX } from "lucide-react";
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
  toolbar?: React.ReactNode;
  pagination?: DataTablePagination;
  maxHeight?: string;
}) {
  const colCount = columns.length;

  return (
    <div>
      {(search || toolbar) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {search ? (
            <div className="relative w-full sm:w-80">
              <Input
                type="search"
                aria-label={searchPlaceholder.replace(/…$/, "")}
                placeholder={searchPlaceholder}
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
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

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className={cn("overflow-x-auto", maxHeight && "overflow-y-auto")} style={maxHeight ? { maxHeight } : undefined}>
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={cn(
                      "h-10 text-xs font-medium text-muted-foreground first:pl-4 last:pr-4",
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
                      <TableCell key={col.key} className={cn("py-3.5 first:pl-4 last:pr-4", col.className)}>
                        <Skeleton className="h-4 w-full max-w-48" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length ? (
                rows.map((row) => (
                  <TableRow
                    key={getRowId(row)}
                    className={cn(onRowClick && "cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none")}
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
                          "py-3 first:pl-4 last:pr-4",
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
                      <span className="mb-3 flex size-10 items-center justify-center rounded-lg border bg-background text-muted-foreground shadow-xs">
                        {search?.value ? <SearchX className="size-5" /> : <EmptyIcon className="size-5" />}
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {search?.value ? `No matches for “${search.value}”` : emptyTitle}
                      </span>
                      <span className="mt-1 text-sm text-muted-foreground">
                        {search?.value ? "Try a different search or clear the filter." : emptyHint}
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

      {pagination && <TablePagination pagination={pagination} />}
    </div>
  );
}

export function TablePagination({ pagination }: { pagination: DataTablePagination }) {
  const pageSizeOptions = pagination.pageSizeOptions ?? [10, 20, 30, 50];
  if (pagination.totalPages <= 0 || pagination.total === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
      <span className="tabular-nums">
        {typeof pagination.total === "number" && pagination.limit
          ? pagination.total === 0
            ? "No results"
            : `${(pagination.page - 1) * pagination.limit + 1}–${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total}`
          : typeof pagination.total === "number"
            ? `${pagination.total} result${pagination.total === 1 ? "" : "s"}`
            : `Page ${pagination.page} of ${pagination.totalPages}`}
      </span>
      <div className="flex items-center gap-2">
        {pagination.onLimit && pagination.limit && (
          <Select value={String(pagination.limit)} onValueChange={(v) => pagination.onLimit!(Number(v))}>
            <SelectTrigger size="sm" className="w-[4.5rem]" aria-label="Rows per page">
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
          variant="outline"
          size="icon"
          className="h-8 w-8"
          aria-label="Previous page"
          disabled={pagination.page <= 1}
          onClick={() => pagination.onPage(pagination.page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="tabular-nums">
          {pagination.page} / {pagination.totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          aria-label="Next page"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => pagination.onPage(pagination.page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
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
        <DropdownMenuContent align="end" className="w-44">
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
