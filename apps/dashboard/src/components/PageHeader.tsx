export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      {/* The title and the button share one row, vertically centred. The description sits below and uses the full width. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <h1 className="min-w-0 text-[1.75rem] leading-9 font-semibold tracking-[-0.025em]">{title}</h1>
        {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
      </div>
      {description && <p className="mt-2 text-[15px] leading-relaxed text-pretty text-muted-foreground">{description}</p>}
    </div>
  );
}
