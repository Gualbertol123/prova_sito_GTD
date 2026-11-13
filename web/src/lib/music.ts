import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { readPref, writePref } from "./prefs";

// -----------------------------------------------------------------------------
// The music player (components/MusicPlayer.tsx): what it can play, and its
// state, shared by the desktop and the phone layout.
//
// Music comes from YouTube's official embedded player (the same source as
// freefy.app): free for everyone, streamed by YouTube. YouTube may show its
// own ads on some videos (none for YouTube Premium); the app adds none.
// -----------------------------------------------------------------------------

export interface Artist {
  name: string;
  /** The artist's official channel's uploads playlist ("UU…"): plays without an API key. */
  list: string;
}

/** The defaults: each artist's official VEVO channel (checked to exist and embed). */
export const ARTISTS: Artist[] = [
  { name: "Enrique Iglesias", list: "UUVttQE6tS_agDSAU61Q65aA" },
  { name: "Ricky Martin", list: "UUNpY5DI8KO-ROA2BxgGWrXg" },
  { name: "Tiziano Ferro", list: "UUvBz3n23YgAvAHfoZtdqZCA" },
];

export interface Track {
  id: string;
  title: string;
  channel: string;
  thumb?: string;
}

/** What is playing: the favourites mix, one artist, some songs, or a playlist link. */
export type Source =
  | { kind: "mix" }
  | { kind: "artist"; artist: string }
  | { kind: "videos"; label: string; tracks: Track[]; start: number }
  | { kind: "list"; label: string; list: string; video?: string };

/** A YouTube link (or bare id) → a video and/or a playlist. */
export function parseYouTube(input: string): { video?: string; list?: string } | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return { video: s };
  if (/^(PL|UU|OL|RD|FL|LL)[\w-]{10,}$/.test(s)) return { list: s };
  let url: URL;
  try {
    url = new URL(s.startsWith("http") ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  const list = url.searchParams.get("list") ?? undefined;
  let video: string | undefined;
  if (host === "youtu.be") video = url.pathname.slice(1, 12);
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    video =
      url.searchParams.get("v") ??
      url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/)?.[1] ??
      undefined;
  } else return null;
  if (video && !/^[\w-]{11}$/.test(video)) video = undefined;
  return video || list ? { video, list } : null;
}

// ---- Shared state -----------------------------------------------------------

export type View = "closed" | "open" | "mini";
export type Side = "right" | "left";

export interface NowPlaying {
  id: string;
  title: string;
  author: string;
}

export interface MusicState {
  view: View;
  source: Source | null;
  playing: boolean;
  now: NowPlaying | null;
  /** Which corner the small player sits in. */
  side: Side;
  notice: string | null;
}

/** What the player component exposes to the controls. */
export interface MusicController {
  play: (s: Source) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
}

let state: MusicState = {
  view: "closed",
  source: null,
  playing: false,
  now: null,
  side: readPref("music") === "left" ? "left" : "right",
  notice: null,
};
const listeners = new Set<() => void>();
let controller: MusicController | null = null;
// A play asked for before the player had loaded (first open).
let pending: Source | null = null;

export function getMusic(): MusicState {
  return state;
}

export function setMusic(patch: Partial<MusicState>): void {
  state = { ...state, ...patch };
  if (patch.side) writePref("music", patch.side);
  listeners.forEach((l) => l());
}

export function useMusic(): MusicState {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}

export function registerController(c: MusicController | null): void {
  controller = c;
  if (c && pending) {
    const s = pending;
    pending = null;
    c.play(s);
  }
}

export const music = {
  open: () => setMusic({ view: "open" }),
  minimize: () => setMusic({ view: state.source ? "mini" : "closed" }),
  close: () => {
    controller?.stop();
    setMusic({ view: "closed", playing: false });
  },
  play: (s: Source) => {
    setMusic({ source: s, view: state.view === "closed" ? "open" : state.view, notice: null });
    if (controller) controller.play(s);
    else pending = s;
  },
  toggle: () => controller?.toggle(),
  next: () => controller?.next(),
  prev: () => controller?.prev(),
};

// ---- Search -----------------------------------------------------------------

export type SearchResult = { tracks: Track[] } | { error: "no-key" | "quota" | "login" | string };

export async function searchMusic(q: string): Promise<SearchResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: "login" };
  try {
    const res = await fetch(`/.netlify/functions/music-search?q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json().catch(() => ({}))) as { tracks?: Track[]; error?: string };
    if (res.ok && body.tracks) return { tracks: body.tracks };
    if (res.status === 404) return { error: "no-key" }; // functions not deployed (local dev)
    return { error: body.error ?? `HTTP ${res.status}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export function youtubeSearchUrl(q: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}
