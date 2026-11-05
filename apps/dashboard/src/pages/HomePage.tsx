import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ArrowRight, Check, ExternalLink, Inbox, Plus, Star } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/App";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

type Analytics = {
  trips: { total: number; published: number; drafts: number };
  bookings: { confirmed: number; pending: number };
  revenue: number;
  inquiriesNew: number;
  upcomingDepartures: Array<{
    id: number;
    startDate: string;
    availableSpots: number;
    capacity: number;
    activity: { title: string | null };
  }>;
  topActivities: Array<{
    id: number;
    title: string | null;
    slug: string;
    popularityScore: number;
    views: number;
    averageRating: number;
  }>;
  monthly: Array<{ month: string; bookings: number; revenue: number }>;
};

type Inquiry = { id: number; name: string; email: string; trip: string | null; status: string; createdAt: string };

const money = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days} days ago` : shortDate(iso);
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const chartConfig = {
  bookings: { label: "Bookings", color: "var(--chart-4)" },
} satisfies ChartConfig;

function SetupChecklist({ data }: { data: Analytics }) {
  const { data: session } = useSession();
  const tenant = session?.tenant;
  const steps = [
    {
      title: "Step 1: Finish your business profile",
      hint: "Add your company description, phone number and address. Travellers see these on your website and in the emails you send them.",
      done: Boolean(tenant?.companyDescription && tenant?.phone),
      href: "/settings",
      cta: "Open business profile",
    },
    {
      title: "Step 2: Create your first trip",
      hint: "Enter the trip name, day-by-day itinerary, price and photos. You can save it as a draft and come back to finish it later.",
      done: data.trips.total > 0,
      href: "/trips/new",
      cta: "Create a trip",
    },
    {
      title: "Step 3: Publish a trip so travellers can see it",
      hint: "Draft trips are hidden from your website. Open a trip and publish it to make it visible to the public.",
      done: data.trips.published > 0,
      href: "/trips",
      cta: "Open the trips list",
    },
    {
      title: "Step 4: Add departure dates and seats",
      hint: "A departure is a specific start date with a set number of seats and a price. Travellers can only book online once a trip has at least one upcoming departure.",
      done: data.upcomingDepartures.length > 0,
      href: "/departures",
      cta: "Add departure dates",
    },
  ];
  const completed = steps.filter((s) => s.done).length;
  if (completed === steps.length) return null;
  const next = steps.find((s) => !s.done);

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-4 pb-3">
        <div>
          <h2 className="text-sm font-semibold">Finish these 4 steps to start receiving customers</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {completed} of {steps.length} setup steps completed
          </p>
        </div>
        <div
          className="h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={completed}
          aria-label="Account setup progress"
        >
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(completed / steps.length) * 100}%` }} />
        </div>
      </div>
      <ol className="divide-y border-t">
        {steps.map((step) => (
          <li key={step.title} className="flex flex-wrap items-start gap-x-3 gap-y-3 px-5 py-3 sm:flex-nowrap sm:items-center">
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border sm:mt-0",
                step.done && "border-primary bg-primary text-primary-foreground",
              )}
            >
              {step.done ? <Check className="size-3" /> : null}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium", step.done && "text-muted-foreground line-through")}>
                {step.title}
                <span className="sr-only">{step.done ? " (done)" : ""}</span>
              </p>
              {!step.done && <p className="text-sm text-muted-foreground">{step.hint}</p>}
            </div>
            {!step.done && (
              <Button size="sm" variant={step === next ? "default" : "outline"} asChild className="ml-8 sm:ml-0">
                <Link to={step.href}>{step.cta}</Link>
              </Button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Panel({
  title,
  href,
  linkLabel = "See everything",
  children,
  className,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-lg border bg-card", className)}>
      <header className="flex h-12 items-center justify-between border-b px-5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {href && (
          <Link
            to={href}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {linkLabel}
            <ArrowRight className="size-3" />
          </Link>
        )}
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}

function PanelEmpty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

function ListSkeleton() {
  return (
    <div className="space-y-4 p-5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

export function HomePage() {
  const { data: session } = useSession();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => api<Analytics>("/tenant/analytics"),
  });
  const inquiries = useQuery({
    queryKey: ["inquiries", "recent"],
    queryFn: () => api<{ data: Inquiry[] }>("/inquiries", { query: { limit: 5 } }),
  });

  // The owner account is named after the company at signup; greet by name only for real people.
  const staffName = session?.staff.name?.trim();
  const firstName =
    staffName && staffName !== session?.tenant?.companyName ? staffName.split(" ")[0] : undefined;
  const website = session?.tenant?.website;

  const stats = [
    { label: "Trips visible on your website", value: data?.trips.published, sub: data ? `${data.trips.drafts} more ${data.trips.drafts === 1 ? "trip is a hidden draft" : "trips are hidden drafts"}` : "", to: "/trips" },
    { label: "Confirmed customer bookings", value: data?.bookings.confirmed, sub: data ? `${data.bookings.pending} waiting for your confirmation` : "", to: "/bookings" },
    { label: "New customer inquiries", value: data?.inquiriesNew, sub: "Travellers waiting for your reply", to: "/inquiries" },
    { label: "Total value of confirmed bookings", value: data ? money(data.revenue) : undefined, sub: "Since you started, all time", to: "/bookings" },
  ];

  // The API only returns months that had bookings; plot all twelve.
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 11 + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const hit = data?.monthly.find((m) => m.month === key);
    return {
      month: key,
      bookings: hit?.bookings ?? 0,
      revenue: hit?.revenue ?? 0,
      label: d.toLocaleDateString(undefined, { month: "short" }),
    };
  });
  const hasTrend = monthly.some((m) => m.bookings > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={session ? (firstName ? `${greeting()}, ${firstName}` : greeting()) : "Business overview"}
        description="A summary of your trips, customer bookings and inquiries. Click any number or list below to open the full page behind it."
        action={
          <div className="flex gap-2">
            {website && (
              <Button variant="outline" asChild>
                <a href={website} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                  Open my public website
                </a>
              </Button>
            )}
            <Button asChild>
              <Link to="/trips/new">
                <Plus />
                Create a new trip
              </Link>
            </Button>
          </div>
        }
      />

      {isError ? (
        <div role="alert" className="rounded-lg border p-8 text-center">
          <p className="font-medium">We could not load your business overview.</p>
          <p className="mt-1 text-sm text-muted-foreground">Check your internet connection, then select "Try loading again". If it keeps failing, contact Wepilo support.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => void refetch()}>
            Try loading again
          </Button>
        </div>
      ) : null}

      {data && <SetupChecklist data={data} />}

      <div className="grid grid-cols-2 overflow-hidden rounded-lg border bg-card lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Link
            key={stat.label}
            to={stat.to}
            className={cn(
              "group flex flex-col gap-1 p-5 transition-colors hover:bg-muted/40",
              i % 2 === 1 && "border-l",
              i >= 2 && "border-t lg:border-t-0",
              i === 2 && "lg:border-l",
            )}
          >
            <span className="flex items-center justify-between text-sm text-muted-foreground">
              {stat.label}
              <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
            </span>
            {isLoading ? (
              <Skeleton className="my-1 h-7 w-16" />
            ) : (
              <span className="text-2xl font-semibold tracking-tight tabular-nums">{stat.value ?? 0}</span>
            )}
            <span className="text-xs text-muted-foreground">{isLoading ? " " : stat.sub}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title="Customer bookings over the last 12 months" href="/bookings" className="lg:col-span-3">
          {isLoading ? (
            <div className="p-5">
              <Skeleton className="h-60 w-full" />
            </div>
          ) : hasTrend ? (
            <div className="p-4 pr-6">
              <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full">
                <AreaChart data={monthly} margin={{ left: -16, right: 4, top: 8 }}>
                  <defs>
                    <linearGradient id="fillBookings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-bookings)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--color-bookings)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" minTickGap={16} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                  <Area
                    dataKey="bookings"
                    type="monotone"
                    fill="url(#fillBookings)"
                    stroke="var(--color-bookings)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            </div>
          ) : (
            <PanelEmpty>This chart will show how many bookings you receive each month. It stays empty until your first customer booking arrives.</PanelEmpty>
          )}
        </Panel>

        <Panel title="Latest customer inquiries" href="/inquiries" className="lg:col-span-2">
          {inquiries.isLoading ? (
            <ListSkeleton />
          ) : inquiries.data?.data.length ? (
            <ul className="divide-y">
              {inquiries.data.data.map((inq) => (
                <li key={inq.id}>
                  <Link to="/inquiries" className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {inq.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{inq.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{inq.trip || inq.email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge kind="inquiry" status={inq.status} />
                      <span className="text-xs text-muted-foreground">{relative(inq.createdAt)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center px-5 py-10 text-center">
              <Inbox className="size-5 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">When a traveller sends a question through a form on your website, it will appear here so you can reply quickly.</p>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Next departures on your calendar" href="/departures">
          {isLoading ? (
            <ListSkeleton />
          ) : data?.upcomingDepartures.length ? (
            <ul className="divide-y">
              {data.upcomingDepartures.map((d) => {
                const booked = d.capacity - d.availableSpots;
                const pct = d.capacity ? Math.round((booked / d.capacity) * 100) : 0;
                return (
                  <li key={d.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="flex w-11 shrink-0 flex-col items-center rounded-md border py-1 leading-none">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase">
                        {new Date(d.startDate).toLocaleDateString(undefined, { month: "short" })}
                      </span>
                      <span className="mt-0.5 text-base font-semibold tabular-nums">{new Date(d.startDate).getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.activity.title ?? "Untitled trip (no title yet)"}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {booked} of {d.capacity} seats booked
                        </span>
                      </div>
                    </div>
                    {d.availableSpots === 0 && <StatusBadge kind="departure" status="FULL" />}
                  </li>
                );
              })}
            </ul>
          ) : (
            <PanelEmpty>
              You have no upcoming departure dates, so travellers cannot book yet.{" "}
              <Link to="/departures" className="font-medium text-foreground underline underline-offset-4">
                Add a departure date
              </Link>
            </PanelEmpty>
          )}
        </Panel>

        <Panel title="Your most popular trips" href="/trips">
          {isLoading ? (
            <ListSkeleton />
          ) : data?.topActivities.length ? (
            <ul className="divide-y">
              {data.topActivities.map((t, i) => (
                <li key={t.id}>
                  <Link to={`/trips/${t.id}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/40">
                    <span className="w-4 text-sm text-muted-foreground tabular-nums">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title ?? "Untitled trip (no title yet)"}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{t.views.toLocaleString()} page views on your website</p>
                    </div>
                    {t.averageRating > 0 && (
                      <span className="inline-flex items-center gap-1 text-sm tabular-nums">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" />
                        {t.averageRating.toFixed(1)}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <PanelEmpty>Once you publish a trip, the trips travellers view and rate most will be ranked here.</PanelEmpty>
          )}
        </Panel>
      </div>
    </div>
  );
}
