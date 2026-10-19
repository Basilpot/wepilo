import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FilePlus2, Footprints, Plus, Upload } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { NAV_GROUPS, QUICK_LINKS } from "@/components/layout/nav";
import { api } from "@/lib/api";

const ACTIONS = [
  { title: "New trip", url: "/trips/new", icon: Plus },
  { title: "New post", url: "/posts/new", icon: FilePlus2 },
  { title: "Upload media", url: "/media", icon: Upload },
];

type TripHit = { id: number; title: string | null; status: string };

function useDebounced<T>(value: T, ms = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function CommandMenu({
  open,
  onOpenChange,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (url: string) => void;
}) {
  const [search, setSearch] = useState("");
  const term = useDebounced(search.trim());

  const trips = useQuery({
    queryKey: ["command", "trips", term],
    queryFn: () => api<{ data: TripHit[] }>("/activities", { query: { search: term, limit: 6 } }),
    enabled: open && term.length >= 2,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const go = (url: string) => {
    onOpenChange(false);
    onNavigate(url);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search" description="Jump to a page or find a trip">
      <CommandInput placeholder="Search pages, actions or trips…" value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandEmpty>{trips.isFetching ? "Searching…" : "No results."}</CommandEmpty>
        {trips.data?.data.length ? (
          <>
            <CommandGroup heading="Trips">
              {trips.data.data.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`trip-${t.id} ${t.title ?? ""}`}
                  onSelect={() => go(`/trips/${t.id}`)}
                >
                  <Footprints />
                  <span className="truncate">{t.title || "Untitled trip"}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {t.status === "PUBLISHED" ? "Live" : "Draft"}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        ) : null}
        <CommandGroup heading="Actions">
          {ACTIONS.map((a) => (
            <CommandItem key={a.url} value={a.title} onSelect={() => go(a.url)}>
              <a.icon />
              {a.title}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Go to">
          {QUICK_LINKS.map((item) => (
            <CommandItem key={item.url} value={`${item.title} ${item.keywords ?? ""}`} onSelect={() => go(item.url)}>
              <item.icon />
              {item.title}
            </CommandItem>
          ))}
        </CommandGroup>
        {NAV_GROUPS.map((group) => (
          <CommandGroup key={group.label} heading={group.label}>
            {group.items.map((item) => (
              <CommandItem
                key={item.url}
                value={`${item.title} ${group.label} ${item.keywords ?? ""}`}
                onSelect={() => go(item.url)}
              >
                <item.icon />
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
