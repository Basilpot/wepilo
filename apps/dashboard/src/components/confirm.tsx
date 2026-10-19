import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ConfirmOptions = {
  title?: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

export type ConfirmFn = (options: ConfirmOptions, onConfirm: () => void) => void;

type ConfirmState = ConfirmOptions & { onConfirm: () => void };

let setExternal: ((state: ConfirmState) => void) | null = null;

export const confirmDialog: ConfirmFn = (options, onConfirm) => {
  setExternal?.({ ...options, onConfirm });
};

export function ConfirmHost() {
  const [state, setState] = useState<ConfirmState | null>(null);

  useEffect(() => {
    setExternal = setState;
    return () => {
      setExternal = null;
    };
  }, []);

  return (
    <AlertDialog
      open={state !== null}
      onOpenChange={(open) => {
        if (!open) setState(null);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state?.title ?? "Are you sure?"}</AlertDialogTitle>
          {state?.description ? (
            <AlertDialogDescription>{state.description}</AlertDialogDescription>
          ) : (
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{state?.cancelLabel ?? "Cancel"}</AlertDialogCancel>
          <AlertDialogAction
            variant={state?.destructive === false ? "default" : "destructive"}
            onClick={() => {
              state?.onConfirm();
              setState(null);
            }}
          >
            {state?.confirmLabel ?? "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
