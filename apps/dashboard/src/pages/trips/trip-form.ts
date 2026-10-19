export type ItineraryImage = { id: string; image: string; title: string; description: string };

export type ItineraryDay = {
  id: string;
  day: number;
  title: string;
  description: string;
  duration: string;
  distance: string;
  ascent: string;
  descent: string;
  meals: string;
  accommodations: string;
  dayFeaturedImages: ItineraryImage[];
};

export type ItineraryVariant = {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  days: ItineraryDay[];
};

export type AdditionalInfoItem = { id: string; title: string; description: string };
export type FaqItem = { q: string; a: string };
export type FaqGroup = { id: string; title: string; items: FaqItem[] };

export type AltitudePoint = { id: string; location: string; altitude: string };
export type GroupDiscountRule = { id: string; groupSize: string; discount: string; discountType: "PERCENTAGE" | "FLAT" };

export type TripLayout = "ITINERARY" | "PAGE";

export type TripForm = {
  layout: TripLayout;
  title: string;
  slug: string;
  overview: string;
  /** Long-form body, used by PAGE trips. */
  content: string;
  tripCategoryId: string;
  countryId: string;
  cityId: string;
  regionId: string;
  featuredTagIds: number[];
  highlights: string;
  itinerary: ItineraryVariant[];
  images: string[];
  videoUrl: string;
  routeMap: string;
  mapDescription: string;
  inclusions: string;
  exclusions: string;
  duration: string;
  maximumAltitude: string;
  altitudeChart: AltitudePoint[];
  guestCapacity: string;
  difficultyLevel: string;
  meetingPoint: string;
  dropOffPoint: string;
  accommodations: string[];
  meals: string[];
  price: string;
  maxPrice: string;
  groupDiscount: GroupDiscountRule[];
  showGroupDiscount: boolean;
  extraIds: number[];
  languages: string[];
  additionalInfo: AdditionalInfoItem[];
  faq: FaqGroup[];
  seo: {
    metaTitle: string;
    metaDescription: string;
    featuredMedia: string;
    schema: string;
    metaKeywords: string;
    metaRobots: string;
    metaAuthor: string;
    canonicalUrl: string;
  };
  isFeatured: boolean;
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export function newDay(day: number): ItineraryDay {
  return {
    id: uid(),
    day,
    title: "",
    description: "",
    duration: "",
    distance: "",
    ascent: "",
    descent: "",
    meals: "",
    accommodations: "",
    dayFeaturedImages: [],
  };
}

export function newVariant(index: number, isDefault = false): ItineraryVariant {
  return {
    id: uid(),
    name: index === 0 ? "Standard itinerary" : `Variant ${index + 1}`,
    description: "",
    isDefault,
    days: [newDay(1)],
  };
}

export const emptyTripForm: TripForm = {
  layout: "ITINERARY",
  title: "",
  slug: "",
  overview: "",
  content: "",
  tripCategoryId: "",
  countryId: "",
  cityId: "",
  regionId: "",
  featuredTagIds: [],
  highlights: "",
  itinerary: [newVariant(0, true)],
  images: [],
  videoUrl: "",
  routeMap: "",
  mapDescription: "",
  inclusions: "",
  exclusions: "",
  duration: "",
  maximumAltitude: "",
  altitudeChart: [],
  guestCapacity: "",
  difficultyLevel: "",
  meetingPoint: "",
  dropOffPoint: "",
  accommodations: [],
  meals: [],
  price: "",
  maxPrice: "",
  groupDiscount: [],
  showGroupDiscount: true,
  extraIds: [],
  languages: [],
  additionalInfo: [],
  faq: [],
  seo: {
    metaTitle: "",
    metaDescription: "",
    featuredMedia: "",
    schema: "",
    metaKeywords: "",
    metaRobots: "index,follow",
    metaAuthor: "",
    canonicalUrl: "",
  },
  isFeatured: false,
};

export type TripStep = {
  n: number;
  key: string;
  title: string;
  description: string;
  fields: string[];
};

export const TRIP_STEPS: TripStep[] = [
  { n: 1, key: "basics", title: "Basic information", description: "Name and web address of the trip.", fields: ["title", "slug"] },
  { n: 2, key: "overview", title: "Overview", description: "Describe what travelers will experience.", fields: ["overview"] },
  { n: 3, key: "categorization", title: "Categorization", description: "Category, country, destination, region and tags.", fields: ["tripCategoryId", "countryId", "cityId", "regionId", "featuredTagIds"] },
  { n: 4, key: "highlights", title: "Highlights", description: "The key experiences and moments.", fields: ["highlights"] },
  { n: 5, key: "itinerary", title: "Itinerary", description: "Day-by-day plan for the trip.", fields: ["itinerary"] },
  { n: 6, key: "media", title: "Media", description: "Gallery and video intro.", fields: ["images", "videoUrl"] },
  { n: 7, key: "map", title: "Map", description: "Route map and how to read it.", fields: ["routeMap", "mapDescription"] },
  { n: 8, key: "inclusions", title: "Inclusions", description: "What is included in the price.", fields: ["inclusions"] },
  { n: 9, key: "exclusions", title: "Exclusions", description: "What is not included.", fields: ["exclusions"] },
  { n: 10, key: "duration", title: "Duration & altitude", description: "Trip length, highest point and altitude profile.", fields: ["duration", "maximumAltitude", "altitudeChart"] },
  { n: 11, key: "capacity", title: "Capacity & difficulty", description: "Group size and difficulty level.", fields: ["guestCapacity", "difficultyLevel"] },
  { n: 12, key: "points", title: "Meeting & drop-off", description: "Where the trip starts and ends.", fields: ["meetingPoint", "dropOffPoint"] },
  { n: 13, key: "stay", title: "Accommodation & meals", description: "Places to stay and meals provided.", fields: ["accommodations", "meals"] },
  { n: 14, key: "pricing", title: "Pricing", description: "Price per person and group discounts.", fields: ["price", "maxPrice", "groupDiscount", "showGroupDiscount"] },
  { n: 15, key: "extras", title: "Extras & languages", description: "Add-ons and spoken languages.", fields: ["extraIds", "languages"] },
  { n: 16, key: "info", title: "Additional info", description: "Extra notes travelers should know.", fields: ["additionalInfo"] },
  { n: 17, key: "faq", title: "FAQs", description: "Frequently asked questions.", fields: ["faq"] },
  { n: 18, key: "seo", title: "SEO", description: "Search engine and social metadata.", fields: ["seo"] },
];

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function toFormState(activity: Record<string, unknown>): TripForm {
  const num = (v: unknown) => (v == null ? "" : String(v));
  const seo = (activity.tripSeo ?? {}) as Record<string, unknown>;
  const ids = (v: unknown, key: string): number[] =>
    Array.isArray(v) ? (v as Record<string, Record<string, number>>[]).map((r) => r[key]?.id).filter((x): x is number => typeof x === "number") : [];
  return {
    layout: activity.layout === "PAGE" ? "PAGE" : "ITINERARY",
    title: str(activity.title),
    slug: str(activity.slug),
    overview: str(activity.overview),
    content: str(activity.content),
    tripCategoryId: num(activity.tripCategoryId),
    countryId: num(activity.countryId),
    cityId: num(activity.cityId),
    regionId: num(activity.regionId),
    featuredTagIds: ids(activity.featuredTags, "featuredTag"),
    highlights: str(activity.highlights),
    itinerary: normalizeItinerary(activity.itinerary),
    images: strArr(activity.images),
    videoUrl: str(activity.videoUrl),
    routeMap: str(activity.routeMap),
    mapDescription: str(activity.mapDescription),
    inclusions: str(activity.inclusions),
    exclusions: str(activity.exclusions),
    duration: str(activity.duration),
    maximumAltitude: num(activity.maximumAltitude),
    altitudeChart: normalizeAltitude(activity.altitudeChart),
    guestCapacity: num(activity.guestCapacity),
    difficultyLevel: str(activity.difficultyLevel),
    meetingPoint: str(activity.meetingPoint),
    dropOffPoint: str(activity.dropOffPoint),
    accommodations: strArr(activity.accommodations),
    meals: mealsToArray(activity.meals),
    price: num(activity.price),
    maxPrice: num(activity.maxPrice),
    groupDiscount: normalizeGroupDiscount(activity.groupDiscount),
    showGroupDiscount: activity.showGroupDiscount == null ? true : Boolean(activity.showGroupDiscount),
    extraIds: ids(activity.extras, "extra"),
    languages: strArr(activity.languages),
    additionalInfo: normalizeInfo(activity.additionalInfo),
    faq: normalizeFaq(activity.faq),
    seo: {
      metaTitle: str(seo.metaTitle),
      metaDescription: str(seo.metaDescription),
      featuredMedia: str(seo.featuredMedia),
      schema: str(seo.schema),
      metaKeywords: str(seo.metaKeywords),
      metaRobots: str(seo.metaRobots) || "index,follow",
      metaAuthor: str(seo.metaAuthor),
      canonicalUrl: str(seo.canonicalUrl),
    },
    isFeatured: Boolean(activity.isFeatured),
  };
}

const has = (v: string) => v.trim().length > 0;
const hasHtml = (v: string) => v.replace(/<[^>]*>/g, "").trim().length > 0;

export function getStepProgress(form: TripForm): Record<string, number> {
  const p: Record<string, number> = {};
  const title = form.title.trim();
  p.basics = title.length >= 3 ? 1 : title ? 0.5 : 0;
  p.overview = hasHtml(form.overview) ? 1 : has(form.overview) ? 0.5 : 0;
  const cat = [form.tripCategoryId, form.countryId, form.cityId, form.regionId].filter(Boolean).length + (form.featuredTagIds.length ? 1 : 0);
  p.categorization = cat >= 2 ? 1 : cat ? 0.5 : 0;
  p.highlights = hasHtml(form.highlights) ? 1 : has(form.highlights) ? 0.5 : 0;
  const days = form.itinerary.reduce((n, v) => n + v.days.length, 0);
  p.itinerary = days && form.itinerary.some((v) => v.days.some((d) => has(d.title))) ? 1 : days ? 0.5 : 0;
  p.media = form.images.length ? 1 : has(form.videoUrl) ? 0.5 : 0;
  p.map = has(form.routeMap) ? 1 : hasHtml(form.mapDescription) ? 0.5 : 0;
  p.inclusions = hasHtml(form.inclusions) ? 1 : has(form.inclusions) ? 0.5 : 0;
  p.exclusions = hasHtml(form.exclusions) ? 1 : has(form.exclusions) ? 0.5 : 0;
  p.duration = has(form.duration) && has(form.maximumAltitude) ? 1 : has(form.duration) || has(form.maximumAltitude) ? 0.5 : 0;
  p.capacity = has(form.guestCapacity) && has(form.difficultyLevel) ? 1 : has(form.guestCapacity) || has(form.difficultyLevel) ? 0.5 : 0;
  p.points = has(form.meetingPoint) && has(form.dropOffPoint) ? 1 : has(form.meetingPoint) || has(form.dropOffPoint) ? 0.5 : 0;
  p.stay = form.accommodations.length && form.meals.length ? 1 : form.accommodations.length || form.meals.length ? 0.5 : 0;
  p.pricing = has(form.price) ? 1 : 0;
  p.extras = form.extraIds.length && form.languages.length ? 1 : form.extraIds.length || form.languages.length ? 0.5 : 0;
  p.info = form.additionalInfo.some((i) => has(i.title)) ? 1 : 0;
  p.faq = form.faq.some((g) => g.items.some((it) => has(it.q) && has(it.a))) ? 1 : form.faq.some((g) => g.items.some((it) => has(it.q))) ? 0.5 : 0;
  p.seo = has(form.seo.metaTitle) && has(form.seo.metaDescription) ? 1 : has(form.seo.metaTitle) || has(form.seo.metaDescription) ? 0.5 : 0;
  return p;
}

/** Sections of a PAGE trip, in page order. Keys match getStepProgress / step bodies. */
export const PAGE_SECTIONS = [
  { key: "summary", title: "Summary", description: "One or two sentences for trip cards and search results." },
  { key: "content", title: "Page content", description: "Everything travellers need to know, in your own structure." },
  { key: "media", title: "Photos & video", description: "The first photo is the cover." },
  { key: "pricing", title: "Pricing", description: "Price per person and any group discounts." },
  { key: "categorization", title: "Category & location", description: "Helps travellers find this trip on your site." },
  { key: "inclusions", title: "What's included", description: "Optional. Shown as a checklist on the trip page." },
  { key: "exclusions", title: "What's not included", description: "Optional." },
  { key: "faq", title: "FAQs", description: "Optional. Answers to the questions you get most." },
  { key: "seo", title: "Search engine listing", description: "Optional. Defaults to the title and summary." },
] as const;

export function getPageProgress(form: TripForm): Record<string, number> {
  const step = getStepProgress(form);
  return {
    summary: has(form.overview.replace(/<[^>]*>/g, "")) ? 1 : 0,
    content: hasHtml(form.content) ? 1 : has(form.content) ? 0.5 : 0,
    media: step.media,
    pricing: step.pricing,
    categorization: step.categorization,
    inclusions: step.inclusions,
    exclusions: step.exclusions,
    faq: step.faq,
    seo: step.seo,
  };
}

/** Sections that count towards a PAGE trip's completeness (the optional ones don't). */
export const PAGE_REQUIRED = ["summary", "content", "media", "pricing", "categorization"];

export function mealsToArray(value: unknown): string[] {
  if (Array.isArray(value)) return strArr(value);
  return str(value)
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

export function normalizeItinerary(itinerary: unknown): ItineraryVariant[] {
  if (!Array.isArray(itinerary) || itinerary.length === 0) return [newVariant(0, true)];
  const first = itinerary[0] as Record<string, unknown>;
  if (Array.isArray(first?.days)) {
    const rows = itinerary as Record<string, unknown>[];
    const defaultIndex = Math.max(0, rows.findIndex((v) => Boolean(v.isDefault)));
    return rows.map((v, i) => ({
      id: uid(),
      name: str(v.name) || (i === 0 ? "Standard itinerary" : `Variant ${i + 1}`),
      description: str(v.description),
      isDefault: i === defaultIndex,
      days: (Array.isArray(v.days) ? (v.days as Record<string, unknown>[]) : []).map((d, di) => ({
        id: uid(),
        day: typeof d.day === "number" ? d.day : di + 1,
        title: str(d.title),
        description: str(d.description),
        duration: str(d.duration),
        distance: str(d.distance),
        ascent: str(d.ascent),
        descent: str(d.descent),
        meals: str(d.meals),
        accommodations: str(d.accommodations),
        dayFeaturedImages: (Array.isArray(d.dayFeaturedImages) ? (d.dayFeaturedImages as Record<string, unknown>[]) : []).map((im) => ({
          id: uid(),
          image: str(im.image),
          title: str(im.title),
          description: str(im.description),
        })),
      })),
    }));
  }
  // Legacy flat shape: array of day objects.
  return [
    {
      id: uid(),
      name: "Standard itinerary",
      description: "",
      isDefault: true,
      days: (itinerary as Record<string, unknown>[]).map((d, di) => ({
        id: uid(),
        day: typeof d.day === "number" ? d.day : di + 1,
        title: str(d.title),
        description: str(d.description),
        duration: str(d.duration),
        distance: str(d.distance),
        ascent: str(d.ascent),
        descent: str(d.descent),
        meals: str(d.meals),
        accommodations: str(d.accommodations ?? d.accommodation),
        dayFeaturedImages: [],
      })),
    },
  ];
}

export function normalizeFaq(value: unknown): FaqGroup[] {
  if (!Array.isArray(value)) return [];
  return (value as Record<string, unknown>[]).map((g) => {
    if (Array.isArray(g.items)) {
      return {
        id: uid(),
        title: str(g.title),
        items: (g.items as Record<string, unknown>[]).map((it) => ({ q: str(it.q ?? it.question), a: str(it.a ?? it.answer) })),
      };
    }
    // Legacy {question, answer} pairs → one group.
    return { id: uid(), title: "", items: [{ q: str(g.question), a: str(g.answer) }] };
  });
}

export function normalizeInfo(value: unknown): AdditionalInfoItem[] {
  if (!Array.isArray(value)) return [];
  return (value as Record<string, unknown>[]).map((i) => ({
    id: uid(),
    title: str(i.title),
    description: str(i.description ?? i.content),
  }));
}

export function normalizeAltitude(value: unknown): AltitudePoint[] {
  if (!Array.isArray(value)) return [];
  return (value as Record<string, unknown>[]).map((p) => ({
    id: uid(),
    location: str(p.location),
    altitude: p.altitude == null ? "" : String(p.altitude),
  }));
}

export function normalizeGroupDiscount(value: unknown): GroupDiscountRule[] {
  if (!Array.isArray(value)) return [];
  return (value as Record<string, unknown>[]).map((r) => ({
    id: uid(),
    groupSize: r.groupSize == null ? "" : String(r.groupSize),
    discount: r.discount == null ? "" : String(r.discount),
    discountType: r.discountType === "FLAT" ? "FLAT" : "PERCENTAGE",
  }));
}

const nullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};
const nullableNum = (value: string) => {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
};

export type ActivityPayload = Record<string, unknown>;

export function toPayload(form: TripForm, status: "DRAFT" | "PUBLISHED"): ActivityPayload {
  return {
    layout: form.layout,
    title: form.title.trim(),
    slug: form.slug.trim() || undefined,
    status,
    overview: nullable(form.overview),
    content: nullable(form.content),
    tripCategoryId: form.tripCategoryId ? Number(form.tripCategoryId) : null,
    countryId: form.countryId ? Number(form.countryId) : null,
    cityId: form.cityId ? Number(form.cityId) : null,
    regionId: form.regionId ? Number(form.regionId) : null,
    featuredTagIds: form.featuredTagIds,
    highlights: nullable(form.highlights),
    itinerary: form.itinerary.map((v) => ({
      name: v.name,
      description: v.description,
      isDefault: v.isDefault,
      days: v.days.map((d) => ({
        day: d.day,
        title: d.title,
        description: d.description,
        duration: d.duration,
        distance: d.distance,
        ascent: d.ascent,
        descent: d.descent,
        meals: d.meals,
        accommodations: d.accommodations,
        dayFeaturedImages: d.dayFeaturedImages.filter((im) => im.image),
      })),
    })),
    images: form.images,
    videoUrl: nullable(form.videoUrl),
    routeMap: nullable(form.routeMap),
    mapDescription: nullable(form.mapDescription),
    inclusions: nullable(form.inclusions),
    exclusions: nullable(form.exclusions),
    duration: nullable(form.duration),
    maximumAltitude: nullableNum(form.maximumAltitude),
    altitudeChart: form.altitudeChart
      .filter((p) => p.location.trim() && Number(p.altitude) > 0)
      .map((p) => ({ id: p.id, location: p.location.trim(), altitude: Number(p.altitude) })),
    guestCapacity: nullableNum(form.guestCapacity),
    difficultyLevel: form.difficultyLevel || null,
    meetingPoint: nullable(form.meetingPoint),
    dropOffPoint: nullable(form.dropOffPoint),
    accommodations: form.accommodations,
    meals: form.meals.length ? form.meals.join(", ") : null,
    price: nullableNum(form.price),
    maxPrice: nullableNum(form.maxPrice),
    groupDiscount: form.groupDiscount
      .filter((r) => Number(r.groupSize) > 0 && Number(r.discount) > 0)
      .map((r) => ({ groupSize: Number(r.groupSize), discount: Number(r.discount), discountType: r.discountType })),
    showGroupDiscount: form.showGroupDiscount,
    extraIds: form.extraIds,
    languages: form.languages,
    additionalInfo: form.additionalInfo
      .filter((i) => i.title.trim())
      .map((i) => ({ title: i.title, description: i.description })),
    faq: form.faq
      .filter((g) => g.items.some((it) => it.q.trim()))
      .map((g) => ({ title: g.title, items: g.items.filter((it) => it.q.trim()) })),
    isFeatured: form.isFeatured,
    tripSeo: {
      metaTitle: nullable(form.seo.metaTitle),
      metaDescription: nullable(form.seo.metaDescription),
      metaKeywords: nullable(form.seo.metaKeywords),
      metaRobots: nullable(form.seo.metaRobots),
      metaAuthor: nullable(form.seo.metaAuthor),
      canonicalUrl: nullable(form.seo.canonicalUrl),
      featuredMedia: nullable(form.seo.featuredMedia),
      schema: nullable(form.seo.schema),
    },
  };
}
