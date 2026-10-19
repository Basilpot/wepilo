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
  TagInput,
  TitleBlock,
} from "@/components/document-editor";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Post = {
  id: number;
  title: string;
  slug: string;
  content: string | null;
  coverImage: string | null;
  tags: string[] | null;
  published: boolean;
  postType: "BLOG" | "TRAVEL_GUIDE";
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  blogCategoryId: number | null;
  writerId: number | null;
};

type Category = { id: number; name: string | null };
type Writer = { id: number; name: string | null; username: string };

type FormState = {
  title: string;
  slug: string;
  content: string;
  coverImage: string;
  tags: string[];
  postType: "BLOG" | "TRAVEL_GUIDE";
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  blogCategoryId: string;
  writerId: string;
};

const empty: FormState = {
  title: "",
  slug: "",
  content: "",
  coverImage: "",
  tags: [],
  postType: "BLOG",
  metaTitle: "",
  metaDescription: "",
  canonicalUrl: "",
  blogCategoryId: "",
  writerId: "",
};

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export function PostEditorPage() {
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
    queryKey: ["post", id],
    queryFn: () => api<{ post: Post }>(`/blogs/${id}`),
    enabled: !isNew,
  });
  const { data: categories } = useQuery({
    queryKey: ["page-categories"],
    queryFn: () => api<{ data: Category[] }>("/info-page-categories"),
  });
  const { data: writers } = useQuery({
    queryKey: ["authors"],
    queryFn: () => api<{ data: Writer[] }>("/authors"),
  });

  useEffect(() => {
    if (!existing) return;
    const p = existing.post;
    const loaded: FormState = {
      title: p.title,
      slug: p.slug,
      content: p.content ?? "",
      coverImage: p.coverImage ?? "",
      tags: p.tags ?? [],
      postType: p.postType,
      metaTitle: p.metaTitle ?? "",
      metaDescription: p.metaDescription ?? "",
      canonicalUrl: p.canonicalUrl ?? "",
      blogCategoryId: p.blogCategoryId ? String(p.blogCategoryId) : "",
      writerId: p.writerId ? String(p.writerId) : "",
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
      toast.error("Give the post a title first.");
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
        tags: form.tags,
        published: nextPublished,
        postType: form.postType,
        metaTitle: form.metaTitle || null,
        metaDescription: form.metaDescription || null,
        canonicalUrl: form.canonicalUrl || null,
        blogCategoryId: form.blogCategoryId ? Number(form.blogCategoryId) : null,
        writerId: form.writerId ? Number(form.writerId) : null,
      };
      const res = isNew
        ? await api<{ post: Post }>("/blogs", { body })
        : await api<{ post: Post }>(`/blogs/${id}`, { body, method: "PATCH" });
      const saved = { ...form, slug: res.post.slug ?? form.slug };
      setForm(saved);
      setBaseline(JSON.stringify(saved));
      setPublished(nextPublished);
      void queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success(
        intent === "publish" ? (published ? "Changes saved" : "Post published") : intent === "unpublish" ? "Post moved to drafts" : "Draft saved",
      );
      if (isNew) navigate(`/posts/${res.post.id}`, { replace: true });
    } catch (err) {
      toastApiError(err, "Couldn't save the post");
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
        <p className="font-medium">This post couldn't be loaded.</p>
        <p className="mt-1 text-sm text-muted-foreground">It may have been deleted.</p>
      </div>
    );
  }

  const siteHost = (session?.tenant?.website || "your-site.com").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const urlPrefix = `${siteHost}/blog/`;
  const wordCount = stripHtml(form.content).split(" ").filter(Boolean).length;

  return (
    <div>
      <EditorHeader
        title={form.title.trim() || (isNew ? "New post" : "Untitled post")}
        badge={<StatusBadge kind="content" status={published ? "published" : "draft"} />}
        dirty={dirty}
        subtitle={
          isNew ? "Not saved yet" : `${wordCount.toLocaleString()} words · ~${Math.max(1, Math.round(wordCount / 220))} min read`
        }
        onBack={() => confirmLeave() && navigate("/posts")}
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
            placeholder="Post title"
          />
          <RichTextEditor
            value={form.content}
            onChange={(html) => set("content", html)}
            placeholder="Tell your story… Use headings to break it into sections."
            minHeight={480}
            variant="document"
            stickyToolbar="7.25rem"
          />
        </div>

        <aside className="lg:sticky lg:top-32 lg:max-h-[calc(100vh-9rem)] lg:self-start lg:overflow-y-auto lg:border-l lg:pl-8">
          <SidebarSection title="Post settings">
            <Field label="Type">
              <Select value={form.postType} onValueChange={(v) => set("postType", v as FormState["postType"])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BLOG">Blog post</SelectItem>
                  <SelectItem value="TRAVEL_GUIDE">Travel guide</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Category">
              <Select value={form.blogCategoryId || "none"} onValueChange={(v) => set("blogCategoryId", v === "none" ? "" : v)}>
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
            <Field label="Author">
              <Select value={form.writerId || "none"} onValueChange={(v) => set("writerId", v === "none" ? "" : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No author</SelectItem>
                  {writers?.data.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.name ?? w.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tags" hint="Press Enter or comma to add.">
              <TagInput value={form.tags} onChange={(tags) => set("tags", tags)} />
            </Field>
          </SidebarSection>

          <SidebarSection title="Cover image" description="Shown at the top of the post and when it's shared.">
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
              <Textarea
                id="meta-desc"
                rows={3}
                value={form.metaDescription}
                onChange={(e) => set("metaDescription", e.target.value)}
                placeholder="One or two sentences that make someone click."
              />
            </div>
            <Field label="Canonical URL" hint="Only if this post first appeared elsewhere.">
              <Input value={form.canonicalUrl} onChange={(e) => set("canonicalUrl", e.target.value)} placeholder="https://…" />
            </Field>
          </SidebarSection>
        </aside>
      </div>
    </div>
  );
}
