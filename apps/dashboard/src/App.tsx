import { Suspense, lazy, useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { setDefaultCurrency } from "@/lib/format";
import { AppShell } from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginPage } from "@/pages/auth/LoginPage";
import { SignupPage } from "@/pages/auth/SignupPage";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";
import type { Access } from "@/pages/billing/billing";

// Each screen loads on first visit, so the first paint ships only the shell and sign-in.
const HomePage = lazy(() => import("@/pages/HomePage").then((m) => ({ default: m.HomePage })));
const TripsPage = lazy(() => import("@/pages/trips/TripsPage").then((m) => ({ default: m.TripsPage })));
const TripEditorPage = lazy(() => import("@/pages/trips/TripEditorPage").then((m) => ({ default: m.TripEditorPage })));
const DeparturesPage = lazy(() => import("@/pages/DeparturesPage").then((m) => ({ default: m.DeparturesPage })));
const BookingsPage = lazy(() => import("@/pages/BookingsPage").then((m) => ({ default: m.BookingsPage })));
const InquiriesPage = lazy(() => import("@/pages/InquiriesPage").then((m) => ({ default: m.InquiriesPage })));
const PostsPage = lazy(() => import("@/pages/content/PostsPage").then((m) => ({ default: m.PostsPage })));
const PostEditorPage = lazy(() => import("@/pages/content/PostEditorPage").then((m) => ({ default: m.PostEditorPage })));
const InfoPagesPage = lazy(() => import("@/pages/content/InfoPagesPage").then((m) => ({ default: m.InfoPagesPage })));
const InfoPageEditorPage = lazy(() => import("@/pages/content/InfoPageEditorPage").then((m) => ({ default: m.InfoPageEditorPage })));
const PageCategoriesPage = lazy(() => import("@/pages/content/PageCategoriesPage").then((m) => ({ default: m.PageCategoriesPage })));
const MediaPage = lazy(() => import("@/pages/content/MediaPage").then((m) => ({ default: m.MediaPage })));
const RedirectsPage = lazy(() => import("@/pages/content/RedirectsPage").then((m) => ({ default: m.RedirectsPage })));
const TeamPage = lazy(() => import("@/pages/content/TeamHubPage").then((m) => ({ default: m.TeamHubPage })));
const DepartmentsPage = lazy(() => import("@/pages/content/DepartmentsPage").then((m) => ({ default: m.DepartmentsPage })));
const DocumentsPage = lazy(() => import("@/pages/content/DocumentsPage").then((m) => ({ default: m.DocumentsPage })));
const TestimonialsPage = lazy(() => import("@/pages/content/TestimonialsPage").then((m) => ({ default: m.TestimonialsPage })));
const ReviewsPage = lazy(() => import("@/pages/ReviewsPage").then((m) => ({ default: m.ReviewsPage })));
const AuthorsPage = lazy(() => import("@/pages/content/AuthorsPage").then((m) => ({ default: m.AuthorsPage })));
const TaxonomyPage = lazy(() => import("@/pages/catalog/TaxonomyPage").then((m) => ({ default: m.TaxonomyPage })));
const FeaturedTagsPage = lazy(() => import("@/pages/catalog/FeaturedTagsPage").then((m) => ({ default: m.FeaturedTagsPage })));
const FeaturedTripsPage = lazy(() => import("@/pages/catalog/FeaturedTripsPage").then((m) => ({ default: m.FeaturedTripsPage })));
const ExtrasPage = lazy(() => import("@/pages/catalog/ExtrasPage").then((m) => ({ default: m.ExtrasPage })));
const NewsletterPage = lazy(() => import("@/pages/NewsletterPage").then((m) => ({ default: m.NewsletterPage })));
const WebsitePage = lazy(() => import("@/pages/website/WebsitePage").then((m) => ({ default: m.WebsitePage })));
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const SupportPage = lazy(() => import("@/pages/support/SupportPage").then((m) => ({ default: m.SupportPage })));
const SupportTicketPage = lazy(() => import("@/pages/support/SupportTicketPage").then((m) => ({ default: m.SupportTicketPage })));
const BillingReturnPage = lazy(() => import("@/pages/billing/PaywallPage").then((m) => ({ default: m.BillingReturnPage })));
const PaywallPage = lazy(() => import("@/pages/billing/PaywallPage").then((m) => ({ default: m.PaywallPage })));
const PublicReviewPage = lazy(() => import("@/pages/reviews/PublicReviewPage").then((m) => ({ default: m.PublicReviewPage })));
const AdminApp = lazy(() => import("@/pages/admin/AdminApp").then((m) => ({ default: m.AdminApp })));
const ConnectPage = lazy(() => import("@/pages/connect/ConnectPage").then((m) => ({ default: m.ConnectPage })));

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
    currency?: string;
    currencyTranslation?: boolean;
  } | null;
  access: Access | null;
};

export async function fetchSession(): Promise<Session | null> {
  try {
    const session = await api<Session>("/auth/me");
    setDefaultCurrency(session.tenant?.currency);
    return session;
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
  // The trip editor is a focused full-screen workspace: no app sidebar, it scrolls on its own.
  if (/^\/trips\/(new|\d+)$/.test(pathname)) {
    return (
      <Suspense fallback={<PageFallback />}>
        <Outlet key={pathname} />
      </Suspense>
    );
  }
  return (
    <AppShell session={data}>
      {/* Pages remount per route (settings tabs share one), the shell around them does not. */}
      <Suspense fallback={<PageFallback />}>
        <Outlet key={pathname.startsWith("/settings") ? "/settings" : pathname} />
      </Suspense>
    </AppShell>
  );
}

function PageFallback() {
  return (
    <div className="space-y-4 p-6" aria-busy="true">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/setup-account" element={<ResetPasswordPage setup />} />
      <Route path="/admin/*" element={<AdminApp />} />
      <Route path="/connect" element={<ConnectPage />} />
      <Route path="/review/:token" element={<PublicReviewPage />} />
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
        <Route path="/departments" element={<Navigate to="/team?tab=departments" replace />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/testimonials" element={<TestimonialsPage />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/authors" element={<Navigate to="/settings/staff" replace />} />
        <Route path="/locations" element={<TaxonomyPage />} />
        <Route path="/trip-categories" element={<TaxonomyPage initialTab="categories" />} />
        <Route path="/featured-tags" element={<FeaturedTagsPage />} />
        <Route path="/featured-trips" element={<FeaturedTripsPage />} />
        <Route path="/extras" element={<ExtrasPage />} />
        <Route path="/newsletter" element={<NewsletterPage />} />
        <Route path="/website" element={<WebsitePage />} />
        <Route path="/settings/*" element={<SettingsPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/support/:id" element={<SupportTicketPage />} />
        <Route path="/billing/return" element={<></>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
