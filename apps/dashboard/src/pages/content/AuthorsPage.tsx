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
    meta: { success: "Blog author saved." },
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
    meta: { success: "Blog author deleted." },
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
    { key: "name", header: "Display name", cell: (a) => <span className="font-medium">{a.name ?? a.username}</span> },
    { key: "username", header: "Username used to log in", className: "text-muted-foreground", cell: (a) => `@${a.username}` },
    { key: "email", header: "Email address", className: "text-muted-foreground", cell: (a) => a.email },
    {
      key: "actions",
      headClassName: "w-12",
      className: "text-right",
      cell: (author) => (
        <RowActions
          actions={[
            { label: "Edit this author", icon: PenLine, onSelect: () => openEdit(author) },
            {
              label: "Delete this author",
              icon: Trash2,
              variant: "destructive",
              separatorBefore: true,
              onSelect: () =>
                confirmDialog({ title: `Delete the author ${author.username}?`, description: "This author’s login will stop working. Posts they wrote stay on your website but will no longer show who wrote them.", confirmLabel: "Yes, delete this author", cancelLabel: "No, keep this author" }, () => remove.mutate(author.id)),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Blog authors"
        description="The writers whose names appear on your blog posts. Each author has their own login so they can write and publish posts without seeing the rest of your business. Create an author here, then choose them when you write a post."
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
            Create a new author
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
        emptyTitle="You have not created any blog authors yet"
        emptyHint="You need at least one author before you can publish a blog post. Select “Create a new author” to add yourself or a writer."
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit this author" : "Create a new blog author"}
        description={editing ? "Leave the password box empty if you want to keep the current password." : "The author uses the email and password you set here to log in and write posts."}
        submitLabel={editing ? "Save changes to this author" : "Create this author"}
        onSubmit={() => save.mutate()}
        pending={save.isPending}
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!editing && (
          <>
            <Field label="Username (used to log in)" required hint="Letters and numbers only, with no spaces.">
              <Input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
            </Field>
            <Field label="Email address" required>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </Field>
          </>
        )}
        <Field label="Name shown publicly on posts" hint="Example: Maya Gurung. If you leave this empty, the username is shown instead.">
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label={editing ? "Set a new password (optional)" : "Password for logging in"} required={!editing} hint={editing ? undefined : "Use at least 8 characters."}>
          <Input
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
        </Field>
        <Field label="Short biography shown under their posts (optional)">
          <Textarea rows={3} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
        </Field>
        <Field label="Profile photo (optional)">
          <ImageField shape="avatar" label="Choose a photo from your media library" value={form.image} onChange={(url) => setForm((f) => ({ ...f, image: url }))} />
        </Field>
      </FormDialog>
    </div>
  );
}
