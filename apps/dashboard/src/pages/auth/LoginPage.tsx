import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, useAuthRedirect, useErrorMessage } from "./shared";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const redirect = useAuthRedirect();
  const { error, capture } = useErrorMessage();
  const [params] = useSearchParams();
  const welcome = params.get("welcome") === "1";
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: params.get("email") ?? "", password: "" },
  });

  const login = useMutation({
    mutationFn: (values: FormValues) => api("/auth/tenant/login", { body: values }),
    onSuccess: redirect,
    onError: capture,
  });

  return (
    <AuthCard
      title={welcome ? "Your password is saved" : "Sign in to your dashboard"}
      description={welcome ? "Now sign in with your email and the password you just chose to open your workspace." : "Enter your email address and password to open your Wepilo workspace."}
      footer={
        <>
          You do not have a workspace yet?{" "}
          <Link to="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
            Create a workspace and start a trial
          </Link>
        </>
      }
    >
      <form onSubmit={form.handleSubmit((v) => login.mutate(v))} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Your email address</Label>
          <Input id="email" type="email" autoComplete="email" required {...form.register("email")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Your password</Label>
          <Input id="password" type="password" autoComplete="current-password" required {...form.register("password")} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? "Signing you in…" : "Sign in"}
        </Button>
        <p className="text-center text-sm">
          <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground">
            I forgot my password
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
