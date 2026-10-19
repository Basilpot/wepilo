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

// Labels match each page's own title so the menu, header and ⌘K agree.
export const QUICK_LINKS: NavItem[] = [
  { title: "Dashboard", url: "/", icon: GaugeCircle, keywords: "home overview analytics" },
  { title: "Inquiries", url: "/inquiries", icon: Inbox, keywords: "leads messages contact" },
  { title: "Bookings", url: "/bookings", icon: Receipt, keywords: "orders sales" },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Trips",
    items: [
      { title: "Trips", url: "/trips", icon: Footprints, keywords: "tours packages activities" },
      { title: "Departures", url: "/departures", icon: CalendarCheck, keywords: "dates slots schedule" },
      { title: "Trip categories", url: "/trip-categories", icon: Layers2 },
      { title: "Destinations", url: "/locations", icon: MapPinHouse, keywords: "countries regions cities locations" },
      { title: "Featured tags", url: "/featured-tags", icon: Tag },
      { title: "Featured trips", url: "/featured-trips", icon: MapPinCheck },
      { title: "Extras", url: "/extras", icon: Package, keywords: "add-ons upsell" },
    ],
  },
  {
    label: "Website",
    items: [
      { title: "Pages", url: "/info-pages", icon: NotebookPen },
      { title: "Posts", url: "/posts", icon: Newspaper, keywords: "blog articles" },
      { title: "Content categories", url: "/page-categories", icon: CopyX },
      { title: "Media", url: "/media", icon: Image, keywords: "images uploads files" },
      { title: "Redirects", url: "/redirects", icon: Redo },
    ],
  },
  {
    label: "About us",
    items: [
      { title: "Team members", url: "/team", icon: Contact2 },
      { title: "Departments", url: "/departments", icon: Building2 },
      { title: "Authors", url: "/authors", icon: PenLine },
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
    label: "Settings",
    items: [
      { title: "Business profile", url: "/settings", icon: Settings, keywords: "company workspace" },
      { title: "Staff logins", url: "/settings/staff", icon: Users2, keywords: "team users permissions" },
      { title: "API keys", url: "/settings/api-keys", icon: KeyRound, keywords: "developer integration" },
      { title: "Billing", url: "/settings/billing", icon: CreditCard, keywords: "plan subscription invoice" },
      { title: "Support", url: "/support", icon: LifeBuoy, keywords: "help ticket" },
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
