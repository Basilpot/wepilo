import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Search, Upload, Check, Library, ImageIcon } from "lucide-react";
import { api, uploadFile, type Paginated, toastApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export type MediaItem = {
  id: number;
  url: string;
  filename: string;
  alt: string | null;
  caption: string | null;
  title: string | null;
  description: string | null;
  mimeType: string | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
};

type MediaListResponse = Paginated<MediaItem> & { storageUsedBytes: number };

const LIMIT = 40;

export function MediaPicker({
  open,
  onOpenChange,
  onSelect,
  multiple,
  accept = "image/*",
  confirmLabel = "Insert",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (media: MediaItem) => void;
  multiple?: boolean;
  accept?: string;
  confirmLabel?: string;
}) {
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<MediaItem | null>(null);
  const [meta, setMeta] = useState({ alt: "", title: "", caption: "", description: "" });

  const load = (nextPage: number, query: string, append: boolean) => {
    if (nextPage === 1) setLoading(true);
    else setLoadingMore(true);
    api<MediaListResponse>("/media", { query: { page: nextPage, limit: LIMIT, search: query || undefined } })
      .then((res) => {
        setItems((prev) => (append ? [...prev, ...res.data] : res.data));
        setTotal(res.pagination.total);
        setPage(nextPage);
      })
      .catch(() => {
        if (!append) setItems([]);
      })
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  };

  useEffect(() => {
    if (!open) return;
    setTab("library");
    setSelected([]);
    setSearch("");
    setPending(null);
    setMeta({ alt: "", title: "", caption: "", description: "" });
    load(1, "", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (item: MediaItem) => {
    if (!multiple) {
      onSelect(item);
      onOpenChange(false);
      return;
    }
    setSelected((prev) => (prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]));
  };

  const confirmMultiple = () => {
    items.filter((m) => selected.includes(m.id)).forEach(onSelect);
    onOpenChange(false);
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const res = await uploadFile<{ media: MediaItem }>("/media/upload", files[0]);
      setPending(res.media);
      setMeta({ alt: "", title: "", caption: "", description: "" });
    } catch (err) {
      toastApiError(err, "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const confirmUpload = async () => {
    if (!pending) return;
    try {
      const res = await api<{ media: MediaItem }>(`/media/${pending.id}`, {
        method: "PATCH",
        body: {
          alt: meta.alt.trim() || null,
          title: meta.title.trim() || null,
          caption: meta.caption.trim() || null,
          description: meta.description.trim() || null,
        },
      });
      onSelect(res.media);
      if (multiple) {
        setPending(null);
        setTab("library");
        load(1, search, false);
      } else {
        onOpenChange(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const hasMore = items.length < total;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88vh] w-[95vw] max-w-[95vw] flex-col sm:max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>Select media</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="library" className="gap-1.5">
              <Library className="h-4 w-4" /> Library
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-1.5">
              <Upload className="h-4 w-4" /> Upload
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "library" && (
          <>
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search media"
                placeholder="Search by filename…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  load(1, e.target.value, false);
                }}
                className="h-8 pl-8"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-xl" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                  No media found
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
                  {items.map((item) => {
                    const isSelected = selected.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggle(item)}
                        className={cn(
                          "group relative aspect-square overflow-hidden rounded-xl border bg-muted transition-all",
                          isSelected ? "ring-2 ring-foreground" : "hover:ring-2 hover:ring-foreground/30",
                        )}
                      >
                        <img src={item.url} alt={item.alt ?? item.filename} className="h-full w-full object-cover" />
                        {isSelected && (
                          <span className="absolute top-1 right-1 rounded-xl bg-foreground p-0.5 text-background">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                        <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 text-left text-[10px] text-white">
                          {item.filename}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 border-t pt-3">
              <span className="text-xs text-muted-foreground">
                {multiple ? `${selected.length} selected · ` : ""}
                {items.length} / {total}
              </span>
              <div className="flex gap-2">
                {hasMore && (
                  <Button variant="outline" size="sm" disabled={loadingMore} onClick={() => load(page + 1, search, true)}>
                    {loadingMore && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                    Load more
                  </Button>
                )}
                {multiple && (
                  <Button size="sm" disabled={selected.length === 0} onClick={confirmMultiple}>
                    {confirmLabel} ({selected.length})
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        {tab === "upload" && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={(e) => handleUpload(e.target.files)} />
            {!pending ? (
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="mx-auto flex w-full max-w-sm flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors hover:border-foreground/40 disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="mb-3 h-9 w-9 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="mb-3 h-9 w-9 text-muted-foreground" />
                )}
                <p className="text-sm font-medium">{uploading ? "Uploading…" : "Click to upload"}</p>
                <p className="text-xs text-muted-foreground">Added to your media library</p>
              </button>
            ) : (
              <div className="grid min-h-0 flex-1 gap-6 overflow-hidden lg:grid-cols-2">
                <div className="flex min-h-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/30 p-4">
                  <img src={pending.url} alt="Preview" className="max-h-full max-w-full rounded-xl object-contain" />
                </div>
                <div className="flex min-h-0 flex-col">
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                    <div className="space-y-1.5">
                      <Label htmlFor="mp-filename">Filename</Label>
                      <Input id="mp-filename" value={pending.filename} disabled />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mp-alt">Alt text (SEO)</Label>
                      <Input id="mp-alt" value={meta.alt} onChange={(e) => setMeta({ ...meta, alt: e.target.value })} placeholder="Describe for screen readers" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mp-title">Title</Label>
                      <Input id="mp-title" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mp-caption">Caption</Label>
                      <Input id="mp-caption" value={meta.caption} onChange={(e) => setMeta({ ...meta, caption: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mp-description">Description</Label>
                      <Textarea id="mp-description" rows={3} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" className="flex-1" onClick={() => setPending(null)}>
                      Back
                    </Button>
                    <Button className="flex-1" onClick={confirmUpload}>
                      {confirmLabel}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
