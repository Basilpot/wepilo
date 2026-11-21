import {
  Building2,
  CalendarCheck,
  CalendarDays,
  Contact2,
  CopyX,
  CreditCard,
  FileText,
  Footprints,
  GaugeCircle,
  Globe,
  Image,
  Languages,
  KeyRound,
  Layers2,
  LifeBuoy,
  Mail,
  MapPinCheck,
  MapPinHouse,
  Newspaper,
  NotebookPen,
  Package,
  PenLine,
  Quote,
  Receipt,
  Redo,
  Settings,
  Star,
  Tag,
  Users2,
  type LucideIcon,
} from "@/components/icons";

export type NavItem = { title: string; url: string; icon: LucideIcon; keywords?: string };
export type NavGroup = { label: string; items: NavItem[] };

// Labels match each page's own title so the menu, header and ⌘K agree.
export const QUICK_LINKS: NavItem[] = [
  { title: "Dashboard", url: "/", icon: GaugeCircle, keywords: "home overview analytics" },
  { title: "Calendar", url: "/calendar", icon: CalendarDays, keywords: "schedule publish plan dates departures content" },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Trips",
    items: [
      { title: "Trips", url: "/trips", icon: Footprints, keywords: "tours packages activities itinerary" },
      { title: "Departures", url: "/departures", icon: CalendarCheck, keywords: "dates slots schedule seats availability" },
      { title: "Extras", url: "/extras", icon: Package, keywords: "add-ons upsell upgrades" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { title: "Locations", url: "/locations", icon: MapPinHouse, keywords: "destinations countries regions cities places" },
      { title: "Trip categories", url: "/trip-categories", icon: Layers2, keywords: "types treks tours" },
      { title: "Featured tags", url: "/featured-tags", icon: Tag, keywords: "themes collections homepage" },
      { title: "Featured trips", url: "/featured-trips", icon: MapPinCheck, keywords: "homepage highlight popular" },
    ],
  },
  {
    label: "Website",
    items: [
      { title: "Homepage and menus", url: "/website", icon: Globe, keywords: "navigation footer social seo announcement sections layout" },
      { title: "Pages", url: "/info-pages", icon: NotebookPen },
      { title: "Posts", url: "/posts", icon: Newspaper, keywords: "blog articles" },
      { title: "Page categories", url: "/page-categories", icon: CopyX },
      { title: "Team", url: "/team", icon: Contact2, keywords: "people guides staff departments about" },
      { title: "Media", url: "/media", icon: Image, keywords: "images uploads files" },
      { title: "Redirects", url: "/redirects", icon: Redo },
    ],
  },
  {
    label: "Marketing",
    items: [
      { title: "Testimonials", url: "/testimonials", icon: Quote },
      { title: "Reviews", url: "/reviews", icon: Star },
      { title: "Documents", url: "/documents", icon: FileText, keywords: "certificates licenses" },
      { title: "Newsletter", url: "/newsletter", icon: Mail, keywords: "subscribers" },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Business profile", url: "/settings", icon: Settings, keywords: "company workspace" },
      { title: "Staff logins", url: "/settings/staff", icon: Users2, keywords: "team users permissions" },
      { title: "API keys", url: "/settings/api-keys", icon: KeyRound, keywords: "developer integration" },
      { title: "Languages", url: "/settings/languages", icon: Languages, keywords: "translations translate multilingual locale" },
      { title: "Currency", url: "/settings/currency", icon: Receipt, keywords: "prices money conversion" },
      { title: "Email", url: "/settings/email", icon: Mail, keywords: "resend sender alerts enquiries recipients" },
      { title: "Billing", url: "/settings/billing", icon: CreditCard, keywords: "plan subscription invoice" },
      { title: "Support", url: "/support", icon: LifeBuoy, keywords: "help ticket" },
    ],
  },
];

/**
 * The sidebar stays short: a few hubs, each one a strip of tabs over the pages inside it.
 * Every page is still a normal route and stays searchable in ⌘K (NAV_GROUPS above).
 */
export type NavHub = NavItem & { tabs: NavItem[]; more: NavItem[]; moreLabel: string };

const byUrl = (url: string): NavItem => {
  const item = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.url === url);
  if (!item) throw new Error(`nav: unknown url ${url}`);
  return item;
};

export const HUBS: NavHub[] = [
  {
    title: "Trips",
    url: "/trips",
    icon: Footprints,
    keywords: "tours packages departures extras locations categories",
    tabs: ["/trips", "/departures", "/extras"].map(byUrl),
    moreLabel: "Organise",
    more: ["/locations", "/trip-categories", "/featured-tags", "/featured-trips"].map(byUrl),
  },
  {
    title: "Website",
    url: "/website",
    icon: Globe,
    keywords: "homepage pages posts blog team redirects documents",
    tabs: ["/website", "/info-pages", "/posts"].map(byUrl),
    moreLabel: "More",
    more: ["/page-categories", "/team", "/redirects", "/documents"].map(byUrl),
  },
  {
    title: "Audience",
    url: "/reviews",
    icon: Star,
    keywords: "reviews testimonials newsletter subscribers",
    tabs: ["/reviews", "/testimonials", "/newsletter"].map(byUrl),
    moreLabel: "More",
    more: [],
  },
];

export const SETTINGS_ITEM: NavItem = { title: "Settings", url: "/settings", icon: Settings, keywords: "business profile staff api keys email billing" };

/** What the sidebar shows, top to bottom. */
export const SIDEBAR_ITEMS: NavItem[] = [
  ...QUICK_LINKS,
  HUBS[0],
  // Photos are used everywhere (trips, pages, posts), so Media gets its own entry.
  byUrl("/media"),
  ...HUBS.slice(1),
  SETTINGS_ITEM,
];

/** The hub whose tab strip should show on this page. Editors (/trips/12) get no strip. */
export function hubFor(pathname: string): NavHub | undefined {
  return HUBS.find((h) => [...h.tabs, ...h.more].some((t) => t.url === pathname));
}

/** A hub is "current" for any page inside it, editors included. */
export function isHubActive(pathname: string, item: NavItem) {
  const hub = HUBS.find((h) => h.url === item.url);
  if (hub) return [...hub.tabs, ...hub.more].some((t) => isActive(pathname, t.url));
  if (item.url === SETTINGS_ITEM.url) return pathname.startsWith("/settings") || pathname.startsWith("/support");
  return isActive(pathname, item.url);
}

const ALL_ITEMS = [...QUICK_LINKS, ...NAV_GROUPS.flatMap((g) => g.items)];

/** Exact match first, then the longest prefix (so /trips/12 → Trips). */
export function findNavItem(pathname: string): NavItem | undefined {
  const exact = ALL_ITEMS.find((i) => i.url === pathname);
  if (exact) return exact;
  return ALL_ITEMS.filter((i) => i.url !== "/" && pathname.startsWith(i.url + "/")).sort(
    (a, b) => b.url.length - a.url.length,
  )[0];
}

export function isActive(pathname: string, url: string) {
  if (url === "/") return pathname === "/";
  if (url === "/settings") return pathname === "/settings" || pathname === "/settings/profile";
  return pathname === url || pathname.startsWith(url + "/");
}
