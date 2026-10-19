import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PenLine, Plus, Trash2, Quote } from "lucide-react";
import { Star } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Field, FormDialog } from "@/components/form";
import { DataTable, RowActions, type Column } from "@/components/data-table";
import { confirmDialog } from "@/components/confirm";
import { useErrorMessage } from "@/pages/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Testimonial = {
  id: number;
  rating: number | null;
  content: string;
  author: string | null;
  media: string | null;
  createdAt: string | number;
};

type FormState = { content: string; author: string; rating: string; media: string };
const empty: FormState = { content: "", author: "", rating: "", media: "" };

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
    meta: { success: "Saved" },
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
    meta: { success: "Deleted" },
    mutationFn: (id: number) => api(`/testimonials/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const openEdit = (item: Testimonial) => {
    setEditing(item);
    setForm({
      content: item.content,
      author: item.author ?? "",
      rating: item.rating != null ? String(item.rating) : "",
      media: item.media ?? "",
    });
    setError(null);
    setDialogOpen(true);
  };

  const columns: Column<Testimonial>[] = [
    { key: "author", header: "Author", cell: (t) => <span className="font-medium">{t.author ?? "Anonymous"}</span> },
    {
      key: "rating",
      header: "Rating",
      cell: (t) =>
        t.rating != null ? (
          <span className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={i < t.rating! ? "h-3.5 w-3.5 fill-amber-400 text-amber-400" : "h-3.5 w-3.5 text-muted-foreground/40"}
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
        description="Quotes featured on your public site."
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
        emptyHint="Feature quotes from happy guests on your site."
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit testimonial" : "New testimonial"}
        onSubmit={() => save.mutate()}
        pending={save.isPending}
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Field label="Content" required>
          <Textarea rows={4} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Author">
            <Input value={form.author} onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))} />
          </Field>
          <Field label="Rating (1–5)">
            <Input
              type="number"
              min={1}
              max={5}
              value={form.rating}
              onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Media URL (optional)">
          <Input value={form.media} onChange={(e) => setForm((f) => ({ ...f, media: e.target.value }))} />
        </Field>
      </FormDialog>
    </div>
  );
}
