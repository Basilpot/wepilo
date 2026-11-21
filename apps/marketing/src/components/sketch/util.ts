/** Shared helpers for the line-drawn product sketches. Coordinates are in the 1200 × 640 sketch space. */

export type Callout = {
  /** The point on the drawing the note refers to. */
  at: [number, number];
  /** Where the note sits. */
  to: [number, number];
  /** Text lines; brackets are added. */
  lines: string[];
  /** Which way the text runs from `to`. */
  side: "left" | "right";
};

/** A simple ridge line inside an image box: the house mark for "a photo of a trip". */
export function ridge(x: number, y: number, w: number, h: number): string {
  const p = (fx: number, fy: number) => `${(x + w * fx).toFixed(1)},${(y + h * fy).toFixed(1)}`;
  return [p(0, 1), p(0.18, 0.5), p(0.3, 0.66), p(0.5, 0.22), p(0.66, 0.58), p(0.78, 0.42), p(1, 0.86), p(1, 1)].join(" ");
}

/** Small snow cap for the highest peak of a ridge(). */
export function cap(x: number, y: number, w: number, h: number): string {
  const px = x + w * 0.5;
  const py = y + h * 0.22;
  return `M${px - w * 0.07} ${py + h * 0.16} L${px} ${py} L${px + w * 0.07} ${py + h * 0.16} L${px + w * 0.03} ${py + h * 0.12} L${px} ${py + h * 0.17} L${px - w * 0.03} ${py + h * 0.11} Z`;
}

/** Names of the small line icons drawn by Glyph.astro. */
export type GlyphName =
  | "route" | "photo" | "list" | "bed" | "price" | "question" | "gauge" | "tag"
  | "calendar" | "seats" | "request" | "extras" | "currency"
  | "draft" | "translate" | "page" | "search" | "link" | "globe"
  | "users" | "approve" | "clock" | "power" | "share" | "sitemap" | "schema" | "alt"
  | "form" | "status" | "mail" | "star" | "layout" | "lock" | "chart" | "code";
