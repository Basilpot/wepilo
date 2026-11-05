import { useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginPage } from "@/pages/auth/LoginPage";
import { SignupPage } from "@/pages/auth/SignupPage";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";
import { HomePage } from "@/pages/HomePage";
import { TripsPage } from "@/pages/trips/TripsPage";
import { TripEditorPage } from "@/pages/trips/TripEditorPage";
import { DeparturesPage } from "@/pages/DeparturesPage";
import { BookingsPage } from "@/pages/BookingsPage";
import { InquiriesPage } from "@/pages/InquiriesPage";
import { PostsPage } from "@/pages/content/PostsPage";
import { PostEditorPage } from "@/pages/content/PostEditorPage";
import { InfoPagesPage } from "@/pages/content/InfoPagesPage";
import { InfoPageEditorPage } from "@/pages/content/InfoPageEditorPage";
import { PageCategoriesPage } from "@/pages/content/PageCategoriesPage";
import { MediaPage } from "@/pages/content/MediaPage";
import { RedirectsPage } from "@/pages/content/RedirectsPage";
import { TeamPage } from "@/pages/content/TeamPage";
import { DepartmentsPage } from "@/pages/content/DepartmentsPage";
import { DocumentsPage } from "@/pages/content/DocumentsPage";
import { TestimonialsPage } from "@/pages/content/TestimonialsPage";
import { ReviewsPage } from "@/pages/ReviewsPage";
import { AuthorsPage } from "@/pages/content/AuthorsPage";
import { TaxonomyPage } from "@/pages/catalog/TaxonomyPage";
import { FeaturedTagsPage } from "@/pages/catalog/FeaturedTagsPage";
import { FeaturedTripsPage } from "@/pages/catalog/FeaturedTripsPage";
import { ExtrasPage } from "@/pages/catalog/ExtrasPage";
import { NewsletterPage } from "@/pages/NewsletterPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { SupportPage } from "@/pages/support/SupportPage";
import { SupportTicketPage } from "@/pages/support/SupportTicketPage";
import { BillingReturnPage, PaywallPage } from "@/pages/billing/PaywallPage";
import type { Access } from "@/pages/billing/billing";
import { AdminApp } from "@/pages/admin/AdminApp";
import { ConnectPage } from "@/pages/connect/ConnectPage";

export type Session = {
  staff: { id: number; name: string; email: string; role: string };
  /** Platform admin id when a Wepilo admin opened this workspace as its owner. */
  impersonatedBy: number | null;
  tenant: {
    id: number;
    email: string;
    companyName: string | null;
    companyLogo: string | null;
    website: string | null;
    companyDescription: string | null;
    phone: string | null;
    address: string | null;
    slug: string;
    status: string;
    plan: string;
    planExpiresAt: string | null;
  } | null;
  access: Access | null;
};

export async function fetchSession(): Promise<Session | null> {
  try {
    return await api<Session>("/auth/me");
  } catch {
    return null;
  }
}

export function useSession() {
  return useQuery({ queryKey: ["session"], queryFn: fetchSession, staleTime: 60_000 });
}

/** Signed-in layout: the shell mounts once and stays while pages change inside it. */
function RequireAuth() {
  const { data, isLoading } = useSession();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    const onUnauthorized = () => navigate("/login", { replace: true });
    const onPaymentRequired = () => queryClient.invalidateQueries({ queryKey: ["session"] });
    window.addEventListener("wepilo:unauthorized", onUnauthorized);
    window.addEventListener("wepilo:payment-required", onPaymentRequired);
    return () => {
      window.removeEventListener("wepilo:unauthorized", onUnauthorized);
      window.removeEventListener("wepilo:payment-required", onPaymentRequired);
    };
  }, [navigate, queryClient]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3">
        <Skeleton className="h-8 w-8 rounded-xl" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }
  if (!data) return <Navigate to="/login" replace />;
  if (pathname === "/billing/return") return <BillingReturnPage session={data} />;
  // No dashboard without a paid trial or plan.
  if (data.access?.locked) return <PaywallPage session={data} />;
  return (
    <AppShell session={data}>
      {/* Pages remount per route (settings tabs share one), the shell around them does not. */}
      <Outlet key={pathname.startsWith("/settings") ? "/settings" : pathname} />
    </AppShell>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/setup-account" element={<ResetPasswordPage setup />} />
      <Route path="/admin/*" element={<AdminApp />} />
      <Route path="/connect" element={<ConnectPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/trips" element={<TripsPage />} />
        <Route path="/trips/new" element={<TripEditorPage mode="create" />} />
        <Route path="/trips/:id" element={<TripEditorPage mode="edit" />} />
        <Route path="/departures" element={<DeparturesPage />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="/inquiries" element={<InquiriesPage />} />
        <Route path="/posts" element={<PostsPage />} />
        <Route path="/posts/:id" element={<PostEditorPage />} />
        <Route path="/info-pages" element={<InfoPagesPage />} />
        <Route path="/info-pages/:id" element={<InfoPageEditorPage />} />
        <Route path="/page-categories" element={<PageCategoriesPage />} />
        <Route path="/media" element={<MediaPage />} />
        <Route path="/redirects" element={<RedirectsPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/departments" element={<DepartmentsPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/testimonials" element={<TestimonialsPage />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/authors" element={<AuthorsPage />} />
        <Route path="/locations" element={<TaxonomyPage />} />
        <Route path="/trip-categories" element={<TaxonomyPage initialTab="categories" />} />
        <Route path="/featured-tags" element={<FeaturedTagsPage />} />
        <Route path="/featured-trips" element={<FeaturedTripsPage />} />
        <Route path="/extras" element={<ExtrasPage />} />
        <Route path="/newsletter" element={<NewsletterPage />} />
        <Route path="/settings/*" element={<SettingsPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/support/:id" element={<SupportTicketPage />} />
        <Route path="/billing/return" element={<></>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
