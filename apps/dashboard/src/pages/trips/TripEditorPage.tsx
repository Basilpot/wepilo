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
  label = "Add an image from your media library",
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
      <MediaPicker open={open} onOpenChange={setOpen} multiple={multiple} accept={accept} onSelect={onSelect} confirmLabel="Add the selected file" />
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
        Add at least two stops with an altitude each to see how the trail climbs and descends.
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
          <SheetDescription>Write a short heading, then the details travellers should read before they book.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-6 py-5">
          <Field label="Heading (what this note is about)" required>
            <Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Example: Visa requirements" />
          </Field>
          <Field label="Details" tooltip="You can make text bold, add bulleted lists and add links, using the buttons above the text box.">
            <RichTextEditor value={draft.description} onChange={(html) => setDraft((d) => ({ ...d, description: html }))} placeholder="Type the details travellers need to know here…" />
          </Field>
        </div>
        <SheetFooter className="border-t px-6 py-4">
          <div className="flex w-full gap-2">
            <Button className="flex-1" type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel and close</Button>
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
          <SheetDescription>Type a question travellers often ask, then write your answer.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-6 py-5">
          <Field label="The question travellers ask" required>
            <Input value={draft.q} onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))} placeholder="Example: How fit do I need to be?" />
          </Field>
          <Field label="Your answer" tooltip="You can make text bold, add bulleted lists and add links, using the buttons above the text box.">
            <RichTextEditor value={draft.a} onChange={(html) => setDraft((d) => ({ ...d, a: html }))} placeholder="Type your answer here…" />
          </Field>
        </div>
        <SheetFooter className="border-t px-6 py-4">
          <div className="flex w-full gap-2">
            <Button className="flex-1" type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel and close</Button>
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
          <SheetTitle>Edit the details of this image</SheetTitle>
          <SheetDescription>Add a short title and a caption. They help travellers and search engines understand the picture.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-6 py-5">
          <img src={draft.image} alt="" className="h-44 w-full rounded-xl border object-cover" />
          <Field label="Image title (optional)">
            <Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Example: Sunrise over the ridge" />
          </Field>
          <Field label="Caption (optional)">
            <Textarea rows={3} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="A short sentence describing the picture" />
          </Field>
        </div>
        <SheetFooter className="border-t px-6 py-4">
          <div className="flex w-full gap-2">
            <Button className="flex-1" type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel and close</Button>
            <Button className="flex-1"
            type="button"
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            Save these image details
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
          <SheetDescription>Describe what happens on this day. Only the title is required. Fill in the rest if it applies.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <Field label="Title of this day" required>
            <Input value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Example: Sunrise hike to the ridge" />
          </Field>
          <Field label="What happens on this day">
            <RichTextEditor value={draft.description} onChange={(html) => set({ description: html })} placeholder="Describe the activities, places and experiences of this day…" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Time spent travelling or walking">
              <Input value={draft.duration} onChange={(e) => set({ duration: e.target.value })} placeholder="Example: 4 hours" />
            </Field>
            <Field label="Distance covered">
              <Input value={draft.distance} onChange={(e) => set({ distance: e.target.value })} placeholder="Example: 12 km" />
            </Field>
            <Field label="Total climb (going up)">
              <Input value={draft.ascent} onChange={(e) => set({ ascent: e.target.value })} placeholder="Example: 600 m" />
            </Field>
            <Field label="Total descent (going down)">
              <Input value={draft.descent} onChange={(e) => set({ descent: e.target.value })} placeholder="Example: 400 m" />
            </Field>
            <Field label="Meals included this day">
              <Input value={draft.meals} onChange={(e) => set({ meals: e.target.value })} placeholder="Example: Breakfast, Lunch" />
            </Field>
            <Field label="Where travellers sleep this night">
              <Input value={draft.accommodations} onChange={(e) => set({ accommodations: e.target.value })} placeholder="Example: Mountain teahouse" />
            </Field>
          </div>

          <Section
            title="Pictures for this day"
            description={`Add up to ${MAX_DAY_IMAGES} images. Drag an image to change the order, or click an image to edit its title and caption.`}
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
                    label="Add an image"
                    onSelect={(media) =>
                      setImages([...draft.dayFeaturedImages, { id: uid(), image: media.url, title: media.title ?? "", description: "" }])
                    }
                  />
                ) : undefined
              }
              renderItem={(img, index, handle) => (
                <div className="group relative aspect-video overflow-hidden rounded-xl border bg-muted">
                  <button type="button" className="h-full w-full" aria-label="Edit the title and caption of this image" onClick={() => setImgIndex(index)}>
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
                      aria-label="Remove this image"
                      onClick={() =>
                        confirmDialog(
                          {
                            title: "Remove this image?",
                            description: "The image will be taken off this day. It stays in your media library.",
                            confirmLabel: "Yes, remove it",
                            cancelLabel: "No, keep it",
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
            <Button className="flex-1" type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel and close</Button>
            <Button className="flex-1"
            type="button"
            disabled={!draft.title.trim()}
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            Save this day
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
          <SheetTitle>{mode === "add" ? "Add another version of the itinerary" : "Edit this version of the itinerary"}</SheetTitle>
          <SheetDescription>An itinerary version is an alternative plan for the same trip, for example a faster or easier route. Give it a name and explain how it differs.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <Field label="Name of this version" required>
            <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Example: Standard itinerary" />
          </Field>
          <Field label="How this version is different (optional)" tooltip="Explain what makes this version different, for example the route, pace, season or difficulty.">
            <RichTextEditor value={draft.description} onChange={(html) => set({ description: html })} placeholder="Describe what makes this version different…" />
          </Field>
          <label className="flex items-start gap-3">
            <Switch checked={draft.isDefault} onCheckedChange={(v) => set({ isDefault: v })} />
            <span>
              <span className="block text-sm font-medium">Show this version first</span>
              <span className="block text-sm text-muted-foreground">This is the version travellers see first when they open the trip.</span>
            </span>
          </label>
        </div>

        <SheetFooter className="border-t px-6 py-4">
          <div className="flex w-full gap-2">
            <Button className="flex-1" type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel and close</Button>
            <Button className="flex-1"
            type="button"
            disabled={!draft.name.trim()}
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            {mode === "add" ? "Add this version" : "Save changes to this version"}
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
          <h3 className="text-sm font-semibold">{variant.name.trim() || "Untitled version (no name yet)"}</h3>
          {variant.isDefault && <Badge variant="secondary">Shown first</Badge>}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          <PenLine />
          Edit this version
        </Button>
      </div>

      {variant.days.length === 0 ? (
        <EmptyState title="No days added yet" hint="Select “Add a day” to describe the first day of this itinerary." />
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
                {day.title.trim() || <span className="font-normal text-muted-foreground italic">Untitled day (no title yet)</span>}
              </button>
              <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs" onClick={() => setSheet(dayIndex)}>
                Edit this day
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
                        description: "This day and everything you wrote for it will be deleted. This cannot be undone.",
                      },
                      () => setDays(variant.days.filter((_, i) => i !== dayIndex)),
                    )
                  }
                >
                  Delete this day
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
          Add a day
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
                        description: "This version of the itinerary and all of its days will be deleted. This cannot be undone.",
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
          Add another version of the itinerary
        </Button>
      </div>

      {variants.length === 0 || !active ? (
        <EmptyState title="No itinerary yet" hint="Select “Add another version of the itinerary” to start planning your days." />
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
          placeholder="Name of this group of questions, for example Booking"
          className="max-w-sm"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto"
          aria-label="Remove this group of questions"
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
        <EmptyState title="No questions in this group yet" hint="Select “Add a question” to write the first one." />
      ) : (
        <div className="space-y-2">
          {group.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors hover:bg-muted/30">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                <span className="mr-2 text-muted-foreground">#{i + 1}</span>
                {item.q.trim() || <span className="font-normal text-muted-foreground italic">Untitled question (nothing typed yet)</span>}
              </span>
              <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs" onClick={() => setEditIdx(i)}>
                Edit this question
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-xs text-destructive hover:text-destructive"
                onClick={() =>
                  confirmDialog(
                    {
                      title: "Remove this question?",
                      description: "The question and its answer will be deleted. This cannot be undone.",
                      confirmLabel: "Yes, remove it",
                      cancelLabel: "No, keep it",
                    },
                    () => setItems(group.items.filter((_, xi) => xi !== i)),
                  )
                }
              >
                Delete this question
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-center pt-1">
        <Button type="button" variant="outline" className="flex items-center gap-2 rounded-xl" onClick={() => setAdd(true)}>
          <Plus className="h-4 w-4" />
          Add a question
        </Button>
      </div>

      {add && (
        <FaqItemDialog
          confirmLabel="Add this question"
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
        title: next === "PAGE" ? "Change this trip to a simple one-page trip?" : "Change this trip to a day-by-day itinerary?",
        description:
          next === "PAGE"
            ? "The trip will be shown as one page of text, photos and prices. Nothing is deleted. Your day-by-day details are kept and come back if you switch again, but your website will not show them while the trip is a simple page."
            : "You will get the step-by-step editor with a day-by-day itinerary. Nothing is deleted. The page content you wrote is kept and comes back if you switch again.",
        confirmLabel: "Yes, change it",
        cancelLabel: "No, keep it as it is",
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
      toast.error("Please type a trip title with at least 3 letters before saving. The title is the first box on the page.");
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
      toast.success(kind === "publish" ? (status === "PUBLISHED" ? "Your changes were saved and are live on your website." : "Your trip is published and visible on your website.") : "Your draft was saved. It is not visible on your website yet.");
      if (mode === "create") navigate(`/trips/${newId}`, { replace: true });
    } catch (err) {
      toastApiError(err, "The trip could not be saved. What you typed is still on this page, so check your internet connection and try saving again.");
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
                    label="Trip title"
                    required
                    htmlFor="title"
                    tooltip="The name travellers see first. Keep it short, clear and appealing."
                    error={!titleReady && form.title.length > 0 ? "The title must have at least 3 characters." : undefined}
                  >
                    <Input id="title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Example: Inca Trail to Machu Picchu" />
                  </Field>
                  <Field
                    label="Web address ending (optional)"
                    htmlFor="slug"
                    tooltip="The last part of this trip’s web address. Use lowercase letters, numbers and dashes only, with no spaces. Example: inca-trail-to-machu-picchu"
                    hint="Leave this empty and we create it automatically from the trip title."
                  >
                    <Input id="slug" value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="inca-trail-to-machu-picchu" />
                  </Field>
                  <label className="flex items-center gap-3 rounded-xl border p-3">
                    <Switch checked={form.isFeatured} onCheckedChange={(v) => set("isFeatured", v)} />
                    <div>
                      <p className="text-sm font-medium">Feature this trip on my homepage</p>
                      <p className="text-xs text-muted-foreground">Turn this on to highlight the trip on your website homepage and in featured lists.</p>
                    </div>
                  </label>
                </div>
              )}

              {/* 2 — Overview */}
              {stepKey === "overview" && (
                <>
                  <Field label="Trip overview" tooltip="Write three to five sentences describing what travellers will do and experience on this trip.">
                    <RichTextEditor value={form.overview} onChange={(html) => set("overview", html)} placeholder="Describe the trip as if you were telling a friend what they will see and do…" />
                  </Field>
                  <InfoCard info="This is the short introduction shown at the top of the trip page. Keep it clear and specific, and focus on what travellers will experience." />
                </>
              )}

              {/* 3 — Categorization */}
              {stepKey === "categorization" && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Trip category" tooltip="The main type of trip, for example Trekking, Cultural tour or Luxury. Manage the list under “Trip categories” in the menu.">
                      <Combobox
                        value={form.tripCategoryId}
                        setValue={(v) => set("tripCategoryId", v)}
                        placeholder="Click to choose a category"
                        options={toOptions(categories.data?.data)}
                        onCreate={(label) => createRelation("/trip-categories", "tripCategories", label)}
                      />
                    </Field>
                    <Field label="Country the trip is in">
                      <Combobox
                        value={form.countryId}
                        setValue={(v) => set("countryId", v)}
                        placeholder="Click to choose a country"
                        options={toOptions(countries.data?.data)}
                        onCreate={(label) => createRelation("/countries", "countries", label)}
                      />
                    </Field>
                    <Field label="City or town it starts in">
                      <Combobox
                        value={form.cityId}
                        setValue={(v) => set("cityId", v)}
                        placeholder="Click to choose a city or town"
                        options={toOptions(cities.data?.data)}
                        onCreate={(label) => createRelation("/cities", "cities", label)}
                      />
                    </Field>
                    <Field label="Region inside the country">
                      <Combobox
                        value={form.regionId}
                        setValue={(v) => set("regionId", v)}
                        placeholder="Click to choose a region"
                        options={toOptions(regions.data?.data)}
                        onCreate={(label) => createRelation("/regions", "regions", label)}
                      />
                    </Field>
                  </div>
                  <Separator />
                  <Section title="Homepage themes" description="Themes group trips together in collections on your website, such as “Family friendly”. Create themes under “Homepage themes” in the menu.">
                    <MultiSelect
                      selected={form.featuredTagIds.map(String)}
                      onChange={(v) => set("featuredTagIds", v.map(Number))}
                      options={toOptions(tags.data?.data)}
                      placeholder="Click to choose one or more themes"
                    />
                    <InfoCard info="Themes help travellers discover this trip through collections on your website. Choose every theme that fits." />
                  </Section>
                </>
              )}

              {/* 4 — Highlights */}
              {stepKey === "highlights" && (
                <>
                  <RichTextEditor value={form.highlights} onChange={(html) => set("highlights", html)} placeholder="List the best moments of the trip, one per line…" />
                  <InfoCard info="Show the key experiences and memorable moments travellers can expect. Keep it short and specific, and focus on what makes this trip worth taking." />
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
                      "Upload clear, high-quality pictures that show the destination.",
                      "Use JPEG, PNG or WebP. Bright, well-lit and properly framed works best.",
                      "The first picture is used as the trip’s cover picture in lists on your website.",
                      "Use real photos of the actual trip. We recommend at least 3.",
                    ]}
                  />
                  <Section title="Photo gallery" description="Drag a photo to change the order. The first photo is used as the cover picture.">
                    <SortableList
                      grid
                      className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
                      items={form.images.map((url) => ({ id: url, url }))}
                      getId={(i) => i.id}
                      onReorder={(items) => set("images", items.map((i) => i.url))}
                      footer={
                        <AddImageButton
                          multiple
                          label="Add photos from your media library"
                          onSelect={(media) => set("images", form.images.includes(media.url) ? form.images : [...form.images, media.url])}
                        />
                      }
                      renderItem={(item, index, handle) => (
                        <div className="group relative aspect-video overflow-hidden rounded-xl border bg-muted">
                          <img src={item.url} alt="" className="h-full w-full object-cover" />
                          {index === 0 && <Badge className="absolute top-1.5 left-1.5">Cover photo</Badge>}
                          <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <span className="rounded bg-background/90">
                              <DragHandle handle={handle} />
                            </span>
                            <button
                              type="button"
                              aria-label="Remove this image"
                              onClick={() =>
                                confirmDialog(
                                  {
                                    title: "Remove this photo?",
                                    description: "The photo will be taken out of this trip’s gallery. It stays in your media library.",
                                    confirmLabel: "Yes, remove it",
                                    cancelLabel: "No, keep it",
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
                  <Section title="Introduction video (optional)" description="Paste a YouTube or Vimeo link, or upload a video file from your computer.">
                    <div className="grid gap-3 sm:max-w-sm">
                      <Input value={form.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} placeholder="Paste a YouTube or Vimeo web address here" />
                      <AddImageButton accept="video/*" label="Upload a video file" onSelect={(media) => set("videoUrl", media.url)} />
                    </div>
                  </Section>
                </>
              )}

              {/* 7 — Map */}
              {stepKey === "map" && (
                <>
                  <Field label="Explain the map" tooltip="Explain the route and what travellers can see on the map.">
                    <RichTextEditor
                      value={form.mapDescription}
                      onChange={(html) => set("mapDescription", html)}
                      placeholder="Describe the route, the main landmarks and the points of interest…"
                    />
                  </Field>
                  <Section title="Route map picture" description="Add a picture of the route map.">
                    <div className="grid gap-3 sm:max-w-md">
                      {form.routeMap ? (
                        <div className="relative aspect-video overflow-hidden rounded-xl border bg-muted">
                          <img src={form.routeMap} alt="Picture of the route map" className="h-full w-full object-contain" />
                          <button
                            type="button"
                            aria-label="Remove the route map picture"
                            onClick={() =>
                              confirmDialog(
                                {
                                  title: "Remove the route map picture?",
                                  description: "The picture will be taken off this trip. It stays in your media library.",
                                  confirmLabel: "Yes, remove it",
                                  cancelLabel: "No, keep it",
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
                        <AddImageButton label="Add a map picture" onSelect={(media) => set("routeMap", media.url)} />
                      )}
                      <Input value={form.routeMap} onChange={(e) => set("routeMap", e.target.value)} placeholder="Or paste the web address of a map picture" />
                    </div>
                  </Section>
                  <InfoCard info="A clear route map helps travelers visualise the journey before they book." />
                </>
              )}

              {/* 8 — Inclusions */}
              {stepKey === "inclusions" && (
                <>
                  <RichTextEditor value={form.inclusions} onChange={(html) => set("inclusions", html)} placeholder="List what is included, for example hotels, meals, guide, transport…" />
                  <InfoCard info="Be clear and specific. Travellers should know exactly what they are paying for. A bulleted list works best." />
                </>
              )}

              {/* 8 — Exclusions */}
              {stepKey === "exclusions" && (
                <>
                  <RichTextEditor value={form.exclusions} onChange={(html) => set("exclusions", html)} placeholder="List what is not included, for example flights, insurance, tips…" />
                  <InfoCard info="List what is not covered so travellers know what they will need to pay for separately." />
                </>
              )}

              {/* 9 — Duration & altitude */}
              {stepKey === "duration" && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="How long the trip lasts" tooltip="The total length of the trip, for example “8 days / 7 nights” or “6 hours”.">
                      <Input value={form.duration} onChange={(e) => set("duration", e.target.value)} placeholder="Example: 8 days / 7 nights" />
                    </Field>
                    <Field label="Highest point reached, in metres" tooltip="The highest altitude travellers reach during the trip, in metres above sea level.">
                      <Input type="number" min={0} value={form.maximumAltitude} onChange={(e) => set("maximumAltitude", e.target.value)} placeholder="Example: 5416" />
                    </Field>
                  </div>

                  <Section
                    title="Altitude chart (optional)"
                    description="Add each stop with its altitude to show travellers a chart of how the trail climbs and descends."
                    action={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => set("altitudeChart", [...form.altitudeChart, { id: uid(), location: "", altitude: "" }])}
                      >
                        <Plus />
                        Add a stop
                      </Button>
                    }
                  >
                    {form.altitudeChart.length === 0 ? (
                      <EmptyState title="No stops added yet" hint="Add at least two stops, each with an altitude, to draw the chart." />
                    ) : (
                      <div className="grid gap-6 lg:grid-cols-2">
                        <div className="space-y-2">
                          {form.altitudeChart.map((point, index) => (
                            <div key={point.id} className="flex items-end gap-2">
                              <div className="flex-1 space-y-1.5">
                                <label className="text-xs text-muted-foreground">Name of the place</label>
                                <Input
                                  value={point.location}
                                  placeholder="Example: Namche Bazaar"
                                  onChange={(e) => set("altitudeChart", form.altitudeChart.map((p, i) => (i === index ? { ...p, location: e.target.value } : p)))}
                                />
                              </div>
                              <div className="w-28 space-y-1.5">
                                <label className="text-xs text-muted-foreground">Altitude in metres</label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={point.altitude}
                                  placeholder="Example: 3440"
                                  onChange={(e) => set("altitudeChart", form.altitudeChart.map((p, i) => (i === index ? { ...p, altitude: e.target.value } : p)))}
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Remove this stop"
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
                  <Field label="Largest group size" tooltip="The maximum number of travellers you take on this trip.">
                    <Input type="number" min={1} value={form.guestCapacity} onChange={(e) => set("guestCapacity", e.target.value)} placeholder="Example: 12" />
                  </Field>
                  <Field label="How difficult the trip is" tooltip="Choose how physically demanding the trip is: Easy, Moderate, Hard or Extreme.">
                    <Select value={form.difficultyLevel || "none"} onValueChange={(v) => set("difficultyLevel", v === "none" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Click to choose a difficulty level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not chosen yet</SelectItem>
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
                  <Field label="Where travellers meet you at the start" tooltip="The place where travellers meet your guide to begin the trip.">
                    <Input value={form.meetingPoint} onChange={(e) => set("meetingPoint", e.target.value)} placeholder="Example: Tribhuvan International Airport" />
                  </Field>
                  <Field label="Where the trip ends" tooltip="The place where the trip finishes and travellers are dropped off.">
                    <Input value={form.dropOffPoint} onChange={(e) => set("dropOffPoint", e.target.value)} placeholder="Example: Same as the meeting point" />
                  </Field>
                </div>
              )}

              {/* 12 — Accommodation & meals */}
              {stepKey === "stay" && (
                <>
                  <Section title="Places to stay" description="Where travellers sleep during the trip.">
                    <StringArrayInput value={form.accommodations} onChange={(v) => set("accommodations", v)} placeholder="Type a kind of place to stay, for example Teahouse, then press Enter" />
                    <LabelDescription text="List the kinds of accommodation travellers can expect. Type each one and press Enter to add it." />
                  </Section>
                  <Section title="Meals included" description="The meals that are included in the price.">
                    <div className="space-y-3">
                      <StringArrayInput value={form.meals} onChange={(v) => set("meals", v)} placeholder="Type a meal, for example Breakfast, then press Enter" />
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
                    <Field label="Price for one traveller" tooltip="The price for one person, in US dollars.">
                      <Input type="number" min={0} value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="Example: 1200" />
                    </Field>
                    <Field label="Highest price (optional)" tooltip="Only fill this in if the price varies, for example by season or room type." hint="Only needed if the price is a range, for example $1200 to $1800.">
                      <Input type="number" min={0} value={form.maxPrice} onChange={(e) => set("maxPrice", e.target.value)} placeholder="Example: 1800" />
                    </Field>
                  </div>
                  <InfoCard info="Bookings are reservation requests only. Travellers are not charged through Wepilo, so enter the price you plan to collect from them yourself." />

                  <Section
                    title="Discounts for larger groups (optional)"
                    description="Offer a lower price when more people travel together. Each rule either takes a percentage off, or sets a fixed price for each person."
                    action={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => set("groupDiscount", [...form.groupDiscount, { id: uid(), groupSize: "", discount: "", discountType: "PERCENTAGE" }])}
                      >
                        <Plus />
                        Add a discount rule
                      </Button>
                    }
                  >
                    <label className="flex items-start gap-3">
                      <Switch checked={form.showGroupDiscount} onCheckedChange={(v) => set("showGroupDiscount", v)} />
                      <span>
                        <span className="block text-sm font-medium">Show the group discounts on my website</span>
                        <span className="block text-sm text-muted-foreground">Turn this off to hide the discounts while you are still deciding them.</span>
                      </span>
                    </label>
                    {form.groupDiscount.length === 0 ? (
                      <EmptyState title="No group discounts yet" hint="Select “Add a discount rule” to offer a lower price to larger groups." />
                    ) : (
                      <div className="space-y-2">
                        {form.groupDiscount.map((rule, index) => (
                          <div key={rule.id} className="flex items-end gap-2">
                            <div className="flex-1 space-y-1.5">
                              <label className="text-xs text-muted-foreground">Applies to groups of up to this many people</label>
                              <Input
                                type="number"
                                min={1}
                                value={rule.groupSize}
                                placeholder="Example: 5"
                                onChange={(e) => set("groupDiscount", form.groupDiscount.map((r, i) => (i === index ? { ...r, groupSize: e.target.value } : r)))}
                              />
                            </div>
                            <div className="flex-1 space-y-1.5">
                              <label className="text-xs text-muted-foreground">{rule.discountType === "FLAT" ? "Fixed price for each person" : "Percentage taken off"}</label>
                              <Input
                                type="number"
                                min={0}
                                value={rule.discount}
                                placeholder={rule.discountType === "FLAT" ? "Example: 950" : "Example: 10"}
                                onChange={(e) => set("groupDiscount", form.groupDiscount.map((r, i) => (i === index ? { ...r, discount: e.target.value } : r)))}
                              />
                            </div>
                            <div className="w-40 space-y-1.5">
                              <label className="text-xs text-muted-foreground">Kind of discount</label>
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
                                  <SelectItem value="PERCENTAGE">Percentage taken off (%)</SelectItem>
                                  <SelectItem value="FLAT">Fixed price for each person</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Remove this discount rule"
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
                  <Section title="Optional add-ons" description="Extra services travellers can add to their booking for this trip.">
                    {extras.data?.data.length === 0 ? (
                      <EmptyState title="You have no optional add-ons yet" hint="Create them first on the “Optional add-ons” page in the menu. They will then appear here for you to choose." />
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
                  <Section title="Languages" description="The languages your guides speak on this trip.">
                    <div className="space-y-3">
                      <StringArrayInput value={form.languages} onChange={(v) => set("languages", v)} placeholder="Type a language, for example English, then press Enter" />
                      <LabelDescription text="Add every language your guides can speak. Type one and press Enter, or pick a common one below." />
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
                  <InfoCard info="Add notes travellers should read before booking, such as packing tips, visa rules, health advice or your cancellation policy. Drag a note to change the order." />
                  {form.additionalInfo.length === 0 ? (
                    <EmptyState title="No extra notes yet" hint="Select “Add a note” to add things like packing tips or visa requirements." />
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
                            {item.title.trim() || <span className="font-normal text-muted-foreground italic">Untitled note (no heading yet)</span>}
                          </span>
                          <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs" onClick={() => setInfoEdit(index)}>
                            Edit this note
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0 text-xs text-destructive hover:text-destructive"
                            onClick={() =>
                              confirmDialog(
                                {
                                  title: "Remove this note?",
                                  description: "The note will be deleted. This cannot be undone.",
                                  confirmLabel: "Yes, remove it",
                                  cancelLabel: "No, keep it",
                                },
                                () => set("additionalInfo", form.additionalInfo.filter((_, xi) => xi !== index)),
                              )
                            }
                          >
                            Delete this note
                          </Button>
                        </div>
                      )}
                    />
                  )}
                  <div className="flex justify-center pt-2">
                    <Button type="button" variant="outline" className="flex items-center gap-2 rounded-xl" onClick={() => setInfoAdd(true)}>
                      <Plus className="h-4 w-4" />
                      Add a note
                    </Button>
                  </div>

                  {infoAdd && (
                    <InfoDialog
                      confirmLabel="Add this note"
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
                  <InfoCard info="Group questions by topic, for example Booking, Health or Packing. Each group can hold many questions." />
                  <Section
                    action={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => set("faq", [...form.faq, { id: uid(), title: "", items: [{ q: "", a: "" }] }])}
                      >
                        <Plus />
                        Add a group of questions
                      </Button>
                    }
                  >
                    {form.faq.length === 0 ? (
                      <EmptyState title="No frequently asked questions yet" hint="Select “Add a group of questions”, then add the questions travellers ask you most often." />
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
                  <Section title="How this trip appears on Google" description="Control the title and description shown in search results.">
                    <div className="grid gap-4">
                      <Field label="Search result title" tooltip="The title shown in Google search results and in browser tabs. Keep it between 50 and 60 characters.">
                        <Input value={form.seo.metaTitle} onChange={(e) => setSeo({ metaTitle: e.target.value })} placeholder={form.title || "Inca Trail to Machu Picchu — 4 days"} />
                      </Field>
                      <Field label="Search result description" tooltip="A short summary shown under the title in Google search results. Keep it between 150 and 160 characters." hint={`${form.seo.metaDescription.length} of 160 characters used`}>
                        <Textarea rows={3} maxLength={160} value={form.seo.metaDescription} onChange={(e) => setSeo({ metaDescription: e.target.value })} />
                      </Field>
                    </div>
                  </Section>
                  <Section title="Picture for social media" description="The picture shown when someone shares this trip on Facebook, WhatsApp or other social media.">
                    <div className="flex flex-wrap items-center gap-3">
                      {form.seo.featuredMedia ? (
                        <div className="relative">
                          <img src={form.seo.featuredMedia} alt="" className="h-24 w-40 rounded-xl border object-cover" />
                          <button
                            type="button"
                            aria-label="Remove the social media picture"
                            onClick={() =>
                              confirmDialog(
                                {
                                  title: "Remove the social media picture?",
                                  description: "The picture will be taken off this trip’s social media sharing. It stays in your media library.",
                                  confirmLabel: "Yes, remove it",
                                  cancelLabel: "No, keep it",
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
                        <AddImageButton className="w-40" label="Choose a picture" onSelect={(media) => setSeo({ featuredMedia: media.url })} />
                      )}
                    </div>
                  </Section>
                  <Collapsible className="border-t pt-6">
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          <Info className="h-4 w-4 text-muted-foreground" />
                          Advanced search settings (most people can skip these)
                        </span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="grid gap-4 pt-4">
                      <Field label="Keywords (optional)" tooltip="Words separated by commas. Most search engines ignore this, but it can help searches on your own website.">
                        <Input value={form.seo.metaKeywords} onChange={(e) => setSeo({ metaKeywords: e.target.value })} placeholder="Example: trekking, nepal, himalaya" />
                      </Field>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Content author (optional)" tooltip="The name of the person or company that wrote this content.">
                          <Input value={form.seo.metaAuthor} onChange={(e) => setSeo({ metaAuthor: e.target.value })} />
                        </Field>
                        <Field label="Search engine instructions (advanced)" tooltip="Tells Google whether to list this page. Leave it as index,follow to appear in search results, or type noindex to hide it from Google.">
                          <Input value={form.seo.metaRobots} onChange={(e) => setSeo({ metaRobots: e.target.value })} placeholder="index,follow" />
                        </Field>
                      </div>
                      <Field label="Original source link (advanced)" tooltip="Only fill this in if the same content is also published on another web address that you prefer Google to show.">
                        <Input value={form.seo.canonicalUrl} onChange={(e) => setSeo({ canonicalUrl: e.target.value })} placeholder="https://…" />
                      </Field>
                      <Field label="Structured data for developers (JSON-LD)" tooltip="Only for developers. Paste valid JSON-LD only. Invalid code can stop Google from showing rich results.">
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
        <Button variant="ghost" size="icon" aria-label="Go back to the list of all trips" onClick={() => confirmLeave() && navigate("/trips")}>
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-semibold tracking-tight">{form.title.trim() || (mode === "create" ? "Create a new trip" : "Untitled trip (no title yet)")}</h1>
            <StatusBadge kind="trip" status={status} />
            {form.isFeatured && <Badge variant="outline">Featured on homepage</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {dirty ? (
              <span className="text-amber-600 dark:text-amber-400">You have unsaved changes. Save before leaving this page.</span>
            ) : form.slug ? (
              `/${form.slug}`
            ) : (
              "Not saved yet. Nothing is stored until you save."
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {status !== "PUBLISHED" && (
            <Button variant="outline" onClick={() => save("draft")} disabled={saving !== null || (mode === "edit" && !dirty)}>
              {saving === "draft" ? <Loader2 className="animate-spin" /> : <Save />}
              Save as a hidden draft
            </Button>
          )}
          <Button onClick={() => save("publish")} disabled={saving !== null || (status === "PUBLISHED" && !dirty)}>
            {saving === "publish" ? <Loader2 className="animate-spin" /> : status === "PUBLISHED" ? <Save /> : <Upload />}
            {status === "PUBLISHED" ? "Save changes to the live trip" : "Publish to my website"}
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
              placeholder="Type the name of your trip, for example Sunset kayak tour"
            />
            {PAGE_SECTIONS.map((section) => (
              <section key={section.key} id={`section-${section.key}`} className="scroll-mt-36 space-y-4 border-t pt-8">
                <div>
                  <h2 className="text-base font-semibold tracking-tight">{section.title}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">{section.description}</p>
                </div>
                {section.key === "summary" ? (
                  <RichTextEditor value={form.overview} onChange={(html) => set("overview", html)} minHeight={96} placeholder="Example: A sunset paddle past sea caves, with a beach stop for snacks." />
                ) : section.key === "content" ? (
                  <RichTextEditor
                    value={form.content}
                    onChange={(html) => set("content", html)}
                    minHeight={420}
                    variant="document"
                    stickyToolbar="7.25rem"
                    placeholder="Describe the experience: what travellers will do, where you meet, what to bring… Use headings to organise it into sections."
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
                <span className="font-medium">How complete this trip is</span>
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
                        {optional && <span className="text-[11px] text-muted-foreground/70">Optional, can be skipped</span>}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="space-y-4 border-t pt-6">
              <h2 className="text-sm font-semibold">Practical details</h2>
              <Field label="How long the trip lasts" htmlFor="page-duration" hint="Examples: 3 hours, Full day, 2 days">
                <Input id="page-duration" value={form.duration} onChange={(e) => set("duration", e.target.value)} />
              </Field>
              <Field label="Largest group size" htmlFor="page-capacity">
                <Input id="page-capacity" type="number" min={1} value={form.guestCapacity} onChange={(e) => set("guestCapacity", e.target.value)} />
              </Field>
              <Field label="Where travellers meet you" htmlFor="page-meeting">
                <Input id="page-meeting" value={form.meetingPoint} onChange={(e) => set("meetingPoint", e.target.value)} />
              </Field>
              <label className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-sm font-medium">Feature this trip on my homepage</span>
                  <span className="block text-xs text-muted-foreground">Turn this on to show the trip on your website homepage.</span>
                </span>
                <Switch checked={form.isFeatured} onCheckedChange={(v) => set("isFeatured", v)} />
              </label>
            </div>

            <div className="space-y-2 border-t pt-6">
              <h2 className="text-sm font-semibold">Trip format</h2>
              <p className="text-sm text-muted-foreground">This trip is a simple one-page trip. Need to show a day-by-day plan instead?</p>
              <Button variant="outline" size="sm" onClick={switchLayout}>
                <CalendarDays />
                Change to a day-by-day itinerary
              </Button>
            </div>
          </aside>
        </div>
      ) : (
      <div className="grid gap-8 pt-2 lg:grid-cols-[232px_1fr]">
        {/* Stepper */}
        <nav aria-label="Steps for filling in this trip" className="min-w-0 lg:sticky lg:top-32 lg:max-h-[calc(100vh-9rem)] lg:self-start lg:overflow-y-auto">
          <div className="mb-3 hidden px-2 lg:block">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium">How complete this trip is</span>
              <span className="text-muted-foreground tabular-nums">{score}%</span>
            </div>
            <Progress value={score} className="mt-2 h-1.5" />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {Object.values(progress).filter((p) => p === 1).length} of {TRIP_STEPS.length} steps completed
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
            <p className="text-xs text-muted-foreground">Is this a short trip or a day tour?</p>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={switchLayout}>
              Change to a simple one-page trip
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
              Go to the previous step
            </Button>
            {step < TRIP_STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => Math.min(TRIP_STEPS.length - 1, s + 1))}>
                <span className="sm:hidden">Go to the next step</span>
                <span className="hidden sm:inline">Go to the next step: {TRIP_STEPS[step + 1].title}</span>
                <ArrowRight />
              </Button>
            ) : (
              <Button onClick={() => save("publish")} disabled={saving !== null}>
                {saving === "publish" ? <Loader2 className="animate-spin" /> : <Upload />}
                {status === "PUBLISHED" ? "Save changes to the live trip" : "Publish this trip to my website"}
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
    title: "Day-by-day itinerary",
    body: "Best for trips that last several days. You fill in the trip step by step: a plan for each day, places to stay, meals, a map, prices and more.",
    points: ["A plan for each day, with optional alternative versions", "Meals, places to stay and an altitude chart", "A guided editor that walks you through 18 steps"],
  },
  {
    layout: "PAGE",
    icon: FileText,
    title: "Simple one-page trip",
    body: "Best for day tours, weekend getaways and experiences that do not need a plan for each day. You write everything on one flexible page.",
    points: ["One page where you write freely, with headings and photos", "Photos, price and frequently asked questions", "Ready to publish in a few minutes"],
  },
];

function LayoutChooser({ onChoose, onBack }: { onChoose: (layout: TripLayout) => void; onBack: () => void }) {
  return (
    <div className="mx-auto max-w-3xl py-4">
      <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={onBack}>
        <ArrowLeft />
        Back to all trips
      </Button>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Which format fits your new trip?</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Choose the way you want to fill in this trip. If you change your mind later, you can switch formats and nothing you wrote is lost.
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
              Choose this format
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
