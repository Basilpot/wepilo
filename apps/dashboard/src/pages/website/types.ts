export const SECTION_LABELS = {
  HERO: "Hero banner",
  FEATURED_TRIPS: "Featured trips",
  DESTINATIONS: "Destinations",
  CATEGORIES: "Trip categories",
  TESTIMONIALS: "Testimonials",
  LATEST_POSTS: "Latest posts",
  NEWSLETTER: "Newsletter signup",
  CUSTOM_TEXT: "Custom text block",
} as const;
export type SectionType = keyof typeof SECTION_LABELS;

/** Sections that list items and so take a count. */
export const LIST_SECTIONS: SectionType[] = ["FEATURED_TRIPS", "DESTINATIONS", "CATEGORIES", "TESTIMONIALS", "LATEST_POSTS"];

export const SECTION_SOURCE: Partial<Record<SectionType, string>> = {
  FEATURED_TRIPS: "Trips marked as featured (Featured trips page).",
  DESTINATIONS: "Destinations set to show on the homepage.",
  CATEGORIES: "Trip categories set to show on the homepage.",
  TESTIMONIALS: "Your newest testimonials.",
  LATEST_POSTS: "Your newest published posts.",
};

export type NavItem = { label: string; href: string; children?: NavItem[] };

export type HomeSection = {
  id: string;
  type: SectionType;
  enabled: boolean;
  title?: string | null;
  subtitle?: string | null;
  limit?: number | null;
  image?: string | null;
  body?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
};

export type SiteConfig = {
  homepage: { sections: HomeSection[] };
  navigation: {
    header: { mode: "AUTO" | "MANUAL"; items: NavItem[] };
    footer: { mode: "AUTO" | "MANUAL"; columns: Array<{ title: string; items: NavItem[] }> };
  };
  paths: { trips: string; trip: string; category: string; destination: string; posts: string; post: string; page: string };
  social: { facebook?: string | null; instagram?: string | null; x?: string | null; youtube?: string | null; tiktok?: string | null; linkedin?: string | null; whatsapp?: string | null };
  seo: { siteTitle?: string | null; description?: string | null; ogImage?: string | null };
  announcement: { enabled: boolean; text: string; href?: string | null };
};
