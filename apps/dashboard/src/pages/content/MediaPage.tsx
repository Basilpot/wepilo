import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Images, Link2, Pencil, Search, Trash2, Upload } from "lucide-react";
import { api, uploadFile, type Paginated } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, Field, FormDialog } from "@/components/form";
import { TablePagination } from "@/components/data-table";
import { confirmDialog } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Media = {
  id: number;
  url: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  alt: string | null;
  caption: string | null;
  title: string | null;
  description: string | null;
  width: number | null;
  height: number | null;
  createdAt: string | number;
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/svg+xml,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
};

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function MediaPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(24);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [editing, setEditing] = useState<Media | null>(null);
  const [editForm, setEditForm] = useState({ alt: "", title: "", caption: "", description: "" });
  const term = useDebounced(search.trim());

  const { data, isLoading } = useQuery({
    queryKey: ["media", page, limit, term],
    queryFn: () =>
      api<Paginated<Media> & { storageUsedBytes: number }>("/media", {
        query: { page, limit, search: term || undefined },
      }),
    placeholderData: (prev) => prev,
  });

  const remove = useMutation({
    meta: { success: "File deleted from your media library." },
    mutationFn: (id: number) => api(`/media/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["media"] }),
  });

  const saveMeta = useMutation({
    meta: { success: "File details saved." },
    mutationFn: () =>
      api(`/media/${editing!.id}`, {
        method: "PATCH",
        body: {
          alt: editForm.alt.trim() || null,
          title: editForm.title.trim() || null,
          caption: editForm.caption.trim() || null,
          description: editForm.description.trim() || null,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["media"] });
      setEditing(null);
    },
  });

  const onUpload = async (list: FileList | File[] | null) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    const tooBig = files.filter((f) => f.size > MAX_BYTES);
    const wrongType = files.filter((f) => !ACCEPT.split(",").includes(f.type));
    const ok = files.filter((f) => !tooBig.includes(f) && !wrongType.includes(f));
    if (tooBig.length) toast.error(`${tooBig.length} file${tooBig.length === 1 ? " is" : "s are"} larger than the 10 MB limit and ${tooBig.length === 1 ? "was" : "were"} not uploaded. Make the file smaller and try again.`);
    if (wrongType.length) toast.error(`Only images (JPG, PNG, WebP, GIF, SVG) and PDF files can be uploaded. These files were not uploaded: ${wrongType.map((f) => f.name).join(", ")}.`);
    if (!ok.length) return;

    setUploading(true);
    const id = toast.loading(`Uploading ${ok.length} file${ok.length === 1 ? "" : "s"}, please wait…`);
    let done = 0;
    let failed = 0;
    for (const f of ok) {
      try {
        await uploadFile("/media/upload", f);
        done++;
      } catch {
        failed++;
      }
      toast.loading(`Uploading file ${done + failed + 1 > ok.length ? ok.length : done + failed + 1} of ${ok.length}, please wait…`, { id });
    }
    if (done) void queryClient.invalidateQueries({ queryKey: ["media"] });
    if (failed) toast.error(`${done} uploaded successfully, but ${failed} could not be uploaded. Check your internet connection and upload the failed files again.`, { id });
    else toast.success(`${done} file${done === 1 ? " was" : "s were"} uploaded to your media library.`, { id });
    setUploading(false);
  };

  const openEdit = (item: Media) => {
    setEditing(item);
    setEditForm({ alt: item.alt ?? "", title: item.title ?? "", caption: item.caption ?? "", description: item.description ?? "" });
  };

  const copyUrl = (url: string) =>
    navigator.clipboard.writeText(url).then(
      () => toast.success("The file link was copied. You can paste it anywhere you need it."),
      () => toast.error("The link could not be copied automatically. Open the file and copy its address from your browser instead."),
    );

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  return (
    <div
      className="relative min-h-[60vh]"
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        dragDepth.current++;
        setDragging(true);
      }}
      onDragOver={(e) => hasFiles(e) && e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDragging(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        void onUpload(e.dataTransfer.files);
      }}
    >
      <PageHeader
        title="Media library"
        description={
          data ? `Photos and PDF files you can reuse on trips, pages and blog posts. You are using ${formatBytes(data.storageUsedBytes)} of storage across ${data.pagination.total} file${data.pagination.total === 1 ? "" : "s"}. You can also drag files from your computer anywhere on this page to upload them.` : "Photos and PDF files you can reuse on trips, pages and blog posts. You can also drag files from your computer anywhere on this page to upload them."
        }
        action={
          <>
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              multiple
              accept={ACCEPT}
              onChange={(e) => {
                void onUpload(e.target.files);
                if (fileRef.current) fileRef.current.value = "";
              }}
            />
            <Button disabled={uploading} onClick={() => fileRef.current?.click()}>
              <Upload />
              {uploading ? "Uploading your files, please wait…" : "Upload images or PDFs"}
            </Button>
          </>
        }
      />

      <div className="relative mb-4 w-full sm:w-80">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Search your media library by file name"
          placeholder="Type part of a file name to search…"
          className="pl-8"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : !data?.data.length ? (
        term ? (
          <EmptyState icon={Search} title={`No files match “${term}”`} hint="Check the spelling or try a shorter part of the file name." />
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center rounded-lg border border-dashed px-6 py-16 text-center transition-colors hover:border-primary/50 hover:bg-muted/40"
          >
            <span className="flex size-10 items-center justify-center rounded-lg border bg-background text-muted-foreground shadow-xs">
              <Images className="size-5" />
            </span>
            <span className="mt-3 text-sm font-medium">Drag images or PDFs here, or click to choose files from your computer</span>
            <span className="mt-1 text-sm text-muted-foreground">Accepted: JPG, PNG, WebP, GIF, SVG and PDF files, up to 10 MB each. Uploaded files stay here so you can reuse them on trips, pages and posts.</span>
          </button>
        )
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {data.data.map((item) => {
            const isImage = item.mimeType.startsWith("image/");
            return (
              <li key={item.id} className="group min-w-0">
                <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted/50">
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="block size-full focus-visible:outline-none"
                    aria-label={`Edit the description and details of ${item.filename}`}
                  >
                    {isImage ? (
                      <img
                        src={item.url}
                        alt={item.alt ?? ""}
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
                        <FileText className="size-8" />
                        <span className="text-xs font-medium">PDF</span>
                      </span>
                    )}
                  </button>
                  <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-end gap-1 p-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                    {[
                      { label: "Edit description and details", icon: Pencil, onClick: () => openEdit(item) },
                      { label: "Copy the file link", icon: Link2, onClick: () => void copyUrl(item.url) },
                      {
                        label: "Delete this file",
                        icon: Trash2,
                        onClick: () =>
                          confirmDialog(
                            {
                              title: "Delete this file permanently?",
                              description: `${item.filename} will be removed from your media library for good. Any trip, page or post that still uses it will show a broken image until you choose a new one.`,
                            },
                            () => remove.mutate(item.id),
                          ),
                      },
                    ].map((a) => (
                      <button
                        key={a.label}
                        type="button"
                        aria-label={a.label}
                        title={a.label}
                        onClick={a.onClick}
                        className="pointer-events-auto flex size-7 items-center justify-center rounded-md bg-background/90 text-foreground shadow-sm ring-1 ring-black/5 backdrop-blur hover:bg-background"
                      >
                        <a.icon className="size-3.5" />
                      </button>
                    ))}
                  </div>
                  {isImage && !item.alt && (
                    <span className="absolute bottom-1.5 left-1.5 rounded bg-amber-100/95 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                      Missing image description
                    </span>
                  )}
                </div>
                <p className="mt-2 truncate text-xs font-medium" title={item.filename}>
                  {item.title || item.filename}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {[item.width && item.height ? `${item.width}×${item.height}` : null, formatBytes(item.fileSize)].filter(Boolean).join(" · ")}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {data && data.pagination.total > 0 && (
        <TablePagination
          pagination={{
            page: data.pagination.page,
            totalPages: data.pagination.totalPages,
            total: data.pagination.total,
            limit,
            onPage: setPage,
            onLimit: (l) => {
              setLimit(l);
              setPage(1);
            },
            pageSizeOptions: [24, 48, 96],
          }}
        />
      )}

      <div
        aria-hidden={!dragging}
        className={cn(
          "pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity",
          dragging ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-primary bg-background px-16 py-12 text-center shadow-lg">
          <Upload className="size-6 text-primary" />
          <p className="mt-3 font-medium">Release your mouse to upload these files</p>
          <p className="mt-1 text-sm text-muted-foreground">Images and PDF files up to 10 MB each</p>
        </div>
      </div>

      <FormDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Edit the details of this file"
        description={editing?.filename}
        submitLabel="Save file details"
        onSubmit={() => saveMeta.mutate()}
        pending={saveMeta.isPending}
      >
        {editing && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-lg border bg-muted/50">
              {editing.mimeType.startsWith("image/") ? (
                <img src={editing.url} alt="" className="max-h-64 w-full object-contain" />
              ) : (
                <span className="flex h-32 items-center justify-center text-muted-foreground">
                  <FileText className="size-8" />
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {[editing.width && editing.height ? `${editing.width}×${editing.height}` : null, formatBytes(editing.fileSize), editing.mimeType]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={() => void copyUrl(editing.url)}>
                <Link2 />
                Copy the file link
              </Button>
            </div>
          </div>
        )}
        <Field label="Image description (alt text)" htmlFor="alt" hint="Describe what the picture shows in one sentence. Google and screen readers for blind visitors use this text. Skip it for PDFs.">
          <Input id="alt" value={editForm.alt} onChange={(e) => setEditForm({ ...editForm, alt: e.target.value })} placeholder="Example: Hikers crossing a suspension bridge at sunrise" />
        </Field>
        <Field label="Title (optional)" htmlFor="title">
          <Input id="title" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
        </Field>
        <Field label="Caption shown under the image (optional)" htmlFor="caption">
          <Input id="caption" value={editForm.caption} onChange={(e) => setEditForm({ ...editForm, caption: e.target.value })} />
        </Field>
        <Field label="Internal notes about this file (optional)" htmlFor="description">
          <Textarea id="description" rows={3} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
        </Field>
      </FormDialog>
    </div>
  );
}
