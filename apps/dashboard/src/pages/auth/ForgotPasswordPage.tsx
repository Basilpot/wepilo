import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, useErrorMessage } from "./shared";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { error, capture } = useErrorMessage();

  const submit = useMutation({
    mutationFn: () => api("/auth/forget-password", { body: { email } }),
    onSuccess: () => setSent(true),
    onError: capture,
  });

  return (
    <AuthCard
      title="Forgot your password?"
      description="Type the email address you sign in with. We will email you a link that lets you choose a new password."
      footer={
        <Link to="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Go back to the sign in page
        </Link>
      }
    >
      {sent ? (
        <p className="text-sm text-muted-foreground">
          If an account exists for <span className="font-medium text-foreground">{email}</span>, we have sent a link to choose a new password. It can take a few minutes to arrive, so check your spam or junk folder too.
        </p>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); submit.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Your email address</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={submit.isPending}>
            {submit.isPending ? "Sending the link…" : "Email me a reset link"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
