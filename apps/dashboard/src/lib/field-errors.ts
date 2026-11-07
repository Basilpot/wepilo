import { useSyncExternalStore } from "react";

/**
 * Per-field problems from the last request the server rejected as invalid, for example { name: "This is required." }.
 * The Field component reads these, so any form shows each message under its own input without extra wiring.
 */
let current: Record<string, string> = {};
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export function setFieldErrors(next: Record<string, string>) {
  current = next;
  emit();
}

export function clearFieldErrors() {
  if (Object.keys(current).length === 0) return;
  current = {};
  emit();
}

export function clearFieldError(key: string) {
  if (!(key in current)) return;
  const { [key]: _removed, ...rest } = current;
  current = rest;
  emit();
}

export function useFieldError(key: string): string | undefined {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current[key],
    () => undefined,
  );
}
