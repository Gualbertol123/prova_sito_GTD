import { useCallback, useEffect, useRef, useState } from "react";

// -----------------------------------------------------------------------------
// The browser's Back and Forward buttons.
//
// Where you are lives in the URL hash, so every tab (and an open project, or a
// page inside the phone's More tab) is its own history entry:
//
//     #/board   #/projects   #/projects/<id>   #/more/weekly …
//
// and a reload or a shared link opens the same place. Sheets and pop-ups add
// an entry of their own (same URL, marked in history.state), so Back closes
// the one on top before it leaves the page.
// -----------------------------------------------------------------------------

export interface Route {
  tab: string;
  sub?: string;
}

const ROUTE_EVENT = "gtd-route";

export function readRoute(): Route {
  const raw = window.location.hash.replace(/^#\/?/, "");
  if (!raw) return { tab: "" };
  const [tab, ...rest] = raw.split("/");
  return { tab: safeDecode(tab), sub: rest.length ? safeDecode(rest.join("/")) : undefined };
}

export function routeHash(r: Route): string {
  return "#/" + encodeURIComponent(r.tab) + (r.sub ? "/" + encodeURIComponent(r.sub) : "");
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Go somewhere: a new history entry (or, with replace, rewrite this one). */
export function navigate(r: Route, opts: { replace?: boolean } = {}): void {
  const hash = routeHash(r);
  if (hash === window.location.hash) return;
  // Remember where this entry came from, so an in-app "back" can step back
  // through history instead of piling up entries.
  const state = { from: window.location.hash || null };
  if (opts.replace) window.history.replaceState(state, "", hash);
  else window.history.pushState(state, "", hash);
  window.dispatchEvent(new Event(ROUTE_EVENT));
}

/** An in-app back button: history Back when it leads to `to`, else go there. */
export function goBackTo(to: Route): void {
  const state = window.history.state as { from?: string | null } | null;
  if (state && state.from === routeHash(to)) window.history.back();
  else navigate(to, { replace: true });
}

/** The current route, kept in step with Back / Forward and navigate(). */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(readRoute);
  useEffect(() => {
    const sync = () =>
      setRoute((cur) => {
        const next = readRoute();
        return cur.tab === next.tab && cur.sub === next.sub ? cur : next;
      });
    window.addEventListener("popstate", sync);
    window.addEventListener(ROUTE_EVENT, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(ROUTE_EVENT, sync);
    };
  }, []);
  return route;
}

// ---- Overlays ---------------------------------------------------------------

let overlaySeq = 0;
// Entries left behind by an overlay closed while a newer one sat on top of it
// (history cannot drop an entry from the middle). Back skips over them.
const deadOverlays = new Set<number>();
let skipperInstalled = false;

function overlayOf(state: unknown): number {
  const v = (state as { overlay?: unknown } | null)?.overlay;
  return typeof v === "number" ? v : 0;
}

function installSkipper(): void {
  if (skipperInstalled) return;
  skipperInstalled = true;
  window.addEventListener("popstate", (e) => {
    const id = overlayOf(e.state);
    if (id && deadOverlays.has(id)) {
      deadOverlays.delete(id);
      window.history.back();
    }
  });
}

/**
 * While the calling component is mounted it owns a history entry, and the
 * browser's Back calls onClose instead of leaving the page. Closing it any
 * other way (×, a swipe, Escape) removes the entry again.
 */
export function useBackClose(onClose: () => void): void {
  const close = useRef(onClose);
  close.current = onClose;
  const entry = useRef<number | null>(null);
  const mounted = useRef(false);
  const closedByBack = useRef(false);

  useEffect(() => {
    installSkipper();
    mounted.current = true;
    // React's development double-mount re-runs this effect; keep one entry.
    if (entry.current === null) {
      entry.current = ++overlaySeq;
      const prev = (window.history.state as Record<string, unknown> | null) ?? {};
      window.history.pushState({ ...prev, overlay: entry.current }, "");
    }
    const id = entry.current;

    const onPop = (e: PopStateEvent) => {
      if (closedByBack.current) return;
      if (overlayOf(e.state) < id) {
        closedByBack.current = true;
        close.current();
      }
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      mounted.current = false;
      // Wait a tick: a development re-mount comes straight back.
      setTimeout(() => {
        if (mounted.current || closedByBack.current) return;
        if (overlayOf(window.history.state) === id) window.history.back();
        else deadOverlays.add(id);
      }, 0);
    };
  }, []);
}

/** For a screen whose sub-view should follow the URL (see ProjectsView). */
export function useRouteSub(tab: string): [string | undefined, (sub?: string, opts?: { replace?: boolean }) => void] {
  const route = useRoute();
  const sub = route.tab === tab ? route.sub : undefined;
  const set = useCallback((s?: string, opts?: { replace?: boolean }) => navigate({ tab, sub: s }, opts), [tab]);
  return [sub, set];
}
