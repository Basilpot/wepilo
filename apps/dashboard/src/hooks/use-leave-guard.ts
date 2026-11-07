import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { confirmDialog } from "@/components/confirm";

/** Used by the browser's own "Leave site?" prompt when a tab is closed or reloaded. Browsers show their own wording there. */
export const LEAVE_MESSAGE = "You have unsaved changes. Leave without saving?";

const ASK = {
  title: "Leave without saving?",
  description: "You have changes that haven't been saved. If you leave now, they will be lost.",
  confirmLabel: "Leave",
  cancelLabel: "Keep editing",
} as const;

/**
 * Warns before unsaved work is lost. Closing or reloading the tab triggers the browser's own prompt, which a page
 * cannot restyle. Everything inside the app uses our dialog: BrowserRouter has no useBlocker, so link clicks are
 * caught in the capture phase before react-router sees them. Buttons that navigate in code call the returned
 * function with what should happen once the person agrees to leave.
 */
export function useLeaveGuard(dirty: boolean) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = LEAVE_MESSAGE;
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]");
      if (!anchor || anchor.getAttribute("target") === "_blank") return;
      const url = new URL((anchor as HTMLAnchorElement).href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      confirmDialog(ASK, () => navigate(`${url.pathname}${url.search}${url.hash}`));
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, navigate]);

  /** Runs `leave` straight away when nothing is unsaved, otherwise after the person confirms. */
  return useCallback((leave: () => void) => (dirty ? confirmDialog(ASK, leave) : leave()), [dirty]);
}
