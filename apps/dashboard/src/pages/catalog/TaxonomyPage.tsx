import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PenLine, Plus, Trash2, MapPinHouse } from "@/components/icons";
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
  {
    key: "countries",
    label: "Countries",
    singular: "country",
    path: "/countries",
    intro: "Countries are the broadest place level, for example Nepal or Peru. Add every country your trips visit.",
  },
  {
    key: "regions",
    label: "Regions",
    singular: "region",
    path: "/regions",
    intro: "Regions are areas inside a country, for example Annapurna or the Sacred Valley. Use them to group trips that run in the same area.",
  },
  {
    key: "cities",
    label: "Cities",
    singular: "city",
    path: "/cities",
    intro: "Cities and towns are the specific places where trips start, end or stop, for example Kathmandu or Cusco.",
  },
  {
    key: "categories",
    label: "Trip categories",
    singular: "trip category",
    path: "/trip-categories",
    intro: "A trip category describes the type of trip, for example Trekking, Cultural tour or Wildlife safari. Travellers use categories to filter your trips on your website.",
  },
] as const;

function TaxonomyTab({
  label,
  singular,
  path,
  intro,
}: {
  label: string;
  singular: string;
  path: string;
  intro: string;
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
    meta: { success: `The ${singular} was saved.` },
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
    meta: { success: `The ${singular} was deleted.` },
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
                confirmDialog({ title: `Delete "${item.name ?? item.handle}"?`, description: `This ${singular} will be removed from your website. Trips that use it will lose this label until you pick a new one.` }, () => remove.mutate(item.id)),
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
        emptyHint={`${intro} Select “New ${singular}” to create the first one.`}
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
        description={intro}
        onSubmit={() => save.mutate()}
        pending={save.isPending}
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Field label="Name" required>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Handle" hint="This becomes part of the page link on your website, for example kathmandu. Leave it empty and we create it automatically from the name.">
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
  // "Destinations" groups three place levels under tabs; "Trip categories" is a single list.
  const isCategories = initialTab === "categories";
  const tabs = TABS.filter((tab) => (isCategories ? tab.key === "categories" : tab.key !== "categories"));
  return (
    <div>
      <PageHeader
        title={isCategories ? "Trip categories" : "Destinations"}
        description={
          isCategories
            ? "Group your trips by type, such as treks, cultural tours or wildlife safaris. Travellers use these categories to filter your trips on your website."
            : "The places your trips visit, organised from broad to specific: countries, then regions inside them, then cities and towns. Pick a tab, then add or edit entries. Each trip is linked to its places inside the trip editor."
        }
      />
      {isCategories ? (
        <TaxonomyTab label={tabs[0].label} singular={tabs[0].singular} path={tabs[0].path} intro={tabs[0].intro} />
      ) : (
        <Tabs defaultValue={initialTab}>
          <TabsList className="mb-4">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((tab) => (
            <TabsContent key={tab.key} value={tab.key}>
              <TaxonomyTab label={tab.label} singular={tab.singular} path={tab.path} intro={tab.intro} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
