import { Plus, Trash2 } from "@/components/icons";
import { Field } from "@/components/form";
import { ImageField } from "@/components/image-field";
import { DragHandle, SortableList } from "@/components/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { LIST_SECTIONS, SECTION_LABELS, SECTION_SOURCE, type HomeSection, type SectionType } from "@/pages/website/types";

const uid = () => Math.random().toString(36).slice(2, 10);

export function HomepageEditor({ sections, onChange }: { sections: HomeSection[]; onChange: (next: HomeSection[]) => void }) {
  const patch = (id: string, change: Partial<HomeSection>) => onChange(sections.map((s) => (s.id === id ? { ...s, ...change } : s)));
  const present = new Set(sections.map((s) => s.type));
  // Every built-in section can exist once; text blocks can repeat.
  const addable = (Object.keys(SECTION_LABELS) as SectionType[]).filter((t) => t === "CUSTOM_TEXT" || !present.has(t));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Drag to reorder. Your website gets these sections, in this order, with their content filled in, from <code className="rounded bg-muted px-1 text-xs">GET /site</code>.
      </p>
      <SortableList
        items={sections}
        getId={(s) => s.id}
        onReorder={onChange}
        className="space-y-3"
        renderItem={(s, _i, handle) => (
          <div className={cn("rounded-xl border bg-card", !s.enabled && "opacity-60")}>
            <div className="flex items-center gap-2 border-b px-3 py-2.5">
              <DragHandle handle={handle} />
              <span className="flex-1 text-sm font-medium">{SECTION_LABELS[s.type]}</span>
              <Switch checked={s.enabled} onCheckedChange={(v) => patch(s.id, { enabled: v })} aria-label={`Show ${SECTION_LABELS[s.type]}`} />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${SECTION_LABELS[s.type]}`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onChange(sections.filter((x) => x.id !== s.id))}
              >
                <Trash2 />
              </Button>
            </div>
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <Field label="Heading">
                <Input value={s.title ?? ""} onChange={(e) => patch(s.id, { title: e.target.value })} />
              </Field>
              {LIST_SECTIONS.includes(s.type) ? (
                <Field label="How many to show" hint={SECTION_SOURCE[s.type]}>
                  <Input type="number" min={1} max={24} value={s.limit ?? ""} onChange={(e) => patch(s.id, { limit: e.target.value ? Number(e.target.value) : null })} />
                </Field>
              ) : null}
              {s.type !== "NEWSLETTER" || s.subtitle ? (
                <Field label="Subheading" className="sm:col-span-2">
                  <Input value={s.subtitle ?? ""} onChange={(e) => patch(s.id, { subtitle: e.target.value })} />
                </Field>
              ) : null}
              {s.type === "HERO" ? (
                <>
                  <Field label="Button text">
                    <Input value={s.ctaLabel ?? ""} onChange={(e) => patch(s.id, { ctaLabel: e.target.value })} />
                  </Field>
                  <Field label="Button link" hint="A page on your site, like /trips.">
                    <Input value={s.ctaHref ?? ""} onChange={(e) => patch(s.id, { ctaHref: e.target.value })} />
                  </Field>
                </>
              ) : null}
              {s.type === "HERO" || s.type === "CUSTOM_TEXT" ? (
                <Field label={s.type === "HERO" ? "Background image" : "Image (optional)"} className="sm:col-span-2">
                  <ImageField value={s.image} onChange={(url) => patch(s.id, { image: url || null })} />
                </Field>
              ) : null}
              {s.type === "CUSTOM_TEXT" ? (
                <Field label="Text" className="sm:col-span-2">
                  <Textarea rows={5} value={s.body ?? ""} onChange={(e) => patch(s.id, { body: e.target.value })} />
                </Field>
              ) : null}
            </div>
          </div>
        )}
      />
      {addable.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3">
          <span className="text-sm text-muted-foreground">Add a section:</span>
          {addable.map((type) => (
            <Button
              key={type}
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange([
                  ...sections,
                  { id: type === "CUSTOM_TEXT" ? `text-${uid()}` : type.toLowerCase(), type, enabled: true, title: SECTION_LABELS[type], ...(LIST_SECTIONS.includes(type) ? { limit: 6 } : {}) },
                ])
              }
            >
              <Plus />
              {SECTION_LABELS[type]}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
