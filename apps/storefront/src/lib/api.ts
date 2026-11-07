/** Reads one agency's public content from the Wepilo API. Everything here is what any website could read with the same slug. */

export type Env = { API_BASE_URL: string; TENANT_SLUG?: string };

export class ApiProblem extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export type NavItem = { label: string; href: string; children?: NavItem[] };

export type Section = {
  id: string;
  type: "HERO" | "FEATURED_TRIPS" | "DESTINATIONS" | "CATEGORIES" | "TESTIMONIALS" | "LATEST_POSTS" | "NEWSLETTER" | "CUSTOM_TEXT";
  title?: string | null;
  subtitle?: string | null;
  image?: string | null;
  body?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  data?: Record<string, any>[];
};

export type Site = {
  company: { name: string | null; logo: string | null; description: string | null; phone: string | null; address: string | null; website: string | null; email: string | null };
  seo: { siteTitle?: string | null; description?: string | null; ogImage?: string | null };
  social: Record<string, string | null | undefined>;
  announcement: { text: string; href?: string | null } | null;
  navigation: { header: NavItem[]; footer: { title: string; items: NavItem[] }[] };
  homepage: Section[];
};

export type Trip = Record<string, any> & { id: number; title: string; slug: string };

export type Client = ReturnType<typeof client>;

export function client(env: Env, slug: string) {
  const get = async <T = any>(path: string, query: Record<string, string | number | undefined> = {}): Promise<T> => {
    const url = new URL(`/api/v1${path}`, env.API_BASE_URL);
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    const res = await fetch(url, { headers: { "x-tenant-slug": slug, accept: "application/json" } });
    const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    if (!res.ok) throw new ApiProblem(res.status, data.error ?? "Request failed", data.code);
    return data as T;
  };
  const post = async (path: string, body: unknown) => {
    const res = await fetch(new URL(`/api/v1${path}`, env.API_BASE_URL), {
      method: "POST",
      headers: { "x-tenant-slug": slug, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; fields?: Record<string, string> };
    if (!res.ok) {
      // A validation problem names the first field that needs fixing, in words a visitor can act on.
      const labels: Record<string, string> = { name: "Your name", email: "Email", message: "Message", phone: "Phone" };
      const [key, text] = data.fields ? (Object.entries(data.fields)[0] ?? []) : [];
      throw new ApiProblem(res.status, text ? `${labels[key!] ?? "Please check your details"}: ${text}` : (data.error ?? "Something went wrong. Please try again."));
    }
    return data;
  };
  return {
    slug,
    site: () => get<Site>("/site"),
    currency: () => get<{ base: string; translation: boolean }>("/public/currency").catch(() => ({ base: "USD", translation: false })),
    trips: (query: Record<string, string | number | undefined> = {}) => get<{ data: Trip[]; pagination: { total: number } }>("/activities", { limit: 48, ...query }),
    trip: (tripSlug: string) => get<{ activity: Trip }>(`/activities/slug/${encodeURIComponent(tripSlug)}`),
    departures: (activityId: number) => get<{ data: Record<string, any>[] }>("/departures", { activityId, status: "OPEN", limit: 6 }).catch(() => ({ data: [] })),
    reviews: (activityId: number) => get<{ data: Record<string, any>[] }>("/reviews", { activityId, limit: 6 }).catch(() => ({ data: [] })),
    categories: () => get<{ data: Record<string, any>[] }>("/trip-categories"),
    locations: () => get<{ data: Record<string, any>[] }>("/locations"),
    posts: () => get<{ data: Record<string, any>[] }>("/blogs/published", { limit: 24 }),
    post: (postSlug: string) => get<{ post: Record<string, any> }>(`/blogs/slug/${encodeURIComponent(postSlug)}`),
    page: (pageSlug: string) => get<{ page: Record<string, any> }>(`/info-pages/slug/${encodeURIComponent(pageSlug)}`),
    inquiry: (body: Record<string, unknown>) => post("/inquiries", body),
    subscribe: (email: string) => post("/newsletter/subscribe", { email }),
  };
}
