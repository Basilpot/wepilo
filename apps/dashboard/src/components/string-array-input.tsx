import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function StringArrayInput({
  value,
  onChange,
  placeholder,
  error,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  error?: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const next = draft.trim().replace(/,$/, "");
    if (!next) return;
    if (!value.some((v) => v.toLowerCase() === next.toLowerCase())) onChange([...value, next]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={add}
        placeholder={placeholder}
        className={cn(error && "border-destructive")}
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-xl border bg-muted/40 p-2">
          {value.map((item) => (
            <Badge key={item} variant="secondary" className="gap-1 font-normal">
              {item}
              <button
                type="button"
                aria-label={`Remove ${item}`}
                className="transition-colors hover:text-destructive"
                onClick={() => onChange(value.filter((v) => v !== item))}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
