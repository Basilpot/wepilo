import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PenLine, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { ImageField } from "@/components/image-field";
import { PageHeader } from "@/components/PageHeader";
import { Field, FormDialog } from "@/components/form";
import { DataTable, RowActions, type Column } from "@/components/data-table";
import { confirmDialog } from "@/components/confirm";
import { useErrorMessage } from "@/pages/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Author = {
  id: number;
  username: string;
  name: string | null;
  email: string;
  bio: string | null;
  image: string | null;
};

type FormState = {
  username: string;
  name: string;
  email: string;
  password: string;
  bio: string;
  image: string;
};

const empty: FormState = { username: "", name: "", email: "", password: "", bio: "", image: "" };

export function AuthorsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Author | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);
  const errorMessage = useErrorMessage();

  const { data, isLoading } = useQuery({
    queryKey: ["authors"],
    queryFn: () => api<{ data: Author[] }>("/authors"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["authors"] });

  const save = useMutation({
    meta: { success: "Saved" },
    mutationFn: () => {
      if (editing) {
        const body: Record<string, unknown> = {
          name: form.name || null,
          bio: form.bio || null,
          image: form.image || null,
        };
        if (form.password) body.password = form.password;
        return api(`/authors/${editing.id}`, { body, method: "PATCH" });
      }
      return api("/authors", {
        body: {
          username: form.username,
          name: form.name || undefined,
          email: form.email,
          password: form.password,
          bio: form.bio || undefined,
          image: form.image || undefined,
        },
      });
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
    mutationFn: (id: number) => api(`/authors/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const openEdit = (author: Author) => {
    setEditing(author);
    setForm({
      username: author.username,
      name: author.name ?? "",
      email: author.email,
      password: "",
      bio: author.bio ?? "",
      image: author.image ?? "",
    });
    setError(null);
    setDialogOpen(true);
  };

  const columns: Column<Author>[] = [
    { key: "name", header: "Name", cell: (a) => <span className="font-medium">{a.name ?? a.username}</span> },
    { key: "username", header: "Username", className: "text-muted-foreground", cell: (a) => `@${a.username}` },
    { key: "email", header: "Email", className: "text-muted-foreground", cell: (a) => a.email },
    {
      key: "actions",
      headClassName: "w-12",
      className: "text-right",
      cell: (author) => (
        <RowActions
          actions={[
            { label: "Edit author", icon: PenLine, onSelect: () => openEdit(author) },
            {
              label: "Delete",
              icon: Trash2,
              variant: "destructive",
              separatorBefore: true,
              onSelect: () =>
                confirmDialog({ description: `Delete author ${author.username}?` }, () => remove.mutate(author.id)),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Authors"
        description="Writer accounts that can publish posts."
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
            New author
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(a) => a.id}
        isLoading={isLoading}
        onRowClick={openEdit}
        emptyIcon={PenLine}
        emptyTitle="No authors yet"
        emptyHint="Add a writer account so they can publish posts."
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit author" : "New author"}
        description={editing ? "Leave password blank to keep the current one." : undefined}
        onSubmit={() => save.mutate()}
        pending={save.isPending}
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!editing && (
          <>
            <Field label="Username" required>
              <Input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
            </Field>
            <Field label="Email" required>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </Field>
          </>
        )}
        <Field label="Display name">
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label={editing ? "New password (optional)" : "Password"} required={!editing}>
          <Input
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
        </Field>
        <Field label="Bio">
          <Textarea rows={3} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
        </Field>
        <Field label="Photo">
          <ImageField shape="avatar" label="Add photo" value={form.image} onChange={(url) => setForm((f) => ({ ...f, image: url }))} />
        </Field>
      </FormDialog>
    </div>
  );
}
