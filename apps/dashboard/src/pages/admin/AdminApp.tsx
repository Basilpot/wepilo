import { useState } from "react";
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldCheck } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminSession, type PlatformAdmin } from "./admin-api";
import { WorkspacesPage } from "./WorkspacesPage";
import { NewWorkspacePage } from "./NewWorkspacePage";
import { WorkspaceDetailPage } from "./WorkspaceDetailPage";
import { AdminsPage } from "./AdminsPage";

/** Wepilo's internal console under /admin. Uses its own login, separate from workspace sessions. */
export function AdminApp() {
  return (
    <Routes>
      <Route path="login" element={<AdminLoginPage />} />
      <Route path="*" element={<RequireAdmin />} />
    </Routes>
  );
}

function RequireAdmin() {
  const { data: admin, isLoading } = useAdminSession();
  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center gap-3">
        <Skeleton className="h-8 w-8 rounded-xl" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }
  if (!admin) return <Navigate to="/admin/login" replace />;
  return (
    <AdminShell admin={admin}>
      <Routes>
        <Route index element={<Navigate to="workspaces" replace />} />
        <Route path="workspaces" element={<WorkspacesPage />} />
        <Route path="workspaces/new" element={<NewWorkspacePage />} />
        <Route path="workspaces/:id" element={<WorkspaceDetailPage />} />
        <Route path="admins" element={<AdminsPage me={admin} />} />
        <Route path="*" element={<Navigate to="workspaces" replace />} />
      </Routes>
    </AdminShell>
  );
}

function AdminShell({ admin, children }: { admin: PlatformAdmin; children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const signOut = async () => {
    await api("/platform/auth/logout", { method: "POST" }).catch(() => {});
    queryClient.removeQueries({ queryKey: ["platform"] });
    navigate("/admin/login", { replace: true });
  };
  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
      isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 md:px-8">
          <Link to="/admin/workspaces" className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-foreground text-background">
              <ShieldCheck className="size-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">Wepilo</span>
            <span className="hidden text-sm text-muted-foreground sm:inline">Platform</span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/admin/workspaces" className={navClass}>
              Workspaces
            </NavLink>
            <NavLink to="/admin/admins" className={navClass}>
              Admins
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground md:inline">{admin.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut />
              <span className="sr-only sm:not-sr-only">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}

function AdminLoginPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: () => api("/platform/auth/login", { body: { email, password } }),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["platform", "me"] });
      navigate("/admin/workspaces", { replace: true });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Something went wrong"),
  });

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-foreground text-background">
            <ShieldCheck className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">Wepilo Platform</span>
        </div>
        <h1 className="mt-6 text-xl font-semibold tracking-tight">Admin sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">For the Wepilo team. Agencies sign in at the main login.</p>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            login.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="admin-email">Email</Label>
            <Input id="admin-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password">Password</Label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
