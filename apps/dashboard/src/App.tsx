import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
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

export type Session = {
  staff: { id: number; name: string; email: string; role: string };
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

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useSession();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    const onUnauthorized = () => navigate("/login", { replace: true });
    const onPaymentRequired = () => queryClient.invalidateQueries({ queryKey: ["session"] });
    window.addEventListener("narfu:unauthorized", onUnauthorized);
    window.addEventListener("narfu:payment-required", onPaymentRequired);
    return () => {
      window.removeEventListener("narfu:unauthorized", onUnauthorized);
      window.removeEventListener("narfu:payment-required", onPaymentRequired);
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
  return <AppShell session={data}>{children}</AppShell>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/trips"
        element={
          <RequireAuth>
            <TripsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/trips/new"
        element={
          <RequireAuth>
            <TripEditorPage mode="create" />
          </RequireAuth>
        }
      />
      <Route
        path="/trips/:id"
        element={
          <RequireAuth>
            <TripEditorPage mode="edit" />
          </RequireAuth>
        }
      />
      <Route
        path="/departures"
        element={
          <RequireAuth>
            <DeparturesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/bookings"
        element={
          <RequireAuth>
            <BookingsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/inquiries"
        element={
          <RequireAuth>
            <InquiriesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/posts"
        element={
          <RequireAuth>
            <PostsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/posts/:id"
        element={
          <RequireAuth>
            <PostEditorPage />
          </RequireAuth>
        }
      />
      <Route
        path="/info-pages"
        element={
          <RequireAuth>
            <InfoPagesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/info-pages/:id"
        element={
          <RequireAuth>
            <InfoPageEditorPage />
          </RequireAuth>
        }
      />
      <Route
        path="/page-categories"
        element={
          <RequireAuth>
            <PageCategoriesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/media"
        element={
          <RequireAuth>
            <MediaPage />
          </RequireAuth>
        }
      />
      <Route
        path="/redirects"
        element={
          <RequireAuth>
            <RedirectsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/team"
        element={
          <RequireAuth>
            <TeamPage />
          </RequireAuth>
        }
      />
      <Route
        path="/departments"
        element={
          <RequireAuth>
            <DepartmentsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/documents"
        element={
          <RequireAuth>
            <DocumentsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/testimonials"
        element={
          <RequireAuth>
            <TestimonialsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/reviews"
        element={
          <RequireAuth>
            <ReviewsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/authors"
        element={
          <RequireAuth>
            <AuthorsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/locations"
        element={
          <RequireAuth>
            <TaxonomyPage />
          </RequireAuth>
        }
      />
      <Route
        path="/trip-categories"
        element={
          <RequireAuth>
            <TaxonomyPage initialTab="categories" />
          </RequireAuth>
        }
      />
      <Route
        path="/featured-tags"
        element={
          <RequireAuth>
            <FeaturedTagsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/featured-trips"
        element={
          <RequireAuth>
            <FeaturedTripsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/extras"
        element={
          <RequireAuth>
            <ExtrasPage />
          </RequireAuth>
        }
      />
      <Route
        path="/newsletter"
        element={
          <RequireAuth>
            <NewsletterPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings/*"
        element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/support"
        element={
          <RequireAuth>
            <SupportPage />
          </RequireAuth>
        }
      />
      <Route
        path="/support/:id"
        element={
          <RequireAuth>
            <SupportTicketPage />
          </RequireAuth>
        }
      />
      <Route
        path="/billing/return"
        element={
          <RequireAuth>
            <></>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
