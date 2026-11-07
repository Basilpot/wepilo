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
import { LOCATION_CATEGORIES, locationCategoryLabel, slugifyName } from "@/lib/locations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Thumb } from "@/components/thumb";

type TaxonomyItem = {
  id: number;
  handle: string;
  name: string | null;
  image: string | null;
  showOnHomepage: boolean;
  /** Locations only: COUNTRY, REGION or CITY. */
  type?: string;
};

type FormState = { name: string; handle: string; image: string; showOnHomepage: boolean; type: string };
const empty: FormState = { name: "", handle: "", image: "", showOnHomepage: false, type: "CITY" };

const categoryLabel = locationCategoryLabel;

const TABS = [
  {
    key: "locations",
    label: "Locations",
    singular: "location",
    path: "/locations",
    intro: "Every place your trips visit, in one list. Give each place a category: a country such as Italy, a region such as Tuscany, a city such as Rome, or a landmark such as the Colosseum.",
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
  title,
  description,
}: {
  label: string;
  singular: string;
  path: string;
  intro: string;
  title: string;
  description: string;
}) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TaxonomyItem | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);
  /** Once someone types their own handle, stop overwriting it from the name. */
  const [handleTouched, setHandleTouched] = useState(false);
  const errorMessage = useErrorMessage();

  const { data, isLoading } = useQuery({
    queryKey: ["taxonomy", path],
    queryFn: () => api<{ data: TaxonomyItem[] }>(path),
  });

  const typed = path === "/locations";
  const [filter, setFilter] = useState<string>("ALL");
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["taxonomy", path] });
    if (typed) queryClient.invalidateQueries({ queryKey: ["locations"] });
  };

  const save = useMutation({
    meta: { success: `The ${singular} was saved.` },
    mutationFn: () => {
      const body = {
        name: form.name,
        handle: form.handle || undefined,
        image: form.image || null,
        showOnHomepage: form.showOnHomepage,
        ...(typed ? { type: form.type } : {}),
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

  const allItems = data?.data ?? [];
  const items = typed && filter !== "ALL" ? allItems.filter((i) => i.type === filter) : allItems;

  const openEdit = (item: TaxonomyItem) => {
    setEditing(item);
    setHandleTouched(item.handle !== slugifyName(item.name ?? ""));
    setForm({
      name: item.name ?? "",
      handle: item.handle,
      image: item.image ?? "",
      showOnHomepage: item.showOnHomepage,
      type: item.type ?? "CITY",
    });
    setError(null);
    setDialogOpen(true);
  };

  const columns: Column<TaxonomyItem>[] = [
    {
      key: "name",
      header: "Name",
      cell: (item) => (
        <div className="flex items-center gap-3">
          <Thumb src={item.image} name={item.name ?? item.handle} />
          <span className="font-medium">{item.name ?? item.handle}</span>
          {item.showOnHomepage && <Badge variant="secondary">Homepage</Badge>}
        </div>
      ),
    },
    ...(typed
      ? [
          {
            key: "type",
            header: "Category",
            cell: (item: TaxonomyItem) => <Badge variant="outline">{categoryLabel(item.type)}</Badge>,
          },
        ]
      : []),
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

  const startNew = () => {
    setEditing(null);
    setHandleTouched(false);
    setForm({ ...empty, type: typed && filter !== "ALL" ? filter : "CITY" });
    setError(null);
    setDialogOpen(true);
  };

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        action={
          <Button onClick={startNew}>
            <Plus />
            New {singular}
          </Button>
        }
      />
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
          typed ? (
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All categories</SelectItem>
                {LOCATION_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.plural}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : undefined
        }
        searchPlaceholder={`Search ${label.toLowerCase()}…`}
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
        {typed && (
          <Field label="Category" required hint={LOCATION_CATEGORIES.find((c) => c.value === form.type)?.hint}>
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCATION_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field label="Name" required>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, handle: handleTouched ? f.handle : slugifyName(e.target.value) }))} />
        </Field>
        <Field label="Handle" hint="This becomes part of the page link on your website, for example rome. It fills in from the name as you type. Change it only if you want a different link.">
          <Input
            value={form.handle}
            onChange={(e) => {
              // Clearing it hands control back to the name.
              setHandleTouched(e.target.value !== "");
              setForm((f) => ({ ...f, handle: e.target.value || slugifyName(f.name) }));
            }}
          />
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
    </div>
  );
}

export function TaxonomyPage({ initialTab = "locations" }: { initialTab?: string }) {
  const tab = TABS.find((t) => t.key === (initialTab === "categories" ? "categories" : "locations"))!;
  const isCategories = tab.key === "categories";
  return (
    <TaxonomyTab
      label={tab.label}
      singular={tab.singular}
      path={tab.path}
      intro={tab.intro}
      title={isCategories ? "Trip categories" : "Locations"}
      description={
        isCategories
          ? "Group your trips by type, such as treks, cultural tours or wildlife safaris. Travellers use these categories to filter your trips on your website."
          : "The places your trips visit, in one list. Each location has a category, so Italy is a country, Tuscany is a region, Rome is a city and the Colosseum is a landmark. Each trip is linked to its places inside the trip editor."
      }
    />
  );
}
