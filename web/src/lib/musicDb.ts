import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { genId } from "./constants";
import type { Track } from "./music";

// -----------------------------------------------------------------------------
// The team's music playlists (table music_playlists, migration 018).
//
// Kept apart from the board: loaded the first time a screen needs them, kept
// live with their own realtime channel, and shared by every screen through a
// small module-level store. Before migration 018 runs, `available` is false
// and the Library says what to run.
// -----------------------------------------------------------------------------

export interface Playlist {
  id: string;
  name: string;
  owner: string;
  tracks: Track[];
  createdAt: number;
  updatedAt: number;
}

interface Row {
  id: string;
  name: string;
  owner: string;
  tracks: Track[] | null;
  created_at: number;
  updated_at: number;
}

interface Store {
  playlists: Playlist[];
  loaded: boolean;
  available: boolean;
  error: string | null;
}

let store: Store = { playlists: [], loaded: false, available: true, error: null };
const listeners = new Set<() => void>();
let started = false;

function set(patch: Partial<Store>) {
  store = { ...store, ...patch };
  listeners.forEach((l) => l());
}

function fromRow(r: Row): Playlist {
  return {
    id: r.id,
    name: r.name ?? "",
    owner: r.owner ?? "",
    tracks: Array.isArray(r.tracks) ? r.tracks.filter((t) => t && typeof t.id === "string") : [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function missingTable(e: { code?: string; message?: string }): boolean {
  return e.code === "42P01" || e.code === "PGRST205" || /does not exist|could not find the table/i.test(e.message ?? "");
}

export async function reloadPlaylists(): Promise<void> {
  const { data, error } = await supabase.from("music_playlists").select("*").order("updated_at", { ascending: false });
  if (error) {
    set({ loaded: true, available: !missingTable(error), error: missingTable(error) ? null : error.message });
    return;
  }
  set({ playlists: ((data ?? []) as Row[]).map(fromRow), loaded: true, available: true, error: null });
}

function start() {
  if (started) return;
  started = true;
  void reloadPlaylists();
  supabase
    .channel("music-playlists")
    .on("postgres_changes", { event: "*", schema: "public", table: "music_playlists" }, () => void reloadPlaylists())
    .subscribe();
}

export function usePlaylists(): Store {
  const [, force] = useState(0);
  useEffect(() => {
    start();
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return store;
}

// ---- Changes (optimistic; reloaded from the database afterwards) ------------

async function must<T extends { error: { message: string } | null }>(p: PromiseLike<T>): Promise<void> {
  const r = await p;
  if (r.error) {
    await reloadPlaylists();
    throw new Error(r.error.message);
  }
}

function patchLocal(id: string, patch: Partial<Playlist>) {
  set({ playlists: store.playlists.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)) });
}

export async function createPlaylist(name: string, owner: string, tracks: Track[] = []): Promise<Playlist> {
  const now = Date.now();
  const p: Playlist = { id: genId() + genId(), name: name.trim() || "Playlist", owner, tracks, createdAt: now, updatedAt: now };
  set({ playlists: [p, ...store.playlists] });
  await must(
    supabase.from("music_playlists").insert({ id: p.id, name: p.name, owner, tracks, created_at: now, updated_at: now })
  );
  return p;
}

export async function renamePlaylist(id: string, name: string): Promise<void> {
  patchLocal(id, { name });
  await must(supabase.from("music_playlists").update({ name, updated_at: Date.now() }).eq("id", id));
}

export async function deletePlaylist(id: string): Promise<void> {
  set({ playlists: store.playlists.filter((p) => p.id !== id) });
  await must(supabase.from("music_playlists").delete().eq("id", id));
}

async function setTracks(id: string, tracks: Track[]): Promise<void> {
  patchLocal(id, { tracks });
  await must(supabase.from("music_playlists").update({ tracks, updated_at: Date.now() }).eq("id", id));
}

/** Adds a song (once: a song already there is not added again). */
export async function addToPlaylist(id: string, track: Track): Promise<boolean> {
  const p = store.playlists.find((x) => x.id === id);
  if (!p || p.tracks.some((t) => t.id === track.id)) return false;
  const clean: Track = { id: track.id, title: track.title, channel: track.channel, thumb: track.thumb };
  await setTracks(id, [...p.tracks, clean]);
  return true;
}

export async function removeFromPlaylist(id: string, trackId: string): Promise<void> {
  const p = store.playlists.find((x) => x.id === id);
  if (p) await setTracks(id, p.tracks.filter((t) => t.id !== trackId));
}

export async function moveInPlaylist(id: string, from: number, to: number): Promise<void> {
  const p = store.playlists.find((x) => x.id === id);
  if (!p || to < 0 || to >= p.tracks.length) return;
  const next = p.tracks.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  await setTracks(id, next);
}
