import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod4";
import type { Env } from "@/env";
import { callApi, WepiloApiError } from "./internal";
import type { ConnectionProps } from "./props";

type Paged<T> = { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } };

type Inquiry = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  trip: string | null;
  message: string;
  status: string;
  createdAt: string;
};
type Booking = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  groupSize: number;
  totalPrice: number;
  status: string;
  createdAt: string;
  activity: { id: number; title: string | null } | null;
  departure: { id: number; startDate: string; endDate: string | null } | null;
};
type Departure = {
  id: number;
  startDate: string;
  endDate: string | null;
  capacity: number;
  availableSpots: number;
  price: number;
  status: string;
  activity: { id: number; title: string | null };
};
type Trip = {
  id: number;
  title: string | null;
  slug: string;
  status: string;
  layout: string;
  price: number | null;
  duration: string | null;
  views: number;
  tripCategory?: { name: string | null } | null;
  city?: { name: string | null } | null;
};
type Analytics = {
  trips: { total: number; published: number; drafts: number };
  bookings: { confirmed: number; pending: number };
  revenue: number;
  inquiriesNew: number;
  upcomingDepartures: Array<{ id: number; startDate: string; availableSpots: number; capacity: number; activity: { title: string | null } }>;
};
type Named = { id: number; name?: string | null; handle?: string; price?: number | null; type?: string };

const money = (n: number | null | undefined) =>
  n == null ? "no price" : `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const day = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "no date";
const clip = (text: string, max = 280) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

const text = (body: string) => ({ content: [{ type: "text" as const, text: body }] });
const failure = (err: unknown) => ({
  isError: true,
  content: [
    {
      type: "text" as const,
      text: err instanceof WepiloApiError ? err.message : "Something went wrong while talking to Wepilo. Try again in a moment.",
    },
  ],
});

const READ = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

const pageArgs = {
  page: z.number().int().min(1).optional().describe("Page number, starting at 1."),
  limit: z.number().int().min(1).max(50).optional().describe("How many results per page (default 20, max 50)."),
};

const pageLine = (p: Paged<unknown>["pagination"], noun: string) =>
  p.total === 0 ? `No ${noun}.` : `Showing page ${p.page} of ${p.totalPages} (${p.total} ${noun} in total).`;

export function registerStaffTools(server: McpServer, env: Env, ctx: ExecutionContext, props: ConnectionProps) {
  const dash = (path: string) => `${env.DASHBOARD_URL}${path}`;
  const run =
    <A>(fn: (args: A) => Promise<string>) =>
    async (args: A) => {
      try {
        return text(await fn(args));
      } catch (err) {
        return failure(err);
      }
    };
  const api = <T>(path: string, options?: Parameters<typeof callApi>[4]) => callApi<T>(env, ctx, props, path, options);

  // ── Overview ────────────────────────────────────────────────────────────────

  server.registerTool(
    "today_summary",
    {
      title: "What needs me today",
      description:
        "Start here. Summarises what needs action in this Wepilo workspace right now: new inquiries waiting for a reply, bookings waiting for confirmation and the next departures with seats left, plus headline numbers.",
      inputSchema: z.object({}),
      annotations: READ,
    },
    run(async () => {
      const [stats, inquiries, pending] = await Promise.all([
        api<Analytics>("/tenant/analytics"),
        api<Paged<Inquiry>>("/inquiries", { query: { status: "NEW", limit: 5 } }),
        api<Paged<Booking>>("/bookings", { query: { status: "PENDING", limit: 5 } }),
      ]);
      const lines = [`Wepilo workspace: ${props.companyName} (signed in as ${props.staffName}, ${props.role.toLowerCase()}).`, ""];
      lines.push(`New inquiries waiting for a reply: ${inquiries.pagination.total}`);
      for (const i of inquiries.data) lines.push(`- #${i.id} ${i.name} about ${i.trip ?? "a general question"}, ${day(i.createdAt)}: "${clip(i.message, 140)}"`);
      lines.push("", `Bookings waiting for confirmation: ${pending.pagination.total}`);
      for (const b of pending.data)
        lines.push(`- #${b.id} ${b.name}, ${b.groupSize} seat(s) on ${b.activity?.title ?? "a removed trip"} (${day(b.departure?.startDate)}), ${money(b.totalPrice)}`);
      lines.push("", "Next departures:");
      if (!stats.upcomingDepartures.length) lines.push("- None scheduled. Travellers can't book online until a trip has a departure.");
      for (const d of stats.upcomingDepartures)
        lines.push(`- ${d.activity.title ?? "Untitled trip"} on ${day(d.startDate)}: ${d.capacity - d.availableSpots} of ${d.capacity} seats booked`);
      lines.push(
        "",
        `Trips: ${stats.trips.published} published, ${stats.trips.drafts} draft. Confirmed bookings: ${stats.bookings.confirmed}. Confirmed value: ${money(stats.revenue)}.`,
        `Dashboard: ${dash("/")}`,
      );
      return lines.join("\n");
    }),
  );

  // ── Inquiries ───────────────────────────────────────────────────────────────

  server.registerTool(
    "list_inquiries",
    {
      title: "List inquiries",
      description:
        "Lists questions travellers sent through the agency's website forms, newest first, with the full message and contact details so you can help draft a reply.",
      inputSchema: z.object({
        status: z.enum(["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional().describe("Only inquiries with this status."),
        ...pageArgs,
      }),
      annotations: READ,
    },
    run(async ({ status, page, limit }) => {
      const res = await api<Paged<Inquiry>>("/inquiries", { query: { status, page, limit } });
      const lines = [pageLine(res.pagination, "inquiries")];
      for (const i of res.data) {
        lines.push(
          "",
          `#${i.id} · ${i.status} · ${day(i.createdAt)}`,
          `From: ${i.name} <${i.email}>${i.phone ? `, ${i.phone}` : ""}`,
          `About: ${i.trip ?? "general question"}`,
          `Message: ${clip(i.message, 1200)}`,
        );
      }
      lines.push("", `Open in Wepilo: ${dash("/inquiries")}`);
      return lines.join("\n");
    }),
  );

  server.registerTool(
    "set_inquiry_status",
    {
      title: "Update an inquiry's status",
      description:
        "Moves an inquiry to a new status: IN_PROGRESS once someone is handling it, RESOLVED when the traveller has been helped, CLOSED when no action is needed. This does not send anything to the traveller.",
      inputSchema: z.object({
        inquiryId: z.number().int().describe("The inquiry number, e.g. 12 for #12."),
        status: z.enum(["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
      }),
      annotations: { ...WRITE, idempotentHint: true },
    },
    run(async ({ inquiryId, status }) => {
      const res = await api<{ inquiry: Inquiry }>(`/inquiries/${inquiryId}/status`, { method: "PATCH", body: { status } });
      return `Inquiry #${res.inquiry.id} from ${res.inquiry.name} is now ${status}. Nothing was sent to the traveller.\nOpen in Wepilo: ${dash("/inquiries")}`;
    }),
  );

  // ── Bookings ────────────────────────────────────────────────────────────────

  server.registerTool(
    "list_bookings",
    {
      title: "List bookings",
      description: "Lists seat reservations travellers made on the agency's departures, newest first. Filter by status or search by traveller name or email.",
      inputSchema: z.object({
        status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]).optional(),
        search: z.string().optional().describe("Part of the traveller's name or email."),
        ...pageArgs,
      }),
      annotations: READ,
    },
    run(async ({ status, search, page, limit }) => {
      const res = await api<Paged<Booking>>("/bookings", { query: { status, search, page, limit } });
      const lines = [pageLine(res.pagination, "bookings")];
      for (const b of res.data) {
        lines.push(
          `- #${b.id} · ${b.status} · ${b.name} <${b.email}> · ${b.groupSize} seat(s) on ${b.activity?.title ?? "a removed trip"}, departs ${day(b.departure?.startDate)} · ${money(b.totalPrice)}`,
        );
      }
      lines.push("", `Open in Wepilo: ${dash("/bookings")}`);
      return lines.join("\n");
    }),
  );

  const bookingStatus = (status: "CONFIRMED" | "CANCELLED" | "COMPLETED", verb: string, extra: string) =>
    run(async ({ bookingId }: { bookingId: number }) => {
      const res = await api<{ booking: Booking }>(`/bookings/${bookingId}/status`, { method: "PATCH", body: { status } });
      return `Booking #${res.booking.id} for ${res.booking.name} (${res.booking.groupSize} seat(s)) is now ${verb}. ${extra}\nOpen in Wepilo: ${dash("/bookings")}`;
    });

  server.registerTool(
    "confirm_booking",
    {
      title: "Confirm a booking",
      description: "Confirms a pending booking so the traveller's seats are secured. The traveller is not emailed automatically.",
      inputSchema: z.object({ bookingId: z.number().int() }),
      annotations: { ...WRITE, idempotentHint: true },
    },
    bookingStatus("CONFIRMED", "confirmed", "Let the traveller know yourself; Wepilo doesn't email them for this."),
  );

  server.registerTool(
    "complete_booking",
    {
      title: "Mark a booking completed",
      description: "Marks a booking as completed after the trip has taken place.",
      inputSchema: z.object({ bookingId: z.number().int() }),
      annotations: { ...WRITE, idempotentHint: true },
    },
    bookingStatus("COMPLETED", "marked completed", ""),
  );

  server.registerTool(
    "cancel_booking",
    {
      title: "Cancel a booking",
      description:
        "Cancels a booking and puts its seats back on sale. Always confirm with the user before calling this. The traveller is not notified automatically.",
      inputSchema: z.object({ bookingId: z.number().int() }),
      annotations: { ...WRITE, idempotentHint: true },
    },
    bookingStatus("CANCELLED", "cancelled and its seats are back on sale", "Contact the traveller yourself to explain."),
  );

  // ── Departures ──────────────────────────────────────────────────────────────

  server.registerTool(
    "list_departures",
    {
      title: "List departures",
      description: "Lists departure dates in date order with seats booked, seats left, price and status. Optionally for one trip.",
      inputSchema: z.object({
        tripId: z.number().int().optional().describe("Only departures of this trip."),
        status: z.enum(["OPEN", "FULL", "DELAYED"]).optional(),
        ...pageArgs,
      }),
      annotations: READ,
    },
    run(async ({ tripId, status, page, limit }) => {
      const res = await api<Paged<Departure>>("/departures", { query: { activityId: tripId, status, page, limit } });
      const lines = [pageLine(res.pagination, "departures")];
      for (const d of res.data) {
        lines.push(
          `- #${d.id} · ${d.activity.title ?? "Untitled trip"} (trip #${d.activity.id}) · ${day(d.startDate)}${d.endDate ? ` to ${day(d.endDate)}` : ""} · ${d.capacity - d.availableSpots} of ${d.capacity} booked, ${d.availableSpots} left · ${money(d.price)} per person · ${d.status}`,
        );
      }
      lines.push("", `Open in Wepilo: ${dash("/departures")}`);
      return lines.join("\n");
    }),
  );

  const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

  server.registerTool(
    "create_departure",
    {
      title: "Add a departure date",
      description: "Adds a departure date to a trip, with the number of seats and the price per person in USD. Travellers can book it on the website straight away.",
      inputSchema: z.object({
        tripId: z.number().int(),
        startDate: dateString.describe("First day, YYYY-MM-DD."),
        endDate: dateString.optional().describe("Last day, YYYY-MM-DD."),
        seats: z.number().int().min(1),
        pricePerPerson: z.number().nonnegative().describe("Price for one traveller in USD."),
      }),
      annotations: WRITE,
    },
    run(async ({ tripId, startDate, endDate, seats, pricePerPerson }) => {
      const res = await api<{ departure: Departure }>("/departures", {
        method: "POST",
        body: { activityId: tripId, startDate, endDate: endDate ?? null, capacity: seats, price: pricePerPerson },
      });
      return `Added departure #${res.departure.id} on ${day(startDate)}${endDate ? ` to ${day(endDate)}` : ""} with ${seats} seats at ${money(pricePerPerson)} per person. It is open for booking now.\nReview in Wepilo: ${dash("/departures")}`;
    }),
  );

  server.registerTool(
    "update_departure",
    {
      title: "Edit a departure",
      description: "Changes a departure's dates, seats, price or status. Only the fields you pass are changed.",
      inputSchema: z.object({
        departureId: z.number().int(),
        startDate: dateString.optional(),
        endDate: dateString.optional(),
        seats: z.number().int().min(0).optional(),
        pricePerPerson: z.number().nonnegative().optional(),
        status: z.enum(["OPEN", "FULL", "DELAYED"]).optional(),
      }),
      annotations: { ...WRITE, idempotentHint: true },
    },
    run(async ({ departureId, startDate, endDate, seats, pricePerPerson, status }) => {
      const body: Record<string, unknown> = {};
      if (startDate) body.startDate = startDate;
      if (endDate) body.endDate = endDate;
      if (seats !== undefined) body.capacity = seats;
      if (pricePerPerson !== undefined) body.price = pricePerPerson;
      if (status) body.status = status;
      if (!Object.keys(body).length) return "Nothing to change: pass at least one field.";
      const res = await api<{ departure: Departure }>(`/departures/${departureId}`, { method: "PATCH", body });
      const d = res.departure;
      return `Departure #${d.id} updated: ${day(d.startDate)}${d.endDate ? ` to ${day(d.endDate)}` : ""}, ${d.capacity} seats, ${money(d.price)} per person, ${d.status}.\nReview in Wepilo: ${dash("/departures")}`;
    }),
  );

  // ── Trips and content ───────────────────────────────────────────────────────

  server.registerTool(
    "list_trips",
    {
      title: "List trips",
      description: "Lists the agency's trips with status, price, duration and category. Search by name.",
      inputSchema: z.object({
        search: z.string().optional(),
        status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
        ...pageArgs,
      }),
      annotations: READ,
    },
    run(async ({ search, status, page, limit }) => {
      const res = await api<Paged<Trip>>("/activities", { query: { search, status, page, limit } });
      const lines = [pageLine(res.pagination, "trips")];
      for (const t of res.data) {
        lines.push(
          `- #${t.id} · ${t.title ?? "Untitled"} · ${t.status === "PUBLISHED" ? "published" : "draft"} · from ${money(t.price)}${t.duration ? ` · ${t.duration}` : ""}${t.tripCategory?.name ? ` · ${t.tripCategory.name}` : ""}${t.city?.name ? ` · ${t.city.name}` : ""} · ${t.views} views`,
        );
      }
      lines.push("", `Open in Wepilo: ${dash("/trips")}`);
      return lines.join("\n");
    }),
  );

  server.registerTool(
    "get_trip",
    {
      title: "Get a trip",
      description: "Returns one trip's full details: overview, highlights, itinerary, inclusions, exclusions, price and practical details.",
      inputSchema: z.object({ tripId: z.number().int() }),
      annotations: READ,
    },
    run(async ({ tripId }) => {
      const res = await api<{ activity: Record<string, unknown> }>(`/activities/${tripId}`);
      const a = res.activity;
      const strip = (html: unknown) => (typeof html === "string" ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "");
      const lines = [
        `#${a.id} ${a.title ?? "Untitled"} (${a.status === "PUBLISHED" ? "published" : "draft"}, ${a.layout === "PAGE" ? "simple page" : "day-by-day itinerary"})`,
        `Price: from ${money(a.price as number | null)}${a.maxPrice ? ` to ${money(a.maxPrice as number)}` : ""} · Duration: ${a.duration ?? "not set"} · Difficulty: ${a.difficultyLevel ?? "not set"} · Group size: ${a.guestCapacity ?? "not set"}`,
      ];
      const sections: Array<[string, unknown]> = [
        ["Overview", a.overview],
        ["Page content", a.content],
        ["Highlights", a.highlights],
        ["Included", a.inclusions],
        ["Not included", a.exclusions],
      ];
      for (const [label, value] of sections) {
        const t = strip(value);
        if (t) lines.push("", `${label}: ${clip(t, 1500)}`);
      }
      const variants = (a.itinerary as Array<{ name?: string; days?: Array<{ title?: string }> }> | undefined) ?? [];
      for (const v of variants) {
        if (!v.days?.length) continue;
        lines.push("", `Itinerary${v.name ? ` (${v.name})` : ""}:`);
        v.days.forEach((d, i) => lines.push(`  Day ${i + 1}: ${d.title || "untitled"}`));
      }
      lines.push("", `Edit in Wepilo: ${dash(`/trips/${a.id}`)}`);
      return lines.join("\n");
    }),
  );

  server.registerTool(
    "create_trip_draft",
    {
      title: "Draft a new trip",
      description:
        "Creates a new trip as a hidden draft (never published). Use simple HTML (<p>, <ul><li>) for the text fields. The user reviews and publishes it in the Wepilo dashboard.",
      inputSchema: z.object({
        title: z.string().min(3),
        format: z.enum(["ITINERARY", "PAGE"]).optional().describe("ITINERARY for multi-day trips with a day-by-day plan, PAGE for day tours and short trips."),
        overview: z.string().optional().describe("Three to five sentences on what travellers experience."),
        highlights: z.string().optional(),
        inclusions: z.string().optional().describe("What the price includes."),
        exclusions: z.string().optional().describe("What travellers pay for separately."),
        duration: z.string().optional().describe('For example "12 days" or "Full day".'),
        price: z.number().nonnegative().optional().describe("Starting price per person in USD."),
        days: z
          .array(z.object({ title: z.string(), description: z.string().optional() }))
          .optional()
          .describe("Day-by-day plan for ITINERARY trips, in order."),
      }),
      annotations: WRITE,
    },
    run(async ({ title, format, overview, highlights, inclusions, exclusions, duration, price, days }) => {
      const layout = format ?? (days?.length ? "ITINERARY" : "PAGE");
      const itinerary = days?.length
        ? [
            {
              id: crypto.randomUUID(),
              name: "Standard itinerary",
              description: "",
              isDefault: true,
              days: days.map((d, i) => ({
                id: crypto.randomUUID(),
                day: i + 1,
                title: d.title,
                description: d.description ?? "",
                duration: "",
                distance: "",
                ascent: "",
                descent: "",
                meals: "",
                accommodations: "",
                dayFeaturedImages: [],
              })),
            },
          ]
        : undefined;
      const res = await api<{ activity: { id: number; title: string } }>("/activities", {
        method: "POST",
        body: {
          title,
          layout,
          status: "DRAFT",
          overview: overview ?? null,
          content: layout === "PAGE" ? (overview ?? null) : null,
          highlights: highlights ?? null,
          inclusions: inclusions ?? null,
          exclusions: exclusions ?? null,
          duration: duration ?? null,
          price: price ?? null,
          itinerary,
        },
      });
      return `Created the draft trip "${res.activity.title}" (#${res.activity.id}). It is hidden from the website until someone publishes it in Wepilo. Add photos and departure dates there too.\nReview in Wepilo: ${dash(`/trips/${res.activity.id}`)}`;
    }),
  );

  server.registerTool(
    "create_post_draft",
    {
      title: "Draft a blog post",
      description: "Creates a blog post or travel guide as a hidden draft (never published). Use simple HTML for the content.",
      inputSchema: z.object({
        title: z.string().min(3),
        content: z.string().describe("The article body as simple HTML (<h2>, <p>, <ul><li>)."),
        type: z.enum(["BLOG", "TRAVEL_GUIDE"]).optional(),
        metaDescription: z.string().max(170).optional().describe("One or two sentences for Google results."),
        tags: z.array(z.string()).optional(),
      }),
      annotations: WRITE,
    },
    run(async ({ title, content, type, metaDescription, tags }) => {
      const res = await api<{ post: { id: number; title: string } }>("/blogs", {
        method: "POST",
        body: { title, content, postType: type ?? "BLOG", metaDescription: metaDescription ?? null, tags: tags ?? [], published: false },
      });
      return `Created the draft post "${res.post.title}" (#${res.post.id}). It is hidden from the website until someone publishes it in Wepilo.\nReview in Wepilo: ${dash(`/posts/${res.post.id}`)}`;
    }),
  );

  // ── Reference lists ─────────────────────────────────────────────────────────

  server.registerTool(
    "list_catalog",
    {
      title: "List catalog options",
      description: "Lists the agency's extras (add-ons), trip categories, countries, regions or cities, with their ids.",
      inputSchema: z.object({ kind: z.enum(["extras", "trip-categories", "countries", "regions", "cities"]) }),
      annotations: READ,
    },
    run(async ({ kind }) => {
      const res = await api<{ data: Named[] }>(`/${kind}`);
      if (!res.data.length) return `No ${kind.replace("-", " ")} yet.`;
      return res.data
        .map((r) => `- #${r.id} ${r.name ?? r.handle ?? ""}${r.type ? ` (${r.type.toLowerCase()})` : ""}${r.price !== undefined ? ` · ${r.price == null ? "free" : money(r.price)}` : ""}`)
        .join("\n");
    }),
  );
}
