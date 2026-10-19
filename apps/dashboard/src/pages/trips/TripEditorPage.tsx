import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  FileText,
  ImagePlus,
  Info,
  Loader2,
  PenLine,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { api, toastApiError } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import { useLeaveGuard } from "@/hooks/use-leave-guard";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, EmptyState } from "@/components/form";
import { Combobox } from "@/components/combobox";
import { confirmDialog } from "@/components/confirm";
import { MultiSelect } from "@/components/multi-select";
import { StringArrayInput } from "@/components/string-array-input";
import { RichTextEditor } from "@/components/rich-text";
import { MediaPicker, type MediaItem } from "@/components/media-picker";
import { SortableList, DragHandle, type DragHandleProps } from "@/components/sortable";
import { InfoCard, LabelDescription, ListBox } from "@/components/atoms";
import {
  emptyTripForm,
  getPageProgress,
  getStepProgress,
  PAGE_REQUIRED,
  PAGE_SECTIONS,
  newDay,
  newVariant,
  toFormState,
  toPayload,
  TRIP_STEPS,
  uid,
  type FaqGroup,
  type GroupDiscountRule,
  type ItineraryDay,
  type ItineraryImage,
  type ItineraryVariant,
  type TripForm,
  type TripLayout,
} from "./trip-form";
import { TitleBlock } from "@/components/document-editor";
import { useSession } from "@/App";

type OptionRow = { id: number; name: string | null; handle?: string };
type TripResponse = { activity: Record<string, unknown> };

const DIFFICULTIES = [
  { value: "EASY", label: "Easy" },
  { value: "MODERATE", label: "Moderate" },
  { value: "HARD", label: "Hard" },
  { value: "EXTREME", label: "Extreme" },
];

const COMMON_LANGUAGES = ["English", "Spanish", "French", "German", "Italian", "Portuguese", "Mandarin", "Japanese", "Arabic", "Hindi"];
const MEAL_PRESETS = ["Breakfast", "Lunch", "Dinner", "Vegan", "Halal", "Vegetarian"];
const MAX_DAY_IMAGES = 3;

const toOptions = (rows: OptionRow[] | undefined): { value: string; label: string }[] =>
  (rows ?? []).map((r) => ({ value: String(r.id), label: r.name ?? r.handle ?? `#${r.id}` }));

// ── Media helpers ─────────────────────────────────────────────────────────────

function AddImageButton({
  onSelect,
  multiple,
  label = "Add image",
  accept,
  className,
}: {
  onSelect: (media: MediaItem) => void;
  multiple?: boolean;
  label?: string;
  accept?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 p-3 text-center text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground",
          className,
        )}
      >
        <ImagePlus className="h-5 w-5" />
        <span className="text-xs font-medium">{label}</span>
      </button>
      <MediaPicker open={open} onOpenChange={setOpen} multiple={multiple} accept={accept} onSelect={onSelect} confirmLabel="Add" />
    </>
  );
}

// ── Reusable borderless section ───────────────────────────────────────────────

function Section({
  title,
  description,
  action,
  children,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      {(title || description || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-0.5">
            {title && <h3 className="text-sm font-semibold">{title}</h3>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// ── Altitude chart ────────────────────────────────────────────────────────────

function AltitudeChartPreview({ points }: { points: { location: string; altitude: string }[] }) {
  const data = points
    .filter((p) => p.location.trim() && Number(p.altitude) > 0)
    .map((p) => ({ location: p.location.trim(), altitude: Number(p.altitude) }));

  if (data.length < 2) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-dashed px-4 text-center text-sm text-muted-foreground">
        Add at least two points to see the altitude profile.
      </div>
    );
  }

  const yMax = Math.ceil(Math.max(...data.map((p) => p.altitude)) / 500) * 500;

  return (
    <div className="h-56 rounded-xl border p-3">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="location" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, yMax]} tick={{ fontSize: 12 }} width={48} />
          <Tooltip />
          <Area type="monotone" dataKey="altitude" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.12} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Additional info / FAQ dialogs ─────────────────────────────────────────────

function InfoDialog({
  confirmLabel,
  initial,
  onSave,
  onOpenChange,
}: {
  confirmLabel: string;
  initial?: { title: string; description: string };
  onSave: (data: { title: string; description: string }) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState({ title: initial?.title ?? "", description: initial?.description ?? "" });
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl">
        <SheetHeader className="border-b pr-14">
          <SheetTitle>{confirmLabel}</SheetTitle>
          <SheetDescription>Add a heading and the details travelers should know.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-6 py-5">
          <Field label="Heading" required>
            <Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Visa requirements" />
          </Field>
          <Field label="Details" tooltip="Rich text — bold, lists and links are supported.">
            <RichTextEditor value={draft.description} onChange={(html) => setDraft((d) => ({ ...d, description: html }))} placeholder="Write the details…" />
          </Field>
        </div>
        <SheetFooter className="border-t px-6 py-4">
          <div className="flex w-full gap-2">
            <Button className="flex-1" type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="flex-1"
            type="button"
            disabled={!draft.title.trim()}
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function FaqItemDialog({
  confirmLabel,
  initial,
  onSave,
  onOpenChange,
}: {
  confirmLabel: string;
  initial?: { q: string; a: string };
  onSave: (data: { q: string; a: string }) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState({ q: initial?.q ?? "", a: initial?.a ?? "" });
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl">
        <SheetHeader className="border-b pr-14">
          <SheetTitle>{confirmLabel}</SheetTitle>
          <SheetDescription>Add the question and its answer.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-6 py-5">
          <Field label="Question" required>
            <Input value={draft.q} onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))} placeholder="e.g. How fit do I need to be?" />
          </Field>
          <Field label="Answer" tooltip="Rich text — bold, lists and links are supported.">
            <RichTextEditor value={draft.a} onChange={(html) => setDraft((d) => ({ ...d, a: html }))} placeholder="Write the answer…" />
          </Field>
        </div>
        <SheetFooter className="border-t px-6 py-4">
          <div className="flex w-full gap-2">
            <Button className="flex-1" type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="flex-1"
            type="button"
            disabled={!draft.q.trim()}
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── Itinerary ─────────────────────────────────────────────────────────────────

function DayImageDialog({
  image,
  onSave,
  onOpenChange,
}: {
  image: ItineraryImage;
  onSave: (next: ItineraryImage) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState(image);
  useEffect(() => setDraft(image), [image]);
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader className="border-b pr-14">
          <SheetTitle>Image details</SheetTitle>
          <SheetDescription>Give this image a title and description.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-6 py-5">
          <img src={draft.image} alt="" className="h-44 w-full rounded-xl border object-cover" />
          <Field label="Title">
            <Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Sunrise over the ridge" />
          </Field>
          <Field label="Description">
            <Textarea rows={3} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Short caption" />
          </Field>
        </div>
        <SheetFooter className="border-t px-6 py-4">
          <div className="flex w-full gap-2">
            <Button className="flex-1" type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="flex-1"
            type="button"
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            Save
          </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function DaySheet({
  day,
  onSave,
  onOpenChange,
}: {
  day: ItineraryDay;
  onSave: (next: ItineraryDay) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState(day);
  const [imgIndex, setImgIndex] = useState<number | null>(null);
  useEffect(() => setDraft(day), [day]);
  const set = (patch: Partial<ItineraryDay>) => setDraft((d) => ({ ...d, ...patch }));
  const setImages = (dayFeaturedImages: ItineraryImage[]) => set({ dayFeaturedImages });

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Day {day.day}</SheetTitle>
          <SheetDescription>Full details for this day of the itinerary.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <Field label="Title" required>
            <Input value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Sunrise hike to the ridge" />
          </Field>
          <Field label="Description">
            <RichTextEditor value={draft.description} onChange={(html) => set({ description: html })} placeholder="What happens on this day…" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Duration">
              <Input value={draft.duration} onChange={(e) => set({ duration: e.target.value })} placeholder="4 hours" />
            </Field>
            <Field label="Distance">
              <Input value={draft.distance} onChange={(e) => set({ distance: e.target.value })} placeholder="12 km" />
            </Field>
            <Field label="Ascent">
              <Input value={draft.ascent} onChange={(e) => set({ ascent: e.target.value })} placeholder="600 m" />
            </Field>
            <Field label="Descent">
              <Input value={draft.descent} onChange={(e) => set({ descent: e.target.value })} placeholder="400 m" />
            </Field>
            <Field label="Meals">
              <Input value={draft.meals} onChange={(e) => set({ meals: e.target.value })} placeholder="Breakfast, Lunch" />
            </Field>
            <Field label="Accommodation">
              <Input value={draft.accommodations} onChange={(e) => set({ accommodations: e.target.value })} placeholder="Teahouse" />
            </Field>
          </div>

          <Section
            title="Featured images"
            description={`Up to ${MAX_DAY_IMAGES} images. Drag to reorder, or click an image to edit its title and description.`}
          >
            <SortableList
              grid
              className="grid grid-cols-2 gap-3 sm:grid-cols-3"
              items={draft.dayFeaturedImages}
              getId={(im) => im.id}
              onReorder={setImages}
              footer={
                draft.dayFeaturedImages.length < MAX_DAY_IMAGES ? (
                  <AddImageButton
                    label="Add image"
                    onSelect={(media) =>
                      setImages([...draft.dayFeaturedImages, { id: uid(), image: media.url, title: media.title ?? "", description: "" }])
                    }
                  />
                ) : undefined
              }
              renderItem={(img, index, handle) => (
                <div className="group relative aspect-video overflow-hidden rounded-xl border bg-muted">
                  <button type="button" className="h-full w-full" aria-label="Edit image" onClick={() => setImgIndex(index)}>
                    <img src={img.image} alt="" className="h-full w-full object-cover" />
                  </button>
                  {img.title && (
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pt-4 pb-1 text-xs text-white">
                      {img.title}
                    </span>
                  )}
                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="rounded bg-background/90">
                      <DragHandle handle={handle} />
                    </span>
                    <button
                      type="button"
                      aria-label="Remove image"
                      onClick={() =>
                        confirmDialog(
                          {
                            title: "Remove image?",
                            description: "This image will be removed from the day.",
                          },
                          () => setImages(draft.dayFeaturedImages.filter((_, xi) => xi !== index)),
                        )
                      }
                      className="flex h-6 w-6 items-center justify-center rounded-xl bg-background/90 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            />
          </Section>
        </div>

        <SheetFooter className="border-t px-6 py-4">
          <div className="flex w-full gap-2">
            <Button className="flex-1" type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="flex-1"
            type="button"
            disabled={!draft.title.trim()}
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            Save changes
          </Button>
          </div>
        </SheetFooter>
      </SheetContent>
      {imgIndex !== null && draft.dayFeaturedImages[imgIndex] && (
        <DayImageDialog
          image={draft.dayFeaturedImages[imgIndex]}
          onSave={(next) => setImages(draft.dayFeaturedImages.map((im, i) => (i === imgIndex ? next : im)))}
          onOpenChange={(open) => {
            if (!open) setImgIndex(null);
          }}
        />
      )}
    </Sheet>
  );
}

function VariantSheet({
  variant,
  mode,
  onSave,
  onOpenChange,
}: {
  variant: ItineraryVariant;
  mode: "add" | "edit";
  onSave: (next: ItineraryVariant) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState(variant);
  const set = (patch: Partial<ItineraryVariant>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{mode === "add" ? "Add itinerary variant" : "Edit itinerary variant"}</SheetTitle>
          <SheetDescription>Name the variant and describe how it differs from the others.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <Field label="Name" required>
            <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Standard itinerary" />
          </Field>
          <Field label="Description" tooltip="Optional. Explain what makes this variant different — route, pace, season or difficulty.">
            <RichTextEditor value={draft.description} onChange={(html) => set({ description: html })} placeholder="Describe this itinerary variant…" />
          </Field>
          <label className="flex items-start gap-3">
            <Switch checked={draft.isDefault} onCheckedChange={(v) => set({ isDefault: v })} />
            <span>
              <span className="block text-sm font-medium">Default variant</span>
              <span className="block text-sm text-muted-foreground">Shown first when travelers open the trip.</span>
            </span>
          </label>
        </div>

        <SheetFooter className="border-t px-6 py-4">
          <div className="flex w-full gap-2">
            <Button className="flex-1" type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="flex-1"
            type="button"
            disabled={!draft.name.trim()}
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            {mode === "add" ? "Add variant" : "Save changes"}
          </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function VariantEditor({
  variant,
  onChange,
  onEdit,
}: {
  variant: ItineraryVariant;
  onChange: (next: ItineraryVariant) => void;
  onEdit: () => void;
}) {
  const [sheet, setSheet] = useState<number | null>(null);
  const setDays = (days: ItineraryDay[]) => onChange({ ...variant, days });
  const patchDay = (dayIndex: number, next: ItineraryDay) => setDays(variant.days.map((d, i) => (i === dayIndex ? next : d)));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{variant.name.trim() || "Untitled variant"}</h3>
          {variant.isDefault && <Badge variant="secondary">Default</Badge>}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          <PenLine />
          Edit variant
        </Button>
      </div>

      {variant.days.length === 0 ? (
        <EmptyState title="No days yet" hint="Add the first day of this itinerary." />
      ) : (
        <SortableList
          className="space-y-2"
          items={variant.days}
          getId={(d) => d.id}
          onReorder={(days) => setDays(days.map((d, i) => ({ ...d, day: i + 1 })))}
          renderItem={(day, dayIndex, handle) => (
            <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors hover:bg-muted/30">
              <DragHandle handle={handle} />
              <button
                type="button"
                onClick={() => setSheet(dayIndex)}
                className="min-w-0 flex-1 truncate text-left text-sm font-medium"
              >
                <span className="mr-2 text-muted-foreground">#{dayIndex + 1}</span>
                {day.title.trim() || <span className="font-normal text-muted-foreground italic">Untitled day</span>}
              </button>
              <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs" onClick={() => setSheet(dayIndex)}>
                Edit
              </Button>
              {variant.days.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-xs text-destructive hover:text-destructive"
                  onClick={() =>
                    confirmDialog(
                      {
                        title: `Remove day ${dayIndex + 1}?`,
                        description: "This day and its details will be deleted.",
                      },
                      () => setDays(variant.days.filter((_, i) => i !== dayIndex)),
                    )
                  }
                >
                  Delete
                </Button>
              )}
            </div>
          )}
        />
      )}

      <div className="flex justify-center pt-4">
        <Button
          type="button"
          variant="outline"
          className="flex items-center gap-2 rounded-xl"
          onClick={() => {
            setDays([...variant.days, newDay(variant.days.length + 1)]);
            setSheet(variant.days.length);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Day
        </Button>
      </div>

      {sheet !== null && variant.days[sheet] && (
        <DaySheet
          day={variant.days[sheet]}
          onSave={(next) => patchDay(sheet, next)}
          onOpenChange={(open) => {
            if (!open) setSheet(null);
          }}
        />
      )}
    </div>
  );
}

function ItineraryStep({ variants, onChange }: { variants: ItineraryVariant[]; onChange: (next: ItineraryVariant[]) => void }) {
  const [activeId, setActiveId] = useState(variants[0]?.id ?? "");
  const [sheet, setSheet] = useState<{ mode: "add" } | { mode: "edit"; id: string } | null>(null);
  const activeIndex = Math.max(0, variants.findIndex((v) => v.id === activeId));
  const active = variants[activeIndex];

  const updateVariant = (index: number, next: ItineraryVariant) =>
    onChange(variants.map((v, i) => (i === index ? next : next.isDefault ? { ...v, isDefault: false } : v)));
  const addVariant = (draft: ItineraryVariant) => {
    const base = draft.isDefault ? variants.map((v) => ({ ...v, isDefault: false })) : variants;
    onChange([...base, draft]);
    setActiveId(draft.id);
  };
  const removeVariant = (index: number) => {
    let next = variants.filter((_, i) => i !== index);
    if (next.length && !next.some((v) => v.isDefault)) next = next.map((v, i) => ({ ...v, isDefault: i === 0 }));
    onChange(next);
    setActiveId(next[0]?.id ?? "");
  };

  const editing = sheet?.mode === "edit" ? variants.find((v) => v.id === sheet.id) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 border-b pb-2">
        {variants.map((v, i) => {
          const isActive = i === activeIndex;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setActiveId(v.id)}
              className={
                "flex items-center gap-1 rounded-xl border border-b-0 px-3 py-1.5 text-sm transition-colors " +
                (isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted text-muted-foreground hover:bg-accent")
              }
            >
              <span className="max-w-[120px] truncate">{v.name.trim() || `Variant ${i + 1}`}</span>
              {variants.length > 1 && (
                <X
                  className="ml-1 h-3 w-3 shrink-0 opacity-70 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    confirmDialog(
                      {
                        title: `Remove "${v.name.trim() || `Variant ${i + 1}`}"?`,
                        description: "This itinerary variant and all its days will be deleted.",
                      },
                      () => removeVariant(i),
                    );
                  }}
                />
              )}
            </button>
          );
        })}
        <Button type="button" variant="outline" size="sm" onClick={() => setSheet({ mode: "add" })}>
          <Plus />
          Add Variant
        </Button>
      </div>

      {variants.length === 0 || !active ? (
        <EmptyState title="No itinerary" hint="Add an itinerary variant to get started." />
      ) : (
        <VariantEditor
          variant={active}
          onChange={(next) => updateVariant(activeIndex, next)}
          onEdit={() => setSheet({ mode: "edit", id: active.id })}
        />
      )}

      {sheet?.mode === "add" && (
        <VariantSheet
          variant={newVariant(variants.length, variants.length === 0)}
          mode="add"
          onSave={addVariant}
          onOpenChange={(open) => {
            if (!open) setSheet(null);
          }}
        />
      )}
      {editing && (
        <VariantSheet
          variant={editing}
          mode="edit"
          onSave={(next) => updateVariant(variants.findIndex((v) => v.id === editing.id), next)}
          onOpenChange={(open) => {
            if (!open) setSheet(null);
          }}
        />
      )}
    </div>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

function FaqGroupBlock({ group, onChange, onRemove }: { group: FaqGroup; onChange: (next: FaqGroup) => void; onRemove: () => void }) {
  const [add, setAdd] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const setItems = (items: FaqGroup["items"]) => onChange({ ...group, items });
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          value={group.title}
          onChange={(e) => onChange({ ...group, title: e.target.value })}
          placeholder="Group title (e.g. Booking)"
          className="max-w-sm"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto"
          aria-label="Remove group"
          onClick={() =>
            confirmDialog(
              {
                title: `Remove "${group.title.trim() || "this group"}"?`,
                description: "This FAQ group and its questions will be deleted.",
              },
              onRemove,
            )
          }
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {group.items.length === 0 ? (
        <EmptyState title="No questions yet" hint="Add the first question for this group." />
      ) : (
        <div className="space-y-2">
          {group.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors hover:bg-muted/30">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                <span className="mr-2 text-muted-foreground">#{i + 1}</span>
                {item.q.trim() || <span className="font-normal text-muted-foreground italic">Untitled question</span>}
              </span>
              <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs" onClick={() => setEditIdx(i)}>
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-xs text-destructive hover:text-destructive"
                onClick={() =>
                  confirmDialog(
                    {
                      title: "Remove question?",
                      description: "This question and its answer will be deleted.",
                    },
                    () => setItems(group.items.filter((_, xi) => xi !== i)),
                  )
                }
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-center pt-1">
        <Button type="button" variant="outline" className="flex items-center gap-2 rounded-xl" onClick={() => setAdd(true)}>
          <Plus className="h-4 w-4" />
          Add question
        </Button>
      </div>

      {add && (
        <FaqItemDialog
          confirmLabel="Add question"
          onSave={(data) => setItems([...group.items, data])}
          onOpenChange={(open) => {
            if (!open) setAdd(false);
          }}
        />
      )}
      {editIdx !== null && group.items[editIdx] && (
        <FaqItemDialog
          confirmLabel="Save changes"
          initial={group.items[editIdx]}
          onSave={(data) => setItems(group.items.map((x, xi) => (xi === editIdx ? data : x)))}
          onOpenChange={(open) => {
            if (!open) setEditIdx(null);
          }}
        />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function TripEditorPage({ mode }: { mode: "create" | "edit" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<TripForm>(emptyTripForm);
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [infoAdd, setInfoAdd] = useState(false);
  const [infoEdit, setInfoEdit] = useState<number | null>(null);
  const [baseline, setBaseline] = useState(() => JSON.stringify(emptyTripForm));
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: session } = useSession();
  const chosenLayout = searchParams.get("layout");
  const needsLayoutChoice = mode === "create" && chosenLayout !== "itinerary" && chosenLayout !== "page";

  const { data: existing, isLoading } = useQuery({
    queryKey: ["trip", id],
    queryFn: () => api<TripResponse>(`/activities/${id}`),
    enabled: mode === "edit" && Boolean(id),
  });

  const countries = useQuery({ queryKey: ["countries"], queryFn: () => api<{ data: OptionRow[] }>("/countries") });
  const regions = useQuery({ queryKey: ["regions"], queryFn: () => api<{ data: OptionRow[] }>("/regions") });
  const cities = useQuery({ queryKey: ["cities"], queryFn: () => api<{ data: OptionRow[] }>("/cities") });
  const categories = useQuery({ queryKey: ["tripCategories"], queryFn: () => api<{ data: OptionRow[] }>("/trip-categories") });
  const tags = useQuery({ queryKey: ["featuredTags"], queryFn: () => api<{ data: OptionRow[] }>("/featured-tags") });
  const extras = useQuery({ queryKey: ["extras"], queryFn: () => api<{ data: (OptionRow & { price: number | null })[] }>("/extras") });

  useEffect(() => {
    if (!existing?.activity) return;
    const loaded = toFormState(existing.activity);
    setForm(loaded);
    setBaseline(JSON.stringify(loaded));
    setStatus((existing.activity.status as "DRAFT" | "PUBLISHED") ?? "DRAFT");
  }, [existing]);

  // A new trip starts from the layout picked on the chooser screen.
  useEffect(() => {
    if (mode !== "create" || (chosenLayout !== "itinerary" && chosenLayout !== "page")) return;
    const layout: TripLayout = chosenLayout === "page" ? "PAGE" : "ITINERARY";
    setForm((f) => ({ ...f, layout }));
    setBaseline(JSON.stringify({ ...emptyTripForm, layout }));
  }, [mode, chosenLayout]);

  const dirty = JSON.stringify(form) !== baseline;
  const confirmLeave = useLeaveGuard(dirty);

  // Each step is its own screen: start it at the top.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const set = <K extends keyof TripForm>(key: K, value: TripForm[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const setSeo = (patch: Partial<TripForm["seo"]>) => setForm((prev) => ({ ...prev, seo: { ...prev.seo, ...patch } }));

  const isPage = form.layout === "PAGE";
  const progress = useMemo(() => getStepProgress(form), [form]);
  const pageProgress = useMemo(() => getPageProgress(form), [form]);
  const score = isPage
    ? Math.round((PAGE_REQUIRED.reduce((a, k) => a + (pageProgress[k] ?? 0), 0) / PAGE_REQUIRED.length) * 100)
    : Math.round((Object.values(progress).reduce((a, b) => a + b, 0) / TRIP_STEPS.length) * 100);

  const switchLayout = () => {
    const next: TripLayout = isPage ? "ITINERARY" : "PAGE";
    confirmDialog(
      {
        title: next === "PAGE" ? "Switch to a simple page?" : "Switch to a multi-day itinerary?",
        description:
          next === "PAGE"
            ? "The trip becomes one page of content. Day-by-day details are kept and come back if you switch again; your site just won't show them."
            : "You'll get the step-by-step editor with a day-by-day itinerary. Your page content is kept and comes back if you switch again.",
        confirmLabel: "Switch",
        destructive: false,
      },
      () => {
        setForm((prev) => ({ ...prev, layout: next }));
        setStep(0);
      },
    );
  };
  const titleReady = form.title.trim().length >= 3;

  const createRelation = async (path: string, key: string, label: string, extra: Record<string, unknown> = {}) => {
    const res = await api<Record<string, { id: number }>>(path, { method: "POST", body: { name: label, handle: label, ...extra } });
    await queryClient.invalidateQueries({ queryKey: [key] });
    return String(res[Object.keys(res)[0]].id);
  };

  const save = async (kind: "draft" | "publish") => {
    if (!titleReady) {
      setStep(0);
      toast.error("Add a title with at least 3 characters.");
      return;
    }
    const nextStatus = kind === "draft" ? (status === "PUBLISHED" ? "PUBLISHED" : "DRAFT") : "PUBLISHED";
    setSaving(kind);
    try {
      const payload = toPayload(form, nextStatus);
      const res =
        mode === "create"
          ? await api<{ activity: { id: number } }>("/activities", { body: payload })
          : await api<{ activity: { id: number } }>(`/activities/${id}`, { method: "PATCH", body: payload });
      const newId = res.activity.id;
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["trip", String(newId)] });
      setStatus(nextStatus);
      setBaseline(JSON.stringify(form));
      toast.success(kind === "publish" ? (status === "PUBLISHED" ? "Changes saved" : "Trip published") : "Draft saved");
      if (mode === "create") navigate(`/trips/${newId}`, { replace: true });
    } catch (err) {
      toastApiError(err, "Failed to save trip");
    } finally {
      setSaving(null);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (saving === null) void save(status === "PUBLISHED" ? "publish" : "draft");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (mode === "edit" && isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-[70vh] w-full" />
      </div>
    );
  }

  if (needsLayoutChoice) {
    return (
      <LayoutChooser
        onBack={() => navigate("/trips")}
        onChoose={(layout) => setSearchParams({ layout: layout === "PAGE" ? "page" : "itinerary" }, { replace: true })}
      />
    );
  }

  const current = TRIP_STEPS[step];
  const siteHost = (session?.tenant?.website || "your-site.com").replace(/^https?:\/\//, "").replace(/\/$/, "");

  // Each step body, by key. The itinerary stepper shows one at a time; the
  // page layout stacks the ones that apply to a simple trip.
  const renderStep = (stepKey: string) => (
    <>
              {/* 1 — Basics */}
              {stepKey === "basics" && (
                <div className="grid gap-4">
                  <Field
                    label="Title"
                    required
                    htmlFor="title"
                    tooltip="Short, descriptive and attractive name travelers see first."
                    error={!titleReady && form.title.length > 0 ? "At least 3 characters required" : undefined}
                  >
                    <Input id="title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Inca Trail to Machu Picchu" />
                  </Field>
                  <Field
                    label="Slug"
                    htmlFor="slug"
                    tooltip="URL-friendly handle. Lowercase, kebab-case, no spaces (e.g. inca-trail-to-machu-picchu)."
                    hint="Leave blank to generate automatically from the title."
                  >
                    <Input id="slug" value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="inca-trail-to-machu-picchu" />
                  </Field>
                  <label className="flex items-center gap-3 rounded-xl border p-3">
                    <Switch checked={form.isFeatured} onCheckedChange={(v) => set("isFeatured", v)} />
                    <div>
                      <p className="text-sm font-medium">Featured trip</p>
                      <p className="text-xs text-muted-foreground">Highlight this trip on your homepage and featured listings.</p>
                    </div>
                  </label>
                </div>
              )}

              {/* 2 — Overview */}
              {stepKey === "overview" && (
                <>
                  <Field label="Description" tooltip="Write 3–5 sentences describing what travelers will do and experience on the trip.">
                    <RichTextEditor value={form.overview} onChange={(html) => set("overview", html)} placeholder="Take travelers through the trip…" />
                  </Field>
                  <InfoCard info="This is the short pitch shown on the trip page. Keep it clear, concrete and focused on the experience." />
                </>
              )}

              {/* 3 — Categorization */}
              {stepKey === "categorization" && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Category" tooltip="Main high-level type of activity, e.g. Trekking, Tours, Luxury.">
                      <Combobox
                        value={form.tripCategoryId}
                        setValue={(v) => set("tripCategoryId", v)}
                        placeholder="Select category"
                        options={toOptions(categories.data?.data)}
                        onCreate={(label) => createRelation("/trip-categories", "tripCategories", label)}
                      />
                    </Field>
                    <Field label="Country">
                      <Combobox
                        value={form.countryId}
                        setValue={(v) => set("countryId", v)}
                        placeholder="Select country"
                        options={toOptions(countries.data?.data)}
                        onCreate={(label) => createRelation("/countries", "countries", label)}
                      />
                    </Field>
                    <Field label="Destination (city)">
                      <Combobox
                        value={form.cityId}
                        setValue={(v) => set("cityId", v)}
                        placeholder="Select destination"
                        options={toOptions(cities.data?.data)}
                        onCreate={(label) => createRelation("/cities", "cities", label)}
                      />
                    </Field>
                    <Field label="Region">
                      <Combobox
                        value={form.regionId}
                        setValue={(v) => set("regionId", v)}
                        placeholder="Select region"
                        options={toOptions(regions.data?.data)}
                        onCreate={(label) => createRelation("/regions", "regions", label)}
                      />
                    </Field>
                  </div>
                  <Separator />
                  <Section title="Featured tags" description="Tags used to group trips in featured sections.">
                    <MultiSelect
                      selected={form.featuredTagIds.map(String)}
                      onChange={(v) => set("featuredTagIds", v.map(Number))}
                      options={toOptions(tags.data?.data)}
                      placeholder="Select tags"
                    />
                    <InfoCard info="Featured tags help travelers discover your trip through curated collections and themed browsing. Select as many as apply." />
                  </Section>
                </>
              )}

              {/* 4 — Highlights */}
              {stepKey === "highlights" && (
                <>
                  <RichTextEditor value={form.highlights} onChange={(html) => set("highlights", html)} placeholder="List the best moments…" />
                  <InfoCard info="Showcase the key experiences and memorable moments travelers can expect. Keep it concise, specific, and focused on what makes this trip worth taking." />
                </>
              )}

              {/* 5 — Itinerary */}
              {stepKey === "itinerary" && (
                <ItineraryStep variants={form.itinerary} onChange={(v) => set("itinerary", v)} />
              )}

              {/* 6 — Media */}
              {stepKey === "media" && (
                <>
                  <ListBox
                    list={[
                      "Upload clear, high-resolution images that show the destination.",
                      "Use JPEG, PNG or WebP. Bright, well-lit and properly framed works best.",
                      "The first image is used as the trip's cover image in listings.",
                      "Use real photos that represent the actual trip — at least 3 is recommended.",
                    ]}
                  />
                  <Section title="Gallery" description="Drag to reorder. The first image is used as the cover.">
                    <SortableList
                      grid
                      className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
                      items={form.images.map((url) => ({ id: url, url }))}
                      getId={(i) => i.id}
                      onReorder={(items) => set("images", items.map((i) => i.url))}
                      footer={
                        <AddImageButton
                          multiple
                          label="Add images"
                          onSelect={(media) => set("images", form.images.includes(media.url) ? form.images : [...form.images, media.url])}
                        />
                      }
                      renderItem={(item, index, handle) => (
                        <div className="group relative aspect-video overflow-hidden rounded-xl border bg-muted">
                          <img src={item.url} alt="" className="h-full w-full object-cover" />
                          {index === 0 && <Badge className="absolute top-1.5 left-1.5">Cover</Badge>}
                          <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <span className="rounded bg-background/90">
                              <DragHandle handle={handle} />
                            </span>
                            <button
                              type="button"
                              aria-label="Remove image"
                              onClick={() =>
                                confirmDialog(
                                  {
                                    title: "Remove image?",
                                    description: "This image will be removed from the gallery.",
                                  },
                                  () => set("images", form.images.filter((u) => u !== item.url)),
                                )
                              }
                              className="flex h-6 w-6 items-center justify-center rounded-xl bg-background/90 text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    />
                  </Section>
                  <Section title="Video intro" description="Optional. Paste a YouTube or Vimeo link, or upload a video file.">
                    <div className="grid gap-3 sm:max-w-sm">
                      <Input value={form.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} placeholder="https://youtube.com/watch?v=…" />
                      <AddImageButton accept="video/*" label="Upload video file" onSelect={(media) => set("videoUrl", media.url)} />
                    </div>
                  </Section>
                </>
              )}

              {/* 7 — Map */}
              {stepKey === "map" && (
                <>
                  <Field label="Map description" tooltip="Explain the route and what travelers can see on the map.">
                    <RichTextEditor
                      value={form.mapDescription}
                      onChange={(html) => set("mapDescription", html)}
                      placeholder="Describe the route, key landmarks and points of interest…"
                    />
                  </Field>
                  <Section title="Route map" description="Upload an image of the route map.">
                    <div className="grid gap-3 sm:max-w-md">
                      {form.routeMap ? (
                        <div className="relative aspect-video overflow-hidden rounded-xl border bg-muted">
                          <img src={form.routeMap} alt="Route map" className="h-full w-full object-contain" />
                          <button
                            type="button"
                            aria-label="Remove map image"
                            onClick={() =>
                              confirmDialog(
                                {
                                  title: "Remove map image?",
                                  description: "The route map image will be removed.",
                                },
                                () => set("routeMap", ""),
                              )
                            }
                            className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-xl bg-background/90 text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <AddImageButton label="Add map image" onSelect={(media) => set("routeMap", media.url)} />
                      )}
                      <Input value={form.routeMap} onChange={(e) => set("routeMap", e.target.value)} placeholder="Or paste an image URL" />
                    </div>
                  </Section>
                  <InfoCard info="A clear route map helps travelers visualise the journey before they book." />
                </>
              )}

              {/* 8 — Inclusions */}
              {stepKey === "inclusions" && (
                <>
                  <RichTextEditor value={form.inclusions} onChange={(html) => set("inclusions", html)} placeholder="Accommodation, meals, guide…" />
                  <InfoCard info="Be clear and specific. Travelers should know exactly what they are paying for. A bulleted list works best." />
                </>
              )}

              {/* 8 — Exclusions */}
              {stepKey === "exclusions" && (
                <>
                  <RichTextEditor value={form.exclusions} onChange={(html) => set("exclusions", html)} placeholder="Flights, insurance, tips…" />
                  <InfoCard info="List what is not covered so travelers know what they'll need to pay for separately." />
                </>
              )}

              {/* 9 — Duration & altitude */}
              {stepKey === "duration" && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Duration" tooltip="Total length of the trip. E.g. '8 days / 7 nights' or '6 hours'.">
                      <Input value={form.duration} onChange={(e) => set("duration", e.target.value)} placeholder="8 days / 7 nights" />
                    </Field>
                    <Field label="Maximum altitude (m)" tooltip="Highest point reached during the trip, in metres.">
                      <Input type="number" min={0} value={form.maximumAltitude} onChange={(e) => set("maximumAltitude", e.target.value)} placeholder="5416" />
                    </Field>
                  </div>

                  <Section
                    title="Altitude chart"
                    description="Plot altitude against each stop to show the climb profile."
                    action={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => set("altitudeChart", [...form.altitudeChart, { id: uid(), location: "", altitude: "" }])}
                      >
                        <Plus />
                        Add point
                      </Button>
                    }
                  >
                    {form.altitudeChart.length === 0 ? (
                      <EmptyState title="No altitude points" hint="Add at least two stops with altitudes to plot the profile." />
                    ) : (
                      <div className="grid gap-6 lg:grid-cols-2">
                        <div className="space-y-2">
                          {form.altitudeChart.map((point, index) => (
                            <div key={point.id} className="flex items-end gap-2">
                              <div className="flex-1 space-y-1.5">
                                <label className="text-xs text-muted-foreground">Location</label>
                                <Input
                                  value={point.location}
                                  placeholder="Namche Bazaar"
                                  onChange={(e) => set("altitudeChart", form.altitudeChart.map((p, i) => (i === index ? { ...p, location: e.target.value } : p)))}
                                />
                              </div>
                              <div className="w-28 space-y-1.5">
                                <label className="text-xs text-muted-foreground">Altitude (m)</label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={point.altitude}
                                  placeholder="3440"
                                  onChange={(e) => set("altitudeChart", form.altitudeChart.map((p, i) => (i === index ? { ...p, altitude: e.target.value } : p)))}
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Remove point"
                                onClick={() => set("altitudeChart", form.altitudeChart.filter((_, i) => i !== index))}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        <AltitudeChartPreview points={form.altitudeChart} />
                      </div>
                    )}
                  </Section>
                </>
              )}

              {/* 10 — Capacity & difficulty */}
              {stepKey === "capacity" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Guest capacity" tooltip="Maximum number of travellers for this trip.">
                    <Input type="number" min={1} value={form.guestCapacity} onChange={(e) => set("guestCapacity", e.target.value)} placeholder="12" />
                  </Field>
                  <Field label="Difficulty" tooltip="Select the trip's difficulty level: Easy, Moderate, Hard or Extreme.">
                    <Select value={form.difficultyLevel || "none"} onValueChange={(v) => set("difficultyLevel", v === "none" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select difficulty" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not set</SelectItem>
                        {DIFFICULTIES.map((d) => (
                          <SelectItem key={d.value} value={d.value}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              )}

              {/* 11 — Meeting & drop-off */}
              {stepKey === "points" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Meeting point" tooltip="Where travelers meet to start the trip.">
                    <Input value={form.meetingPoint} onChange={(e) => set("meetingPoint", e.target.value)} placeholder="Tribhuvan International Airport" />
                  </Field>
                  <Field label="Drop-off point" tooltip="Where the trip ends or travelers are dropped off.">
                    <Input value={form.dropOffPoint} onChange={(e) => set("dropOffPoint", e.target.value)} placeholder="Same as meeting point" />
                  </Field>
                </div>
              )}

              {/* 12 — Accommodation & meals */}
              {stepKey === "stay" && (
                <>
                  <Section title="Accommodations" description="Where travelers stay during the trip.">
                    <StringArrayInput value={form.accommodations} onChange={(v) => set("accommodations", v)} placeholder="Teahouse, hotel… (Enter to add)" />
                    <LabelDescription text="The types of accommodation travelers can expect. Type and press Enter to add each one." />
                  </Section>
                  <Section title="Meals" description="Meals included in the trip.">
                    <div className="space-y-3">
                      <StringArrayInput value={form.meals} onChange={(v) => set("meals", v)} placeholder="Add a meal and press Enter" />
                      <div className="flex flex-wrap gap-1.5">
                        {MEAL_PRESETS.filter((m) => !form.meals.includes(m)).map((m) => (
                          <button key={m} type="button" onClick={() => set("meals", [...form.meals, m])}>
                            <Badge variant="outline" className="cursor-pointer font-normal hover:bg-accent">
                              <Plus />
                              {m}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  </Section>
                </>
              )}

              {/* 13 — Pricing */}
              {stepKey === "pricing" && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Price" tooltip="Price per person in your default currency.">
                      <Input type="number" min={0} value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="1200" />
                    </Field>
                    <Field label="Maximum price" tooltip="Optional. Fill this in when the trip has a price range." hint="Optional — for trips with a price range.">
                      <Input type="number" min={0} value={form.maxPrice} onChange={(e) => set("maxPrice", e.target.value)} placeholder="1800" />
                    </Field>
                  </div>
                  <InfoCard info="Bookings are reservation requests only — travelers are not charged through the platform. Quote the price you expect to collect directly." />

                  <Section
                    title="Group discount"
                    description="Offer discounted pricing for larger groups. Each rule applies a percentage off or a fixed per-person price."
                    action={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => set("groupDiscount", [...form.groupDiscount, { id: uid(), groupSize: "", discount: "", discountType: "PERCENTAGE" }])}
                      >
                        <Plus />
                        Add rule
                      </Button>
                    }
                  >
                    <label className="flex items-start gap-3">
                      <Switch checked={form.showGroupDiscount} onCheckedChange={(v) => set("showGroupDiscount", v)} />
                      <span>
                        <span className="block text-sm font-medium">Show group discount on website</span>
                        <span className="block text-sm text-muted-foreground">Hide the rules while you are still tuning them.</span>
                      </span>
                    </label>
                    {form.groupDiscount.length === 0 ? (
                      <EmptyState title="No group discount rules" hint="Add a rule to offer discounted pricing for larger groups." />
                    ) : (
                      <div className="space-y-2">
                        {form.groupDiscount.map((rule, index) => (
                          <div key={rule.id} className="flex items-end gap-2">
                            <div className="flex-1 space-y-1.5">
                              <label className="text-xs text-muted-foreground">Group size (max)</label>
                              <Input
                                type="number"
                                min={1}
                                value={rule.groupSize}
                                placeholder="e.g. 5"
                                onChange={(e) => set("groupDiscount", form.groupDiscount.map((r, i) => (i === index ? { ...r, groupSize: e.target.value } : r)))}
                              />
                            </div>
                            <div className="flex-1 space-y-1.5">
                              <label className="text-xs text-muted-foreground">{rule.discountType === "FLAT" ? "Flat price" : "Percentage"}</label>
                              <Input
                                type="number"
                                min={0}
                                value={rule.discount}
                                placeholder={rule.discountType === "FLAT" ? "e.g. 950" : "e.g. 10"}
                                onChange={(e) => set("groupDiscount", form.groupDiscount.map((r, i) => (i === index ? { ...r, discount: e.target.value } : r)))}
                              />
                            </div>
                            <div className="w-40 space-y-1.5">
                              <label className="text-xs text-muted-foreground">Type</label>
                              <Select
                                value={rule.discountType}
                                onValueChange={(v) =>
                                  set("groupDiscount", form.groupDiscount.map((r, i) => (i === index ? { ...r, discountType: v as GroupDiscountRule["discountType"] } : r)))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                                  <SelectItem value="FLAT">Flat price</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Remove rule"
                              onClick={() => set("groupDiscount", form.groupDiscount.filter((_, i) => i !== index))}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </Section>
                </>
              )}

              {/* 14 — Extras & languages */}
              {stepKey === "extras" && (
                <>
                  <Section title="Extras" description="Optional add-ons travelers can select.">
                    {extras.data?.data.length === 0 ? (
                      <EmptyState title="No extras yet" hint="Create extras from the Extras page." />
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {extras.data?.data.map((extra) => {
                          const checked = form.extraIds.includes(extra.id);
                          return (
                            <label key={extra.id} className="flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 text-sm hover:bg-accent/40">
                              <span
                                role="checkbox"
                                aria-checked={checked}
                                className={cn("flex h-4 w-4 items-center justify-center rounded border", checked && "border-primary bg-primary text-primary-foreground")}
                              >
                                {checked && <Check className="h-3 w-3" />}
                              </span>
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={checked}
                                onChange={() =>
                                  set("extraIds", checked ? form.extraIds.filter((i) => i !== extra.id) : [...form.extraIds, extra.id])
                                }
                              />
                              <span className="flex-1">{extra.name}</span>
                              {extra.price != null && <span className="text-muted-foreground">+${extra.price}</span>}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </Section>
                  <Section title="Languages" description="Languages the trip is offered in.">
                    <div className="space-y-3">
                      <StringArrayInput value={form.languages} onChange={(v) => set("languages", v)} placeholder="Add a language" />
                      <LabelDescription text="Add the languages your guides can speak. Type and press Enter, or pick a common one below." />
                      <div className="flex flex-wrap gap-1.5">
                        {COMMON_LANGUAGES.filter((l) => !form.languages.includes(l)).map((l) => (
                          <button key={l} type="button" onClick={() => set("languages", [...form.languages, l])}>
                            <Badge variant="outline" className="cursor-pointer font-normal hover:bg-accent">
                              <Plus />
                              {l}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  </Section>
                </>
              )}

              {/* 15 — Additional info */}
              {stepKey === "info" && (
                <>
                  <InfoCard info="Add notes travelers should know before booking — packing tips, visa requirements, health advice, cancellation notes. Drag to reorder." />
                  {form.additionalInfo.length === 0 ? (
                    <EmptyState title="No additional info" hint="Add notes like packing tips or visa requirements." />
                  ) : (
                    <SortableList
                      className="space-y-2"
                      items={form.additionalInfo}
                      getId={(i) => i.id}
                      onReorder={(items) => set("additionalInfo", items)}
                      renderItem={(item, index, handle) => (
                        <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors hover:bg-muted/30">
                          <DragHandle handle={handle} />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            <span className="mr-2 text-muted-foreground">#{index + 1}</span>
                            {item.title.trim() || <span className="font-normal text-muted-foreground italic">Untitled</span>}
                          </span>
                          <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs" onClick={() => setInfoEdit(index)}>
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0 text-xs text-destructive hover:text-destructive"
                            onClick={() =>
                              confirmDialog(
                                {
                                  title: "Remove note?",
                                  description: "This additional information note will be deleted.",
                                },
                                () => set("additionalInfo", form.additionalInfo.filter((_, xi) => xi !== index)),
                              )
                            }
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    />
                  )}
                  <div className="flex justify-center pt-2">
                    <Button type="button" variant="outline" className="flex items-center gap-2 rounded-xl" onClick={() => setInfoAdd(true)}>
                      <Plus className="h-4 w-4" />
                      Add Info
                    </Button>
                  </div>

                  {infoAdd && (
                    <InfoDialog
                      confirmLabel="Add Info"
                      onSave={(data) => set("additionalInfo", [...form.additionalInfo, { id: uid(), ...data }])}
                      onOpenChange={(open) => {
                        if (!open) setInfoAdd(false);
                      }}
                    />
                  )}
                  {infoEdit !== null && form.additionalInfo[infoEdit] && (
                    <InfoDialog
                      confirmLabel="Save changes"
                      initial={form.additionalInfo[infoEdit]}
                      onSave={(data) => set("additionalInfo", form.additionalInfo.map((x, xi) => (xi === infoEdit ? { ...x, ...data } : x)))}
                      onOpenChange={(open) => {
                        if (!open) setInfoEdit(null);
                      }}
                    />
                  )}
                </>
              )}

              {/* 16 — FAQ */}
              {stepKey === "faq" && (
                <>
                  <InfoCard info="Group questions by topic. Each group can hold multiple questions." />
                  <Section
                    action={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => set("faq", [...form.faq, { id: uid(), title: "", items: [{ q: "", a: "" }] }])}
                      >
                        <Plus />
                        Add group
                      </Button>
                    }
                  >
                    {form.faq.length === 0 ? (
                      <EmptyState title="No FAQs yet" hint="Add question groups travelers commonly ask about." />
                    ) : (
                      <div className="space-y-6">
                        {form.faq.map((group, i) => (
                          <Fragment key={group.id}>
                            {i > 0 && <Separator />}
                            <FaqGroupBlock
                              group={group}
                              onChange={(next) => set("faq", form.faq.map((g, gi) => (gi === i ? next : g)))}
                              onRemove={() => set("faq", form.faq.filter((_, gi) => gi !== i))}
                            />
                          </Fragment>
                        ))}
                      </div>
                    )}
                  </Section>
                </>
              )}

              {/* 17 — SEO */}
              {stepKey === "seo" && (
                <>
                  <Section title="Search metadata" description="How this trip appears in search results.">
                    <div className="grid gap-4">
                      <Field label="Meta title" tooltip="The title shown in Google search results and browser tabs. Keep it 50–60 characters.">
                        <Input value={form.seo.metaTitle} onChange={(e) => setSeo({ metaTitle: e.target.value })} placeholder={form.title || "Inca Trail to Machu Picchu — 4 days"} />
                      </Field>
                      <Field label="Meta description" tooltip="A short summary shown under the title in search results. Keep it 150–160 characters." hint={`${form.seo.metaDescription.length}/160 characters`}>
                        <Textarea rows={3} maxLength={160} value={form.seo.metaDescription} onChange={(e) => setSeo({ metaDescription: e.target.value })} />
                      </Field>
                    </div>
                  </Section>
                  <Section title="Featured media" description="Image used when this trip is shared on social media.">
                    <div className="flex flex-wrap items-center gap-3">
                      {form.seo.featuredMedia ? (
                        <div className="relative">
                          <img src={form.seo.featuredMedia} alt="" className="h-24 w-40 rounded-xl border object-cover" />
                          <button
                            type="button"
                            aria-label="Remove featured media"
                            onClick={() =>
                              confirmDialog(
                                {
                                  title: "Remove featured image?",
                                  description: "The social share image will be removed.",
                                },
                                () => setSeo({ featuredMedia: "" }),
                              )
                            }
                            className="absolute -top-2 -right-2 rounded-xl bg-background p-0.5 shadow"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <AddImageButton className="w-40" label="Select image" onSelect={(media) => setSeo({ featuredMedia: media.url })} />
                      )}
                    </div>
                  </Section>
                  <Collapsible className="border-t pt-6">
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          <Info className="h-4 w-4 text-muted-foreground" />
                          Advanced
                        </span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="grid gap-4 pt-4">
                      <Field label="Meta keywords" tooltip="Comma-separated keywords. Most search engines ignore this, but it can help internal search.">
                        <Input value={form.seo.metaKeywords} onChange={(e) => setSeo({ metaKeywords: e.target.value })} placeholder="trekking, nepal, himalaya" />
                      </Field>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Author" tooltip="Name of the content author or organisation, used for attribution.">
                          <Input value={form.seo.metaAuthor} onChange={(e) => setSeo({ metaAuthor: e.target.value })} />
                        </Field>
                        <Field label="Robots" tooltip="Controls search engine indexing, e.g. index,follow or noindex.">
                          <Input value={form.seo.metaRobots} onChange={(e) => setSeo({ metaRobots: e.target.value })} placeholder="index,follow" />
                        </Field>
                      </div>
                      <Field label="Canonical URL" tooltip="The preferred URL if this content is available on multiple pages.">
                        <Input value={form.seo.canonicalUrl} onChange={(e) => setSeo({ canonicalUrl: e.target.value })} placeholder="https://…" />
                      </Field>
                      <Field label="Structured data (JSON-LD)" tooltip="Paste valid JSON-LD schema only (e.g. Article, Product, Organization). Invalid JSON can break rich results.">
                        <Textarea rows={4} value={form.seo.schema} onChange={(e) => setSeo({ schema: e.target.value })} placeholder='{"@context":"https://schema.org",…}' />
                      </Field>
                    </CollapsibleContent>
                  </Collapsible>
                </>
              )}
    </>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="sticky top-12 z-10 -mx-4 -mt-6 flex flex-wrap items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-8 md:-mt-8 md:px-8">
        <Button variant="ghost" size="icon" aria-label="Back to trips" onClick={() => confirmLeave() && navigate("/trips")}>
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-semibold tracking-tight">{form.title.trim() || (mode === "create" ? "New trip" : "Untitled trip")}</h1>
            <StatusBadge kind="trip" status={status} />
            {form.isFeatured && <Badge variant="outline">Featured</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {dirty ? (
              <span className="text-amber-600 dark:text-amber-400">Unsaved changes</span>
            ) : form.slug ? (
              `/${form.slug}`
            ) : (
              "Not saved yet"
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {status !== "PUBLISHED" && (
            <Button variant="outline" onClick={() => save("draft")} disabled={saving !== null || (mode === "edit" && !dirty)}>
              {saving === "draft" ? <Loader2 className="animate-spin" /> : <Save />}
              Save draft
            </Button>
          )}
          <Button onClick={() => save("publish")} disabled={saving !== null || (status === "PUBLISHED" && !dirty)}>
            {saving === "publish" ? <Loader2 className="animate-spin" /> : status === "PUBLISHED" ? <Save /> : <Upload />}
            {status === "PUBLISHED" ? "Save changes" : "Publish"}
          </Button>
        </div>
      </div>

      {isPage ? (
        <div className="grid gap-x-10 gap-y-8 pt-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="min-w-0 space-y-10">
            <TitleBlock
              title={form.title}
              onTitleChange={(v) => set("title", v)}
              slug={form.slug}
              onSlugChange={(v) => set("slug", v)}
              prefix={`${siteHost}/trips/`}
              placeholder="Trip name, e.g. Sunset kayak tour"
            />
            {PAGE_SECTIONS.map((section) => (
              <section key={section.key} id={`section-${section.key}`} className="scroll-mt-36 space-y-4 border-t pt-8">
                <div>
                  <h2 className="text-base font-semibold tracking-tight">{section.title}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">{section.description}</p>
                </div>
                {section.key === "summary" ? (
                  <RichTextEditor value={form.overview} onChange={(html) => set("overview", html)} minHeight={96} placeholder="A sunset paddle past sea caves, with a beach stop for snacks." />
                ) : section.key === "content" ? (
                  <RichTextEditor
                    value={form.content}
                    onChange={(html) => set("content", html)}
                    minHeight={420}
                    variant="document"
                    stickyToolbar="7.25rem"
                    placeholder="Describe the experience: what you'll do, where you meet, what to bring… Use headings to organise it."
                  />
                ) : (
                  <div className="space-y-6">{renderStep(section.key)}</div>
                )}
              </section>
            ))}
          </div>

          <aside className="space-y-6 lg:sticky lg:top-32 lg:max-h-[calc(100vh-9rem)] lg:self-start lg:overflow-y-auto">
            <div>
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-medium">Completeness</span>
                <span className="text-muted-foreground tabular-nums">{score}%</span>
              </div>
              <Progress value={score} className="mt-2 h-1.5" />
              <ol className="mt-3 space-y-0.5">
                {PAGE_SECTIONS.map((section) => {
                  const state = pageProgress[section.key] ?? 0;
                  const optional = !PAGE_REQUIRED.includes(section.key);
                  return (
                    <li key={section.key}>
                      <button
                        type="button"
                        onClick={() => document.getElementById(`section-${section.key}`)?.scrollIntoView({ behavior: "smooth" })}
                        className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                      >
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded-full border",
                            state === 1 && "border-primary bg-primary text-primary-foreground",
                            state === 0.5 && "border-amber-500",
                          )}
                        >
                          {state === 1 && <Check className="size-2.5" />}
                        </span>
                        <span className="flex-1 truncate">{section.title}</span>
                        {optional && <span className="text-[11px] text-muted-foreground/70">Optional</span>}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="space-y-4 border-t pt-6">
              <h2 className="text-sm font-semibold">Details</h2>
              <Field label="Duration" htmlFor="page-duration" hint="e.g. 3 hours, Full day, 2 days">
                <Input id="page-duration" value={form.duration} onChange={(e) => set("duration", e.target.value)} />
              </Field>
              <Field label="Max group size" htmlFor="page-capacity">
                <Input id="page-capacity" type="number" min={1} value={form.guestCapacity} onChange={(e) => set("guestCapacity", e.target.value)} />
              </Field>
              <Field label="Meeting point" htmlFor="page-meeting">
                <Input id="page-meeting" value={form.meetingPoint} onChange={(e) => set("meetingPoint", e.target.value)} />
              </Field>
              <label className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-sm font-medium">Featured trip</span>
                  <span className="block text-xs text-muted-foreground">Show it on your homepage.</span>
                </span>
                <Switch checked={form.isFeatured} onCheckedChange={(v) => set("isFeatured", v)} />
              </label>
            </div>

            <div className="space-y-2 border-t pt-6">
              <h2 className="text-sm font-semibold">Layout</h2>
              <p className="text-sm text-muted-foreground">Simple page. Need a day-by-day plan?</p>
              <Button variant="outline" size="sm" onClick={switchLayout}>
                <CalendarDays />
                Switch to itinerary
              </Button>
            </div>
          </aside>
        </div>
      ) : (
      <div className="grid gap-8 pt-2 lg:grid-cols-[232px_1fr]">
        {/* Stepper */}
        <nav aria-label="Trip editor steps" className="min-w-0 lg:sticky lg:top-32 lg:max-h-[calc(100vh-9rem)] lg:self-start lg:overflow-y-auto">
          <div className="mb-3 hidden px-2 lg:block">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium">Completeness</span>
              <span className="text-muted-foreground tabular-nums">{score}%</span>
            </div>
            <Progress value={score} className="mt-2 h-1.5" />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {Object.values(progress).filter((p) => p === 1).length} of {TRIP_STEPS.length} sections complete
            </p>
          </div>
          <ol className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0">
            {TRIP_STEPS.map((s, i) => {
              const state = progress[s.key];
              const active = i === step;
              return (
                <li key={s.key} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => setStep(i)}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                      active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums",
                        state === 1 && "border-primary bg-primary text-primary-foreground",
                        state === 0.5 && "border-amber-500 text-amber-600 dark:text-amber-400",
                        !state && active && "border-foreground/40 text-foreground",
                      )}
                    >
                      {state === 1 ? <Check className="size-3" /> : s.n}
                    </span>
                    <span className="truncate">{s.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 hidden border-t px-2 pt-4 lg:block">
            <p className="text-xs text-muted-foreground">Short trip or day tour?</p>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={switchLayout}>
              Switch to a simple page
            </Button>
          </div>
        </nav>

        {/* Step content */}
        <div className="min-w-0 space-y-6">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Step {current.n} of {TRIP_STEPS.length}
            </p>
            <h2 className="text-xl font-semibold tracking-tight">{current.title}</h2>
            <p className="text-sm text-muted-foreground">{current.description}</p>
          </div>

          <div className="space-y-8">{renderStep(current.key)}</div>

          <div className="flex items-center justify-between border-t pt-6 pb-8">
            <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              <ArrowLeft />
              Previous
            </Button>
            {step < TRIP_STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => Math.min(TRIP_STEPS.length - 1, s + 1))}>
                <span className="sm:hidden">Next</span>
                <span className="hidden sm:inline">Next: {TRIP_STEPS[step + 1].title}</span>
                <ArrowRight />
              </Button>
            ) : (
              <Button onClick={() => save("publish")} disabled={saving !== null}>
                {saving === "publish" ? <Loader2 className="animate-spin" /> : <Upload />}
                {status === "PUBLISHED" ? "Save changes" : "Publish trip"}
              </Button>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}


const LAYOUT_OPTIONS: {
  layout: TripLayout;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  points: string[];
}[] = [
  {
    layout: "ITINERARY",
    icon: CalendarDays,
    title: "Multi-day itinerary",
    body: "For trips with multiple days, day-by-day schedules, activities, accommodations, and other structured details.",
    points: ["Day-by-day plan, with variants", "Meals, stays and altitude profile", "Guided step-by-step editor"],
  },
  {
    layout: "PAGE",
    icon: FileText,
    title: "Simple page",
    body: "For short trips, weekend getaways, day tours, and experiences that need flexible content rather than a day-by-day structure.",
    points: ["One page of rich content", "Photos, price, FAQs", "Ready in a few minutes"],
  },
];

function LayoutChooser({ onChoose, onBack }: { onChoose: (layout: TripLayout) => void; onBack: () => void }) {
  return (
    <div className="mx-auto max-w-3xl py-4">
      <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={onBack}>
        <ArrowLeft />
        Trips
      </Button>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">What kind of trip is this?</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Pick the editor that fits. You can switch later without losing anything.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {LAYOUT_OPTIONS.map((option) => (
          <button
            key={option.layout}
            type="button"
            onClick={() => onChoose(option.layout)}
            className="group flex flex-col rounded-xl border bg-card p-6 text-left transition-all hover:border-primary/60 hover:shadow-md focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <option.icon className="size-5" />
            </span>
            <span className="mt-5 text-base font-semibold">{option.title}</span>
            <span className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{option.body}</span>
            <ul className="mt-5 flex-1 space-y-2 border-t pt-5 text-sm">
              {option.points.map((point) => (
                <li key={point} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {point}
                </li>
              ))}
            </ul>
            <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Start with this
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
