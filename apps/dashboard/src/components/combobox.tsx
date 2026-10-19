import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type ComboOption = { value: string; label: string };

export function Combobox({
  options,
  value,
  setValue,
  placeholder,
  notFoundPlaceholder = "No results found.",
  error,
  onCreate,
  optional,
  className,
}: {
  options: ComboOption[];
  value: string;
  setValue: (value: string) => void;
  placeholder: string;
  notFoundPlaceholder?: string;
  error?: boolean;
  optional?: { label: string; value: string };
  onCreate?: (label: string) => Promise<string | void>;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const trimmed = search.trim();
  const noMatch = trimmed && !options.some((o) => o.label.toLowerCase() === trimmed.toLowerCase());

  const handleCreate = async () => {
    if (!onCreate || !trimmed) return;
    setCreating(true);
    try {
      const id = await onCreate(trimmed);
      if (id) setValue(id);
      setSearch("");
      setOpen(false);
    } finally {
      setCreating(false);
    }
  };

  const items = optional ? [optional, ...options] : options;
  const selectedLabel = items.find((o) => o.value === value)?.label;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-8 w-full justify-between font-normal", !selectedLabel && "text-muted-foreground", error && "border-destructive", className)}
        >
          <span className="truncate">{selectedLabel ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter>
          <CommandInput placeholder={placeholder} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty className="p-2">
              {onCreate && trimmed ? (
                <button
                  type="button"
                  disabled={creating}
                  onClick={handleCreate}
                  className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {creating ? "Adding…" : `Add "${trimmed}"`}
                </button>
              ) : (
                <span className="text-sm text-muted-foreground">{notFoundPlaceholder}</span>
              )}
            </CommandEmpty>
            <CommandGroup>
              {items.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label]}
                  onSelect={() => {
                    setValue(option.value);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
