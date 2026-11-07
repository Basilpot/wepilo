import * as React from "react";
import { Check, Plus, X } from "@/components/icons";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ComboOption } from "@/components/combobox";

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Click to choose one or more items…",
  searchPlaceholder = "Search…",
  emptyText = "No items found.",
  onCreate,
  className,
}: {
  options: ComboOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Lets people add a missing item on the spot. Return the new item's value so it is selected right away. */
  onCreate?: (label: string) => Promise<string | void>;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const trimmed = search.trim();
  const canCreate = Boolean(onCreate && trimmed && !options.some((o) => o.label.toLowerCase() === trimmed.toLowerCase()));

  const handleCreate = async () => {
    if (!onCreate || !trimmed) return;
    setCreating(true);
    try {
      const id = await onCreate(trimmed);
      if (id && !selected.includes(id)) onChange([...selected, id]);
      setSearch("");
    } finally {
      setCreating(false);
    }
  };

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  const selectedOptions = selected
    .map((value) => options.find((o) => o.value === value))
    .filter((o): o is ComboOption => Boolean(o));

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
          className={cn("h-auto min-h-8 w-full justify-between font-normal", className)}
        >
          <div className="flex flex-wrap gap-1 py-0.5 text-left">
            {selectedOptions.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selectedOptions.map((o) => (
                <Badge key={o.value} variant="secondary" className="h-7 gap-1.5 px-3 text-sm font-normal">
                  {o.label}
                  <span
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(o.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        toggle(o.value);
                      }
                    }}
                  >
                    <X className="size-3.5" />
                  </span>
                </Badge>
              ))
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{canCreate ? null : emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem key={option.value} value={option.label} onSelect={() => toggle(option.value)}>
                  <Check className={cn("mr-2 h-4 w-4", selected.includes(option.value) ? "opacity-100" : "opacity-0")} />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
            {canCreate && (
              // forceMount on the group too: cmdk hides a group when nothing in it matches the search.
              <CommandGroup forceMount>
                <CommandItem forceMount value={`__create__${trimmed}`} disabled={creating} onSelect={handleCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  {creating ? "Adding…" : `Add "${trimmed}"`}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
