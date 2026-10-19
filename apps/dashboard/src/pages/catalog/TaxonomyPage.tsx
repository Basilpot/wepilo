import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PenLine, Plus, Trash2, MapPinHouse } from "lucide-react";
import { api } from "@/lib/api";
import { ImageField } from "@/components/image-field";
import { PageHeader } from "@/components/PageHeader";
import { Field, FormDialog } from "@/components/form";
import { DataTable, RowActions, type Column } from "@/components/data-table";
import { confirmDialog } from "@/components/confirm";
import { useErrorMessage } from "@/pages/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TaxonomyItem = {
  id: number;
  handle: string;
  name: string | null;
  image: string | null;
  showOnHomepage: boolean;
};

type FormState = { name: string; handle: string; image: string; showOnHomepage: boolean };
const empty: FormState = { name: "", handle: "", image: "", showOnHomepage: false };

const TABS = [
  { key: "countries", label: "Countries", singular: "country", path: "/countries" },
  { key: "regions", label: "Regions", singular: "region", path: "/regions" },
  { key: "cities", label: "Cities", singular: "city", path: "/cities" },
  { key: "categories", label: "Trip categories", singular: "trip category", path: "/trip-categories" },
] as const;

function TaxonomyTab({
  label,
  singular,
  path,
}: {
  label: string;
  singular: string;
  path: string;
}) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TaxonomyItem | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);
  const errorMessage = useErrorMessage();

  const { data, isLoading } = useQuery({
    queryKey: ["taxonomy", path],
    queryFn: () => api<{ data: TaxonomyItem[] }>(path),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["taxonomy", path] });

  const save = useMutation({
    meta: { success: "Saved" },
    mutationFn: () => {
      const body = {
        name: form.name,
        handle: form.handle || form.name,
        image: form.image || null,
        showOnHomepage: form.showOnHomepage,
      };
      return editing ? api(`${path}/${editing.id}`, { body, method: "PATCH" }) : api(path, { body });
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
    mutationFn: (id: number) => api(`${path}/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const items = data?.data ?? [];

  const openEdit = (item: TaxonomyItem) => {
    setEditing(item);
    setForm({
      name: item.name ?? "",
      handle: item.handle,
      image: item.image ?? "",
      showOnHomepage: item.showOnHomepage,
    });
    setError(null);
    setDialogOpen(true);
  };

  const columns: Column<TaxonomyItem>[] = [
    {
      key: "name",
      header: "Name",
      cell: (item) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.name ?? item.handle}</span>
          {item.showOnHomepage && <Badge variant="secondary">Homepage</Badge>}
        </div>
      ),
    },
    {
      key: "handle",
      header: "Handle",
      cell: (item) => <span className="font-mono text-xs text-muted-foreground">{item.handle}</span>,
    },
    {
      key: "actions",
      headClassName: "w-12",
      className: "text-right",
      cell: (item) => (
        <RowActions
          actions={[
            { label: `Edit ${singular}`, icon: PenLine, onSelect: () => openEdit(item) },
            {
              label: "Delete",
              icon: Trash2,
              variant: "destructive",
              separatorBefore: true,
              onSelect: () =>
                confirmDialog({ description: `Delete "${item.name ?? item.handle}"?` }, () => remove.mutate(item.id)),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={items}
        getRowId={(item) => item.id}
        isLoading={isLoading}
        onRowClick={openEdit}
        emptyIcon={MapPinHouse}
        emptyTitle={`No ${label.toLowerCase()} yet`}
        emptyHint={`Add a ${singular} to build out your catalog.`}
        maxHeight="420px"
        toolbar={
          <Button
            onClick={() => {
              setEditing(null);
              setForm(empty);
              setError(null);
              setDialogOpen(true);
            }}
          >
            <Plus />
            New {singular}
          </Button>
        }
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? `Edit ${singular}` : `New ${singular}`}
        onSubmit={() => save.mutate()}
        pending={save.isPending}
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Field label="Name" required>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Handle" hint="URL slug; blank = generated from name.">
          <Input value={form.handle} onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))} />
        </Field>
        <Field label="Image">
          <ImageField value={form.image} onChange={(url) => setForm((f) => ({ ...f, image: url }))} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={form.showOnHomepage}
            onCheckedChange={(v) => setForm((f) => ({ ...f, showOnHomepage: v === true }))}
          />
          Show on homepage
        </label>
      </FormDialog>
    </>
  );
}

export function TaxonomyPage({ initialTab = "countries" }: { initialTab?: string }) {
  return (
    <div>
      <PageHeader
        title={initialTab === "categories" ? "Trip categories" : "Destinations"}
        description={
          initialTab === "categories"
            ? "Group trips by type, like treks, tours or expeditions."
            : "Countries, regions and cities your trips run in."
        }
      />
      <Tabs defaultValue={initialTab}>
        <TabsList className="mb-4">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((tab) => (
          <TabsContent key={tab.key} value={tab.key}>
            <TaxonomyTab label={tab.label} singular={tab.singular} path={tab.path} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
