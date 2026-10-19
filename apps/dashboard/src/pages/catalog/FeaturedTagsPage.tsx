import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, PenLine, Plus, Trash2, Tag } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Field, FormDialog } from "@/components/form";
import { DataTable, RowActions, type Column } from "@/components/data-table";
import { confirmDialog } from "@/components/confirm";
import { useErrorMessage } from "@/pages/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type FeaturedTag = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  showOnHomepage: boolean;
  order: number;
};

type FormState = { name: string; slug: string; description: string; showOnHomepage: boolean };
const empty: FormState = { name: "", slug: "", description: "", showOnHomepage: false };

export function FeaturedTagsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FeaturedTag | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);
  const errorMessage = useErrorMessage();

  const { data, isLoading } = useQuery({
    queryKey: ["featured-tags"],
    queryFn: () => api<{ data: FeaturedTag[] }>("/featured-tags"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["featured-tags"] });

  const save = useMutation({
    meta: { success: "Saved" },
    mutationFn: () => {
      const body = {
        name: form.name,
        slug: form.slug || undefined,
        description: form.description || null,
        showOnHomepage: form.showOnHomepage,
      };
      return editing
        ? api(`/featured-tags/${editing.id}`, { body, method: "PATCH" })
        : api("/featured-tags", { body });
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
    mutationFn: (id: number) => api(`/featured-tags/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const move = useMutation({
    mutationFn: (ids: number[]) => api("/featured-tags/reorder", { body: { ids }, method: "PATCH" }),
    onSuccess: invalidate,
  });

  const tags = data?.data ?? [];

  const moveTag = (index: number, direction: -1 | 1) => {
    const next = [...tags];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    move.mutate(next.map((t) => t.id));
  };

  const openEdit = (tag: FeaturedTag) => {
    setEditing(tag);
    setForm({
      name: tag.name,
      slug: tag.slug,
      description: tag.description ?? "",
      showOnHomepage: tag.showOnHomepage,
    });
    setError(null);
    setDialogOpen(true);
  };

  const columns: Column<FeaturedTag>[] = [
    {
      key: "tag",
      header: "Tag",
      cell: (t) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{t.name}</span>
            <span className="font-mono text-xs text-muted-foreground">/{t.slug}</span>
            {t.showOnHomepage && <Badge variant="secondary">Homepage</Badge>}
          </div>
          {t.description && <p className="truncate text-sm text-muted-foreground">{t.description}</p>}
        </div>
      ),
    },
    {
      key: "actions",
      headClassName: "w-12",
      className: "text-right",
      cell: (tag) => {
        const index = tags.findIndex((t) => t.id === tag.id);
        return (
          <RowActions
            actions={[
              {
                label: "Move up",
                icon: ArrowUp,
                hidden: index === 0,
                disabled: move.isPending,
                onSelect: () => moveTag(index, -1),
              },
              {
                label: "Move down",
                icon: ArrowDown,
                hidden: index === tags.length - 1,
                disabled: move.isPending,
                onSelect: () => moveTag(index, 1),
              },
              { label: "Edit tag", icon: PenLine, separatorBefore: true, onSelect: () => openEdit(tag) },
              {
                label: "Delete",
                icon: Trash2,
                variant: "destructive",
                separatorBefore: true,
                onSelect: () => confirmDialog({ description: `Delete tag "${tag.name}"?` }, () => remove.mutate(tag.id)),
              },
            ]}
          />
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Featured tags"
        description="Taggable themes shown on the homepage."
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
            New tag
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={tags}
        getRowId={(t) => t.id}
        isLoading={isLoading}
        onRowClick={openEdit}
        emptyIcon={Tag}
        emptyTitle="No featured tags yet"
        emptyHint="Add taggable themes to show on the homepage."
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit tag" : "New tag"}
        onSubmit={() => save.mutate()}
        pending={save.isPending}
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Field label="Name" required>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Slug" hint="Blank = generated from name.">
          <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
        </Field>
        <Field label="Description">
          <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </Field>
        <Label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={form.showOnHomepage}
            onCheckedChange={(v) => setForm((f) => ({ ...f, showOnHomepage: v === true }))}
          />
          Show on homepage
        </Label>
      </FormDialog>
    </div>
  );
}
