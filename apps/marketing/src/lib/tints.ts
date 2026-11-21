import type { Tint } from "../data/features";

/** Tailwind classes for each feature tint, written out in full so Tailwind can see them. */
export const tintBg: Record<Tint, string> = {
  sand: "bg-sand",
  sky: "bg-sky",
  lilac: "bg-lilac",
  sage: "bg-sage",
  peach: "bg-peach",
  butter: "bg-butter",
};

/** Soft fallback colour under each painted scene, so the band reads right before the image loads. */
const tintHex: Record<Tint, string> = {
  sand: "#ead6b2",
  sky: "#c6daf0",
  lilac: "#d8cdf1",
  sage: "#c9ddbd",
  peach: "#f5c8ae",
  butter: "#f0df9b",
};

/** Inline style for a `.painted` element: the tint's landscape over its fallback colour. */
export const sceneStyle = (t: Tint) => `--scene:url(/art/scenes/${t}.webp);--scene-tint:${tintHex[t]}`;
