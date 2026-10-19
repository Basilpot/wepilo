import { useCallback, useEffect } from "react";

export const LEAVE_MESSAGE = "You have unsaved changes. Leave without saving?";

/**
 * Warns before unsaved work is lost: on tab close/reload (beforeunload) and on
 * in-app link clicks. BrowserRouter has no useBlocker, so link clicks are
 * caught in the capture phase before react-router sees them. Buttons that
 * navigate in code should call the returned `confirmLeave()` first.
 */
export function useLeaveGuard(dirty: boolean) {
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
      if (!window.confirm(LEAVE_MESSAGE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  return useCallback(() => !dirty || window.confirm(LEAVE_MESSAGE), [dirty]);
}
