import { useEffect, useState } from "react";

// -----------------------------------------------------------------------------
// The installable app (PWA): service worker registration and "Install".
//
// public/manifest.webmanifest describes the app; public/sw.js caches its code
// (never board data). Chrome / Edge / Android offer an install prompt, which
// is kept here so the app can show its own "Install" button; iPhone and iPad
// have no prompt, so they get a hint instead (Share → Add to Home Screen).
// -----------------------------------------------------------------------------

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Call once at start-up, before React renders. */
export function initPwa(): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // our own button asks, at a better moment
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });

  // Production only: in development a cached shell would hide changes.
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* not supported here (private mode, old browser): the site works as before */
      });
    });
  }
}

/** Running as the installed app (home-screen icon), not in a browser tab. */
export function isStandalone(): boolean {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

/** iPhone / iPad (including iPadOS, which reports itself as a Mac). */
export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export interface InstallState {
  /** Already running as the installed app. */
  installed: boolean;
  /** The browser offers an install prompt (Chrome, Edge, Android). */
  canPrompt: boolean;
  /** iOS: no prompt, show the Share → Add to Home Screen hint. */
  iosHint: boolean;
  prompt: () => Promise<boolean>;
}

export function useInstall(): InstallState {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const installed = isStandalone();
  return {
    installed,
    canPrompt: !installed && !!deferred,
    iosHint: !installed && !deferred && isIOS(),
    prompt: async () => {
      if (!deferred) return false;
      const ev = deferred;
      deferred = null;
      await ev.prompt();
      const { outcome } = await ev.userChoice;
      emit();
      return outcome === "accepted";
    },
  };
}
