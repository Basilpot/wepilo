import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, useErrorMessage } from "./shared";

const schema = z.object({
  password: z.string().min(8, "At least 8 characters"),
  confirmPassword: z.string(),
}).refine((v) => v.password === v.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type FormValues = z.infer<typeof schema>;

type LinkInfo = { purpose: "SETUP" | "RESET"; email: string; name: string; companyName: string | null };

/** Password reset, and (with `setup`) the first password for a workspace handed over by the Wepilo team. */
export function ResetPasswordPage({ setup = false }: { setup?: boolean }) {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const { error, capture } = useErrorMessage();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const link = useQuery({
    queryKey: ["link-info", token],
    queryFn: () => api<LinkInfo>("/auth/link-info", { query: { token } }),
    enabled: Boolean(token),
    retry: false,
  });

  const reset = useMutation({
    mutationFn: (values: FormValues) =>
      api<{ email: string }>("/auth/reset-password", { body: { token, password: values.password } }),
    onSuccess: (r) => navigate(`/login?email=${encodeURIComponent(r.email)}${setup ? "&welcome=1" : ""}`, { replace: true }),
    onError: capture,
  });

  const info = link.data;
  const isSetup = setup || info?.purpose === "SETUP";
  const title = isSetup ? "Set up your account" : "Set new password";
  const description = isSetup
    ? info
      ? `${info.companyName ?? "Your workspace"} is ready. Choose a password for ${info.email}.`
      : "Choose a password to take over your workspace."
    : info
      ? `Choose a new password for ${info.email}.`
      : "Choose a new password for your account.";

  return (
    <AuthCard
      title={title}
      description={description}
      footer={
        <Link to="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {!token || link.isError ? (
        <p className="text-sm text-destructive">
          {isSetup
            ? "This setup link has expired or was already used. Ask your Wepilo contact for a new one."
            : "This reset link has expired or was already used. Request a new one."}
        </p>
      ) : link.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : (
        <form onSubmit={form.handleSubmit((v) => reset.mutate(v))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{isSetup ? "Password" : "New password"}</Label>
            <Input id="password" type="password" autoComplete="new-password" required {...form.register("password")} />
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input id="confirmPassword" type="password" autoComplete="new-password" required {...form.register("confirmPassword")} />
            {form.formState.errors.confirmPassword && (
              <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={reset.isPending}>
            {reset.isPending ? "Saving…" : isSetup ? "Set password and continue" : "Save password"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
