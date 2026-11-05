import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, useAuthRedirect, useErrorMessage } from "./shared";

const schema = z
  .object({
    companyName: z.string().min(2),
    slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "lowercase letters, numbers and dashes only"),
    email: z.string().email(),
    password: z.string().min(8, "Your password must be at least 8 characters long"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "The two passwords you typed are not the same. Type the same password in both boxes.",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export function SignupPage() {
  const redirect = useAuthRedirect();
  const { error, capture } = useErrorMessage();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { companyName: "", slug: "", email: "", password: "", confirmPassword: "" },
  });

  const signup = useMutation({
    mutationFn: (values: FormValues) =>
      api("/auth/tenant/signup", {
        body: {
          companyName: values.companyName,
          slug: values.slug,
          email: values.email,
          password: values.password,
        },
      }),
    onSuccess: redirect,
    onError: capture,
  });

  return (
    <AuthCard
      title="Create your Wepilo workspace"
      description="First, create your workspace here. Next, you start a 3-day trial for a one-time payment of $1. It is not a subscription, and nothing renews automatically."
      footer={
        <>
          Already have a workspace?{" "}
          <Link to="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={form.handleSubmit((v) => signup.mutate(v))} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="companyName">Your company name</Label>
          <Input
            id="companyName"
            required
            {...form.register("companyName", {
              onChange: (e) => {
                // Suggest a web address until the person edits it themselves.
                if (!form.getFieldState("slug").isDirty) {
                  const slug = String(e.target.value)
                    .toLowerCase()
                    .normalize("NFKD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-+|-+$/g, "")
                    .slice(0, 60);
                  form.setValue("slug", slug, { shouldDirty: false });
                }
              },
            })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Your workspace address</Label>
          <Input id="slug" placeholder="acme-expeditions" required {...form.register("slug")} />
          <p className="text-xs text-muted-foreground">Use only lowercase letters, numbers and dashes, with no spaces. It becomes your workspace’s unique name in links. It is filled in for you from your company name, and you can change it.</p>
          {form.formState.errors.slug && (
            <p className="text-sm text-destructive">{form.formState.errors.slug.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Your email address</Label>
          <Input id="email" type="email" autoComplete="email" required {...form.register("email")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Choose a password (at least 8 characters)</Label>
          <Input id="password" type="password" autoComplete="new-password" required {...form.register("password")} />
          {form.formState.errors.password && (
            <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Type the same password again</Label>
          <Input id="confirmPassword" type="password" autoComplete="new-password" required {...form.register("confirmPassword")} />
          {form.formState.errors.confirmPassword && (
            <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={signup.isPending}>
          {signup.isPending ? "Creating your workspace…" : "Create my workspace"}
        </Button>
      </form>
    </AuthCard>
  );
}
