import { useState } from "react";
import { ImagePlus, RefreshCw, X } from "lucide-react";
import { MediaPicker } from "@/components/media-picker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Single image chosen from the media library (or uploaded through it).
 * Stores the image URL, so it drops in wherever a URL text input used to be.
 */
export function ImageField({
  value,
  onChange,
  shape = "cover",
  label = "Choose image",
  className,
}: {
  value: string | null | undefined;
  onChange: (url: string) => void;
  shape?: "cover" | "square" | "avatar";
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const frame =
    shape === "avatar"
      ? "size-20 rounded-full"
      : shape === "square"
        ? "aspect-square w-32 rounded-lg"
        : "aspect-video w-full max-w-sm rounded-lg";

  return (
    <div className={cn("flex items-center gap-4", shape === "cover" && "flex-col items-start gap-2", className)}>
      {value ? (
        <div className={cn("group relative overflow-hidden border bg-muted", frame)}>
          <img src={value} alt="" className="size-full object-cover" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "flex flex-col items-center justify-center gap-1 border border-dashed bg-muted/40 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
            frame,
          )}
        >
          <ImagePlus className="size-5" />
          {shape !== "avatar" && <span className="text-xs font-medium">{label}</span>}
        </button>
      )}
      {value || shape === "avatar" ? (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            {value ? <RefreshCw /> : <ImagePlus />}
            {value ? "Replace" : label}
          </Button>
          {value ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")} className="text-muted-foreground">
              <X />
              Remove
            </Button>
          ) : null}
        </div>
      ) : null}
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        onSelect={(media) => {
          onChange(media.url);
          setOpen(false);
        }}
        confirmLabel="Use image"
      />
    </div>
  );
}
