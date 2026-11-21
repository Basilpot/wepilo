import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, toastApiError } from "@/lib/api";
import { Field, FormDialog } from "@/components/form";
import { Input } from "@/components/ui/input";
import { rememberWorkspace, slugFromName } from "@/lib/workspaces";

/** Adds another workspace to the person's account. */
export function NewWorkspaceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [form, setForm] = useState({ companyName: "", slug: "" });
  const [slugEdited, setSlugEdited] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      api<{ tenant: { id: number } }>("/auth/workspaces", {
        body: { companyName: form.companyName, slug: form.slug },
      }),
    onSuccess: (res) => {
      // The session now points at the new workspace, so the dashboard starts again there.
      rememberWorkspace(res.tenant.id);
      window.location.assign("/");
    },
    onError: (err) => toastApiError(err),
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New workspace"
      description="This adds another workspace to your account. You sign in with the same email and password, and can switch between your workspaces from the menu at the top of the sidebar."
      onSubmit={() => create.mutate()}
      pending={create.isPending}
      submitLabel="Create workspace"
    >
      <Field label="Company name" htmlFor="workspace-name" required>
        <Input
          id="workspace-name"
          value={form.companyName}
          onChange={(e) => {
            const companyName = e.target.value;
            setForm((f) => ({ ...f, companyName, slug: slugEdited ? f.slug : slugFromName(companyName) }));
          }}
        />
      </Field>
      <Field
        label="Workspace URL"
        htmlFor="workspace-slug"
        required
        hint="Lowercase letters, numbers and dashes, with no spaces. It is filled in for you from the company name, and you can change it."
      >
        <Input
          id="workspace-slug"
          value={form.slug}
          onChange={(e) => {
            setSlugEdited(true);
            setForm((f) => ({ ...f, slug: e.target.value }));
          }}
        />
      </Field>
    </FormDialog>
  );
}
