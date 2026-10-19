import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastApiError } from "@/lib/api";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmHost } from "@/components/confirm";
import "./index.css";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { success?: string };
  }
}

// One place for mutation feedback: a mutation names its success message in
// `meta.success`; failures toast unless the mutation shows its own error.
const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: (_data, _vars, _ctx, mutation) => {
      if (mutation.meta?.success) toast.success(mutation.meta.success);
    },
    onError: (err, _vars, _ctx, mutation) => {
      if (mutation.options.onError) return;
      toastApiError(err);
    },
  }),
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <App />
        </ThemeProvider>
        <Toaster position="bottom-right" />
        <ConfirmHost />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
