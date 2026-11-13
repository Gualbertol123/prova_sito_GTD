import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../lib/i18n";
import { useBackClose } from "../lib/history";
import {
  ARTISTS,
  coverOf,
  formatTime,
  getMusic,
  music,
  parseYouTube,
  registerController,
  searchMusic,
  setMusic,
  useMusic,
  youtubeSearchUrl,
  type Artist,
  type Source,
  type Track,
} from "../lib/music";
import { usePlaylists } from "../lib/musicDb";
import "../styles/music.css";

// -----------------------------------------------------------------------------
// The music player: YouTube's official embedded player (IFrame Player API),
// mounted ONCE at the root of the app so the music keeps playing across tabs
// and across the desktop / phone layouts. Only its frame changes:
//
//   open    the full panel: cover (or video), controls, favourites, search
//   mini    small, in a corner: a slim bar with the cover (music only), or
//           the 200 × 200 video (video mode)
//   closed  stopped and out of sight
//   tab     the desktop Music tab is on screen and shows the controls itself;
//           in video mode the video is placed inside the tab (state.dock)
//
// Music only (the default) keeps the YouTube frame on the page but out of
// sight. YouTube's embedding rules ask for a visible player of at least
// 200 × 200 px, which is what Video mode shows.
// -----------------------------------------------------------------------------

interface YTPlayer {
  loadPlaylist(arg: string[] | { list: string; listType: "playlist"; index?: number }, index?: number): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  nextVideo(): void;
  previousVideo(): void;
  playVideoAt(i: number): void;
  seekTo(s: number, allowSeekAhead: boolean): void;
  setVolume(v: number): void;
  mute(): void;
  unMute(): void;
  setShuffle(on: boolean): void;
  setLoop(on: boolean): void;
  getPlaylist(): string[] | null;
  getPlaylistIndex(): number;
  getCurrentTime(): number;
  getDuration(): number;
  getVolume(): number;
  isMuted(): boolean;
  getVideoData(): { video_id?: string; title?: string; author?: string };
}
interface YTNamespace {
  Player: new (el: HTMLIFrameElement, opts: { events?: Record<string, (e: { data: number }) => void> }) => YTPlayer;
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const ENDED = 0;
const PLAYING = 1;
const PAUSED = 2;

let apiPromise: Promise<YTNamespace> | null = null;
function loadApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => {
      apiPromise = null;
      reject(new Error("YouTube could not be reached"));
    };
    document.head.appendChild(s);
  });
  return apiPromise;
}

function shuffled<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** The player itself. Render once, at the app's root. */
export function MusicPlayer({ mobile }: { mobile: boolean }) {
  const { t } = useT();
  const st = useMusic();
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const mix = useRef<{ order: Artist[]; pos: number }>({ order: [], pos: 0 });
  const shufflePending = useRef(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const loadArtist = useCallback((a: Artist) => {
    shufflePending.current = true; // start somewhere random in the artist's songs
    setMusic({ queue: [], index: -1, shuffle: true, now: null });
    player.current?.loadPlaylist({ list: a.list, listType: "playlist", index: 0 });
  }, []);

  const advanceMix = useCallback(() => {
    const m = mix.current;
    m.pos = (m.pos + 1) % m.order.length;
    loadArtist(m.order[m.pos]);
  }, [loadArtist]);

  const atEnd = () => {
    const p = player.current;
    const len = p?.getPlaylist()?.length ?? 0;
    return !!p && len > 0 && p.getPlaylistIndex() >= len - 1;
  };

  // Create the player the first time it is needed (panel opened, or the Music tab).
  const wanted = st.view !== "closed" || st.tab;
  useEffect(() => {
    if (!wanted || player.current || !host.current) return;
    let alive = true;
    loadApi()
      .then((YT) => {
        if (!alive || player.current || !host.current) return;
        // The frame is made here, not by the API, for one attribute: since
        // 2025 YouTube refuses to play an embed whose page sends no referrer
        // ("Error 153"), and this site sends none (netlify.toml). So this one
        // frame tells YouTube the site's address (origin only, no path); every
        // other request still sends nothing.
        const frame = document.createElement("iframe");
        const vars = new URLSearchParams({
          enablejsapi: "1",
          origin: window.location.origin,
          playsinline: "1",
          rel: "0",
          controls: "1",
          fs: "0",
          iv_load_policy: "3",
        });
        frame.src = `https://www.youtube-nocookie.com/embed/?${vars}`;
        frame.referrerPolicy = "strict-origin-when-cross-origin";
        frame.allow = "autoplay; encrypted-media; picture-in-picture";
        frame.title = "YouTube";
        host.current.appendChild(frame);
        const p = new YT.Player(frame, {
          events: {
            onReady: () => {
              player.current = p;
              setReady(true);
              p.setVolume(getMusic().volume);
              registerController({
                play: (s: Source) => playSource(s),
                toggle: () => (getMusic().playing ? p.pauseVideo() : p.playVideo()),
                next: () => {
                  if (getMusic().source?.kind === "mix" && atEnd()) advanceMix();
                  else p.nextVideo();
                },
                prev: () => (p.getCurrentTime() > 4 ? p.seekTo(0, true) : p.previousVideo()),
                stop: () => p.stopVideo(),
                seek: (sec) => {
                  p.seekTo(sec, true);
                  setMusic({ time: sec });
                },
                setVolume: (v) => {
                  p.setVolume(v);
                  if (v > 0) p.unMute();
                },
                setMuted: (m) => (m ? p.mute() : p.unMute()),
                setShuffle: (on) => p.setShuffle(on),
                setRepeat: (on) => p.setLoop(on),
                playAt: (i) => p.playVideoAt(i),
              });
            },
            onStateChange: (e) => {
              if (e.data === PLAYING) {
                if (shufflePending.current) {
                  shufflePending.current = false;
                  p.setShuffle(true);
                  p.playVideoAt(0);
                  return;
                }
                const d = p.getVideoData();
                setMusic({
                  playing: true,
                  now: d.video_id ? { id: d.video_id, title: d.title ?? "", author: d.author ?? "" } : null,
                  index: p.getPlaylistIndex(),
                  duration: p.getDuration(),
                });
              } else if (e.data === PAUSED) {
                setMusic({ playing: false });
              } else if (e.data === ENDED) {
                setMusic({ playing: false });
                if (getMusic().source?.kind === "mix" && atEnd()) advanceMix();
              }
            },
            onError: () => {
              // Not found, or its owner does not allow playing it elsewhere: skip it.
              setMusic({ notice: t("music.unavailable") });
              setTimeout(() => {
                setMusic({ notice: null });
                if (getMusic().source?.kind === "mix" && atEnd()) advanceMix();
                else p.nextVideo();
              }, 1200);
            },
          },
        });
      })
      .catch((e: unknown) => setFailed(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);

  useEffect(() => () => registerController(null), []);

  // Keep every view in step with the player itself: position, length, and
  // volume / mute (which YouTube's own controls can change in Video mode).
  // Fast while playing, slower while paused.
  const loaded = !!st.source;
  useEffect(() => {
    if (!loaded) return;
    const id = setInterval(
      () => {
        const p = player.current;
        if (!p) return;
        const cur = getMusic();
        const patch: Partial<typeof cur> = {};
        const time = p.getCurrentTime() || 0;
        const duration = p.getDuration() || 0;
        if (Math.abs(time - cur.time) >= 0.25) patch.time = time;
        if (duration !== cur.duration) patch.duration = duration;
        const vol = p.getVolume();
        if (typeof vol === "number" && vol !== cur.volume && !p.isMuted()) patch.volume = vol;
        const muted = p.isMuted();
        if (muted !== cur.muted) patch.muted = muted;
        if (Object.keys(patch).length) setMusic(patch);
      },
      st.playing ? 500 : 1500
    );
    return () => clearInterval(id);
  }, [loaded, st.playing]);

  function playSource(s: Source) {
    const p = player.current;
    if (!p) return;
    shufflePending.current = false;
    setMusic({ time: 0, duration: 0 });
    if (s.kind === "mix") {
      mix.current = { order: shuffled(ARTISTS), pos: 0 };
      loadArtist(mix.current.order[0]);
    } else if (s.kind === "artist") {
      const a = ARTISTS.find((x) => x.name === s.artist);
      if (a) loadArtist(a);
    } else if (s.kind === "videos") {
      const first = s.tracks[s.start];
      setMusic({
        queue: s.tracks,
        index: s.start,
        now: first ? { id: first.id, title: first.title, author: first.channel } : null,
      });
      p.loadPlaylist(
        s.tracks.map((x) => x.id),
        s.start
      );
    } else {
      setMusic({ queue: [], index: -1, now: null });
      p.loadPlaylist({ list: s.list, listType: "playlist", index: 0 });
    }
    if (getMusic().shuffle && s.kind !== "mix" && s.kind !== "artist") setTimeout(() => p.setShuffle(true), 800);
    if (getMusic().repeat) setTimeout(() => p.setLoop(true), 800);
  }

  const view = st.view;
  const audio = st.mode === "audio";
  // On the Music tab the tab is the player: this one only hosts the frame
  // (and, in video mode, shows the video where the tab put its slot).
  const inTab = st.tab && !mobile;
  const docked = inTab && !audio && !!st.dock;
  const frameStyle = docked ? { left: st.dock!.x, top: st.dock!.y, width: st.dock!.w, height: st.dock!.h } : undefined;
  const cls = [
    "mp",
    inTab ? "mp--tab" : `mp--${view}`,
    `mp--${mobile ? "phone" : "desk"}`,
    `mp--${st.side}`,
    audio ? "mp--audio" : "mp--video",
    docked ? "mp--docked" : "",
  ].join(" ");

  return (
    <div className={cls} role="region" aria-label={t("music.title")} aria-hidden={!inTab && view === "closed"} data-ready={ready} style={frameStyle}>
      {mobile && view === "open" && <BackToMini />}
      {!inTab && view === "open" && (
        <div className="mp-head">
          <span className="mp-head__title">♪ {t("music.title")}</span>
          <ModeSwitch />
          <button className="mp-icon" onClick={music.minimize} aria-label={t("music.minimize")} title={t("music.minimize")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <button className="mp-icon" onClick={music.close} aria-label={t("music.close")} title={t("music.close")}>
            ✕
          </button>
        </div>
      )}

      <div className="mp-video" ref={host}>
        {failed && <div className="mp-failed">{t("music.failed")}</div>}
      </div>

      {!inTab && audio && view === "open" && (
        <div className="mp-cover">{st.now ? <img src={coverOf(st.now.id, true)} alt="" /> : <div className="mp-cover__ph">♪</div>}</div>
      )}

      {!inTab && (
        <div className="mp-strip">
          {audio && view === "mini" && <span className="mp-thumb">{st.now ? <img src={coverOf(st.now.id)} alt="" /> : "♪"}</span>}
          <div className="mp-now">
            <div className="mp-now__title">{st.notice ?? st.now?.title ?? (st.source ? "…" : t("music.nothing"))}</div>
            {(view === "open" || audio) && st.now?.author && <div className="mp-now__author">{st.now.author}</div>}
          </div>
          <div className="mp-controls">
            {view === "open" && (
              <button className="mp-icon" onClick={music.prev} aria-label={t("music.prev")} disabled={!st.source}>
                ⏮
              </button>
            )}
            <button className="mp-icon mp-icon--main" onClick={music.toggle} aria-label={st.playing ? t("music.pause") : t("music.play")} disabled={!st.source}>
              {st.playing ? "❚❚" : "▶"}
            </button>
            <button className="mp-icon" onClick={music.next} aria-label={t("music.next")} disabled={!st.source}>
              ⏭
            </button>
            {view === "mini" && (
              <>
                <button className="mp-icon" onClick={music.open} aria-label={t("music.expand")}>
                  ⤢
                </button>
                {!audio && (
                  <button className="mp-icon" onClick={() => setMusic({ side: st.side === "right" ? "left" : "right" })} aria-label={t("music.side")}>
                    ⇆
                  </button>
                )}
                <button className="mp-icon" onClick={music.close} aria-label={t("music.close")}>
                  ✕
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {!inTab && view === "open" && st.duration > 0 && <Progress />}

      {!inTab && view === "open" && <MusicBrowser />}
    </div>
  );
}

/** Video or music only. */
export function ModeSwitch() {
  const { t } = useT();
  const st = useMusic();
  return (
    <div className="mp-mode" role="group" aria-label={t("music.mode")}>
      <button aria-pressed={st.mode === "audio"} onClick={() => music.setMode("audio")}>
        ♪ {t("music.audioOnly")}
      </button>
      <button aria-pressed={st.mode === "video"} onClick={() => music.setMode("video")}>
        ▶ {t("music.video")}
      </button>
    </div>
  );
}

/** Time played, a seek bar, and the length. */
export function Progress() {
  const st = useMusic();
  const [drag, setDrag] = useState<number | null>(null);
  const value = drag ?? st.time;
  const commit = () => {
    if (drag !== null) music.seek(drag);
    setDrag(null);
  };
  return (
    <div className="mp-progress">
      <span>{formatTime(value)}</span>
      <input
        type="range"
        min={0}
        max={Math.max(1, Math.floor(st.duration))}
        step={1}
        value={Math.floor(value)}
        onChange={(e) => setDrag(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        aria-label="Seek"
        style={{ ["--p" as string]: `${st.duration ? (value / st.duration) * 100 : 0}%` }}
      />
      <span>{formatTime(st.duration)}</span>
    </div>
  );
}

/** On a phone, Back folds the full player into the small one. */
function BackToMini() {
  useBackClose(music.minimize);
  return null;
}

/** Favourites, playlists, search and links: what to play. */
function MusicBrowser() {
  const { t } = useT();
  const st = useMusic();
  const { playlists } = usePlaylists();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Track[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [linkErr, setLinkErr] = useState(false);
  const src = st.source;

  const search = async () => {
    const text = q.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    const r = await searchMusic(text);
    setBusy(false);
    if ("tracks" in r) setResults(r.tracks);
    else setError(r.error);
  };

  const playLink = () => {
    const p = parseYouTube(link);
    if (!p) return setLinkErr(true);
    setLinkErr(false);
    if (p.list) music.play({ kind: "list", label: t("music.link"), list: p.list, video: p.video });
    else music.play({ kind: "videos", label: t("music.link"), tracks: [{ id: p.video!, title: "", channel: "" }], start: 0 });
    setLink("");
  };

  return (
    <div className="mp-body">
      <button className={`mp-mix${src?.kind === "mix" ? " is-on" : ""}`} onClick={() => music.play({ kind: "mix" })}>
        <span className="mp-mix__icon">▶</span>
        <span>
          <b>{t("music.mix")}</b>
          <small>{ARTISTS.map((a) => a.name).join(" · ")}</small>
        </span>
      </button>
      <div className="mp-chips">
        {ARTISTS.map((a) => (
          <button
            key={a.name}
            className={`mp-chip${src?.kind === "artist" && src.artist === a.name ? " is-on" : ""}`}
            onClick={() => music.play({ kind: "artist", artist: a.name })}
          >
            {a.name}
          </button>
        ))}
      </div>

      {playlists.length > 0 && (
        <>
          <div className="mp-label">{t("music.playlists")}</div>
          <div className="mp-chips">
            {playlists.map((pl) => (
              <button
                key={pl.id}
                className={`mp-chip${src?.kind === "videos" && src.label === pl.name ? " is-on" : ""}`}
                disabled={pl.tracks.length === 0}
                onClick={() => music.play({ kind: "videos", label: pl.name, tracks: pl.tracks, start: 0 })}
              >
                {pl.name} · {pl.tracks.length}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="mp-label">{t("music.searchTitle")}</div>
      <form
        className="mp-row"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input className="mp-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("music.searchPh")} enterKeyHint="search" aria-label={t("music.searchTitle")} />
        <button className="mp-btn" type="submit" disabled={busy || !q.trim()}>
          {busy ? "…" : t("music.search")}
        </button>
      </form>
      {error && <SearchError error={error} q={q} />}
      {results && (
        <div className="mp-results">
          {results.length === 0 && <div className="mp-note">{t("music.noResults")}</div>}
          {results.map((tr, i) => (
            <button
              key={tr.id}
              className={`mp-result${st.now?.id === tr.id ? " is-on" : ""}`}
              onClick={() => music.play({ kind: "videos", label: q, tracks: results, start: i })}
            >
              {tr.thumb ? <img src={tr.thumb} alt="" loading="lazy" /> : <span className="mp-result__ph" />}
              <span>
                <b>{tr.title}</b>
                <small>{tr.channel}</small>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mp-label">{t("music.linkTitle")}</div>
      <div className="mp-row">
        <input
          className="mp-input"
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setLinkErr(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && playLink()}
          placeholder={t("music.linkPh")}
          aria-label={t("music.linkTitle")}
        />
        <button className="mp-btn" onClick={playLink} disabled={!link.trim()}>
          {t("music.play")}
        </button>
      </div>
      {linkErr && <div className="mp-note">{t("music.badLink")}</div>}

      <p className="mp-fine">{t("music.adsNote")}</p>
    </div>
  );
}

/** What went wrong with a search, with YouTube's own search as a way out. */
export function SearchError({ error, q }: { error: string; q: string }) {
  const { t } = useT();
  return (
    <div className="mp-note">
      {error === "no-key" ? t("music.noKey") : error === "quota" ? t("music.quota") : `${t("music.searchError")} ${error}`}{" "}
      {q.trim() && (
        <a href={youtubeSearchUrl(q)} target="_blank" rel="noopener noreferrer">
          {t("music.openYt")} ↗
        </a>
      )}
    </div>
  );
}

/** The header button (desktop) that opens or folds the player. */
export function MusicButton() {
  const { t } = useT();
  const st = useMusic();
  return (
    <button
      onClick={() => (st.view === "open" ? music.minimize() : music.open())}
      aria-pressed={st.view !== "closed"}
      title={t("music.title")}
      aria-label={t("music.title")}
      className={`h-9 w-9 rounded-full border text-[15px] leading-none flex items-center justify-center transition-colors ${
        st.view !== "closed" ? "bg-[#C9A96E] text-[#0A1931] border-[#C9A96E]" : "bg-transparent text-white border-white/35 hover:border-[#C9A96E]"
      }`}
    >
      {st.playing ? "♫" : "♪"}
    </button>
  );
}
