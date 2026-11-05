import { ApiClientError } from "@/lib/api";

export function useErrorMessage() {
  return (err: unknown) =>
    err instanceof ApiClientError ? err.message : "Something went wrong on our side. Please try again in a moment.";
}
