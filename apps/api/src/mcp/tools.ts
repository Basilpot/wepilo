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

const dayInput = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  duration: z.string().optional(),
  distance: z.string().optional(),
  ascent: z.string().optional(),
  descent: z.string().optional(),
  meals: z.string().optional(),
  accommodations: z.string().optional(),
});

/** Every writable field on a trip, all optional so the update tool can patch a single field at a time. */
const tripFields = z.object({
  format: z.enum(["ITINERARY", "PAGE"]).optional(),
  days: z.array(dayInput).optional(),
  layout: z.enum(["ITINERARY", "PAGE"]).optional(),
  overview: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  highlights: z.string().nullable().optional(),
  inclusions: z.string().nullable().optional(),
  exclusions: z.string().nullable().optional(),
  itinerary: z.array(z.object({}).passthrough()).optional(),
  additionalInfo: z.array(z.object({ title: z.string().optional(), description: z.string().nullable().optional() })).optional(),
  faq: z.array(z.object({ title: z.string().optional(), items: z.array(z.object({ q: z.string(), a: z.string() })).optional() })).optional(),
  price: z.number().nonnegative().nullable().optional(),
  maxPrice: z.number().nonnegative().nullable().optional(),
  groupDiscount: z.array(z.object({ groupSize: z.number().int().positive(), discount: z.number().nonnegative(), discountType: z.enum(["PERCENTAGE", "FLAT"]) })).optional(),
  showGroupDiscount: z.boolean().optional(),
  duration: z.string().nullable().optional(),
  groupSize: z.number().int().nullable().optional(),
  guestCapacity: z.number().int().nullable().optional(),
  maximumAltitude: z.number().int().nullable().optional(),
  altitudeChart: z.array(z.object({ location: z.string(), altitude: z.number() })).nullable().optional(),
  transportation: z.string().nullable().optional(),
  meals: z.string().nullable().optional(),
  bestSeason: z.string().nullable().optional(),
  meetingPoint: z.string().nullable().optional(),
  dropOffPoint: z.string().nullable().optional(),
  videoUrl: z.string().nullable().optional(),
  routeMap: z.string().nullable().optional(),
  mapDescription: z.string().nullable().optional(),
  images: z.array(z.string()).optional(),
  accommodations: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  difficultyLevel: z.enum(["EASY", "MODERATE", "HARD", "EXTREME"]).nullable().optional(),
  isFeatured: z.boolean().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

const tripCreateInput = z.object({ title: z.string().min(3), ...tripFields.shape });
const tripUpdateInput = z.object({ id: z.number().int(), title: z.string().min(3).optional(), ...tripFields.shape });

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
        "Creates a new trip as a hidden draft (never published). Use simple HTML (<p>, <ul><li>) for the text fields. Pass days for an ITINERARY trip. Every other field is optional and maps to the full Wepilo trip record.",
      inputSchema: tripCreateInput,
      annotations: WRITE,
    },
    run(async ({ title, format, layout, status, overview, content, highlights, inclusions, exclusions, itinerary, additionalInfo, faq, price, maxPrice, groupDiscount, showGroupDiscount, duration, groupSize, guestCapacity, maximumAltitude, altitudeChart, transportation, meals, bestSeason, meetingPoint, dropOffPoint, videoUrl, routeMap, mapDescription, images, accommodations, languages, difficultyLevel, isFeatured, days }) => {
      const resolvedLayout = layout ?? (days?.length ? "ITINERARY" : "PAGE");
      const itineraryOut = days?.length
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
                duration: d.duration ?? "",
                distance: d.distance ?? "",
                ascent: d.ascent ?? "",
                descent: d.descent ?? "",
                meals: d.meals ?? "",
                accommodations: d.accommodations ?? "",
                dayFeaturedImages: [],
              })),
            },
          ]
        : undefined;
      const created = await api<{ activity: { id: number; title: string } }>("/activities", {
        method: "POST",
        body: {
          title,
          layout: resolvedLayout,
          status: status ?? "DRAFT",
          overview: overview ?? null,
          content: content ?? (resolvedLayout === "PAGE" ? (overview ?? null) : null),
          highlights: highlights ?? null,
          inclusions: inclusions ?? null,
          exclusions: exclusions ?? null,
          itinerary: itineraryOut ?? itinerary,
          additionalInfo: additionalInfo ?? null,
          faq: faq ?? null,
          price: price ?? null,
          maxPrice: maxPrice ?? null,
          groupDiscount: groupDiscount ?? null,
          showGroupDiscount: showGroupDiscount ?? true,
          duration: duration ?? null,
          groupSize: groupSize ?? null,
          guestCapacity: guestCapacity ?? null,
          maximumAltitude: maximumAltitude ?? null,
          altitudeChart: altitudeChart ?? null,
          transportation: transportation ?? null,
          meals: meals ?? null,
          bestSeason: bestSeason ?? null,
          meetingPoint: meetingPoint ?? null,
          dropOffPoint: dropOffPoint ?? null,
          videoUrl: videoUrl ?? null,
          routeMap: routeMap ?? null,
          mapDescription: mapDescription ?? null,
          images: images ?? [],
          accommodations: accommodations ?? [],
          languages: languages ?? [],
          difficultyLevel: difficultyLevel ?? null,
          isFeatured: isFeatured ?? false,
        },
      });
      return `Created the draft trip "${created.activity.title}" (#${created.activity.id}). It is hidden from the website until someone publishes it in Wepilo. Add photos and departure dates there too.\nReview in Wepilo: ${dash(`/trips/${created.activity.id}`)}`;
    }),
  );

  server.registerTool(
    "update_trip",
    {
      title: "Update a trip",
      description:
        "Updates a trip in this Wepilo workspace. Only the fields you pass are changed; pass a full itinerary array (with days, each having title, description and per-day duration, meals and accommodation) to replace the day-by-day plan of the default itinerary, in order.",
      inputSchema: tripUpdateInput,
      annotations: WRITE,
    },
    run(async ({ id, ...fields }) => {
      const res = await api<{ activity: Record<string, unknown> }>(`/activities/${id}`);
      const a = res.activity;
      const itinerary = Array.isArray(a.itinerary) ? [...(a.itinerary as Record<string, any>[])] : [];
      const patch: Record<string, unknown> = {};
      const set = (key: string, value: unknown) => {
        if (value !== undefined) patch[key] = value;
      };

      set("title", fields.title);
      set("layout", fields.layout);
      set("overview", fields.overview);
      set("content", fields.content);
      set("highlights", fields.highlights);
      set("inclusions", fields.inclusions);
      set("exclusions", fields.exclusions);
      set("additionalInfo", fields.additionalInfo);
      set("faq", fields.faq);
      set("price", fields.price);
      set("maxPrice", fields.maxPrice);
      set("groupDiscount", fields.groupDiscount);
      set("showGroupDiscount", fields.showGroupDiscount);
      set("duration", fields.duration);
      set("groupSize", fields.groupSize);
      set("guestCapacity", fields.guestCapacity);
      set("maximumAltitude", fields.maximumAltitude);
      set("altitudeChart", fields.altitudeChart);
      set("transportation", fields.transportation);
      set("meals", fields.meals);
      set("bestSeason", fields.bestSeason);
      set("meetingPoint", fields.meetingPoint);
      set("dropOffPoint", fields.dropOffPoint);
      set("videoUrl", fields.videoUrl);
      set("routeMap", fields.routeMap);
      set("mapDescription", fields.mapDescription);
      set("images", fields.images);
      set("accommodations", fields.accommodations);
      set("languages", fields.languages);
      set("difficultyLevel", fields.difficultyLevel);
      set("isFeatured", fields.isFeatured);
      set("status", fields.status);

      if (fields.itinerary || fields.days) {
        const source = (fields.itinerary ?? fields.days) as Array<Record<string, any>> | undefined;
        const variants = Array.isArray(a.itinerary) ? [...(a.itinerary as Record<string, any>[])] : [];
        const defIdx = variants.findIndex((v) => v.isDefault);
        const at = defIdx === -1 ? 0 : defIdx;
        const prevDays = Array.isArray(variants[at]?.days) ? (variants[at].days as Record<string, any>[]) : [];
        const dayKeys = ["duration", "distance", "ascent", "descent", "meals", "accommodations"] as const;
        const daysOut = (source ?? []).map((d: Record<string, any>, i: number) => {
          const prev = prevDays[i];
          const out: Record<string, any> = {
            id: prev?.id ?? crypto.randomUUID(),
            day: i + 1,
            title: String(d.title ?? ""),
            description: d.description ?? prev?.description ?? "",
          };
          for (const key of dayKeys) out[key] = d[key] ?? prev?.[key] ?? "";
          return out;
        });
        variants[at] = { ...variants[at], days: daysOut };
        patch.itinerary = variants;
      }

      const updated = await api(`/activities/${id}`, { method: "PATCH", body: patch });
      const t = (updated as { activity: { title?: string | null; status?: string } }).activity;
      return `Updated trip #${id}${t.title ? ` "${t.title}"` : ""} (now ${t.status ?? "draft"}).\nReview in Wepilo: ${dash(`/trips/${id}`)}`;
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

  server.registerTool(
    "create_extra",
    {
      title: "Add a trip extra",
      description:
        "Adds an extra to this Wepilo workspace: an add-on, an accommodation or a meal, or anything else travellers can book. Use it while drafting trips so the plan can be sold with the trip.",
      inputSchema: z.object({
        type: z.enum(["ADDON", "ACCOMMODATION", "MEAL", "OTHER"]).optional().describe("ADDON for extras, or one of ACCOMMODATION, MEAL, OTHER."),
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        price: z.number().nonnegative().nullable().optional(),
        images: z.array(z.string()).optional(),
      }),
      annotations: WRITE,
    },
    run(async ({ type, name, description, price, images }) => {
      const res = await api<{ extra: { id: number; name: string; type: string } }>("/extras", {
        method: "POST",
        body: { type: type ?? "ADDON", name, description: description ?? null, price: price ?? null, images: images ?? [] },
      });
      return `Created the extra "${res.extra.name}" (#${res.extra.id}, ${res.extra.type}) on this Wepilo workspace.\nAdd it to a trip through the trip's extraIds field, or in Wepilo: ${dash(`/extras`)}`;
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
