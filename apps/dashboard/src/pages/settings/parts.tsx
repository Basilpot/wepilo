import type { ReactNode } from "react";

/** Two-column settings row: what it is on the left, the controls on the right. */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-x-10 gap-y-4 border-b py-8 first:pt-2 last:border-b-0 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0 max-w-2xl space-y-5">{children}</div>
    </section>
  );
}

