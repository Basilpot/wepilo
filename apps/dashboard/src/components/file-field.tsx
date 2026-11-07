import { useState } from "react";
import { FileText, RefreshCw, Upload, X } from "@/components/icons";
import { MediaPicker } from "@/components/media-picker";
import { Button } from "@/components/ui/button";

/** Last path segment of a media link, for showing which file is chosen. */
function fileName(url: string) {
  try {
    return decodeURIComponent(new URL(url, window.location.origin).pathname.split("/").filter(Boolean).pop() ?? url);
  } catch {
    return url;
  }
}

/**
 * Document (PDF) chosen from the media library or uploaded through it.
 * Stores the file's link, so it replaces a text input that used to take a pasted path.
 */
export function FileField({
  value,
  onChange,
  label = "Choose file",
}: {
  value: string | null | undefined;
  onChange: (url: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-3">
      {value ? (
        <>
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm hover:bg-muted"
          >
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{fileName(value)}</span>
          </a>
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            <RefreshCw />
            Replace
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onChange("")}>
            <X />
            Remove
          </Button>
        </>
      ) : (
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          <Upload />
          {label}
        </Button>
      )}
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        kind="document"
        onSelect={(media) => {
          onChange(media.url);
          setOpen(false);
        }}
        confirmLabel="Use file"
      />
    </div>
  );
}
