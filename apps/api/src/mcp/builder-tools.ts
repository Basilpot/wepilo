import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod4";
import { app } from "@/app";
import type { Env } from "@/env";
import apiGuide from "../../../../docs/API.md";
import { callApi, WepiloApiError } from "./internal";
import type { ConnectionProps } from "./props";

/** `docs/API.md` split into its numbered top-level sections ("## 3. Trips"…). */
function guideSections() {
  const parts = apiGuide.split(/^(?=## \d+\. )/m);
  const intro = parts.shift() ?? "";
  return {
    intro,
    sections: parts.map((body) => ({ title: body.split("\n")[0].replace(/^## \d+\.\s*/, "").trim(), body })),
  };
}

const SECTION_KEYS = {
  setup: ["Identify the agency", "Conventions"],
  trips: ["Trips"],
  booking: ["Departures and bookings"],
  inquiries: ["Inquiries and newsletter"],
  content: ["Website content"],
  accounts: ["Traveller accounts (optional)"],
  examples: ["Examples", "Caching tips", "Checklist before launch"],
} as const;

const text = (body: string) => ({ content: [{ type: "text" as const, text: body }] });

export function registerBuilderTools(server: McpServer, env: Env, ctx: ExecutionContext, props: ConnectionProps) {
  const publicGet = async (path: string, slug: string) => {
    const res = await app.fetch(
      new Request(new URL(`/api/v1${path}`, env.API_BASE_URL), { headers: { "x-tenant-slug": slug } }),
      env,
      ctx,
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new WepiloApiError(res.status, (data as { error?: string }).error ?? `Wepilo returned ${res.status}.`);
    return data;
  };
  const tenantSlug = async () => {
    const me = await callApi<{ tenant: { slug: string; companyName: string | null } | null }>(env, ctx, props, "/auth/me");
    if (!me.tenant) throw new WepiloApiError(404, "No Wepilo workspace is linked to this connection.");
    return me.tenant.slug;
  };

  server.registerTool(
    "get_website_connection",
    {
      title: "How to connect a website to Wepilo",
      description:
        "Use this first when building or editing the agency's public website (for example in Lovable, Base44, Bolt or v0). Returns the API base URL, this agency's slug, and the rules for which header to use in browser code versus server code.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const slug = await tenantSlug();
        const base = `${env.API_BASE_URL}/api/v1`;
        return text(
          [
            `Agency: ${props.companyName}`,
            `API base URL: ${base}`,
            `Agency slug: ${slug}`,
            "",
            "Browser code (React components, client-side fetch, forms):",
            `- Send the header "x-tenant-slug: ${slug}" on every request.`,
            "- Works for reading published trips, departures, pages, posts and reviews, and for submitting the inquiry form, the newsletter form and booking requests.",
            "",
            "Server-side code only (server components, edge or serverless functions, build scripts):",
            '- You may use "x-api-key: <key>" instead. The owner creates the key in Wepilo under Settings → API keys.',
            "- Never put the API key in browser code, a public environment variable (VITE_*, NEXT_PUBLIC_*) or a repository. Store it as a server secret.",
            "",
            "Rules for the website:",
            "- Only published trips are returned to the website; drafts stay hidden.",
            "- Prices are in USD. Rich text fields (overview, content, highlights, inclusions…) are HTML: render them as HTML, sanitised.",
            "- Bookings are reservation requests. The agency collects payment itself, so don't add a payment step.",
            "",
            'Call get_api_guide for endpoint details and sample_public_data to see real responses for this agency.',
          ].join("\n"),
        );
      } catch (err) {
        return { isError: true, content: [{ type: "text" as const, text: err instanceof Error ? err.message : "Could not read the workspace." }] };
      }
    },
  );

  server.registerTool(
    "get_api_guide",
    {
      title: "Wepilo website API guide",
      description:
        "Returns the Wepilo website API documentation for one topic: setup (headers, pagination, errors), trips, booking (departures and booking requests), inquiries (contact and newsletter forms), content (pages, posts, redirects), accounts (traveller sign-in) or examples (Next.js, plain fetch, caching, launch checklist).",
      inputSchema: z.object({
        topic: z.enum(["setup", "trips", "booking", "inquiries", "content", "accounts", "examples"]),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ topic }) => {
      const { intro, sections } = guideSections();
      const wanted = SECTION_KEYS[topic] as readonly string[];
      const picked = sections.filter((s) => wanted.includes(s.title)).map((s) => s.body.trim());
      const body = topic === "setup" ? [intro.trim(), ...picked] : picked;
      return text(body.join("\n\n") || "That part of the guide isn't available.");
    },
  );

  server.registerTool(
    "sample_public_data",
    {
      title: "Sample website data",
      description:
        "Fetches a few real records for this agency exactly as the public website API returns them, so page layouts use the true field names: trips, one trip in full, departures, posts, page categories or the team.",
      inputSchema: z.object({ kind: z.enum(["trips", "trip", "departures", "posts", "page-categories", "team"]) }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ kind }) => {
      try {
        const slug = await tenantSlug();
        let path: string;
        let data: unknown;
        if (kind === "trip") {
          const list = (await publicGet("/activities?limit=1", slug)) as { data: Array<{ slug: string }> };
          if (!list.data.length) return text("This agency has no published trips yet, so there is no trip to show.");
          path = `/activities/slug/${list.data[0].slug}`;
          data = await publicGet(path, slug);
        } else {
          path = {
            trips: "/activities?limit=3",
            departures: "/departures?limit=3",
            posts: "/blogs/published?limit=3",
            "page-categories": "/info-page-categories",
            team: "/public/team/public",
          }[kind];
          data = await publicGet(path, slug);
        }
        const json = JSON.stringify(data, null, 2);
        return text(`GET /api/v1${path}  (header x-tenant-slug: ${slug})\n\n${json.length > 12000 ? `${json.slice(0, 12000)}\n… (truncated)` : json}`);
      } catch (err) {
        return { isError: true, content: [{ type: "text" as const, text: err instanceof Error ? err.message : "Could not load sample data." }] };
      }
    },
  );
}
