import { useState } from "react";
import { ArrowLeft, Loader2, Save, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Sticky title bar for full-page editors (trip, post, page). */
export function EditorHeader({
  title,
  badge,
  dirty,
  subtitle,
  onBack,
  actions,
}: {
  title: string;
  badge?: React.ReactNode;
  dirty: boolean;
  subtitle?: React.ReactNode;
  onBack: () => void;
  actions: React.ReactNode;
}) {
  return (
    <div className="sticky top-12 z-10 -mx-4 -mt-6 flex flex-wrap items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-8 md:-mt-8 md:px-8">
      <Button variant="ghost" size="icon" aria-label="Back" onClick={onBack}>
        <ArrowLeft />
      </Button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-base font-semibold tracking-tight">{title}</h1>
          {badge}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {dirty ? <span className="text-amber-600 dark:text-amber-400">Unsaved changes</span> : subtitle}
        </p>
      </div>
      <div className="flex gap-2">{actions}</div>
    </div>
  );
}

/** Save / publish buttons with the same rules everywhere. */
export function PublishActions({
  published,
  dirty,
  isNew,
  saving,
  canSave,
  onSave,
}: {
  published: boolean;
  dirty: boolean;
  isNew: boolean;
  saving: "draft" | "publish" | "unpublish" | null;
  canSave: boolean;
  onSave: (intent: "draft" | "publish" | "unpublish") => void;
}) {
  const busy = saving !== null;
  if (published) {
    return (
      <>
        <Button variant="ghost" onClick={() => onSave("unpublish")} disabled={busy || !canSave}>
          {saving === "unpublish" && <Loader2 className="animate-spin" />}
          Unpublish
        </Button>
        <Button onClick={() => onSave("publish")} disabled={busy || !canSave || !dirty}>
          {saving === "publish" ? <Loader2 className="animate-spin" /> : <Save />}
          Save changes
        </Button>
      </>
    );
  }
  return (
    <>
      <Button variant="outline" onClick={() => onSave("draft")} disabled={busy || !canSave || (!isNew && !dirty)}>
        {saving === "draft" ? <Loader2 className="animate-spin" /> : <Save />}
        Save draft
      </Button>
      <Button onClick={() => onSave("publish")} disabled={busy || !canSave}>
        {saving === "publish" ? <Loader2 className="animate-spin" /> : <Upload />}
        Publish
      </Button>
    </>
  );
}

/** Hairline-separated block in an editor's settings column. */
export function SidebarSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4 border-b py-5 first:pt-0 last:border-b-0", className)}>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function CharCount({ value, max }: { value: string; max: number }) {
  const n = value.length;
  return (
    <span className={cn("tabular-nums", n > max ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
      {n}/{max}
    </span>
  );
}

export { CharCount };

/** How the page is likely to look in a Google result. */
export function SerpPreview({ title, url, description }: { title: string; url: string; description: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="truncate text-xs text-muted-foreground">{url}</p>
      <p className="mt-0.5 line-clamp-1 text-[15px] leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">
        {title || "Page title"}
      </p>
      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {description || "Add a meta description so search engines show a useful summary instead of guessing one."}
      </p>
    </div>
  );
}

/** Chips for short tags: Enter or comma adds, Backspace removes the last. */
export function TagInput({
  value,
  onChange,
  placeholder = "Add a tag…",
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const parts = raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .filter((t) => !value.some((v) => v.toLowerCase() === t.toLowerCase()));
    if (parts.length) onChange([...value, ...parts]);
    setDraft("");
  };
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30">
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded bg-muted py-0.5 pr-1 pl-2 text-xs font-medium">
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="rounded-sm text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft && add(draft)}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (text.includes(",") || text.includes("\n")) {
            e.preventDefault();
            add(text.replace(/\n/g, ","));
          }
        }}
        placeholder={value.length ? "" : placeholder}
        className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

/** Big borderless title + editable web address under it. */
export function TitleBlock({
  title,
  onTitleChange,
  slug,
  onSlugChange,
  prefix,
  placeholder,
}: {
  title: string;
  onTitleChange: (v: string) => void;
  slug: string;
  onSlugChange: (v: string) => void;
  prefix: string;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <textarea
        rows={1}
        value={title}
        onChange={(e) => onTitleChange(e.target.value.replace(/\n/g, ""))}
        placeholder={placeholder}
        aria-label="Title"
        className="field-sizing-content w-full resize-none bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
      />
      <label className="flex max-w-full items-center gap-0 rounded-md text-sm text-muted-foreground">
        <span className="shrink-0">{prefix}</span>
        <input
          value={slug}
          onChange={(e) => onSlugChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))}
          placeholder="generated-from-title"
          aria-label="Web address"
          className="min-w-0 flex-1 rounded-sm bg-transparent px-0.5 text-foreground outline-none placeholder:text-muted-foreground/60 hover:bg-muted focus:bg-muted"
        />
      </label>
    </div>
  );
}
