/** The categories a location can have. Must match LOCATION_TYPES in the API. */
export const LOCATION_CATEGORIES = [
  { value: "COUNTRY", label: "Country", plural: "Countries", hint: "The broadest level, for example Italy or Peru." },
  { value: "REGION", label: "Region", plural: "Regions", hint: "An area inside a country, for example Tuscany or the Sacred Valley." },
  { value: "CITY", label: "City", plural: "Cities", hint: "A city where trips start, end or stop, for example Rome or Cusco." },
  { value: "TOWN", label: "Town", plural: "Towns", hint: "A smaller town or village, for example Pienza or Ollantaytambo." },
  { value: "ISLAND", label: "Island", plural: "Islands", hint: "An island or island group, for example Santorini or Bali." },
  { value: "MOUNTAIN", label: "Mountain", plural: "Mountains", hint: "A peak, pass or range, for example Mont Blanc or Kilimanjaro." },
  { value: "PARK", label: "National park", plural: "National parks", hint: "A park or reserve, for example Yellowstone or the Serengeti." },
  { value: "LANDMARK", label: "Landmark", plural: "Landmarks", hint: "A famous site or attraction, for example the Colosseum or Machu Picchu." },
  { value: "AIRPORT", label: "Airport", plural: "Airports", hint: "An airport travellers arrive at, for example Heathrow." },
] as const;

export type LocationCategory = (typeof LOCATION_CATEGORIES)[number]["value"];

export const locationCategoryLabel = (type?: string | null) =>
  LOCATION_CATEGORIES.find((c) => c.value === type)?.label ?? (type ? type.charAt(0) + type.slice(1).toLowerCase() : "");

/** "Mount Everest" → "mount-everest". Used to suggest a handle from a name. */
export const slugifyName = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
