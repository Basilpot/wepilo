import {
  Building2,
  CalendarCheck,
  Contact2,
  CopyX,
  CreditCard,
  FileText,
  Footprints,
  GaugeCircle,
  Image,
  Inbox,
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
} from "lucide-react";

export type NavItem = { title: string; url: string; icon: LucideIcon; keywords?: string };
export type NavGroup = { label: string; items: NavItem[] };

// Labels match each page's own title so the sidebar, page header and ⌘K search all agree.
// Groups follow the order an agency actually works in: handle customers first, then
// build the trips they buy, then publish the website around them, then manage the account.
export const QUICK_LINKS: NavItem[] = [
  {
    title: "Business overview",
    url: "/",
    icon: GaugeCircle,
    keywords: "dashboard home overview analytics summary stats",
  },
  {
    title: "Customer inquiries",
    url: "/inquiries",
    icon: Inbox,
    keywords: "inquiries enquiries leads messages contact questions replies",
  },
  {
    title: "Customer bookings",
    url: "/bookings",
    icon: Receipt,
    keywords: "bookings orders sales reservations seats",
  },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Trips you sell",
    items: [
      {
        title: "All trips",
        url: "/trips",
        icon: Footprints,
        keywords: "trips tours packages activities itinerary create publish",
      },
      {
        title: "Departure dates and seats",
        url: "/departures",
        icon: CalendarCheck,
        keywords: "departures dates slots schedule availability capacity price",
      },
      {
        title: "Optional add-ons",
        url: "/extras",
        icon: Package,
        keywords: "extras add-ons upsell upgrades",
      },
    ],
  },
  {
    label: "Organise your trips",
    items: [
      {
        title: "Destinations",
        url: "/locations",
        icon: MapPinHouse,
        keywords: "destinations countries regions cities locations places",
      },
      {
        title: "Trip categories",
        url: "/trip-categories",
        icon: Layers2,
        keywords: "categories types treks tours expeditions",
      },
      {
        title: "Homepage themes",
        url: "/featured-tags",
        icon: Tag,
        keywords: "featured tags themes collections homepage",
      },
      {
        title: "Homepage featured trips",
        url: "/featured-trips",
        icon: MapPinCheck,
        keywords: "featured trips homepage highlight popular",
      },
    ],
  },
  {
    label: "Website content",
    items: [
      {
        title: "Website pages",
        url: "/info-pages",
        icon: NotebookPen,
        keywords: "pages info about terms privacy how to book",
      },
      {
        title: "Blog posts",
        url: "/posts",
        icon: Newspaper,
        keywords: "posts blog articles travel guides",
      },
      {
        title: "Page and post categories",
        url: "/page-categories",
        icon: CopyX,
        keywords: "categories group pages posts",
      },
      {
        title: "Media library",
        url: "/media",
        icon: Image,
        keywords: "media images uploads files photos pdf",
      },
      {
        title: "Old-to-new link redirects",
        url: "/redirects",
        icon: Redo,
        keywords: "redirects urls links 301 moved",
      },
    ],
  },
  {
    label: "People on your website",
    items: [
      {
        title: "Team members",
        url: "/team",
        icon: Contact2,
        keywords: "team staff people guides profiles",
      },
      {
        title: "Team departments",
        url: "/departments",
        icon: Building2,
        keywords: "departments groups team",
      },
      {
        title: "Blog authors",
        url: "/authors",
        icon: PenLine,
        keywords: "authors writers bylines blog",
      },
    ],
  },
  {
    label: "Trust and marketing",
    items: [
      {
        title: "Customer testimonials",
        url: "/testimonials",
        icon: Quote,
        keywords: "testimonials quotes praise",
      },
      {
        title: "Guest trip reviews",
        url: "/reviews",
        icon: Star,
        keywords: "reviews ratings stars feedback guests",
      },
      {
        title: "Licences and certificates",
        url: "/documents",
        icon: FileText,
        keywords: "documents certificates licenses licences registration files",
      },
      {
        title: "Newsletter subscribers",
        url: "/newsletter",
        icon: Mail,
        keywords: "newsletter subscribers email broadcast send",
      },
    ],
  },
  {
    label: "Account and help",
    items: [
      {
        title: "Business profile",
        url: "/settings",
        icon: Settings,
        keywords: "settings business profile company workspace name logo",
      },
      {
        title: "Staff logins",
        url: "/settings/staff",
        icon: Users2,
        keywords: "staff team users permissions invite logins access",
      },
      {
        title: "Developer API keys",
        url: "/settings/api-keys",
        icon: KeyRound,
        keywords: "api keys developer integration token",
      },
      {
        title: "Plan and billing",
        url: "/settings/billing",
        icon: CreditCard,
        keywords: "billing plan subscription invoice payment card",
      },
      {
        title: "Contact Wepilo support",
        url: "/support",
        icon: LifeBuoy,
        keywords: "support help ticket contact problem",
      },
    ],
  },
];

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
