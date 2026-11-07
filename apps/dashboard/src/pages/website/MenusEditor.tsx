import { Plus, Trash2 } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { NavItem, SiteConfig } from "@/pages/website/types";

type Navigation = SiteConfig["navigation"];

function ModeSwitch({ mode, onChange }: { mode: "AUTO" | "MANUAL"; onChange: (m: "AUTO" | "MANUAL") => void }) {
  return (
    <div className="inline-flex rounded-lg border p-0.5 text-sm">
      {(["AUTO", "MANUAL"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn("rounded-md px-3 py-1", mode === m ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
        >
          {m === "AUTO" ? "Automatic" : "I'll set it"}
        </button>
      ))}
    </div>
  );
}

function ItemRows({ items, onChange, nested = false }: { items: NavItem[]; onChange: (next: NavItem[]) => void; nested?: boolean }) {
  const patch = (i: number, change: Partial<NavItem>) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...change } : it)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className={cn("space-y-2", nested && "ml-6 border-l pl-3")}>
      {items.map((item, i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center gap-2">
            <Input aria-label="Link text" value={item.label} onChange={(e) => patch(i, { label: e.target.value })} placeholder="Link text" className="h-8" />
            <Input aria-label="Link address" value={item.href} onChange={(e) => patch(i, { href: e.target.value })} placeholder="/trips or https://…" className="h-8" />
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
              ↓
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove link" className="text-muted-foreground hover:text-destructive" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
              <Trash2 />
            </Button>
          </div>
          {!nested ? (
            <>
              {item.children?.length ? <ItemRows nested items={item.children} onChange={(children) => patch(i, { children })} /> : null}
              <button
                type="button"
                className="ml-6 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => patch(i, { children: [...(item.children ?? []), { label: "", href: "" }] })}
              >
                + Add dropdown link
              </button>
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function MenusEditor({ navigation, onChange }: { navigation: Navigation; onChange: (next: Navigation) => void }) {
  const { header, footer } = navigation;
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Top menu</h3>
            <p className="text-sm text-muted-foreground">
              {header.mode === "AUTO" ? "Built from your trip categories, blog and the pages marked “show in menu”." : "Exactly the links below."}
            </p>
          </div>
          <ModeSwitch mode={header.mode} onChange={(mode) => onChange({ ...navigation, header: { ...header, mode } })} />
        </div>
        {header.mode === "MANUAL" ? (
          <>
            <ItemRows items={header.items} onChange={(items) => onChange({ ...navigation, header: { ...header, items } })} />
            <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...navigation, header: { ...header, items: [...header.items, { label: "", href: "" }] } })}>
              <Plus />
              Add link
            </Button>
          </>
        ) : null}
      </section>

      <section className="space-y-3 border-t pt-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Footer</h3>
            <p className="text-sm text-muted-foreground">
              {footer.mode === "AUTO" ? "An “Explore” column of tags and categories, and a “Company” column of your pages." : "Exactly the columns below."}
            </p>
          </div>
          <ModeSwitch mode={footer.mode} onChange={(mode) => onChange({ ...navigation, footer: { ...footer, mode } })} />
        </div>
        {footer.mode === "MANUAL" ? (
          <>
            {footer.columns.map((col, ci) => (
              <div key={ci} className="space-y-2 rounded-xl border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="Column title"
                    value={col.title}
                    onChange={(e) => onChange({ ...navigation, footer: { ...footer, columns: footer.columns.map((c, i) => (i === ci ? { ...c, title: e.target.value } : c)) } })}
                    placeholder="Column title"
                    className="h-8 font-medium"
                  />
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove column" className="text-muted-foreground hover:text-destructive" onClick={() => onChange({ ...navigation, footer: { ...footer, columns: footer.columns.filter((_, i) => i !== ci) } })}>
                    <Trash2 />
                  </Button>
                </div>
                <ItemRows items={col.items} onChange={(items) => onChange({ ...navigation, footer: { ...footer, columns: footer.columns.map((c, i) => (i === ci ? { ...c, items } : c)) } })} />
                <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...navigation, footer: { ...footer, columns: footer.columns.map((c, i) => (i === ci ? { ...c, items: [...c.items, { label: "", href: "" }] } : c)) } })}>
                  <Plus />
                  Add link
                </Button>
              </div>
            ))}
            {footer.columns.length < 6 ? (
              <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...navigation, footer: { ...footer, columns: [...footer.columns, { title: "", items: [] }] } })}>
                <Plus />
                Add column
              </Button>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
