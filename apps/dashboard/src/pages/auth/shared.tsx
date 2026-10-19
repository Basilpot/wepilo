import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiClientError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mountain } from "lucide-react";

const POINTS = [
  { title: "Trips, departures and bookings", body: "Itineraries, dates, seats and payments in one place." },
  { title: "A content API for your site", body: "Publish here, and your website updates on its own." },
  { title: "Inquiries that don't get lost", body: "Every form lands in one inbox with a one-click reply." },
];

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex flex-col px-6 py-8 md:px-12">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Mountain className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">Narfu</span>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">{footer}</div>}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Narfu</p>
      </div>
      <aside className="relative hidden overflow-hidden bg-[oklch(0.27_0.06_155)] text-white lg:flex lg:flex-col lg:justify-end">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div aria-hidden className="absolute -top-32 -right-32 size-[28rem] rounded-full bg-[oklch(0.62_0.17_150)] opacity-30 blur-3xl" />
        <div className="relative p-12 xl:p-16">
          <p className="max-w-md text-3xl leading-tight font-semibold tracking-tight">
            Run your travel agency's website from one dashboard.
          </p>
          <ul className="mt-10 max-w-md space-y-6">
            {POINTS.map((point) => (
              <li key={point.title} className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[oklch(0.8_0.15_150)]" />
                <div>
                  <p className="font-medium">{point.title}</p>
                  <p className="mt-0.5 text-sm text-white/65">{point.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

export function useAuthRedirect() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.refetchQueries({ queryKey: ["session"] });
    navigate("/", { replace: true });
  };
}

export function useErrorMessage() {
  const [error, setError] = useState<string | null>(null);
  const capture = (err: unknown) => {
    setError(err instanceof ApiClientError ? err.message : "Something went wrong");
  };
  return { error, setError, capture };
}

export { Link, Button, Input, Label };
