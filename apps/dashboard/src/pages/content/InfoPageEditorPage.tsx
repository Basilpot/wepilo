import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, toastApiError } from "@/lib/api";
import { useSession } from "@/App";
import { useLeaveGuard } from "@/hooks/use-leave-guard";
import { Field } from "@/components/form";
import { ImageField } from "@/components/image-field";
import { RichTextEditor } from "@/components/rich-text";
import { StatusBadge } from "@/components/status-badge";
import {
  CharCount,
  EditorHeader,
  PublishActions,
  SerpPreview,
  SidebarSection,
  TitleBlock,
} from "@/components/document-editor";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type InfoPage = {
  id: number;
  title: string;
  slug: string;
  content: string | null;
  coverImage: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  published: boolean;
  featuredInNavbar: boolean;
  infoPageCategoryId: number | null;
};

type Category = { id: number; name: string | null };

type FormState = {
  title: string;
  slug: string;
  content: string;
  coverImage: string;
  metaTitle: string;
  metaDescription: string;
  featuredInNavbar: boolean;
  infoPageCategoryId: string;
};

const empty: FormState = {
  title: "",
  slug: "",
  content: "",
  coverImage: "",
  metaTitle: "",
  metaDescription: "",
  featuredInNavbar: false,
  infoPageCategoryId: "",
};

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export function InfoPageEditorPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [form, setForm] = useState<FormState>(empty);
  const [baseline, setBaseline] = useState(JSON.stringify(empty));
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState<"draft" | "publish" | "unpublish" | null>(null);

  const { data: existing, isLoading, isError } = useQuery({
    queryKey: ["info-page", id],
    queryFn: () => api<{ page: InfoPage }>(`/info-pages/${id}`),
    enabled: !isNew,
  });
  const { data: categories } = useQuery({
    queryKey: ["page-categories"],
    queryFn: () => api<{ data: Category[] }>("/info-page-categories"),
  });

  useEffect(() => {
    if (!existing) return;
    const p = existing.page;
    const loaded: FormState = {
      title: p.title,
      slug: p.slug,
      content: p.content ?? "",
      coverImage: p.coverImage ?? "",
      metaTitle: p.metaTitle ?? "",
      metaDescription: p.metaDescription ?? "",
      featuredInNavbar: p.featuredInNavbar,
      infoPageCategoryId: p.infoPageCategoryId ? String(p.infoPageCategoryId) : "",
    };
    setForm(loaded);
    setBaseline(JSON.stringify(loaded));
    setPublished(p.published);
  }, [existing]);

  const dirty = JSON.stringify(form) !== baseline;
  const confirmLeave = useLeaveGuard(dirty);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = async (intent: "draft" | "publish" | "unpublish") => {
    if (!form.title.trim()) {
      toast.error("Give the page a title first.");
      return;
    }
    const nextPublished = intent === "publish" ? true : intent === "unpublish" ? false : published;
    setSaving(intent);
    try {
      const body = {
        title: form.title.trim(),
        slug: form.slug || undefined,
        content: form.content,
        coverImage: form.coverImage || null,
        metaTitle: form.metaTitle || null,
        metaDescription: form.metaDescription || null,
        published: nextPublished,
        featuredInNavbar: form.featuredInNavbar,
        infoPageCategoryId: form.infoPageCategoryId ? Number(form.infoPageCategoryId) : null,
      };
      const res = isNew
        ? await api<{ page: InfoPage }>("/info-pages", { body })
        : await api<{ page: InfoPage }>(`/info-pages/${id}`, { body, method: "PATCH" });
      const saved = { ...form, slug: res.page?.slug ?? form.slug };
      setForm(saved);
      setBaseline(JSON.stringify(saved));
      setPublished(nextPublished);
      void queryClient.invalidateQueries({ queryKey: ["info-pages"] });
      toast.success(
        intent === "publish" ? (published ? "Changes saved" : "Page published") : intent === "unpublish" ? "Page moved to drafts" : "Draft saved",
      );
      if (isNew && res.page) navigate(`/info-pages/${res.page.id}`, { replace: true });
    } catch (err) {
      toastApiError(err, "Couldn't save the page");
    } finally {
      setSaving(null);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (saving === null && dirty) void save(published ? "publish" : "draft");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!isNew && isLoading) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-[60vh] w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (isError) {
    return (
      <div role="alert" className="rounded-lg border p-8 text-center">
        <p className="font-medium">This page couldn't be loaded.</p>
        <p className="mt-1 text-sm text-muted-foreground">It may have been deleted.</p>
      </div>
    );
  }

  const siteHost = (session?.tenant?.website || "your-site.com").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const urlPrefix = `${siteHost}/`;

  return (
    <div>
      <EditorHeader
        title={form.title.trim() || (isNew ? "New page" : "Untitled page")}
        badge={<StatusBadge kind="content" status={published ? "published" : "draft"} />}
        dirty={dirty}
        subtitle={isNew ? "Not saved yet" : `/${form.slug}`}
        onBack={() => confirmLeave() && navigate("/info-pages")}
        actions={
          <PublishActions
            published={published}
            dirty={dirty}
            isNew={isNew}
            saving={saving}
            canSave={Boolean(form.title.trim())}
            onSave={save}
          />
        }
      />

      <div className="grid gap-x-10 gap-y-8 pt-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <TitleBlock
            title={form.title}
            onTitleChange={(v) => set("title", v)}
            slug={form.slug}
            onSlugChange={(v) => set("slug", v)}
            prefix={urlPrefix}
            placeholder="Page title"
          />
          <RichTextEditor
            value={form.content}
            onChange={(html) => set("content", html)}
            placeholder="Write the page… e.g. who you are, how booking works, your terms."
            minHeight={480}
            variant="document"
            stickyToolbar="7.25rem"
          />
        </div>

        <aside className="lg:sticky lg:top-32 lg:max-h-[calc(100vh-9rem)] lg:self-start lg:overflow-y-auto lg:border-l lg:pl-8">
          <SidebarSection title="Page settings">
            <Field label="Category" hint="Put legal pages (terms, privacy) in a “Legal” category.">
              <Select
                value={form.infoPageCategoryId || "none"}
                onValueChange={(v) => set("infoPageCategoryId", v === "none" ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categories?.data.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name ?? `#${c.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <label className="flex items-start justify-between gap-4">
              <span>
                <span className="block text-sm font-medium">Show in site navigation</span>
                <span className="block text-xs text-muted-foreground">Adds a link to your site's main menu.</span>
              </span>
              <Switch checked={form.featuredInNavbar} onCheckedChange={(v) => set("featuredInNavbar", v)} />
            </label>
          </SidebarSection>

          <SidebarSection title="Cover image">
            <ImageField value={form.coverImage} onChange={(url) => set("coverImage", url)} />
          </SidebarSection>

          <SidebarSection title="Search engine listing">
            <SerpPreview
              title={form.metaTitle || form.title}
              url={`${urlPrefix}${form.slug || "…"}`}
              description={form.metaDescription || stripHtml(form.content).slice(0, 160)}
            />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <label htmlFor="meta-title" className="font-medium">
                  Meta title
                </label>
                <span className="text-xs">
                  <CharCount value={form.metaTitle} max={60} />
                </span>
              </div>
              <Input id="meta-title" value={form.metaTitle} onChange={(e) => set("metaTitle", e.target.value)} placeholder={form.title} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <label htmlFor="meta-desc" className="font-medium">
                  Meta description
                </label>
                <span className="text-xs">
                  <CharCount value={form.metaDescription} max={160} />
                </span>
              </div>
              <Textarea id="meta-desc" rows={3} value={form.metaDescription} onChange={(e) => set("metaDescription", e.target.value)} />
            </div>
          </SidebarSection>
        </aside>
      </div>
    </div>
  );
}
