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
          <AlertDialogTitle>{state?.title ?? "Are you sure you want to continue?"}</AlertDialogTitle>
          {state?.description ? (
            <AlertDialogDescription>{state.description}</AlertDialogDescription>
          ) : (
            <AlertDialogDescription>This cannot be undone. Once you confirm, it is gone for good.</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{state?.cancelLabel ?? "No, go back"}</AlertDialogCancel>
          <AlertDialogAction
            variant={state?.destructive === false ? "default" : "destructive"}
            onClick={() => {
              state?.onConfirm();
              setState(null);
            }}
          >
            {state?.confirmLabel ?? "Yes, delete it"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
