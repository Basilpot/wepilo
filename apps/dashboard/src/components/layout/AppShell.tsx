import { useContext, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  ChevronsUpDown,
  CreditCard,
  ExternalLink,
  Globe,
  KeyRound,
  LifeBuoy,
  LogOut,
  Moon,
  Mountain,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { ThemeContext } from "@/components/theme-provider";
import { CommandMenu } from "@/components/layout/CommandMenu";
import { NAV_GROUPS, QUICK_LINKS, findNavItem, isActive, type NavItem } from "@/components/layout/nav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PLAN_NAMES, daysLeft, useBillingPortal } from "@/pages/billing/billing";
import type { Session } from "@/App";

const COLLAPSED_KEY = "narfu-nav-collapsed";

function readCollapsed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"
  );
}

function planLabel(session: Session) {
  const a = session.access;
  if (!a) return "—";
  return a.state === "TRIAL" ? `${PLAN_NAMES[a.plan]} trial` : PLAN_NAMES[a.plan];
}

async function signOut() {
  await api("/auth/logout", { method: "POST" }).catch(() => {});
  window.location.href = "/login";
}

function useNewInquiries() {
  const { pathname } = useLocation();
  const { data, refetch } = useQuery({
    queryKey: ["inquiries", "new-count"],
    queryFn: () =>
      api<{ pagination: { total: number } }>("/inquiries", { query: { status: "NEW", limit: 1 } }),
    staleTime: 30_000,
  });
  useEffect(() => {
    void refetch();
  }, [pathname, refetch]);
  return data?.pagination.total ?? 0;
}

function NavLinkItem({ item, badge }: { item: NavItem; badge?: number }) {
  const { pathname } = useLocation();
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={item.title} isActive={isActive(pathname, item.url)}>
        <Link to={item.url} onClick={() => setOpenMobile(false)}>
          <item.icon />
          <span>{item.title}</span>
          {badge ? <span className="sr-only">, {badge} new</span> : null}
        </Link>
      </SidebarMenuButton>
      {badge ? (
        <SidebarMenuBadge aria-hidden className="bg-primary/10 text-primary peer-data-[active=true]/menu-button:text-primary">
          {badge > 99 ? "99+" : badge}
        </SidebarMenuBadge>
      ) : null}
    </SidebarMenuItem>
  );
}

function WorkspaceHeader({ session }: { session: Session }) {
  const tenant = session.tenant;
  const name = tenant?.companyName ?? tenant?.slug ?? "Workspace";
  const paid = session.access?.state === "ACTIVE" || session.access?.state === "PAST_DUE";
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" asChild>
          <Link to="/">
            <div className="flex aspect-square size-8 items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground">
              {tenant?.companyLogo ? (
                <img src={tenant.companyLogo} alt="" className="size-full bg-background object-contain" />
              ) : (
                <Mountain className="size-4" />
              )}
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{name}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-xs">
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 font-medium whitespace-nowrap",
                    paid ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {planLabel(session)}
                </span>
                <span className="truncate text-muted-foreground">{tenant?.slug}</span>
              </span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function UserMenu({ session }: { session: Session }) {
  const { isMobile } = useSidebar();
  const { theme, setTheme } = useContext(ThemeContext);
  const user = session.staff;
  const avatar = (
    <Avatar className="size-8 rounded-lg">
      <AvatarImage src={undefined} alt="" />
      <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-semibold text-primary">
        {initials(user.name)}
      </AvatarFallback>
    </Avatar>
  );
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {avatar}
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-60 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={6}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                {avatar}
                <div className="grid flex-1 leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email} · {user.role.toLowerCase()}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link to="/settings">
                  <Settings />
                  Business profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings/billing">
                  <CreditCard />
                  Billing
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings/api-keys">
                  <KeyRound />
                  API keys
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/support">
                  <LifeBuoy />
                  Support
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <div className="flex items-center justify-between px-2 py-1.5 text-sm">
              <span className="text-muted-foreground">Theme</span>
              <div className="flex rounded-md border p-0.5">
                {(
                  [
                    ["light", Sun],
                    ["dark", Moon],
                  ] as const
                ).map(([value, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={`${value} theme`}
                    aria-pressed={theme === value}
                    onClick={() => setTheme(value)}
                    className={cn(
                      "flex size-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground",
                      theme === value && "bg-muted text-foreground",
                    )}
                  >
                    <Icon className="size-3.5" />
                  </button>
                ))}
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function AppSidebar({ session }: { session: Session }) {
  const newInquiries = useNewInquiries();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState<string[]>(readCollapsed);

  const toggleGroup = (label: string, open: boolean) => {
    setCollapsed((prev) => {
      const next = open ? prev.filter((l) => l !== label) : [...prev, label];
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        // storage blocked; collapse state just won't persist
      }
      return next;
    });
  };

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <WorkspaceHeader session={session} />
      </SidebarHeader>
      <SidebarContent className="gap-1">
        <SidebarGroup className="py-1">
          <SidebarGroupContent>
            <SidebarMenu>
              {QUICK_LINKS.map((item) => (
                <NavLinkItem
                  key={item.url}
                  item={item}
                  badge={item.url === "/inquiries" ? newInquiries : undefined}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {NAV_GROUPS.map((group) => {
          const hasActive = group.items.some((i) => isActive(pathname, i.url));
          const open = hasActive || !collapsed.includes(group.label);
          return (
            <Collapsible
              key={group.label}
              open={open}
              onOpenChange={(o) => toggleGroup(group.label, o)}
              className="group/collapsible"
            >
              <SidebarGroup className="py-1">
                <SidebarGroupLabel asChild className="group/label hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                  <CollapsibleTrigger>
                    {group.label}
                    <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => (
                        <NavLinkItem key={item.url} item={item} />
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>
      <SidebarFooter>
        <UserMenu session={session} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function BillingBanner({ session }: { session: Session }) {
  const access = session.access;
  const portal = useBillingPortal();
  if (!access) return null;
  const days = daysLeft(access.endsAt);
  const isOwner = session.staff.role === "OWNER";

  let tone: "warning" | "danger" = "warning";
  let text: string | null = null;
  let action: React.ReactNode = null;
  const billingLink = (label: string) => (
    <Link to="/settings/billing" className="font-medium underline underline-offset-4">
      {label}
    </Link>
  );

  if (access.state === "TRIAL") {
    text =
      days === 0
        ? "Your trial ends today."
        : `Your trial ends in ${days} day${days === 1 ? "" : "s"}. Nothing renews automatically.`;
    action = billingLink("Choose a plan");
  } else if (access.state === "PAST_DUE") {
    tone = "danger";
    text = "Your last payment failed. Update your card to keep access.";
    action = isOwner ? (
      <button type="button" className="font-medium underline underline-offset-4" onClick={() => portal.mutate()}>
        Update card
      </button>
    ) : null;
  } else if (access.cancelAtPeriodEnd && days !== null && days <= 14) {
    text = `Your plan is cancelled and ends in ${days} day${days === 1 ? "" : "s"}.`;
    action = billingLink("Renew");
  }
  if (!text) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b px-4 py-2 text-center text-sm",
        tone === "danger"
          ? "bg-destructive/10 text-destructive"
          : "bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200",
      )}
    >
      <span>{text}</span>
      {action}
    </div>
  );
}

function SiteHeader({ session, onSearch }: { session: Session; onSearch: () => void }) {
  const { pathname } = useLocation();
  const current = findNavItem(pathname);
  const website = session.tenant?.website;
  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="flex w-full items-center gap-1 px-3 lg:gap-2 lg:px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-1.5 data-[orientation=vertical]:h-4" />
        <span className="truncate text-sm font-medium">{current?.title ?? ""}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onSearch}
            className="hidden w-56 justify-start gap-2 px-2.5 font-normal text-muted-foreground md:flex"
          >
            <Search />
            <span className="flex-1 text-left">Search or jump to…</span>
            <kbd className="pointer-events-none rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </Button>
          <Button variant="ghost" size="icon" onClick={onSearch} className="md:hidden" aria-label="Search">
            <Search />
          </Button>
          {website ? (
            <Button asChild variant="outline" size="sm">
              <a href={website} target="_blank" rel="noopener noreferrer">
                <Globe />
                <span className="hidden sm:inline">View site</span>
                <ExternalLink className="hidden opacity-60 sm:inline" />
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function AppShell({ session, children }: { session: Session; children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const title = findNavItem(pathname)?.title;
    const company = session.tenant?.companyName ?? "Narfu";
    document.title = title ? `${title} · ${company}` : company;
  }, [pathname, session.tenant?.companyName]);

  return (
    <SidebarProvider>
      <AppSidebar session={session} />
      <SidebarInset className="min-w-0">
        <BillingBanner session={session} />
        <SiteHeader session={session} onSearch={() => setSearchOpen(true)} />
        <div className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </div>
      </SidebarInset>
      <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} onNavigate={(url) => navigate(url)} />
    </SidebarProvider>
  );
}
