import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "@/components/icons";
import { api, toastApiError } from "@/lib/api";
import { useLeaveGuard } from "@/hooks/use-leave-guard";
import { PageHeader } from "@/components/PageHeader";
import { Field } from "@/components/form";
import { ImageField } from "@/components/image-field";
import { confirmDialog } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsSection } from "@/pages/settings/parts";
import { HomepageEditor } from "@/pages/website/HomepageEditor";
import { MenusEditor } from "@/pages/website/MenusEditor";
import type { SiteConfig } from "@/pages/website/types";
import { cn } from "@/lib/utils";

const SOCIALS: Array<[keyof SiteConfig["social"], string, string]> = [
  ["facebook", "Facebook", "https://facebook.com/…"],
  ["instagram", "Instagram", "https://instagram.com/…"],
  ["x", "X", "https://x.com/…"],
  ["youtube", "YouTube", "https://youtube.com/@…"],
  ["tiktok", "TikTok", "https://tiktok.com/@…"],
  ["linkedin", "LinkedIn", "https://linkedin.com/company/…"],
  ["whatsapp", "WhatsApp number", "+977 9800000000"],
];

const PATHS: Array<[keyof SiteConfig["paths"], string]> = [
  ["trips", "All trips"],
  ["trip", "One trip"],
  ["category", "Trip category"],
  ["destination", "Destination"],
  ["posts", "All posts"],
  ["post", "One post"],
  ["page", "Page"],
];

/** Empty strings become null so the API stores "nothing" rather than "". */
const clean = (config: SiteConfig): SiteConfig => ({
  ...config,
  social: Object.fromEntries(Object.entries(config.social).map(([k, v]) => [k, v?.toString().trim() || null])),
  seo: { siteTitle: config.seo.siteTitle?.trim() || null, description: config.seo.description?.trim() || null, ogImage: config.seo.ogImage || null },
  announcement: { ...config.announcement, href: config.announcement.href?.trim() || null },
});

type Snippet = { id: number; name: string };

function SnippetList({ title, description, endpoint, empty }: { title: string; description: string; endpoint: string; empty: string }) {
  const queryClient = useQueryClient();
  const key = ["snippets", endpoint];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => api<{ data: Snippet[] }>(endpoint) });
  const remove = useMutation({
    meta: { success: "Deleted." },
    mutationFn: (id: number) => api(`${endpoint}/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: (err) => toastApiError(err),
  });
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => api(`${endpoint}/${id}`, { method: "PATCH", body: { name } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: (err) => toastApiError(err),
  });
  return (
    <SettingsSection title={title} description={description}>
      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : data?.data.length ? (
        <ul className="divide-y rounded-lg border">
          {data.data.map((s) => (
            <li key={s.id} className="flex items-center gap-2 px-3 py-2">
              <Input
                aria-label="Name"
                defaultValue={s.name}
                className="h-8 border-transparent bg-transparent shadow-none focus-visible:border-input"
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name && name !== s.name) rename.mutate({ id: s.id, name });
                  else e.target.value = s.name;
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${s.name}`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => confirmDialog({ title: `Delete “${s.name}”?`, description: "Content already inserted into trips or pages is not affected.", confirmLabel: "Delete", cancelLabel: "Keep" }, () => remove.mutate(s.id))}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </SettingsSection>
  );
}

export function WebsitePage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["site-config"], queryFn: () => api<{ config: SiteConfig }>("/site/config") });
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const baseline = data ? JSON.stringify(data.config) : "";
  useEffect(() => {
    if (data) setConfig(structuredClone(data.config));
  }, [baseline]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = Boolean(config) && JSON.stringify(config) !== baseline;
  useLeaveGuard(dirty);

  const save = useMutation({
    meta: { success: "Website settings saved. Your site picks them up within a minute." },
    mutationFn: () => api<{ config: SiteConfig }>("/site/config", { method: "PUT", body: clean(config!) }),
    onSuccess: (res) => queryClient.setQueryData(["site-config"], res),
    onError: (err) => toastApiError(err),
  });

  if (isLoading || !config) {
    return (
      <div>
        <PageHeader title="Website" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  const set = <K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) => setConfig((c) => (c ? { ...c, [key]: value } : c));

  return (
    <div>
      <PageHeader
        title="Website"
        description="What your site's homepage shows, its menus and links, and your social and search details. Your developer receives all of this from one request, so changes here need no code."
      />
      <Tabs defaultValue="homepage">
        <TabsList variant="line" className="w-full justify-start border-b">
          <TabsTrigger value="homepage" className="flex-none px-3">Homepage</TabsTrigger>
          <TabsTrigger value="menus" className="flex-none px-3">Menus</TabsTrigger>
          <TabsTrigger value="details" className="flex-none px-3">Links and details</TabsTrigger>
          <TabsTrigger value="snippets" className="flex-none px-3">Saved content</TabsTrigger>
        </TabsList>

        <TabsContent value="homepage" className="pt-6">
          <HomepageEditor sections={config.homepage.sections} onChange={(sections) => set("homepage", { sections })} />
        </TabsContent>

        <TabsContent value="menus" className="pt-6">
          <MenusEditor navigation={config.navigation} onChange={(navigation) => set("navigation", navigation)} />
        </TabsContent>

        <TabsContent value="details" className="pt-4">
          <SettingsSection title="Announcement bar" description="A short message across the top of your site, for a sale or a notice.">
            <label className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm">
              Show the announcement
              <Switch checked={config.announcement.enabled} onCheckedChange={(enabled) => set("announcement", { ...config.announcement, enabled })} />
            </label>
            <Field label="Message">
              <Input maxLength={200} value={config.announcement.text} onChange={(e) => set("announcement", { ...config.announcement, text: e.target.value })} />
            </Field>
            <Field label="Link (optional)">
              <Input value={config.announcement.href ?? ""} onChange={(e) => set("announcement", { ...config.announcement, href: e.target.value })} placeholder="/trips/everest-base-camp" />
            </Field>
          </SettingsSection>

          <SettingsSection title="Search and sharing" description="The default title, description and picture when your homepage is shared or found on Google.">
            <Field label="Site title">
              <Input value={config.seo.siteTitle ?? ""} onChange={(e) => set("seo", { ...config.seo, siteTitle: e.target.value })} />
            </Field>
            <Field label="Description" hint="One or two sentences, up to 160 characters reads best.">
              <Input value={config.seo.description ?? ""} onChange={(e) => set("seo", { ...config.seo, description: e.target.value })} />
            </Field>
            <Field label="Sharing picture">
              <ImageField value={config.seo.ogImage} onChange={(url) => set("seo", { ...config.seo, ogImage: url || null })} />
            </Field>
          </SettingsSection>

          <SettingsSection title="Social links" description="Shown in your footer and on contact blocks.">
            <div className="grid gap-4 sm:grid-cols-2">
              {SOCIALS.map(([key, label, placeholder]) => (
                <Field key={key} label={label}>
                  <Input value={config.social[key] ?? ""} placeholder={placeholder} onChange={(e) => set("social", { ...config.social, [key]: e.target.value })} />
                </Field>
              ))}
            </div>
          </SettingsSection>

          <SettingsSection title="Page addresses" description="How your website names its pages, so the links we generate match. Use {slug} or {handle} where the page's own name goes.">
            <div className="grid gap-4 sm:grid-cols-2">
              {PATHS.map(([key, label]) => (
                <Field key={key} label={label}>
                  <Input value={config.paths[key]} className="font-mono text-sm" onChange={(e) => set("paths", { ...config.paths, [key]: e.target.value })} />
                </Field>
              ))}
            </div>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="snippets" className="pt-4">
          <SnippetList
            title="Text templates"
            description="Snippets you insert into posts, pages and trips from the editor toolbar."
            endpoint="/templates"
            empty="None yet. In any editor, select some text and choose “Save as template”."
          />
          <SnippetList
            title="Saved itinerary days"
            description="Days you saved from a trip, ready to drop into another one."
            endpoint="/saved-sections"
            empty="None yet. In a trip's itinerary, open a day and choose “Save for reuse”."
          />
        </TabsContent>
      </Tabs>

      <div
        className={cn(
          "sticky bottom-4 z-10 mt-6 flex items-center justify-between gap-3 rounded-lg border bg-background/95 px-4 py-3 shadow-lg backdrop-blur transition-all",
          dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
        )}
        aria-hidden={!dirty}
      >
        <span className="text-sm text-muted-foreground">You have unsaved changes</span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" disabled={save.isPending} onClick={() => data && setConfig(structuredClone(data.config))}>
            Discard
          </Button>
          <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
