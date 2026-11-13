import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useT } from "../lib/i18n";
import { useMe } from "../lib/identity";
import { ARTISTS, coverOf, getMusic, music, searchMusic, setMusic, useMusic, type Artist, type Track } from "../lib/music";
import {
  addToPlaylist,
  createPlaylist,
  deletePlaylist,
  moveInPlaylist,
  removeFromPlaylist,
  renamePlaylist,
  usePlaylists,
  type Playlist,
} from "../lib/musicDb";
import { ModeSwitch, Progress, SearchError } from "./MusicPlayer";
import "../styles/musicTab.css";

// -----------------------------------------------------------------------------
// The MUSIC tab (desktop): a full music app around the same player.
//
//   sidebar   Home, Search, the favourite artists, the team's playlists
//   main      Home · Search · an artist · a playlist
//   right     what is playing (cover, or the video in Video mode) and the queue
//   bottom    the player bar: song, controls, seek bar, music/video, volume
//
// The YouTube player itself stays in MusicPlayer (mounted once at the root);
// this tab drives it through lib/music and, in Video mode, gives it a slot
// (state.dock) to sit in.
// -----------------------------------------------------------------------------

type View = { kind: "home" } | { kind: "search" } | { kind: "artist"; name: string } | { kind: "playlist"; id: string };

// The page you were on, kept while you visit other tabs (until a reload).
let lastView: View = { kind: "home" };

export function MusicTab() {
  const { t } = useT();
  const [view, setViewState] = useState<View>(lastView);
  const setView = (v: View) => {
    lastView = v;
    setViewState(v);
  };
  const { playlists, available } = usePlaylists();
  const { me } = useMe();

  // While the tab is on screen it is the player's face.
  useEffect(() => {
    setMusic({ tab: true });
    return () => {
      // Leaving the tab with music on: it carries on in the small player.
      const cur = getMusic();
      setMusic({ tab: false, dock: null, view: cur.source ? "mini" : "closed" });
    };
  }, []);

  const newPlaylist = async () => {
    const name = window.prompt(t("mt.newName"), t("mt.newDefault"));
    if (!name?.trim()) return;
    const p = await createPlaylist(name, me);
    setView({ kind: "playlist", id: p.id });
  };

  return (
    <div className="mt">
      <aside className="mt-side">
        <nav className="mt-box">
          <button className={`mt-nav${view.kind === "home" ? " is-on" : ""}`} onClick={() => setView({ kind: "home" })}>
            <span aria-hidden="true">⌂</span> {t("mt.home")}
          </button>
          <button className={`mt-nav${view.kind === "search" ? " is-on" : ""}`} onClick={() => setView({ kind: "search" })}>
            <span aria-hidden="true">⌕</span> {t("mt.search")}
          </button>
        </nav>
        <div className="mt-box mt-lib">
          <div className="mt-lib__head">
            <span>{t("mt.library")}</span>
            <button className="mt-round" onClick={newPlaylist} title={t("mt.create")} aria-label={t("mt.create")} disabled={!available}>
              +
            </button>
          </div>
          <div className="mt-lib__list">
            {ARTISTS.map((a) => (
              <button
                key={a.name}
                className={`mt-libitem${view.kind === "artist" && view.name === a.name ? " is-on" : ""}`}
                onClick={() => setView({ kind: "artist", name: a.name })}
              >
                <ArtistAvatar name={a.name} size={44} />
                <span>
                  <b>{a.name}</b>
                  <small>{t("mt.artist")}</small>
                </span>
              </button>
            ))}
            {playlists.map((p) => (
              <button
                key={p.id}
                className={`mt-libitem${view.kind === "playlist" && view.id === p.id ? " is-on" : ""}`}
                onClick={() => setView({ kind: "playlist", id: p.id })}
              >
                <Mosaic tracks={p.tracks} size={44} />
                <span>
                  <b>{p.name}</b>
                  <small>
                    {t("mt.playlist")} · {p.owner || "—"} · {t("mt.songs").replace("{n}", String(p.tracks.length))}
                  </small>
                </span>
              </button>
            ))}
            {!available && <p className="mt-hint">{t("mt.needMigration")}</p>}
          </div>
        </div>
      </aside>

      <main className="mt-main">
        {view.kind === "home" && <Home go={setView} playlists={playlists} />}
        {view.kind === "search" && <Search playlists={playlists} />}
        {view.kind === "artist" && <ArtistPage artist={ARTISTS.find((a) => a.name === view.name)!} playlists={playlists} />}
        {view.kind === "playlist" && (
          <PlaylistPage
            playlist={playlists.find((p) => p.id === view.id)}
            playlists={playlists}
            onDeleted={() => setView({ kind: "home" })}
          />
        )}
      </main>

      <NowPlaying />
      <PlayerBar playlists={playlists} />
    </div>
  );
}

// ---- Bits -------------------------------------------------------------------

const GRADIENTS = [
  "linear-gradient(135deg,#5e5ce6,#bf5af2)",
  "linear-gradient(135deg,#0a84ff,#64d2ff)",
  "linear-gradient(135deg,#ff9f0a,#ff375f)",
  "linear-gradient(135deg,#30d158,#0a84ff)",
];
function gradientFor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

function ArtistAvatar({ name, size }: { name: string; size: number }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
  return (
    <span className="mt-avatar" style={{ width: size, height: size, background: gradientFor(name), fontSize: size * 0.36 }}>
      {initials}
    </span>
  );
}

/** A playlist's cover: its first four songs' pictures, or a note. */
function Mosaic({ tracks, size }: { tracks: Track[]; size: number }) {
  const pics = tracks.slice(0, 4).map((t) => coverOf(t.id));
  if (pics.length === 0) return <span className="mt-mosaic mt-mosaic--empty" style={{ width: size, height: size }}>♪</span>;
  if (pics.length < 4) return <img className="mt-mosaic" src={pics[0]} alt="" style={{ width: size, height: size }} />;
  return (
    <span className="mt-mosaic mt-mosaic--grid" style={{ width: size, height: size }}>
      {pics.map((p, i) => (
        <img key={i} src={p} alt="" />
      ))}
    </span>
  );
}

function greeting(t: (k: string) => string) {
  const h = new Date().getHours();
  return h < 13 ? t("m.hello.morning") : h < 18 ? t("m.hello.afternoon") : t("m.hello.evening");
}

// ---- Home ---------------------------------------------------------------------

function Home({ go, playlists }: { go: (v: View) => void; playlists: Playlist[] }) {
  const { t } = useT();
  const st = useMusic();
  return (
    <div className="mt-page">
      <div className="mt-hero" style={{ background: "linear-gradient(180deg, rgba(94,92,230,.45), transparent)" }}>
        <h1>{greeting(t)}</h1>
      </div>
      <div className="mt-quick">
        <button className="mt-qtile" onClick={() => music.play({ kind: "mix" })}>
          <span className="mt-qtile__art" style={{ background: "linear-gradient(135deg,#0a84ff,#bf5af2)" }}>
            ♫
          </span>
          <b>{t("music.mix")}</b>
          <PlayFab on={st.source?.kind === "mix" && st.playing} />
        </button>
        {ARTISTS.map((a) => (
          <button key={a.name} className="mt-qtile" onClick={() => go({ kind: "artist", name: a.name })}>
            <ArtistAvatar name={a.name} size={56} />
            <b>{a.name}</b>
          </button>
        ))}
        {playlists.slice(0, 4).map((p) => (
          <button key={p.id} className="mt-qtile" onClick={() => go({ kind: "playlist", id: p.id })}>
            <Mosaic tracks={p.tracks} size={56} />
            <b>{p.name}</b>
          </button>
        ))}
      </div>

      <h2 className="mt-h2">{t("mt.yourArtists")}</h2>
      <div className="mt-cards">
        {ARTISTS.map((a) => (
          <div key={a.name} className="mt-card" onClick={() => go({ kind: "artist", name: a.name })} role="button" tabIndex={0}>
            <div className="mt-card__art mt-card__art--round">
              <ArtistAvatar name={a.name} size={150} />
              <button
                className="mt-play mt-play--float"
                aria-label={`${t("music.play")} ${a.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  music.play({ kind: "artist", artist: a.name });
                }}
              >
                ▶
              </button>
            </div>
            <b>{a.name}</b>
            <small>{t("mt.artist")}</small>
          </div>
        ))}
      </div>

      <h2 className="mt-h2">{t("mt.teamPlaylists")}</h2>
      {playlists.length === 0 ? (
        <p className="mt-hint">{t("mt.noPlaylists")}</p>
      ) : (
        <div className="mt-cards">
          {playlists.map((p) => (
            <div key={p.id} className="mt-card" onClick={() => go({ kind: "playlist", id: p.id })} role="button" tabIndex={0}>
              <div className="mt-card__art">
                <Mosaic tracks={p.tracks} size={150} />
                {p.tracks.length > 0 && (
                  <button
                    className="mt-play mt-play--float"
                    aria-label={`${t("music.play")} ${p.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      music.play({ kind: "videos", label: p.name, tracks: p.tracks, start: 0 });
                    }}
                  >
                    ▶
                  </button>
                )}
              </div>
              <b>{p.name}</b>
              <small>
                {p.owner || "—"} · {t("mt.songs").replace("{n}", String(p.tracks.length))}
              </small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlayFab({ on }: { on: boolean }) {
  return <span className={`mt-play mt-play--tile${on ? " is-on" : ""}`}>{on ? "❚❚" : "▶"}</span>;
}

// ---- Search -------------------------------------------------------------------

function Search({ playlists }: { playlists: Playlist[] }) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const run = async () => {
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    const r = await searchMusic(q.trim());
    setBusy(false);
    if ("tracks" in r) setTracks(r.tracks);
    else setError(r.error);
  };

  return (
    <div className="mt-page">
      <form
        className="mt-search"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <span aria-hidden="true">⌕</span>
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("mt.searchPh")} aria-label={t("mt.search")} />
        {busy && <span className="mt-spin" aria-hidden="true" />}
      </form>
      {error && <SearchError error={error} q={q} />}
      {tracks && (tracks.length ? <TrackTable tracks={tracks} label={q} playlists={playlists} /> : <p className="mt-hint">{t("music.noResults")}</p>)}
      {!tracks && !error && (
        <>
          <h2 className="mt-h2">{t("mt.browse")}</h2>
          <div className="mt-genres">
            {["Pop latino", "Cantautori italiani", "Reggaeton", "Ballate", "Anni 2000", "Flamenco pop", "Dance", "Acoustic"].map((g, i) => (
              <button
                key={g}
                className="mt-genre"
                style={{ background: GRADIENTS[i % GRADIENTS.length] }}
                onClick={() => {
                  setQ(g);
                  setBusy(true);
                  void searchMusic(g).then((r) => {
                    setBusy(false);
                    if ("tracks" in r) setTracks(r.tracks);
                    else setError(r.error);
                  });
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---- Artist ------------------------------------------------------------------

function ArtistPage({ artist, playlists }: { artist: Artist; playlists: Playlist[] }) {
  const { t } = useT();
  const st = useMusic();
  const [top, setTop] = useState<Track[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setTop(null);
    setError(null);
    void searchMusic("", { channelId: artist.channel, order: "viewCount" }).then((r) => {
      if (!alive) return;
      if ("tracks" in r) setTop(r.tracks);
      else setError(r.error);
    });
    return () => {
      alive = false;
    };
  }, [artist.channel]);
  const playing = st.source?.kind === "artist" && st.source.artist === artist.name && st.playing;

  return (
    <div className="mt-page">
      <div className="mt-hero mt-hero--artist" style={{ background: `${gradientFor(artist.name)}` }}>
        <ArtistAvatar name={artist.name} size={160} />
        <div>
          <small>{t("mt.artist")}</small>
          <h1>{artist.name}</h1>
        </div>
      </div>
      <div className="mt-actions">
        <button className="mt-play mt-play--big" onClick={() => (playing ? music.toggle() : music.play({ kind: "artist", artist: artist.name }))} aria-label={t("music.play")}>
          {playing ? "❚❚" : "▶"}
        </button>
        <span className="mt-hint">{t("mt.artistAll")}</span>
      </div>
      <h2 className="mt-h2">{t("mt.popular")}</h2>
      {error && <SearchError error={error} q={artist.name} />}
      {!top && !error && <div className="mt-spin mt-spin--block" />}
      {top && <TrackTable tracks={top.slice(0, 15)} label={artist.name} playlists={playlists} />}
    </div>
  );
}

// ---- Playlist ----------------------------------------------------------------

function PlaylistPage({ playlist, playlists, onDeleted }: { playlist?: Playlist; playlists: Playlist[]; onDeleted: () => void }) {
  const { t } = useT();
  const st = useMusic();
  const [confirm, setConfirm] = useState(false);
  if (!playlist) return <div className="mt-page"><p className="mt-hint">{t("mt.gone")}</p></div>;
  const p = playlist;
  const playingThis = st.source?.kind === "videos" && st.source.label === p.name;

  return (
    <div className="mt-page">
      <div className="mt-hero mt-hero--artist" style={{ background: gradientFor(p.name) }}>
        <Mosaic tracks={p.tracks} size={160} />
        <div>
          <small>{t("mt.playlist")}</small>
          <h1
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            title={t("mt.rename")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLElement).blur();
              }
            }}
            onBlur={(e) => {
              const name = e.currentTarget.textContent?.trim() ?? "";
              if (name && name !== p.name) void renamePlaylist(p.id, name);
              else e.currentTarget.textContent = p.name;
            }}
          >
            {p.name}
          </h1>
          <p>
            {p.owner || "—"} · {t("mt.songs").replace("{n}", String(p.tracks.length))}
          </p>
        </div>
      </div>
      <div className="mt-actions">
        <button
          className="mt-play mt-play--big"
          disabled={!p.tracks.length}
          onClick={() => (playingThis ? music.toggle() : music.play({ kind: "videos", label: p.name, tracks: p.tracks, start: 0 }))}
          aria-label={t("music.play")}
        >
          {playingThis && st.playing ? "❚❚" : "▶"}
        </button>
        <button
          className={`mt-ghost${st.shuffle ? " is-on" : ""}`}
          onClick={() => music.setShuffle(!st.shuffle)}
          title={t("mt.shuffle")}
          aria-pressed={st.shuffle}
        >
          ⤮ {t("mt.shuffle")}
        </button>
        <span style={{ flex: 1 }} />
        {confirm ? (
          <>
            <span className="mt-hint">{t("mt.deleteQ")}</span>
            <button
              className="mt-ghost mt-ghost--danger"
              onClick={() => {
                void deletePlaylist(p.id);
                onDeleted();
              }}
            >
              {t("mt.delete")}
            </button>
            <button className="mt-ghost" onClick={() => setConfirm(false)}>
              {t("task.no")}
            </button>
          </>
        ) : (
          <button className="mt-ghost" onClick={() => setConfirm(true)}>
            {t("mt.delete")}
          </button>
        )}
      </div>
      {p.tracks.length === 0 ? (
        <p className="mt-hint">{t("mt.emptyPlaylist")}</p>
      ) : (
        <TrackTable tracks={p.tracks} label={p.name} playlists={playlists} inPlaylist={p} />
      )}
    </div>
  );
}

// ---- Track table ---------------------------------------------------------------

function TrackTable({ tracks, label, playlists, inPlaylist }: { tracks: Track[]; label: string; playlists: Playlist[]; inPlaylist?: Playlist }) {
  const { t } = useT();
  const st = useMusic();
  return (
    <div className="mt-table" role="table">
      <div className="mt-tr mt-tr--head" role="row">
        <span>#</span>
        <span>{t("mt.title")}</span>
        <span />
      </div>
      {tracks.map((tr, i) => {
        const on = st.now?.id === tr.id;
        return (
          <div
            key={tr.id + i}
            className={`mt-tr${on ? " is-on" : ""}`}
            role="row"
            onDoubleClick={() => music.play({ kind: "videos", label, tracks, start: i })}
          >
            <span className="mt-tr__n">
              <span className="mt-tr__num">{on && st.playing ? "♫" : i + 1}</span>
              <button className="mt-tr__play" onClick={() => music.play({ kind: "videos", label, tracks, start: i })} aria-label={`${t("music.play")} ${tr.title}`}>
                ▶
              </button>
            </span>
            <span className="mt-tr__title">
              <img src={tr.thumb || coverOf(tr.id)} alt="" loading="lazy" />
              <span>
                <b>{tr.title || tr.id}</b>
                <small>{tr.channel}</small>
              </span>
            </span>
            <span className="mt-tr__act">
              {inPlaylist && (
                <>
                  <button className="mt-iconbtn" title={t("mt.up")} aria-label={t("mt.up")} disabled={i === 0} onClick={() => void moveInPlaylist(inPlaylist.id, i, i - 1)}>
                    ↑
                  </button>
                  <button className="mt-iconbtn" title={t("mt.down")} aria-label={t("mt.down")} disabled={i === tracks.length - 1} onClick={() => void moveInPlaylist(inPlaylist.id, i, i + 1)}>
                    ↓
                  </button>
                  <button className="mt-iconbtn" title={t("mt.remove")} aria-label={t("mt.remove")} onClick={() => void removeFromPlaylist(inPlaylist.id, tr.id)}>
                    ✕
                  </button>
                </>
              )}
              <AddToPlaylist track={tr} playlists={playlists} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** "+": add this song to a playlist, or to a new one. */
function AddToPlaylist({ track, playlists }: { track: Track; playlists: Playlist[] }) {
  const { t } = useT();
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <span className="mt-add" ref={ref}>
      <button className="mt-iconbtn" title={t("mt.addTo")} aria-label={t("mt.addTo")} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {done ? "✓" : "+"}
      </button>
      {open && (
        <div className="mt-menu" role="menu">
          <div className="mt-menu__head">{t("mt.addTo")}</div>
          {playlists.map((p) => (
            <button
              key={p.id}
              role="menuitem"
              disabled={p.tracks.some((x) => x.id === track.id)}
              onClick={async () => {
                await addToPlaylist(p.id, track);
                setOpen(false);
                setDone(p.name);
                setTimeout(() => setDone(null), 1500);
              }}
            >
              {p.name}
              {p.tracks.some((x) => x.id === track.id) && <small> ✓</small>}
            </button>
          ))}
          <button
            role="menuitem"
            className="mt-menu__new"
            onClick={async () => {
              const name = window.prompt(t("mt.newName"), t("mt.newDefault"));
              if (!name?.trim()) return;
              await createPlaylist(name, me, [{ id: track.id, title: track.title, channel: track.channel, thumb: track.thumb }]);
              setOpen(false);
              setDone(name);
              setTimeout(() => setDone(null), 1500);
            }}
          >
            + {t("mt.create")}
          </button>
        </div>
      )}
    </span>
  );
}

// ---- Now playing + queue ---------------------------------------------------------

function NowPlaying() {
  const { t } = useT();
  const st = useMusic();
  const slot = useRef<HTMLDivElement>(null);
  const video = st.mode === "video";

  // In Video mode the player (fixed, at the root) sits exactly on this slot.
  useLayoutEffect(() => {
    if (!video) {
      setMusic({ dock: null });
      return;
    }
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = slot.current?.getBoundingClientRect();
        if (r) setMusic({ dock: { x: r.left, y: r.top, w: r.width, h: r.height } });
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (slot.current) ro.observe(slot.current);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [video]);

  const upNext = useMemo(() => (st.index >= 0 ? st.queue.slice(st.index + 1, st.index + 30) : []), [st.queue, st.index]);

  return (
    <aside className="mt-now">
      <div className="mt-box mt-now__box">
        <div className="mt-now__head">{t("mt.nowPlaying")}</div>
        {video ? (
          <div className="mt-now__video" ref={slot} />
        ) : (
          <div className="mt-now__cover">{st.now ? <img src={coverOf(st.now.id, true)} alt="" /> : <span>♪</span>}</div>
        )}
        <div className="mt-now__title">{st.notice ?? st.now?.title ?? t("music.nothing")}</div>
        <div className="mt-now__author">{st.now?.author}</div>
        {upNext.length > 0 && (
          <>
            <div className="mt-now__head" style={{ marginTop: 18 }}>
              {t("mt.next")}
            </div>
            <div className="mt-queue">
              {upNext.map((tr, i) => (
                <button key={tr.id + i} className="mt-qitem" onClick={() => music.playAt(st.index + 1 + i)}>
                  <img src={tr.thumb || coverOf(tr.id)} alt="" loading="lazy" />
                  <span>
                    <b>{tr.title}</b>
                    <small>{tr.channel}</small>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

// ---- Player bar ------------------------------------------------------------------

function PlayerBar({ playlists }: { playlists: Playlist[] }) {
  const { t } = useT();
  const st = useMusic();
  const current: Track | null = st.now ? { id: st.now.id, title: st.now.title, channel: st.now.author } : null;
  return (
    <footer className="mt-bar">
      <div className="mt-bar__song">
        {st.now ? <img src={coverOf(st.now.id)} alt="" /> : <span className="mt-bar__ph">♪</span>}
        <span>
          <b>{st.notice ?? st.now?.title ?? t("music.nothing")}</b>
          <small>{st.now?.author}</small>
        </span>
        {current && <AddToPlaylist track={current} playlists={playlists} />}
      </div>
      <div className="mt-bar__center">
        <div className="mt-bar__controls">
          <button className={`mt-iconbtn${st.shuffle ? " is-on" : ""}`} onClick={() => music.setShuffle(!st.shuffle)} aria-pressed={st.shuffle} title={t("mt.shuffle")} aria-label={t("mt.shuffle")}>
            ⤮
          </button>
          <button className="mt-iconbtn" onClick={music.prev} disabled={!st.source} aria-label={t("music.prev")}>
            ⏮
          </button>
          <button className="mt-play" onClick={music.toggle} disabled={!st.source} aria-label={st.playing ? t("music.pause") : t("music.play")}>
            {st.playing ? "❚❚" : "▶"}
          </button>
          <button className="mt-iconbtn" onClick={music.next} disabled={!st.source} aria-label={t("music.next")}>
            ⏭
          </button>
          <button className={`mt-iconbtn${st.repeat ? " is-on" : ""}`} onClick={() => music.setRepeat(!st.repeat)} aria-pressed={st.repeat} title={t("mt.repeat")} aria-label={t("mt.repeat")}>
            ⟲
          </button>
        </div>
        <Progress />
      </div>
      <div className="mt-bar__right">
        <ModeSwitch />
        <button className="mt-iconbtn" onClick={() => music.setMuted(!st.muted)} aria-label={st.muted ? t("mt.unmute") : t("mt.mute")}>
          {st.muted || st.volume === 0 ? "🔇" : "🔊"}
        </button>
        <input
          className="mt-volume"
          type="range"
          min={0}
          max={100}
          value={st.muted ? 0 : st.volume}
          onChange={(e) => music.setVolume(Number(e.target.value))}
          aria-label={t("mt.volume")}
          style={{ ["--p" as string]: `${st.muted ? 0 : st.volume}%` }}
        />
      </div>
    </footer>
  );
}
