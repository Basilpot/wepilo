import { ApiClientError } from "@/lib/api";

export function useErrorMessage() {
  return (err: unknown) =>
    err instanceof ApiClientError
      ? // Each problem is shown under its own field. The banner only points people there.
        err.code === "VALIDATION" && err.fields
        ? "Please fix the highlighted fields and try again."
        : err.message
      : "Something went wrong and your change was not saved. Please try again.";
}
