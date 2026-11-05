import { ApiClientError } from "@/lib/api";

export function useErrorMessage() {
  return (err: unknown) =>
    err instanceof ApiClientError ? err.message : "Something went wrong";
}
