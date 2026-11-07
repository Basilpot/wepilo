import { useState } from "react";
import { cn } from "@/lib/utils";

const initials = (name: string) =>
  (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

/**
 * The picture shown at the start of a table row. Shows the image when the item has one, and its initials when it doesn't,
 * so every row in a list lines up the same way.
 * `round` is for people (avatars). Everything else gets a small landscape thumbnail.
 */
export function Thumb({
  src,
  name,
  round = false,
  className,
}: {
  src?: string | null;
  name: string;
  round?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const shape = round ? "size-9 rounded-full" : "h-10 w-14 rounded-lg";
  if (src && !failed) {
    return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className={cn("shrink-0 border bg-muted object-cover", shape, className)} />;
  }
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center bg-muted text-xs font-semibold tracking-wide text-muted-foreground", shape, className)}
    >
      {initials(name)}
    </span>
  );
}
