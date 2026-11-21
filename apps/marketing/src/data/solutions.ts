import type { SketchName, Tint } from "./features";

/** Solution pages: who Wepilo is for, in their words. Copy follows .claude/skills/copywriter. */
export type Solution = {
  slug: string;
  name: string;
  sketch: SketchName;
  tint: Tint;
  summary: string;
  line: [string, string];
  lead: string;
  /** Each problem, and the feature that fixes it. */
  pains: Array<{ text: string; fix: string }>;
  helps: Array<{ feature: string; title: string; body: string }>;
};

export const solutions: Solution[] = [
  {
    slug: "tour-operators",
    name: "Tour operators",
    sketch: "departures",
    tint: "sky",
    summary: "Many departures a year, always shown right.",
    line: ["For tour operators", "with a full calendar."],
    lead: "You run the same tours many times a year. Wepilo keeps dates, seats and prices right across the site, so travellers ask about departures that are open.",
    pains: [
      { text: "Departure dates live in a spreadsheet, and the website still shows last year's.", fix: "departures" },
      { text: "A traveller asks about a date that filled up weeks ago, because the site says it's open.", fix: "departures" },
      { text: "New season prices wait until a developer has an afternoon free.", fix: "trip-pages" },
    ],
    helps: [
      { feature: "departures", title: "Departures with seats", body: "Add each date once with its seats and price. The trip page shows what's open." },
      { feature: "calendar", title: "Season updates, scheduled", body: "Line up next season's tours and set them to go live on the morning you choose." },
      { feature: "enquiries", title: "Date questions by email", body: "Questions about a date arrive in the email you already use, with the group size." },
    ],
  },
  {
    slug: "trekking-and-adventure",
    name: "Trekking and adventure",
    sketch: "editor",
    tint: "sand",
    summary: "Itineraries, altitudes and gear lists that answer questions.",
    line: ["For trekking and", "adventure agencies."],
    lead: "Your trips have days, altitudes, gear lists and difficulty grades. Wepilo has fields for all of them, so the trip page answers questions before they reach your inbox.",
    pains: [
      { text: "Itineraries change with the season, and the website falls behind.", fix: "ai-assistant" },
      { text: "Travellers email to ask about altitude, fitness and what to pack.", fix: "trip-pages" },
      { text: "The best photos are on a guide's phone, not on the trip page.", fix: "trip-pages" },
    ],
    helps: [
      { feature: "trip-pages", title: "Day-by-day itineraries", body: "Route, altitude and overnight stop for each day, reordered with a drag." },
      { feature: "ai-assistant", title: "Guide notes to trip page", body: "Paste a guide's notes and review a draft trip page or journal post." },
      { feature: "seo", title: "Found for the route name", body: "Titles and descriptions checked as you write, with travel schema built for you." },
    ],
  },
  {
    slug: "inbound-and-dmc",
    name: "Inbound agencies and DMCs",
    sketch: "languages",
    tint: "sage",
    summary: "One site in the languages and currencies you sell in.",
    line: ["For inbound agencies", "selling abroad."],
    lead: "Your travellers search in German, Spanish and Japanese. Wepilo publishes each trip in their language and shows prices in their currency, from one site.",
    pains: [
      { text: "Your site is in English, and most of your travellers don't read it first.", fix: "languages" },
      { text: "Translating the catalogue for one trade fair costs more than the stand.", fix: "ai-assistant" },
      { text: "Prices in one currency leave travellers doing the maths.", fix: "departures" },
    ],
    helps: [
      { feature: "languages", title: "A page per language", body: "Each trip in the languages you sell in, checked by someone who speaks them." },
      { feature: "ai-assistant", title: "Translations drafted for you", body: "Ask for a Spanish version of your ten best trips and review the drafts." },
      { feature: "departures", title: "Prices in their currency", body: "Show prices converted to the visitor's currency, with rates updated daily." },
    ],
  },
];

export const solutionBySlug = (slug: string) => solutions.find((s) => s.slug === slug);
