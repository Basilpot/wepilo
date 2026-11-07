import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PenLine, Plus, Trash2, Quote } from "@/components/icons";
import { Star } from "@/components/icons";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Field, FormDialog } from "@/components/form";
import { DataTable, RowActions, type Column } from "@/components/data-table";
import { confirmDialog } from "@/components/confirm";
import { useErrorMessage } from "@/pages/shared";
import { Button } from "@/components/ui/button";
import { ImageField } from "@/components/image-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Thumb } from "@/components/thumb";
import { Slider } from "@/components/ui/slider";

type Testimonial = {
  id: number;
  rating: number | null;
  content: string;
  author: string | null;
  media: string | null;
  createdAt: string | number;
};

type FormState = { content: string; author: string; rating: string; media: string };
const empty: FormState = { content: "", author: "", rating: "5", media: "" };

export function TestimonialsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);
  const errorMessage = useErrorMessage();

  const { data, isLoading } = useQuery({
    queryKey: ["testimonials"],
    queryFn: () => api<{ data: Testimonial[] }>("/testimonials"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["testimonials"] });

  const save = useMutation({
    meta: { success: "Testimonial saved. It now appears on your website." },
    mutationFn: () => {
      const body = {
        content: form.content,
        author: form.author || null,
        rating: form.rating ? Number(form.rating) : null,
        media: form.media || null,
      };
      return editing
        ? api(`/testimonials/${editing.id}`, { body, method: "PATCH" })
        : api("/testimonials", { body });
    },
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      setEditing(null);
      setForm(empty);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const remove = useMutation({
    meta: { success: "Testimonial deleted from your website." },
    mutationFn: (id: number) => api(`/testimonials/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const openEdit = (item: Testimonial) => {
    setEditing(item);
    setForm({
      content: item.content,
      author: item.author ?? "",
      rating: String(item.rating ?? 5),
      media: item.media ?? "",
    });
    setError(null);
    setDialogOpen(true);
  };

  const columns: Column<Testimonial>[] = [
    { key: "author", header: "Author", cell: (t) => (
        <div className="flex items-center gap-3">
          <Thumb round src={t.media} name={t.author ?? "Anonymous"} />
          <span className="font-medium">{t.author ?? "Anonymous"}</span>
        </div>
      ),
    },
    {
      key: "rating",
      header: "Rating",
      cell: (t) =>
        t.rating != null ? (
          <span className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={i < t.rating! ? "h-3.5 w-3.5 fill-primary text-primary" : "h-3.5 w-3.5 text-muted-foreground/40"}
              />
            ))}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "content",
      header: "Content",
      className: "max-w-md",
      cell: (t) => <span className="line-clamp-2 text-muted-foreground">{t.content}</span>,
    },
    {
      key: "actions",
      headClassName: "w-12",
      className: "text-right",
      cell: (item) => (
        <RowActions
          actions={[
            { label: "Edit testimonial", icon: PenLine, onSelect: () => openEdit(item) },
            {
              label: "Delete",
              icon: Trash2,
              variant: "destructive",
              separatorBefore: true,
              onSelect: () => confirmDialog({ description: "Delete this testimonial?" }, () => remove.mutate(item.id)),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Testimonials"
        description="Praise from happy travellers that you choose to show on your public website. You write or paste each quote yourself, so you control exactly what appears. These are different from “Reviews”, which travellers submit on their own."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setForm(empty);
              setError(null);
              setDialogOpen(true);
            }}
          >
            <Plus />
            Add testimonial
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(t) => t.id}
        isLoading={isLoading}
        onRowClick={openEdit}
        emptyIcon={Quote}
        emptyTitle="No testimonials yet"
        emptyHint="Quotes from happy travellers build trust with new visitors. Select “Add testimonial” and paste in a kind message a guest sent you."
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit testimonial" : "New testimonial"}
        description="Only add a quote when the traveller has agreed to it being shown publicly."
        onSubmit={() => save.mutate()}
        pending={save.isPending}
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Field label="Content" required hint="Paste or type their words exactly as they wrote them.">
          <Textarea rows={4} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Author" hint="Example: Sarah, Canada. Leave empty to show it as anonymous.">
            <Input value={form.author} onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))} />
          </Field>
          <Field label="Rating (1–5)">
            <div className="flex h-9 items-center gap-4">
              <Slider
                min={1}
                max={5}
                step={1}
                value={[Number(form.rating) || 5]}
                onValueChange={([v]) => setForm((f) => ({ ...f, rating: String(v) }))}
                aria-label="Rating"
              />
              <Input
                type="number"
                min={1}
                max={5}
                step={1}
                value={form.rating}
                className="w-20 shrink-0"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  // Typing is free, but anything out of range snaps to 1–5.
                  setForm((f) => ({ ...f, rating: e.target.value === "" ? "" : String(Math.min(5, Math.max(1, Math.round(n) || 1))) }));
                }}
                onBlur={() => setForm((f) => (f.rating === "" ? { ...f, rating: "5" } : f))}
              />
            </div>
          </Field>
        </div>
        <Field label="Photo (optional)" hint="A picture from this traveller’s trip.">
          <ImageField label="Choose photo" value={form.media} onChange={(url) => setForm((f) => ({ ...f, media: url }))} />
        </Field>
      </FormDialog>
    </div>
  );
}
