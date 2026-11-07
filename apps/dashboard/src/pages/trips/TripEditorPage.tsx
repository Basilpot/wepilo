import { SaveDayButton, InsertSavedDay } from "@/pages/trips/SavedDays";
import { MoneyInput } from "@/components/money-input";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock,
  CreditCard,
  Footprints,
  Package,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  ImageIcon,
  ImagePlus,
  HelpCircle,
  Info,
  Loader2,
  PenLine,
  Plus,
  Search,
  Save,
  Trash2,
  Upload,
  X,
  ExternalLink,
} from "@/components/icons";
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
import { LOCATION_CATEGORIES, locationCategoryLabel } from "@/lib/locations";
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
import { getDefaultCurrency, money } from "@/lib/format";

type OptionRow = { id: number; name: string | null; handle?: string };
type TripResponse = { activity: Record<string, unknown> };

const DIFFICULTIES = [
  { value: "EASY", label: "Easy" },
  { value: "MODERATE", label: "Moderate" },
  { value: "HARD", label: "Hard" },
  { value: "EXTREME", label: "Extreme" },
];

const COMMON_LANGUAGES = ["English", "Spanish", "French", "German", "Italian", "Portuguese", "Mandarin", "Japanese", "Arabic", "Hindi"];
const STAY_PRESETS = ["Teahouse", "Lodge", "Hotel", "Guesthouse", "Homestay", "Camping", "Resort", "Hostel"];
/** Ideas shown as one-click suggestions until the agency has made its own. Picking one creates it. */
const CATEGORY_PRESETS = ["Trekking", "Cultural tour", "Wildlife safari", "Day tour", "City tour", "Cycling", "Rafting", "Luxury"];
const TAG_PRESETS = ["Family friendly", "Adventure", "Best seller", "Budget", "Photography", "Small groups", "Off the beaten path", "Honeymoon"];
const MEAL_PRESETS = ["Breakfast", "Lunch", "Dinner", "Vegan", "Halal", "Vegetarian"];

/** The 18 itinerary steps, grouped so the stepper reads as a few short chapters. */
const STEP_GROUPS: { label: string; keys: string[] }[] = [
  { label: "The trip", keys: ["basics", "overview", "categorization", "highlights"] },
  { label: "Itinerary", keys: ["itinerary"] },
  { label: "Photos and map", keys: ["media", "map"] },
  { label: "What's included", keys: ["inclusions", "exclusions", "stay"] },
  { label: "Practical details", keys: ["duration", "capacity"] },
  { label: "Price and extras", keys: ["pricing", "extras"] },
  { label: "Before booking", keys: ["info", "faq", "seo"] },
];

/** Every itinerary step in order, one screen each. */
const GROUP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "The trip": Footprints,
  Itinerary: CalendarDays,
  "Photos and map": ImageIcon,
  "What's included": Package,
  "Practical details": Clock,
  "Price and extras": CreditCard,
  "Before booking": FileText,
};

const FLAT_KEYS = STEP_GROUPS.flatMap((g) => g.keys.filter((k) => TRIP_STEPS.some((t) => t.key === k)));

/** Short advice shown beside a step on wide screens. */
const STEP_TIPS: Record<string, { title: string; points: string[] }> = {
  basics: { title: "Naming your trip", points: ["Lead with the place, then the activity: “Inca Trail to Machu Picchu”.", "Add what makes it special, such as the length or a key inclusion.", "The web address is made from the title. You can change it later, but links you already shared will break."] },
  overview: { title: "Writing the overview", points: ["This is the short introduction shown at the top of the trip page.", "Two or three sentences are enough.", "Say what travellers will see and do, not how great you are."] },
  categorization: { title: "Locations and themes", points: ["Add every place this trip visits, from the country down to landmarks. Travellers filter trips by them.", "Themes help travellers discover this trip through collections on your website. Choose every theme that fits."] },
  highlights: { title: "Writing highlights", points: ["Show the key experiences and memorable moments travellers can expect.", "Keep it short and specific, and focus on what makes this trip worth taking."] },
  itinerary: { title: "Planning the days", points: ["Add one entry per day, in order. Drag to reorder.", "Use variants for an alternative route or pace.", "Meals, stays and altitude per day help travellers compare trips."] },
  map: { title: "The route map", points: ["A clear route map helps travellers visualise the journey before they book.", "Explain the route in the description so the picture is easy to follow."] },
  inclusions: { title: "Be specific", points: ["Travellers should know exactly what they are paying for.", "A bulleted list works best, one item per line.", "Match what you promise in the description and highlights."] },
  exclusions: { title: "What is not covered", points: ["List what is not covered so travellers know what they will need to pay for separately.", "Anything not listed under inclusions, travellers will assume is not covered."] },
  pricing: { title: "Setting the price", points: ["Bookings are reservation requests only. Travellers are not charged through Wepilo, so enter the price you plan to collect from them yourself.", "Price is per traveller, in your account currency.", "Group discounts show on your website only if you turn them on."] },
  info: { title: "Before they book", points: ["Add notes travellers should read before booking, such as packing tips, visa rules, health advice or your cancellation policy.", "Drag a note to change the order."] },
  faq: { title: "Answering questions", points: ["Group questions by topic, for example Booking, Health or Packing.", "Each group can hold many questions."] },
  duration: { title: "Length and altitude", points: ["Say how long the trip lasts in plain words, such as “7 days”.", "Altitude stops draw the climb chart on your trip page."] },
  capacity: { title: "Group, difficulty and meeting points", points: ["Capacity is the largest group you take on one departure.", "Be honest about difficulty. It prevents refunds and bad reviews.", "Give an address or landmark travellers can find easily, and say what time to arrive if it matters."] },
  stay: { title: "Where they sleep and eat", points: ["List the type of stay for each night, such as tea house or hotel.", "Say which meals are included and which are not."] },
  extras: { title: "Extras and languages", points: ["Extras are optional add-ons travellers can choose, such as a porter or an upgrade.", "List every language your guides speak well."] },
  seo: { title: "Search appearance", points: ["Keep the title under 60 characters and the description under 160.", "Leave blank to use the trip title and overview."] },
};

/** The steps of a simple page: fewer, and each one short. The first holds the trip's name. */
const PAGE_STEPS: { key: string; title: string; description: string }[] = [...PAGE_SECTIONS];
const PAGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  content: PenLine,
  media: ImageIcon,
  pricing: CreditCard,
  categorization: Package,
  inclusions: Package,
  exclusions: Package,
  faq: Info,
  seo: Search,
};

/** Optional simple-page sections that stay folded until they have content or are opened. */
const FOLDABLE_PAGE_SECTIONS = ["inclusions", "exclusions", "faq", "seo"];

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
      <MediaPicker open={open} onOpenChange={setOpen} multiple={multiple} kind={accept?.startsWith("video") ? "video" : "image"} accept={accept} onSelect={onSelect} confirmLabel="Add" />
    </>
  );
}

function PhotoUploadButton({ onSelect }: { onSelect: (media: MediaItem) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="lg" onClick={() => setOpen(true)}>
        <ImagePlus />
        Upload photos
      </Button>
      <MediaPicker open={open} onOpenChange={setOpen} multiple kind="image" onSelect={onSelect} confirmLabel="Add" />
    </>
  );
}

// ── Reusable borderless section ───────────────────────────────────────────────

function Section({
  title,
  description,
  action,
  defaultOpen = true,
  children,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!title) {
    return (
      <section className="space-y-3">
        {action && <div className="flex justify-end">{action}</div>}
        {children}
      </section>
    );
  }
  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section className="rounded-xl border bg-card text-card-foreground">
        <div className="flex items-start gap-3 px-4 py-3">
          <CollapsibleTrigger asChild>
            <button type="button" className="min-w-0 flex-1 text-left">
              <span className="block text-sm font-semibold">{title}</span>
              {description && <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>}
            </button>
          </CollapsibleTrigger>
          {/* Header actions such as "Add point" only make sense while the section is open. */}
          {open && action}
          {/* The chevron comes last, so it sits in the same corner whether or not there is a button beside it. */}
          <CollapsibleTrigger asChild>
            <button type="button" aria-label={open ? `Fold away ${title}` : `Open ${title}`} className="group mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
              <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
            </button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="space-y-3 border-t px-4 py-4">{children}</div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

/** A muted, collapsible section bar for use inside side sheets. */
function SheetSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="group/sheet-section">
      <CollapsibleTrigger asChild>
        <button type="button" className="flex w-full items-center justify-between rounded-lg bg-muted px-4 py-3 text-left text-sm font-medium hover:bg-muted/80">
          {title}
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]/sheet-section:rotate-180" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-6 px-1 pt-6 pb-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
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
          <Field label="Heading" required>
            <Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Example: Visa requirements" />
          </Field>
          <Field label="Details" tooltip="You can make text bold, add bulleted lists and add links, using the buttons above the text box.">
            <RichTextEditor value={draft.description} onChange={(html) => setDraft((d) => ({ ...d, description: html }))} placeholder="Type the details travellers need to know here…" />
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
          <SheetDescription>Type a question travellers often ask, then write your answer.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-6 py-5">
          <Field label="Question" required>
            <Input value={draft.q} onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))} placeholder="Example: How fit do I need to be?" />
          </Field>
          <Field label="Answer" tooltip="You can make text bold, add bulleted lists and add links, using the buttons above the text box.">
            <RichTextEditor value={draft.a} onChange={(html) => setDraft((d) => ({ ...d, a: html }))} placeholder="Type your answer here…" />
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
          <SheetDescription>Add a short title and a caption. They help travellers and search engines understand the picture.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-6 py-5">
          <img src={draft.image} alt="" className="h-44 w-full rounded-xl border object-cover" />
          <Field label="Title">
            <Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Sunrise over the ridge" />
          </Field>
          <Field label="Description">
            <Textarea rows={3} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="A short sentence describing the picture" />
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

function DayEditor({ day, onChange }: { day: ItineraryDay; onChange: (next: ItineraryDay) => void }) {
  const [imgIndex, setImgIndex] = useState<number | null>(null);
  // The picker calls onSelect once per chosen photo, back to back, before React re-renders.
  // Each call must build on the previous one, so keep the newest day in a ref and update it right away.
  const latest = useRef(day);
  latest.current = day;
  const set = (patch: Partial<ItineraryDay>) => onChange({ ...day, ...patch });
  const addPhoto = (media: MediaItem) => {
    const current = latest.current;
    if (current.dayFeaturedImages.some((im) => im.image === media.url)) return;
    const next = {
      ...current,
      dayFeaturedImages: [...current.dayFeaturedImages, { id: uid(), image: media.url, title: media.title ?? "", description: "" }],
    };
    latest.current = next;
    onChange(next);
  };
  const setImages = (dayFeaturedImages: ItineraryImage[]) => set({ dayFeaturedImages });

  return (
    <div className="space-y-6">
      <SheetSection title="General">
        <Field label="Title" required hint="Give the day a short, clear name, for example “Sunrise hike to the ridge”.">
          <Input value={day.title} onChange={(e) => set({ title: e.target.value })} placeholder="Sunrise hike to the ridge" />
        </Field>
        <Field label="Description" hint="Describe the activities, places and experiences of this day, in the order they happen.">
          <RichTextEditor value={day.description} onChange={(html) => set({ description: html })} minHeight={220} placeholder="Describe the activities, places and experiences of this day…" />
        </Field>
      </SheetSection>

      <SheetSection title="Details">
        <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2">
          <Field label="Duration" hint="How long the day takes.">
            <Input value={day.duration} onChange={(e) => set({ duration: e.target.value })} placeholder="e.g. 1 night / 1 day" />
          </Field>
          <Field label="Distance" hint="How far travellers go.">
            <Input value={day.distance} onChange={(e) => set({ distance: e.target.value })} placeholder="e.g. 13 km" />
          </Field>
          <Field label="Ascent">
            <Input value={day.ascent} onChange={(e) => set({ ascent: e.target.value })} placeholder="e.g. 600 m" />
          </Field>
          <Field label="Descent">
            <Input value={day.descent} onChange={(e) => set({ descent: e.target.value })} placeholder="e.g. 400 m" />
          </Field>
          <Field label="Meals">
            <Input value={day.meals} onChange={(e) => set({ meals: e.target.value })} placeholder="e.g. Breakfast, Lunch" />
          </Field>
          <Field label="Accommodation">
            <Input value={day.accommodations} onChange={(e) => set({ accommodations: e.target.value })} placeholder="e.g. Tea house" />
          </Field>
        </div>
      </SheetSection>

      <SheetSection title="Featured images (optional)">
        <p className="-mt-2 text-[13px] leading-relaxed text-muted-foreground">Drag to reorder, or <strong className="font-semibold text-foreground">click a photo</strong> to edit its title and caption.</p>
        <SortableList
          grid
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          items={day.dayFeaturedImages}
          getId={(im) => im.id}
          onReorder={setImages}
          footer={
            <AddImageButton multiple label="Add photos" onSelect={addPhoto} />
          }
          renderItem={(img, index, handle) => (
            <div className="group relative aspect-video overflow-hidden rounded-xl border bg-muted">
              <button type="button" className="h-full w-full" aria-label="Edit the title and caption of this photo" onClick={() => setImgIndex(index)}>
                <img src={img.image} alt="" className="h-full w-full object-cover" />
              </button>
              {img.title && (
                <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-background/85 backdrop-blur-sm px-2 pt-4 pb-1 text-xs text-foreground">
                  {img.title}
                </span>
              )}
              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <span className="rounded bg-background/90">
                  <DragHandle handle={handle} />
                </span>
                <button
                  type="button"
                  aria-label="Remove this photo"
                  onClick={() =>
                    confirmDialog(
                      { title: "Remove photo?", description: "The photo will be taken off this day. It stays in your media library." },
                      () => setImages(day.dayFeaturedImages.filter((_, xi) => xi !== index)),
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
      </SheetSection>
      {imgIndex !== null && day.dayFeaturedImages[imgIndex] && (
        <DayImageDialog
          image={day.dayFeaturedImages[imgIndex]}
          onSave={(next) => setImages(day.dayFeaturedImages.map((im, i) => (i === imgIndex ? next : im)))}
          onOpenChange={(open) => {
            if (!open) setImgIndex(null);
          }}
        />
      )}
    </div>
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
          <SheetDescription>An itinerary version is an alternative plan for the same trip, for example a faster or easier route. Give it a name and explain how it differs.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <Field label="Name" required>
            <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Standard itinerary" />
          </Field>
          <Field label="Description" tooltip="Explain what makes this version different, for example the route, pace, season or difficulty.">
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

/** Edit one day in a side sheet. Changes apply only when saved. */
function DaySheet({
  day,
  mode,
  number,
  onSave,
  onOpenChange,
}: {
  day: ItineraryDay;
  mode: "add" | "edit";
  number: number;
  onSave: (next: ItineraryDay) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState(day);
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[min(56rem,92vw)]">
        <SheetHeader className="space-y-2 px-8 pt-8 pb-6 pr-16">
          <SheetTitle className="text-2xl font-semibold tracking-tight">{mode === "add" ? `Add day ${number}` : `Edit day ${number}`}</SheetTitle>
          <SheetDescription>Required fields are marked with *</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          <DayEditor day={draft} onChange={setDraft} />
        </div>
        <SheetFooter className="border-t bg-muted/50 px-8 py-4">
          <div className="flex w-full gap-3">
            <Button type="button" variant="secondary" size="lg" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="lg"
              className="flex-1"
              disabled={!draft.title.trim()}
              onClick={() => {
                onSave(draft);
                onOpenChange(false);
              }}
            >
              {mode === "add" ? "Add day" : "Save changes"}
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
  const [sheet, setSheet] = useState<{ mode: "add"; day: ItineraryDay } | { mode: "edit"; id: string } | null>(null);
  const setDays = (days: ItineraryDay[]) => onChange({ ...variant, days });

  const prepare = (data?: Partial<ItineraryDay>): ItineraryDay => {
    const day = { ...newDay(variant.days.length + 1), ...data };
    day.id = uid();
    day.day = variant.days.length + 1;
    if (data?.dayFeaturedImages) day.dayFeaturedImages = data.dayFeaturedImages.map((im) => ({ ...im, id: uid() }));
    return day;
  };

  const removeDay = (index: number) =>
    confirmDialog(
      { title: `Remove day ${index + 1}?`, description: "This day and everything you wrote for it will be deleted. This cannot be undone." },
      () => setDays(variant.days.filter((_, i) => i !== index).map((d, i) => ({ ...d, day: i + 1 }))),
    );

  const editing = sheet?.mode === "edit" ? variant.days.find((d) => d.id === sheet.id) : undefined;
  const editingIndex = editing ? variant.days.findIndex((d) => d.id === editing.id) : -1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">{variant.name.trim() || "Untitled variant"}</h3>
          {variant.isDefault && <Badge variant="secondary">Default</Badge>}
          <span className="text-sm text-muted-foreground">
            {variant.days.length} day{variant.days.length === 1 ? "" : "s"}
          </span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          <PenLine />
          Edit variant
        </Button>
      </div>

      <SortableList
        className="space-y-3"
        items={variant.days}
        getId={(d) => d.id}
        onReorder={(days) => setDays(days.map((d, i) => ({ ...d, day: i + 1 })))}
        renderItem={(day, dayIndex, handle) => (
          <div className="group flex items-center gap-2 rounded-2xl border border-border/80 bg-card py-3.5 pr-4 pl-2 shadow-sm transition-shadow hover:shadow-md">
            <DragHandle handle={handle} />
            <button type="button" onClick={() => setSheet({ mode: "edit", id: day.id })} className="flex min-w-0 flex-1 items-baseline gap-3 text-left">
              <span className="text-base text-muted-foreground tabular-nums">#{dayIndex + 1}</span>
              <span className="min-w-0">
                <span className="block truncate text-base font-medium">
                  {day.title.trim() || <span className="font-normal text-muted-foreground italic">Untitled day</span>}
                </span>
                {(day.accommodations || day.meals || day.dayFeaturedImages.length > 0) && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {[day.meals, day.accommodations, day.dayFeaturedImages.length > 0 && `${day.dayFeaturedImages.length} photo${day.dayFeaturedImages.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
            </button>
            <SaveDayButton day={day} />
            <button type="button" onClick={() => setSheet({ mode: "edit", id: day.id })} className="rounded-md px-2 py-1 text-sm font-medium hover:bg-muted">
              Edit
            </button>
            <button
              type="button"
              onClick={() => removeDay(dayIndex)}
              aria-label={`Delete day ${dayIndex + 1}`}
              className="rounded-md px-2 py-1 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              Delete
            </button>
          </div>
        )}
      />

      {variant.days.length === 0 && <EmptyState title="No days yet" hint="Select “Add day” to describe the first day of this itinerary." />}

      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        <Button type="button" variant="outline" size="lg" onClick={() => setSheet({ mode: "add", day: prepare() })}>
          <Plus />
          Add day
        </Button>
        <InsertSavedDay onInsert={(data) => setSheet({ mode: "add", day: prepare(data) })} />
      </div>

      {sheet?.mode === "add" && (
        <DaySheet
          day={sheet.day}
          mode="add"
          number={variant.days.length + 1}
          onSave={(next) => setDays([...variant.days, next])}
          onOpenChange={(open) => {
            if (!open) setSheet(null);
          }}
        />
      )}
      {editing && (
        <DaySheet
          key={editing.id}
          day={editing}
          mode="edit"
          number={editingIndex + 1}
          onSave={(next) => setDays(variant.days.map((d) => (d.id === editing.id ? next : d)))}
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
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Itinerary versions" className="inline-flex max-w-full flex-wrap gap-1 rounded-full bg-muted p-1">
        {variants.map((v, i) => {
          const isActive = i === activeIndex;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setActiveId(v.id)}
              role="tab"
              aria-selected={isActive}
              className={cn(
                "flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-200",
                isActive
                  ? "bg-background text-primary shadow-sm dark:bg-input/40"
                  : "text-muted-foreground hover:text-foreground",
              )}
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
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setSheet({ mode: "add" })}>
          <Plus />
          Add Variant
        </Button>
      </div>

      {variants.length === 0 || !active ? (
        <EmptyState title="No itinerary" hint="Select “Add Variant” to start planning your days." />
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

/** Tells whoever is entering prices which currency they are in, and whether visitors can see them converted. */
function CurrencyNotice({ translation }: { translation: boolean }) {
  const code = getDefaultCurrency();
  return (
    <div role="note" className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="space-y-1">
        <p className="font-medium">Prices are in {code}</p>
        <p className="text-muted-foreground">
          That is the currency set in your payment settings, so enter every price here in {code}.{" "}
          {translation
            ? `Currency translation is on, so visitors can see these prices converted to their own currency on your website. Travellers are still charged in ${code}.`
            : "Currency translation is off, so your website shows prices in " + code + " only. You can turn it on to let visitors see prices in their own currency."}{" "}
          <Link to="/settings/payments" className="font-medium text-foreground underline underline-offset-4">
            Open payment settings
          </Link>
        </p>
      </div>
    </div>
  );
}

/** One-click ideas under a field: the agency's own items first, then common ones to start from. */
function Suggestions({
  existing,
  allLabels,
  presets,
  onPickExisting,
  onPickPreset,
}: {
  /** The agency's own items that are not picked yet. */
  existing: { value: string; label: string }[];
  /** Every item the agency has, picked or not, so a preset is never offered for something it already has. */
  allLabels: string[];
  presets: string[];
  onPickExisting: (value: string) => void;
  onPickPreset: (label: string) => void | Promise<void>;
}) {
  const known = new Set([...allLabels, ...existing.map((e) => e.label)].map((l) => l.toLowerCase()));
  const chips = [
    ...existing.map((e) => ({ key: `e-${e.value}`, label: e.label, pick: () => onPickExisting(e.value) })),
    ...presets.filter((p) => !known.has(p.toLowerCase())).map((p) => ({ key: `p-${p}`, label: p, pick: () => onPickPreset(p) })),
  ].slice(0, 8);
  if (chips.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Suggestions</p>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => void c.pick()}
            className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-sm hover:bg-accent"
          >
            <Plus className="size-3 text-muted-foreground" />
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Locations ─────────────────────────────────────────────────────────────────

type PickerLocation = { value: string; label: string; type: string };

function LocationPicker({
  locations,
  selected,
  onAdd,
  onRemove,
  onCreate,
}: {
  locations: PickerLocation[];
  selected: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onCreate: (type: string, label: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [newType, setNewType] = useState<string>("CITY");
  const q = query.trim().toLowerCase();
  const chosen = selected.map((id) => locations.find((l) => l.value === id)).filter((l): l is PickerLocation => Boolean(l));
  const available = locations.filter((l) => !selected.includes(l.value));
  const matches = q ? available.filter((l) => l.label.toLowerCase().includes(q)).slice(0, 8) : [];
  const exact = locations.some((l) => l.label.toLowerCase() === q);
  const suggestions = q ? [] : available.slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search for a country, city, landmark…" className="pl-9" />
      </div>

      {/* Results sit in the page flow, so the section never clips them. */}
      {q && (
        <div className="overflow-hidden rounded-lg border bg-card">
          {matches.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => {
                onAdd(l.value);
                setQuery("");
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <span>{l.label}</span>
              <Badge variant="outline" className="h-6 px-2.5 text-xs">{locationCategoryLabel(l.type)}</Badge>
            </button>
          ))}
          {!exact && (
            <div className={cn("flex flex-wrap items-center gap-2 bg-muted/40 px-3 py-2.5", matches.length > 0 && "border-t")}>
              <span className="text-sm text-muted-foreground">Add “{query.trim()}” as a</span>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger size="sm" className="w-40">
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
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  await onCreate(newType, query.trim());
                  setQuery("");
                }}
              >
                <Plus />
                Add
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex min-h-8 flex-wrap gap-2">
        {chosen.length === 0 && <p className="text-sm text-muted-foreground">Nothing chosen yet. Search above, or pick a suggestion.</p>}
        {chosen.map((l) => (
          <span key={l.value} className="inline-flex items-center gap-1.5 rounded-full border bg-secondary py-1 pr-1 pl-3 text-sm text-secondary-foreground">
            {l.label}
            <span className="text-xs text-muted-foreground">{locationCategoryLabel(l.type)}</span>
            <button type="button" aria-label={`Remove ${l.label}`} onClick={() => onRemove(l.value)} className="rounded-full p-1 text-muted-foreground hover:bg-background hover:text-foreground">
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Suggestions</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => onAdd(l.value)}
                className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-sm hover:bg-accent"
              >
                <Plus className="size-3 text-muted-foreground" />
                {l.label}
                <span className="text-xs text-muted-foreground">{locationCategoryLabel(l.type)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Photos ────────────────────────────────────────────────────────────────────

const MIN_PHOTOS = 4;

function PhotoReview({ count }: { count: number }) {
  const met = count >= MIN_PHOTOS;
  return (
    <aside className="rounded-xl border bg-card text-card-foreground">
      <div className="space-y-1 p-4">
        <h3 className="text-sm font-semibold">Photo review</h3>
        <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm">
          {met ? <Check className="mt-0.5 size-4 shrink-0 text-primary" /> : <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
          <div>
            <p className="font-medium">{count === 0 ? "No photos yet" : met ? "Minimum met" : `Add ${MIN_PHOTOS - count} more`}</p>
            <p className="text-muted-foreground">
              {count} photo{count === 1 ? "" : "s"} added. We recommend at least {MIN_PHOTOS}.
            </p>
          </div>
        </div>
      </div>
      <div className="border-t p-4">
        <h3 className="text-sm font-semibold">Tips and requirements</h3>
        <ul className="mt-2 list-disc space-y-2 pl-4 text-sm text-muted-foreground">
          <li>Choose bright, sharp photos that show what the trip is about.</li>
          <li>Put the best one first. It is the cover picture in lists and search results.</li>
          <li>Use real photos of this trip, with the real group size and places to stay.</li>
          <li>JPEG, PNG or WebP files work best.</li>
        </ul>
      </div>
    </aside>
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
        <EmptyState title="No questions yet" hint="Select “Add question” to write the first one." />
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
                      description: "The question and its answer will be deleted. This cannot be undone.",
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
  const [chapter, setChapter] = useState(0);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  /** null = follow the data. It starts off, and turns on by itself only for a saved trip whose drop-off already matches its meeting point. */
  const [sameDropOverride, setSameDropOverride] = useState<boolean | null>(null);
  const sameDrop = sameDropOverride ?? (form.meetingPoint !== "" && form.dropOffPoint === form.meetingPoint);
  const [tipsOpen, setTipsOpen] = useState(() => {
    try {
      return localStorage.getItem("wepilo:trip-tips") !== "closed";
    } catch {
      return true;
    }
  });
  const toggleTips = (open: boolean) => {
    setTipsOpen(open);
    try {
      localStorage.setItem("wepilo:trip-tips", open ? "open" : "closed");
    } catch {
      // storage blocked; the choice just won't persist
    }
  };
  const setStep = (_: number) => setChapter(0);
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [infoAdd, setInfoAdd] = useState(false);
  const [infoEdit, setInfoEdit] = useState<number | null>(null);
  const [openSections, setOpenSections] = useState<string[]>([]);
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

  const siteConfig = useQuery({
    queryKey: ["site-config"],
    queryFn: () => api<{ config: { paths: { trip: string } } }>("/site/config"),
    staleTime: 5 * 60_000,
  });
  const locations = useQuery({ queryKey: ["locations"], queryFn: () => api<{ data: (OptionRow & { type: string })[] }>("/locations") });
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

  // Unsaved work is copied to this browser, so a crash, a closed tab or an expired session can't lose it.
  const backupKey = `wepilo-trip-draft:${mode === "create" ? "new" : id}`;
  const [recovered, setRecovered] = useState<{ form: TripForm; savedAt: number } | null>(null);
  const backupChecked = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const clearBackup = () => {
    try {
      localStorage.removeItem(backupKey);
      if (mode === "create") localStorage.removeItem("wepilo-trip-draft:new");
    } catch {
      /* storage blocked */
    }
  };
  const ready = mode === "edit" ? Boolean(existing?.activity) : !needsLayoutChoice;
  useEffect(() => {
    if (!ready || backupChecked.current) return;
    backupChecked.current = true;
    try {
      const raw = localStorage.getItem(backupKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as { form: TripForm; savedAt: number };
      // Only offer it when it differs from what is saved on the server.
      if (saved?.form && JSON.stringify(saved.form) !== baseline && Date.now() - saved.savedAt < 14 * 24 * 60 * 60 * 1000) setRecovered(saved);
      else localStorage.removeItem(backupKey);
    } catch {
      /* unreadable backup: ignore it */
    }
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready || recovered) return;
    const t = setTimeout(() => {
      try {
        if (dirty) localStorage.setItem(backupKey, JSON.stringify({ form, savedAt: Date.now() }));
        else localStorage.removeItem(backupKey);
      } catch {
        /* storage full or blocked: editing still works */
      }
    }, 800);
    return () => clearTimeout(t);
  }, [form, dirty, ready, recovered, backupKey]);

  // Each chapter is its own screen: start it at the top.
  useEffect(() => {
    if (form.layout === "PAGE") return; // a simple page is one long scroll: the stepper follows it instead
    scrollRef.current?.scrollTo({ top: 0 });
  }, [chapter, form.layout]);
  const goToChapter = (i: number) => setChapter(Math.max(0, Math.min((form.layout === "PAGE" ? PAGE_STEPS.length : FLAT_KEYS.length) - 1, i)));

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
            ? "The trip will be shown as one page of text, photos and prices. Nothing is deleted. Your day-by-day details are kept and come back if you switch again, but your website will not show them while the trip is a simple page."
            : "You will get the step-by-step editor with a day-by-day itinerary. Nothing is deleted. The page content you wrote is kept and comes back if you switch again.",
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

  /** Sections a trip should have before travellers see it. Anything still empty is listed. */
  const missingForPublish = () => {
    const required = isPage ? PAGE_REQUIRED : ["overview", "categorization", "itinerary", "media", "pricing"];
    const state = isPage ? pageProgress : progress;
    const titles: Record<string, string> = isPage
      ? Object.fromEntries(PAGE_SECTIONS.map((x) => [x.key, x.title]))
      : Object.fromEntries(TRIP_STEPS.map((x) => [x.key, x.title]));
    return required.filter((k) => !(state[k] ?? 0)).map((k) => titles[k] ?? k);
  };

  const save = async (kind: "draft" | "publish") => {
    if (kind === "publish" && status !== "PUBLISHED" && titleReady) {
      const missing = missingForPublish();
      if (missing.length > 0) {
        confirmDialog(
          {
            title: "Publish with sections still empty?",
            description: `Travellers will see this trip right away. Still empty: ${missing.join(", ")}. You can save a draft instead and finish later.`,
            confirmLabel: "Publish anyway",
            cancelLabel: "Keep editing",
            destructive: false,
          },
          () => void doSave(kind),
        );
        return;
      }
    }
    await doSave(kind);
  };

  const doSave = async (kind: "draft" | "publish"): Promise<boolean> => {
    if (!titleReady) {
      setStep(0);
      toast.error("Please type a trip title with at least 3 letters before saving. The title is the first box on the page.");
      return false;
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
      clearBackup();
      toast.success(kind === "publish" ? (status === "PUBLISHED" ? "Changes saved" : "Trip published") : "Draft saved");
      if (mode === "create") navigate(`/trips/${newId}`, { replace: true });
      return true;
    } catch (err) {
      toastApiError(err, "Failed to save trip");
      return false;
    } finally {
      setSaving(null);
    }
  };

  const saveAndExit = async () => {
    if (await doSave(status === "PUBLISHED" ? "publish" : "draft")) navigate("/trips");
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

  // The stepper follows the page as it scrolls: the section nearest the top is the active one.
  useEffect(() => {
    if (!isPage) return;
    const els = PAGE_STEPS.map((x) => document.getElementById(`section-${x.key}`)).filter((e): e is HTMLElement => !!e);
    if (els.length === 0) return;
    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target.id, e.boundingClientRect.top);
          else visible.delete(e.target.id);
        }
        const top = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
        if (top) setChapter(PAGE_STEPS.findIndex((x) => `section-${x.key}` === top[0]));
      },
      { rootMargin: "-10% 0px -70% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [isPage, openSections, isLoading, needsLayoutChoice]);

  if (mode === "edit" && isLoading) {
    return (
      <div className="space-y-4 p-6">
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

  const stepKeys = isPage ? PAGE_STEPS.map((t) => t.key) : FLAT_KEYS;
  const activeKey = stepKeys[chapter] ?? stepKeys[0];
  const activeStep = (isPage ? PAGE_STEPS : TRIP_STEPS).find((t) => t.key === activeKey)!;
  const tips = isPage ? undefined : STEP_TIPS[activeKey];
  const tripPattern = siteConfig.data?.config.paths.trip ?? "/trips/{slug}";
  const websiteBase = session?.tenant?.website?.replace(/\/$/, "");
  const liveUrl = websiteBase && form.slug ? `${websiteBase.startsWith("http") ? websiteBase : `https://${websiteBase}`}${tripPattern.replace("{slug}", encodeURIComponent(form.slug))}` : null;
  const siteHost = (session?.tenant?.website || "your-site.com").replace(/^https?:\/\//, "").replace(/\/$/, "");

  // Each step body, by key. The itinerary stepper shows one at a time; the
  // page layout stacks the ones that apply to a simple trip.
  // On the step-by-step editor these notes live in the tips panel beside the step.
  const StepNote = ({ info }: { info: string }) => (isPage ? <InfoCard info={info} /> : null);
  const renderStep = (stepKey: string) => (
    <>
              {/* 1 — Basics */}
              {stepKey === "basics" && (
                <div className="grid gap-4">
                  <Field
                    label="Title"
                    required
                    htmlFor="title"
                    tooltip="The name travellers see first. Keep it short, clear and appealing."
                    error={!titleReady && form.title.length > 0 ? "At least 3 characters required" : undefined}
                  >
                    <Input id="title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Example: Inca Trail to Machu Picchu" />
                  </Field>
                  <Field
                    label="Slug"
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
                  <Field label="Description" tooltip="Write three to five sentences describing what travellers will do and experience on this trip.">
                    <RichTextEditor value={form.overview} onChange={(html) => set("overview", html)} placeholder="Describe the trip as if you were telling a friend what they will see and do…" />
                  </Field>
                  <StepNote info="This is the short introduction shown at the top of the trip page. Keep it clear and specific, and focus on what travellers will experience." />
                </>
              )}

              {/* 3 — Categorization */}
              {stepKey === "categorization" && (
                <>
                  <Section title="Where does it take place?" description="Search your locations and add every place this trip visits: countries, cities, landmarks and more. New places you add here are saved to your Locations list.">
                    <LocationPicker
                      locations={(locations.data?.data ?? []).map((l) => ({ value: String(l.id), label: l.name ?? l.handle ?? `#${l.id}`, type: l.type }))}
                      selected={form.locationIds.map(String)}
                      onAdd={(id) => set("locationIds", form.locationIds.includes(Number(id)) ? form.locationIds : [...form.locationIds, Number(id)])}
                      onRemove={(id) => set("locationIds", form.locationIds.filter((x) => x !== Number(id)))}
                      onCreate={async (type, label) => {
                        const id = await createRelation("/locations", "locations", label, { type });
                        setForm((prev) => ({ ...prev, locationIds: [...prev.locationIds, Number(id)] }));
                      }}
                    />
                  </Section>
                  <Separator />
                  <Field label="Trip category" tooltip="The main type of trip, for example Trekking, Cultural tour or Luxury. Manage the list under “Trip categories” in the menu.">
                    <Combobox
                      value={form.tripCategoryId}
                      setValue={(v) => set("tripCategoryId", v)}
                      placeholder="Click to choose a category"
                      options={toOptions(categories.data?.data)}
                      onCreate={(label) => createRelation("/trip-categories", "tripCategories", label)}
                    />
                    <Suggestions
                      existing={toOptions(categories.data?.data).filter((o) => o.value !== form.tripCategoryId)}
                      allLabels={toOptions(categories.data?.data).map((o) => o.label)}
                      presets={CATEGORY_PRESETS}
                      onPickExisting={(v) => set("tripCategoryId", v)}
                      onPickPreset={async (label) => set("tripCategoryId", await createRelation("/trip-categories", "tripCategories", label))}
                    />
                  </Field>
                  {!isPage && <Separator />}
                  {fold("tags", "Featured tags", form.featuredTagIds.length > 0, <Section title="Featured tags" description="Themes group trips together in collections on your website, such as “Family friendly”. Type a new one in the box to add it.">
                    <MultiSelect
                      selected={form.featuredTagIds.map(String)}
                      onChange={(v) => set("featuredTagIds", v.map(Number))}
                      options={toOptions(tags.data?.data)}
                      placeholder="Click to choose one or more themes"
                      onCreate={(label) => createRelation("/featured-tags", "featuredTags", label)}
                    />
                    <Suggestions
                      existing={toOptions(tags.data?.data).filter((o) => !form.featuredTagIds.includes(Number(o.value)))}
                      allLabels={toOptions(tags.data?.data).map((o) => o.label)}
                      presets={TAG_PRESETS}
                      onPickExisting={(v) => setForm((prev) => ({ ...prev, featuredTagIds: prev.featuredTagIds.includes(Number(v)) ? prev.featuredTagIds : [...prev.featuredTagIds, Number(v)] }))}
                      onPickPreset={async (label) => {
                        const id = Number(await createRelation("/featured-tags", "featuredTags", label));
                        setForm((prev) => ({ ...prev, featuredTagIds: [...prev.featuredTagIds, id] }));
                      }}
                    />
                    <StepNote info="Themes help travellers discover this trip through collections on your website. Choose every theme that fits." />
                  </Section>)}
                </>
              )}

              {/* 4 — Highlights */}
              {stepKey === "highlights" && (
                <>
                  <RichTextEditor value={form.highlights} onChange={(html) => set("highlights", html)} placeholder="List the best moments of the trip, one per line…" />
                  <StepNote info="Show the key experiences and memorable moments travellers can expect. Keep it short and specific, and focus on what makes this trip worth taking." />
                </>
              )}

              {/* 5 — Itinerary */}
              {stepKey === "itinerary" && (
                <ItineraryStep variants={form.itinerary} onChange={(v) => set("itinerary", v)} />
              )}

              {/* 6 — Media */}
              {stepKey === "media" && (
                <>
                  <div>
                    <div className="rounded-xl border bg-card p-5">
                      <div className="flex flex-col items-center gap-2 text-center">
                        <PhotoUploadButton
                          onSelect={(media) =>
                            // The picker calls this once per photo in a row, so build on the latest list, not this render's copy.
                            setForm((prev) => (prev.images.includes(media.url) ? prev : { ...prev, images: [...prev.images, media.url] }))
                          }
                        />
                        <p className="text-sm text-muted-foreground">JPG, PNG or WebP · Minimum {MIN_PHOTOS} photos · Choose several at once</p>
                      </div>
                      {form.images.length > 0 && (
                        <SortableList
                          grid
                          className="mt-5 grid grid-cols-2 gap-3"
                          items={form.images.map((url) => ({ id: url, url }))}
                          getId={(i) => i.id}
                          onReorder={(items) => set("images", items.map((i) => i.url))}
                          renderItem={(item, index, handle) => (
                            <div className="group relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted">
                              <img src={item.url} alt="" className="h-full w-full object-cover" />
                              {index === 0 && <Badge variant="secondary" className="absolute top-2 left-2">Main photo</Badge>}
                              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                                <span className="rounded bg-background/90">
                                  <DragHandle handle={handle} />
                                </span>
                                <button
                                  type="button"
                                  aria-label="Remove this image"
                                  onClick={() =>
                                    confirmDialog(
                                      { title: "Remove image?", description: "The photo will be taken out of this trip’s gallery. It stays in your media library." },
                                      () => set("images", form.images.filter((u) => u !== item.url)),
                                    )
                                  }
                                  className="flex size-6 items-center justify-center rounded bg-background/90 text-muted-foreground hover:text-destructive"
                                >
                                  <X className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        />
                      )}
                    </div>
                  </div>
                  {fold("video", "Video intro", !!form.videoUrl, <Section title="Video intro" description="Paste a YouTube or Vimeo link. The video is embedded on the trip page. Video files cannot be uploaded.">
                    <Input value={form.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
                  </Section>)}
                </>
              )}

              {/* 7 — Map */}
              {stepKey === "map" && (
                <>
                  <Field label="Map description" tooltip="Explain the route and what travellers can see on the map.">
                    <RichTextEditor
                      value={form.mapDescription}
                      onChange={(html) => set("mapDescription", html)}
                      placeholder="Describe the route, the main landmarks and the points of interest…"
                    />
                  </Field>
                  <Section title="Route map" description="Add a picture of the route map.">
                    <div className="grid gap-3">
                      {form.routeMap ? (
                        <div className="relative aspect-video max-w-xl overflow-hidden rounded-xl border bg-muted">
                          <img src={form.routeMap} alt="Route map" className="h-full w-full object-contain" />
                          <button
                            type="button"
                            aria-label="Remove the route map picture"
                            onClick={() =>
                              confirmDialog(
                                {
                                  title: "Remove map image?",
                                  description: "The picture will be taken off this trip. It stays in your media library.",
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
                        <AddImageButton className="aspect-auto h-36 w-full rounded-lg" label="Add a map image" onSelect={(media) => set("routeMap", media.url)} />
                      )}
                      <Input value={form.routeMap} onChange={(e) => set("routeMap", e.target.value)} placeholder="Or paste the web address of a map picture" />
                    </div>
                  </Section>
                  <StepNote info="A clear route map helps travelers visualise the journey before they book." />
                </>
              )}

              {/* 8 — Inclusions */}
              {stepKey === "inclusions" && (
                <>
                  <RichTextEditor value={form.inclusions} onChange={(html) => set("inclusions", html)} placeholder="List what is included, for example hotels, meals, guide, transport…" />
                  <StepNote info="Be clear and specific. Travellers should know exactly what they are paying for. A bulleted list works best." />
                </>
              )}

              {/* 8 — Exclusions */}
              {stepKey === "exclusions" && (
                <>
                  <RichTextEditor value={form.exclusions} onChange={(html) => set("exclusions", html)} placeholder="List what is not included, for example flights, insurance, tips…" />
                  <StepNote info="List what is not covered so travellers know what they will need to pay for separately." />
                </>
              )}

              {/* 9 — Duration & altitude */}
              {stepKey === "duration" && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Duration" tooltip="The total length of the trip, for example “8 days / 7 nights” or “6 hours”.">
                      <Input value={form.duration} onChange={(e) => set("duration", e.target.value)} placeholder="Example: 8 days / 7 nights" />
                    </Field>
                    <Field label="Maximum altitude (m)" tooltip="The highest altitude travellers reach during the trip, in metres above sea level.">
                      <Input type="number" min={0} value={form.maximumAltitude} onChange={(e) => set("maximumAltitude", e.target.value)} placeholder="Example: 5416" />
                    </Field>
                  </div>

                  <Section
                    title="Altitude chart"
                    description="Add each stop with its altitude to show travellers a chart of how the trail climbs and descends."
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
                      <EmptyState title="No altitude points" hint="Add at least two stops, each with an altitude, to draw the chart." />
                    ) : (
                      <div className="grid gap-6 lg:grid-cols-2">
                        <div className="space-y-2">
                          {form.altitudeChart.map((point, index) => (
                            <div key={point.id} className="flex items-end gap-2">
                              <div className="flex-1 space-y-1.5">
                                <label className="text-xs text-muted-foreground">Name of the place</label>
                                <Input
                                  value={point.location}
                                  placeholder="Example: Machu Picchu"
                                  onChange={(e) => set("altitudeChart", form.altitudeChart.map((p, i) => (i === index ? { ...p, location: e.target.value } : p)))}
                                />
                              </div>
                              <div className="w-28 space-y-1.5">
                                <label className="text-xs text-muted-foreground">Altitude in metres</label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={point.altitude}
                                  placeholder="Example: 2430"
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

              {/* 10 — Group size, difficulty and meeting points */}
              {stepKey === "capacity" && (
                <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2">
                  <Field label="Guest capacity" tooltip="The maximum number of travellers you take on this trip.">
                    <Input type="number" min={1} value={form.guestCapacity} onChange={(e) => set("guestCapacity", e.target.value)} placeholder="Example: 12" />
                  </Field>
                  <Field label="Difficulty" tooltip="Choose how physically demanding the trip is: Easy, Moderate, Hard or Extreme.">
                    <Select value={form.difficultyLevel || "none"} onValueChange={(v) => set("difficultyLevel", v === "none" ? "" : v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Click to choose a difficulty level" />
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
                  <Field label="Meeting point" tooltip="The place where travellers meet your guide to begin the trip.">
                    <Input
                      value={form.meetingPoint}
                      onChange={(e) => {
                        const v = e.target.value;
                        // While drop-off is "same as the meeting point", it follows what is typed here.
                        setForm((prev) => ({ ...prev, meetingPoint: v, ...(sameDrop ? { dropOffPoint: v } : {}) }));
                      }}
                      placeholder="Example: Heathrow Airport, London"
                    />
                  </Field>
                  <Field label="Drop-off point" tooltip="The place where the trip finishes and travellers are dropped off.">
                    {/* The input never moves. While the switch is on it just shows the meeting point. */}
                    <Input
                      value={sameDrop ? form.meetingPoint : form.dropOffPoint}
                      disabled={sameDrop}
                      onChange={(e) => set("dropOffPoint", e.target.value)}
                      placeholder="Example: Kennedy Airport, New York"
                    />
                    <label className="flex items-center gap-2.5 pt-1 text-sm">
                      <Switch
                        checked={sameDrop}
                        onCheckedChange={(on) => {
                          setSameDropOverride(on);
                          if (on) setForm((prev) => ({ ...prev, dropOffPoint: prev.meetingPoint }));
                        }}
                      />
                      Same as the meeting point
                    </label>
                  </Field>
                </div>
              )}

              {/* 12 — Accommodation & meals */}
              {stepKey === "stay" && (
                <>
                  <Section title="Accommodations" description="Where travellers sleep during the trip.">
                    <div className="space-y-3">
                      <StringArrayInput value={form.accommodations} onChange={(v) => set("accommodations", v)} placeholder="Type a kind of place to stay, for example Teahouse, then press Enter" />
                      <div className="flex flex-wrap gap-1.5">
                        {STAY_PRESETS.filter((m) => !form.accommodations.includes(m)).map((m) => (
                          <button key={m} type="button" onClick={() => set("accommodations", [...form.accommodations, m])}>
                            <Badge variant="outline" className="h-8 cursor-pointer px-3.5 text-sm font-normal hover:bg-accent [&>svg]:size-3.5!">
                              <Plus />
                              {m}
                            </Badge>
                          </button>
                        ))}
                      </div>
                      <LabelDescription text="List the kinds of accommodation travellers can expect. Type each one and press Enter, or pick a suggestion." />
                    </div>
                  </Section>
                  <Section title="Meals" description="The meals that are included in the price.">
                    <div className="space-y-3">
                      <StringArrayInput value={form.meals} onChange={(v) => set("meals", v)} placeholder="Type a meal, for example Breakfast, then press Enter" />
                      <div className="flex flex-wrap gap-1.5">
                        {MEAL_PRESETS.filter((m) => !form.meals.includes(m)).map((m) => (
                          <button key={m} type="button" onClick={() => set("meals", [...form.meals, m])}>
                            <Badge variant="outline" className="h-8 cursor-pointer px-3.5 text-sm font-normal hover:bg-accent [&>svg]:size-3.5!">
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
                  <CurrencyNotice translation={Boolean(session?.tenant?.currencyTranslation)} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Price" tooltip={`The price for one person, in ${getDefaultCurrency()}.`}>
                      <MoneyInput value={form.price} onChange={(v) => set("price", v)} placeholder="1200" />
                    </Field>
                    <Field label="Maximum price" tooltip="Only fill this in if the price varies, for example by season or room type." hint={`Only needed if the price is a range, for example ${money(1200)} to ${money(1800)}.`}>
                      <MoneyInput value={form.maxPrice} onChange={(v) => set("maxPrice", v)} placeholder="1800" />
                    </Field>
                  </div>
                  <StepNote info="Bookings are reservation requests only. Travellers are not charged through Wepilo, so enter the price you plan to collect from them yourself." />

                  {fold("discount", "Group discount", form.groupDiscount.length > 0, <Section
                    title="Group discount"
                    description="Offer a lower price when more people travel together. Each rule either takes a percentage off, or sets a fixed price for each person."
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
                    {form.groupDiscount.length > 0 && (
                    <label className="flex items-start gap-3">
                      <Switch checked={form.showGroupDiscount} onCheckedChange={(v) => set("showGroupDiscount", v)} />
                      <span>
                        <span className="block text-sm font-medium">Show group discount on website</span>
                        <span className="block text-sm text-muted-foreground">Turn this off to hide the discounts while you are still deciding them.</span>
                      </span>
                    </label>
                    )}
                    {form.groupDiscount.length === 0 ? (
                      <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">No group discounts yet. Select “Add rule” to offer a lower price to larger groups.</p>
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
                                  <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                                  <SelectItem value="FLAT">Flat price</SelectItem>
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
                  </Section>)}
                </>
              )}

              {/* 14 — Extras & languages */}
              {stepKey === "extras" && (
                <>
                  <Section title="Extras" description="Extra services travellers can add to their booking for this trip.">
                    {extras.data?.data.length === 0 ? (
                      <EmptyState title="No extras yet" hint="Create them first on the “Extras” page in the menu. They will then appear here for you to choose." />
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
                            <Badge variant="outline" className="h-8 cursor-pointer px-3.5 text-sm font-normal hover:bg-accent [&>svg]:size-3.5!">
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
                  <StepNote info="Add notes travellers should read before booking, such as packing tips, visa rules, health advice or your cancellation policy. Drag a note to change the order." />
                  {form.additionalInfo.length === 0 ? (
                    <EmptyState title="No additional info" hint="Select “Add Info” to add things like packing tips or visa requirements." />
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
                                  description: "The note will be deleted. This cannot be undone.",
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
                  <StepNote info="Group questions by topic, for example Booking, Health or Packing. Each group can hold many questions." />
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
                      <EmptyState title="No FAQs yet" hint="Select “Add group”, then add the questions travellers ask you most often." />
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
                  <Section title="Search metadata" description="Control the title and description shown in search results.">
                    <div className="grid gap-4">
                      <Field label="Meta title" tooltip="The title shown in Google search results and in browser tabs. Keep it between 50 and 60 characters.">
                        <Input value={form.seo.metaTitle} onChange={(e) => setSeo({ metaTitle: e.target.value })} placeholder={form.title || "Inca Trail to Machu Picchu — 4 days"} />
                      </Field>
                      <Field label="Meta description" tooltip="A short summary shown under the title in Google search results. Keep it between 150 and 160 characters." hint={`${form.seo.metaDescription.length} of 160 characters used`}>
                        <Textarea rows={3} maxLength={160} value={form.seo.metaDescription} onChange={(e) => setSeo({ metaDescription: e.target.value })} />
                      </Field>
                    </div>
                  </Section>
                  <Section title="Featured media" description="The picture shown when someone shares this trip on Facebook, WhatsApp or other social media.">
                    {form.seo.featuredMedia ? (
                      <div className="relative w-full max-w-md">
                        <img src={form.seo.featuredMedia} alt="" className="aspect-[1.91/1] w-full rounded-lg border object-cover" />
                        <button
                          type="button"
                          aria-label="Remove the social media picture"
                          onClick={() =>
                            confirmDialog(
                              {
                                title: "Remove featured image?",
                                description: "The picture will be taken off this trip’s social media sharing. It stays in your media library.",
                              },
                              () => setSeo({ featuredMedia: "" }),
                            )
                          }
                          className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm hover:text-destructive"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <AddImageButton className="aspect-auto h-36 w-full rounded-lg" label="Select an image" onSelect={(media) => setSeo({ featuredMedia: media.url })} />
                    )}
                    <p className="text-[13px] text-muted-foreground">Use a landscape picture, around 1200 × 630 pixels, so it is not cropped when shared.</p>
                  </Section>
                  <Section title="Advanced" description="Optional settings for search engines. Most trips do not need these." defaultOpen={false}>
                    <div className="grid gap-4">
                      <Field label="Meta keywords" tooltip="Words separated by commas. Most search engines ignore this, but it can help searches on your own website.">
                        <Input value={form.seo.metaKeywords} onChange={(e) => setSeo({ metaKeywords: e.target.value })} placeholder="Example: trekking, nepal, himalaya" />
                      </Field>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Author" tooltip="The name of the person or company that wrote this content.">
                          <Input value={form.seo.metaAuthor} onChange={(e) => setSeo({ metaAuthor: e.target.value })} />
                        </Field>
                        <Field label="Robots" tooltip="Tells Google whether to list this page. Leave it as index,follow to appear in search results, or type noindex to hide it from Google.">
                          <Input value={form.seo.metaRobots} onChange={(e) => setSeo({ metaRobots: e.target.value })} placeholder="index,follow" />
                        </Field>
                      </div>
                      <Field label="Canonical URL" tooltip="Only fill this in if the same content is also published on another web address that you prefer Google to show.">
                        <Input value={form.seo.canonicalUrl} onChange={(e) => setSeo({ canonicalUrl: e.target.value })} placeholder="https://…" />
                      </Field>
                      <Field label="Structured data (JSON-LD)" tooltip="Only for developers. Paste valid JSON-LD only. Invalid code can stop Google from showing rich results.">
                        <Textarea rows={4} value={form.seo.schema} onChange={(e) => setSeo({ schema: e.target.value })} placeholder='{"@context":"https://schema.org",…}' />
                      </Field>
                    </div>
                  </Section>
                </>
              )}
    </>
  );

  /** On a simple page, rarely used fields stay folded behind a dashed row until opened (or already filled in). */
  const fold = (id: string, title: string, filled: boolean, node: React.ReactNode) =>
    !isPage || filled || openSections.includes(id) ? (
      node
    ) : (
      <button
        type="button"
        onClick={() => setOpenSections((o) => [...o, id])}
        className="group flex w-full items-center gap-3 rounded-2xl border border-dashed px-4 py-3.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
          <Plus className="size-4" />
        </span>
        <span className="flex-1 text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">Optional</span>
      </button>
    );

  /** One screen of the simple-page editor. Most steps reuse the multi-day editor's fields. */
  const renderPageStep = (key: string) => {
    if (key === "content") {
      return (
        <RichTextEditor
          value={form.content}
          onChange={(html) => set("content", html)}
          minHeight={420}
          placeholder="Describe the experience: what travellers will do, where you meet, what to bring… Use headings to organise it into sections."
        />
      );
    }
    return renderStep(key);
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Header */}
      <div className="z-10 flex shrink-0 flex-wrap items-center gap-3 border-b bg-background px-4 py-3 md:px-6">
        <Button variant="ghost" size="icon" aria-label="Go back to the list of all trips" onClick={() => confirmLeave(() => navigate("/trips"))}>
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-semibold tracking-tight">{form.title.trim() || (mode === "create" ? "New trip" : "Untitled trip")}</h1>
            <StatusBadge kind="trip" status={status} className="hidden sm:inline-flex" />
            {form.isFeatured && <Badge variant="outline">Featured</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {dirty ? (
              <span className="inline-flex items-center gap-1.5 text-foreground">
                <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                Unsaved changes · ⌘S to save
              </span>
            ) : form.slug ? (
              `/${form.slug}`
            ) : (
              "Not saved yet"
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {status === "PUBLISHED" && liveUrl && (
            <Button variant="outline" asChild>
              <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                <span className="hidden sm:inline">View on site</span>
              </a>
            </Button>
          )}
          {status !== "PUBLISHED" && (
            <Button variant="outline" onClick={() => save("draft")} disabled={saving !== null || (mode === "edit" && !dirty)}>
              {saving === "draft" ? <Loader2 className="animate-spin" /> : <Save />}
              Save draft
            </Button>
          )}
          <Button
            onClick={() => save("publish")}
            disabled={saving !== null || (status === "PUBLISHED" && !dirty)}
            className="sm:min-w-36 disabled:opacity-100 disabled:bg-primary/12 disabled:text-primary"
          >
            {saving === "publish" ? (
              <Loader2 className="animate-spin" />
            ) : status === "PUBLISHED" && !dirty ? (
              <Check className="" />
            ) : status === "PUBLISHED" ? (
              <Save />
            ) : (
              <Upload />
            )}
            {saving === "publish" ? "Saving…" : status === "PUBLISHED" ? (dirty ? "Save changes" : "Saved") : "Publish"}
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-[96rem] flex-col gap-4 px-4 pt-6 md:px-8">
      {recovered && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-primary/10 px-4 py-3 text-sm">
          <span>
            You have unsaved changes from {new Date(recovered.savedAt).toLocaleString()} that never reached the server. Restore them?
          </span>
          <span className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                clearBackup();
                setRecovered(null);
              }}
            >
              Discard
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setForm(recovered.form);
                setRecovered(null);
              }}
            >
              Restore
            </Button>
          </span>
        </div>
      )}

      <div className="grid flex-1 gap-8 pt-2 lg:grid-cols-[17rem_minmax(0,1fr)]">
        {/* Step list */}
        <nav aria-label="Steps of this trip" className="min-w-0 lg:sticky lg:top-0 lg:max-h-[calc(100dvh-8rem)] lg:self-start lg:overflow-y-auto">
          <div className="flex items-center gap-3 px-3 pb-4">
            <Progress value={score} className="h-1.5 flex-1" />
            <span className="text-xs font-medium text-muted-foreground tabular-nums">{score}%</span>
          </div>
          {isPage ? (
            <ol className="space-y-1">
              {PAGE_STEPS.map((step, i) => {
                const Icon = PAGE_ICONS[step.key] ?? FileText;
                const active = step.key === activeKey;
                const state = pageProgress[step.key] ?? 0;
                const optional = !PAGE_REQUIRED.includes(step.key) && step.key !== "basics";
                return (
                  <li key={step.key}>
                    <button
                      type="button"
                      aria-current={active ? "step" : undefined}
                      onClick={() => {
                        setChapter(i);
                        document.getElementById(`section-${step.key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                        active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                      )}
                    >
                      <Icon className="size-[18px] shrink-0" />
                      <span className="truncate">{step.title}</span>
                      {state === 1 ? (
                        <Check className="ml-auto size-4 shrink-0 text-primary" />
                      ) : optional ? (
                        <span className="ml-auto text-xs font-normal text-muted-foreground">Optional</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
          <ol className="space-y-1">
              {STEP_GROUPS.map((g) => {
                const keys = g.keys.filter((k) => TRIP_STEPS.some((t) => t.key === k));
                const done = keys.filter((k) => progress[k] === 1).length;
                const hasActive = keys.includes(activeKey);
                const open = hasActive || openGroups.includes(g.label);
                const single = keys.length === 1;
                const GroupIcon = GROUP_ICONS[g.label] ?? FileText;
                const rowClass = (active: boolean) =>
                  cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                    active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  );
                const tick = (ok: boolean) => (ok ? <Check className="ml-auto size-4 shrink-0 text-primary" /> : null);
                return (
                  <li key={g.label}>
                    <button
                      type="button"
                      aria-expanded={single ? undefined : open}
                      aria-current={single && hasActive ? "step" : undefined}
                      onClick={() => {
                        // From another group, jump to this group's first step. Inside the current group, the header folds and unfolds it.
                        if (single || !hasActive) {
                          goToChapter(FLAT_KEYS.indexOf(keys[0]));
                          if (!single) setOpenGroups((o) => (o.includes(g.label) ? o : [...o, g.label]));
                        } else {
                          setOpenGroups((o) => (o.includes(g.label) ? o.filter((x) => x !== g.label) : [...o, g.label]));
                        }
                      }}
                      className={rowClass(hasActive)}
                    >
                      <GroupIcon className="size-[18px] shrink-0" />
                      <span className="truncate">{g.label}</span>
                      {tick(done === keys.length)}
                    </button>
                    {!single && open && (
                      <ul className="mt-1 mb-2 ml-[1.65rem] space-y-0.5 border-l pl-0">
                        {keys.map((k) => {
                          const active = k === activeKey;
                          return (
                            <li key={k} className="relative">
                              {active && <span aria-hidden className="absolute top-1/2 -left-px h-5 w-0.5 -translate-y-1/2 rounded-full bg-foreground" />}
                              <button
                                type="button"
                                aria-current={active ? "step" : undefined}
                                onClick={() => goToChapter(FLAT_KEYS.indexOf(k))}
                                className={cn(
                                  "flex w-full items-center gap-2 rounded-md py-1.5 pr-3 pl-4 text-left text-sm transition-colors",
                                  active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                                )}
                              >
                                <span className="truncate">{TRIP_STEPS.find((t) => t.key === k)!.title}</span>
                                {tick(progress[k] === 1)}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          <div className="mt-4 hidden px-3 lg:block">
            <p className="text-xs text-muted-foreground">{isPage ? "Need a day-by-day plan?" : "Short trip or day tour?"}</p>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={switchLayout}>
              {isPage ? "Switch to an itinerary" : "Switch to a simple page"}
            </Button>
          </div>
        </nav>

        {/* One step per screen */}
        <div className={cn("grid min-w-0 gap-x-8 gap-y-8", tipsOpen ? "xl:grid-cols-[minmax(0,1fr)_20rem]" : "xl:grid-cols-[minmax(0,1fr)_2.5rem]")}>
          {isPage ? (
            <div className={cn("min-w-0 pb-24", tipsOpen ? "max-w-3xl" : "max-w-[70rem]")}>
              <TitleBlock
                title={form.title}
                onTitleChange={(v) => set("title", v)}
                slug={form.slug}
                onSlugChange={(v) => set("slug", v)}
                prefix={`${siteHost}/trips/`}
                placeholder="Type the name of your trip, for example Sunset kayak tour"
              />
              {PAGE_STEPS.map((step) => (
                <section key={step.key} id={`section-${step.key}`} className="scroll-mt-6 space-y-4 border-t pt-8 mt-10 first-of-type:mt-8">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight">{step.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                  </div>
                  <div className="space-y-6">{renderPageStep(step.key)}</div>
                </section>
              ))}
            </div>
          ) : (
          <div key={activeKey} className={cn("flex min-w-0 flex-col", tipsOpen ? "max-w-3xl" : "max-w-[70rem]")}>
            <h2 className="text-[1.65rem] leading-tight font-semibold tracking-[-0.025em]">{activeStep.title}</h2>
            <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">{activeStep.description}</p>
            <div className="mt-8 mb-10 space-y-6">{isPage ? renderPageStep(activeKey) : renderStep(activeKey)}</div>

            <div className="sticky bottom-0 z-10 mt-auto flex flex-wrap items-center justify-end gap-3 border-t bg-background/95 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              {chapter > 0 && (
                <Button variant="ghost" className="mr-auto" onClick={() => goToChapter(chapter - 1)}>
                  <ArrowLeft />
                  Back
                </Button>
              )}
              <Button variant="outline" size="lg" onClick={() => void saveAndExit()} disabled={saving !== null}>
                Save and exit
              </Button>
              {chapter < stepKeys.length - 1 ? (
                <Button size="lg" onClick={() => goToChapter(chapter + 1)}>
                  Continue
                </Button>
              ) : (
                <Button size="lg" onClick={() => save("publish")} disabled={saving !== null}>
                  {saving === "publish" ? <Loader2 className="animate-spin" /> : <Upload />}
                  {status === "PUBLISHED" ? "Save changes" : "Publish trip"}
                </Button>
              )}
            </div>
          </div>
          )}

          {/* Same place on every step. Collapses to a slim rail. */}
          <aside className="hidden xl:block">
            <div className="sticky top-0">
              {tipsOpen ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {isPage ? "Details" : activeKey === "media" ? "Photo review" : "Tips"}
                    </span>
                    <Button variant="ghost" size="icon-sm" aria-label={isPage ? "Hide details" : "Hide tips"} title={isPage ? "Hide details" : "Hide tips"} className="rounded-full bg-muted hover:bg-foreground/10" onClick={() => toggleTips(false)}>
                      <ChevronRight />
                    </Button>
                  </div>
                  {isPage ? (
                    <div className="space-y-5 rounded-xl border bg-card p-5 text-card-foreground">
                      <Field label="Duration" htmlFor="page-duration" hint="Examples: 3 hours, Full day, 2 days">
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
                          <span className="block text-sm font-medium">Feature on my homepage</span>
                          <span className="block text-xs text-muted-foreground">Shows this trip on your website homepage.</span>
                        </span>
                        <Switch checked={form.isFeatured} onCheckedChange={(v) => set("isFeatured", v)} />
                      </label>
                    </div>
                  ) : activeKey === "media" ? (
                    <PhotoReview count={form.images.length} />
                  ) : (
                    tips && (
                      <div className="rounded-xl border bg-card p-5 text-card-foreground">
                        <h3 className="text-base font-semibold tracking-tight">{tips.title}</h3>
                        <ul className="mt-3 list-disc space-y-2.5 pl-4 text-sm leading-relaxed text-muted-foreground marker:text-muted-foreground/60">
                          {tips.points.map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <Button variant="outline" size="icon" aria-label={isPage ? "Show details" : "Show tips"} title={isPage ? "Show details" : "Show tips"} onClick={() => toggleTips(true)}>
                  {isPage ? <PenLine /> : <HelpCircle />}
                </Button>
              )}
            </div>
          </aside>
        </div>
      </div>
      </div>
      </div>
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
    body: "Best for trips that last several days. You fill in the trip step by step: a plan for each day, places to stay, meals, a map, prices and more.",
    points: ["Day-by-day plan, with variants", "Meals, stays and altitude profile", "Guided step-by-step editor"],
  },
  {
    layout: "PAGE",
    icon: FileText,
    title: "Simple page",
    body: "Best for day tours, weekend getaways and experiences that do not need a plan for each day. You write everything on one flexible page.",
    points: ["One page of rich content", "Photos, price, FAQs", "Ready in a few minutes"],
  },
];

function LayoutChooser({ onChoose, onBack }: { onChoose: (layout: TripLayout) => void; onBack: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
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
              Start with this
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
