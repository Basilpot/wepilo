/**
 * Feature pages. Every claim here is checked against the dashboard, the API guide (docs/API.md)
 * and the MCP tools. Copy follows .claude/skills/copywriter.
 */
import type { GlyphName } from "../components/sketch/util";

export type Tint = "sand" | "sky" | "lilac" | "sage" | "peach" | "butter";

export type SketchName = "editor" | "departures" | "assistant" | "languages" | "workflow" | "seo" | "inbox" | "website" | "api" | "calendar";

export type Feature = {
  slug: string;
  name: string;
  sketch: SketchName;
  /** The feature's own icon, for lists. */
  icon: GlyphName;
  /** The feature's colour, used behind its drawing. */
  tint: Tint;
  /** One-line summary for cards and menus. */
  summary: string;
  /** The serif line above the drawing: [plain, italic]. */
  line: [string, string];
  lead: string;
  points: Array<{ icon: GlyphName; title: string; body: string }>;
  /** The spec sheet: what's in it and where it lives in the dashboard. */
  details: Array<{ icon: GlyphName; title: string; note: string; where: string }>;
};

export const features: Feature[] = [
  {
    slug: "trip-pages",
    name: "Trip pages",
    sketch: "editor",
    icon: "route",
    tint: "sand",
    summary: "Itinerary, photos, prices and FAQs in one editor.",
    line: ["Build a trip page once,", "then keep it right."],
    lead: "Itinerary, photos, map, inclusions, prices and FAQs live in one editor, so a trip page is complete before it goes live and quick to fix after.",
    points: [
      { icon: "route", title: "Day by day", body: "Write each day with its route and altitude, then drag the days into a new order when the route changes." },
      { icon: "photo", title: "Photos that load fast", body: "Upload a set and pick the cover. Wepilo resizes each image for the web." },
      { icon: "list", title: "Nothing left out", body: "The editor marks which sections are done, so a trip doesn't go live without prices or an FAQ." },
    ],
    details: [
      { icon: "route", title: "Day-by-day itinerary", note: "Each day's route, overnight stop and altitude, drawn as an altitude chart.", where: "trips \u203a itinerary" },
      { icon: "photo", title: "Photos, map and cover", note: "Upload a set, choose the cover and add the route map.", where: "trips \u203a photos and map" },
      { icon: "list", title: "What's included", note: "Inclusions and exclusions, so travellers know what the price covers.", where: "trips \u203a what's included" },
      { icon: "bed", title: "Meals, transport and stays", note: "The practical details travellers ask about before they book.", where: "trips \u203a practical details" },
      { icon: "price", title: "Prices and discounts", note: "A from price, an upper price and group discounts.", where: "trips \u203a price and extras" },
      { icon: "question", title: "FAQs and packing list", note: "Answer the usual questions once, on the page itself.", where: "trips \u203a before booking" },
      { icon: "gauge", title: "Difficulty and season", note: "Difficulty, group size, top altitude and the best months to go.", where: "trips \u203a the trip" },
      { icon: "tag", title: "Categories and tags", note: "Group trips by type and place, and feature the ones you want to sell.", where: "catalog" },
    ],
  },
  {
    slug: "departures",
    name: "Departures",
    sketch: "departures",
    icon: "calendar",
    tint: "sky",
    summary: "Dates, seats and prices on every trip page.",
    line: ["Show real dates", "and real seats."],
    lead: "Add departure dates with seats and prices. Travellers see what's open on the trip page and can ask about a date, and the question arrives in your email.",
    points: [
      { icon: "calendar", title: "One list per trip", body: "Each departure sits in one table with its date, seats and price." },
      { icon: "request", title: "Ask about a date", body: "A traveller picks a date and says how many are coming. You reply and book them the way you already do." },
      { icon: "seats", title: "Full dates stand out", body: "Set the seats left as you sell them. At zero the date shows as full." },
    ],
    details: [
      { icon: "calendar", title: "Departure dates", note: "Each date you run a trip, in one list per trip.", where: "trips \u203a departures" },
      { icon: "seats", title: "Seats left", note: "Total seats and seats left for each date, marked open or full.", where: "trips \u203a departures" },
      { icon: "request", title: "Date enquiries", note: "A question about a date arrives by email, with the group size.", where: "settings › email" },
      { icon: "calendar", title: "On the calendar", note: "Every departure shows next to your scheduled pages.", where: "calendar" },
      { icon: "extras", title: "Extras", note: "Add-ons such as a porter or a single room, priced per person.", where: "trips \u203a extras" },
      { icon: "currency", title: "The visitor's currency", note: "Prices converted with daily rates, if you switch it on.", where: "settings \u203a currency" },
    ],
  },
  {
    slug: "calendar",
    name: "Calendar and scheduling",
    sketch: "calendar",
    icon: "clock",
    tint: "butter",
    summary: "Schedule trips, posts and pages for the day they go live.",
    line: ["Plan the season", "on one calendar."],
    lead: "Write next season's trips now and pick the morning they go live. The calendar shows what's scheduled, what went live and every departure, so nothing goes out by surprise.",
    points: [
      { icon: "clock", title: "Go live on time", body: "Set a day and time on any draft. Wepilo publishes it then, even at night." },
      { icon: "calendar", title: "One month view", body: "Scheduled trips, posts and pages sit next to your departures." },
      { icon: "draft", title: "Drag to move", body: "Drag a scheduled item to another day. It keeps its time." },
    ],
    details: [
      { icon: "clock", title: "Scheduled publishing", note: "Any trip, post or page draft, to the minute.", where: "every editor \u203a schedule" },
      { icon: "calendar", title: "Content calendar", note: "Month grid on desktop, a list on your phone.", where: "calendar" },
      { icon: "seats", title: "Departures alongside", note: "Open, full and delayed dates on the same view.", where: "calendar" },
      { icon: "users", title: "Who can schedule", note: "Anyone who can publish. Authors leave drafts undated.", where: "settings \u203a staff logins" },
    ],
  },
  {
    slug: "ai-assistant",
    name: "AI assistant",
    sketch: "assistant",
    icon: "draft",
    tint: "lilac",
    summary: "Ask Claude for a change and review the draft.",
    line: ["Ask for a change,", "get a draft back."],
    lead: "Connect Claude to Wepilo once. Ask for next season's dates, a new FAQ or a Spanish version. Claude saves a draft, and publishes or schedules it only when you ask and your role allows it.",
    points: [
      { icon: "question", title: "Plain words", body: "Ask the way you'd brief a colleague. Claude reads your existing trips before it writes." },
      { icon: "draft", title: "Your login, your rights", body: "Claude works as you. An author's Claude can only write drafts; an editor's can publish when asked." },
      { icon: "users", title: "Your own Claude account", body: "The free plan works. Claude Pro, about $20 a month, gives more room if you write a lot." },
    ],
    details: [
      { icon: "calendar", title: "Season refreshes", note: "New dates and details across a trip in one request.", where: "claude \u203a update_trip" },
      { icon: "draft", title: "New trip pages", note: "A full draft from your notes or a guide's.", where: "claude \u203a create_trip_draft" },
      { icon: "translate", title: "Translations", note: "Trips and posts in each of your languages.", where: "claude \u203a update_trip" },
      { icon: "clock", title: "Scheduling", note: "Set a draft to go live on the day you name.", where: "claude \u203a update_trip" },
      { icon: "page", title: "Journal posts", note: "A post from a few lines of notes, ready for review.", where: "claude \u203a create_post_draft" },
      { icon: "search", title: "Titles and descriptions", note: "Rewritten to fit what Google shows in results.", where: "claude \u203a update_trip" },
      { icon: "link", title: "MCP connector", note: "An open standard, so other assistants can follow.", where: "settings \u203a connect" },
    ],
  },
  {
    slug: "languages",
    name: "Languages",
    sketch: "languages",
    icon: "translate",
    tint: "sage",
    summary: "Each trip in the languages your travellers read.",
    line: ["Sell to travellers", "in their own language."],
    lead: "Add the languages your markets read, then switch language in any editor and type the translation. Each language gets its own address, like /de/trips.",
    points: [
      { icon: "calendar", title: "Change it once", body: "Prices and departures are shared between languages, so a new date shows up in all of them." },
      { icon: "translate", title: "Write it yourself, or ask", body: "Type a translation in the editor, or ask Claude for one and check it before it goes live." },
      { icon: "search", title: "Found on Google", body: "Each language has its own address, and your site tells search engines which version is for whom." },
    ],
    details: [
      { icon: "translate", title: "Translated content", note: "Trips, pages, posts, categories, menus and homepage text.", where: "every editor" },
      { icon: "calendar", title: "Shared dates and prices", note: "Change a departure once and each language shows it.", where: "trips \u203a departures" },
      { icon: "link", title: "An address per language", note: "Your site at /, German at /de/, French at /fr/.", where: "settings \u203a languages" },
      { icon: "globe", title: "hreflang tags and a switcher", note: "Visitors and search engines find the right version.", where: "your site" },
      { icon: "currency", title: "Local currency", note: "Prices in the visitor's currency, with daily rates.", where: "settings \u203a currency" },
    ],
  },
  {
    slug: "roles-and-approvals",
    name: "Roles and publishing",
    sketch: "workflow",
    icon: "users",
    tint: "peach",
    summary: "A login for everyone, and a say in who publishes.",
    line: ["Decide who can", "put things live."],
    lead: "Give everyone who works on the site their own login and a role. Authors write drafts. Editors, managers and admins publish or schedule them. The owner looks after billing.",
    points: [
      { icon: "users", title: "A role for each person", body: "Owner, admin, manager, editor and author, each seeing what they need." },
      { icon: "approve", title: "Drafts wait for a publisher", body: "An author's work, and anything Claude writes for them, stays a draft until an editor puts it live." },
      { icon: "clock", title: "Publish on a date", body: "Approve next season's trips now and set them to go live on the morning you choose." },
    ],
    details: [
      { icon: "users", title: "Five roles", note: "Owner, admin, manager, editor and author.", where: "settings \u203a staff logins" },
      { icon: "approve", title: "Who can publish", note: "Everyone but authors. Authors save drafts.", where: "every editor" },
      { icon: "clock", title: "Scheduled publishing", note: "Pick the morning a new season goes live.", where: "calendar" },
      { icon: "power", title: "Switch off a login", note: "One click when someone leaves the agency.", where: "settings \u203a staff logins" },
    ],
  },
  {
    slug: "seo",
    name: "SEO",
    sketch: "seo",
    icon: "search",
    tint: "butter",
    summary: "Titles checked as you write, schema built for you.",
    line: ["Get found for", "the trips you sell."],
    lead: "Wepilo checks titles and descriptions as you write and builds the technical parts search engines read, so your trip pages can rank without a specialist.",
    points: [
      { icon: "search", title: "Checks as you write", body: "A counter shows when a title or description is too long for Google to show in full." },
      { icon: "share", title: "Share previews", body: "Pick the photo and text people see when a trip is shared on WhatsApp or Facebook." },
      { icon: "sitemap", title: "Built for you", body: "The sitemap and travel schema update each time you publish." },
    ],
    details: [
      { icon: "search", title: "Title and description", note: "With a counter, so Google shows them in full.", where: "trips \u203a seo" },
      { icon: "share", title: "Share image", note: "The photo shown when a trip is shared on WhatsApp or Facebook.", where: "trips \u203a seo" },
      { icon: "sitemap", title: "Sitemap", note: "Updated each time you publish.", where: "your site" },
      { icon: "schema", title: "Travel schema", note: "TouristTrip JSON-LD on each trip page.", where: "trips \u203a seo" },
      { icon: "link", title: "Canonical URLs", note: "One preferred address per page, so copies don't compete.", where: "trips \u203a seo" },
      { icon: "alt", title: "Alt text reminders", note: "The media library flags photos without a description.", where: "media" },
    ],
  },
  {
    slug: "enquiries",
    name: "Enquiries by email",
    sketch: "inbox",
    icon: "mail",
    tint: "sky",
    summary: "Enquiries sent to your own email.",
    line: ["Enquiries go to", "the email you already use."],
    lead: "Messages from your site, including questions about a date, go straight to the addresses you choose. Hit reply to answer the traveller. There's no new inbox to learn.",
    points: [
      { icon: "mail", title: "No new inbox", body: "Each enquiry arrives in the email you use today, with the trip it's about. There's nothing extra to log in to." },
      { icon: "users", title: "The right people get it", body: "Send alerts to the owner, the sales desk or anyone who answers travellers, up to ten addresses." },
      { icon: "form", title: "A newsletter list", body: "Visitors sign up on your site, and Wepilo keeps the list, with unsubscribe links handled." },
    ],
    details: [
      { icon: "form", title: "Enquiry forms", note: "Contact and trip forms email each message to you, with the trip it's about.", where: "your site" },
      { icon: "request", title: "Questions about a date", note: "Sent with the trip, the date and the group size.", where: "your site" },
      { icon: "users", title: "Who gets them", note: "Up to ten addresses. Leave it empty and the owner gets them.", where: "settings › email" },
      { icon: "mail", title: "Newsletter list", note: "Sign-ups from your site, with unsubscribe links handled.", where: "newsletter" },
      { icon: "star", title: "Reviews", note: "Traveller reviews shown on the trip they're about.", where: "reviews" },
    ],
  },
  {
    slug: "website",
    name: "Website and hosting",
    sketch: "website",
    icon: "layout",
    tint: "sage",
    summary: "The site you want, built on your content.",
    line: ["Build the site", "the way you want it."],
    lead: "Design your site your way: Claude and the website API build it with you on top of your Wepilo content. Rather not build it? Send us an enquiry and we'll do it for you.",
    points: [
      { icon: "code", title: "Built with AI help", body: "Claude reads the API guide and writes your site with you, page by page." },
      { icon: "layout", title: "Or we build it", body: "Tell us what you want and we'll build it on the same content." },
      { icon: "lock", title: "Your domain", body: "Connect your own address. We set up SSL for you." },
      { icon: "chart", title: "Hosting we run", body: "You won't need to look after servers, plugins or security updates." },
    ],
    details: [
      { icon: "code", title: "AI-assisted building", note: "Claude builds pages on the website API with you.", where: "settings \u203a connect" },
      { icon: "list", title: "Sections and menus", note: "Switch homepage sections on, reorder them and edit the menus.", where: "website \u203a homepage and menus" },
      { icon: "page", title: "Pages and journal", note: "About, contact, terms and your posts.", where: "content" },
      { icon: "lock", title: "Your domain, with SSL", note: "Your own address, secured for you.", where: "settings \u203a domain" },
      { icon: "code", title: "Website API", note: "Build your own frontend on the same content.", where: "docs \u203a api" },
    ],
  },
];

export const featureBySlug = (slug: string) => features.find((f) => f.slug === slug);
