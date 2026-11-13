import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../lib/i18n";
import { useBackClose } from "../lib/history";
import {
  ARTISTS,
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
import "../styles/music.css";

// -----------------------------------------------------------------------------
// The music player: YouTube's official embedded player (IFrame Player API),
// mounted ONCE at the root of the app so the music keeps playing across tabs
// and across the desktop / phone layouts. Only its frame changes:
//
//   open    the full panel: the video, controls, favourites, search, links
//   mini    a small floating player in a corner (moves to the other corner)
//   closed  stopped and out of sight
//
// YouTube's rules: a playing video stays visible and at least 200 × 200 px,
// and the player is not altered (its ads, if any, are left alone). So the
// small player is 200 × 200, not an invisible audio-only player.
// -----------------------------------------------------------------------------

interface YTPlayer {
  loadPlaylist(arg: string[] | { list: string; listType: "playlist"; index?: number }, index?: number): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  nextVideo(): void;
  previousVideo(): void;
  playVideoAt(i: number): void;
  setShuffle(on: boolean): void;
  getPlaylist(): string[] | null;
  getPlaylistIndex(): number;
  getVideoData(): { video_id?: string; title?: string; author?: string };
  destroy(): void;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      host?: string;
      width?: string;
      height?: string;
      playerVars?: Record<string, string | number>;
      events?: Record<string, (e: { data: number; target: YTPlayer }) => void>;
    }
  ) => YTPlayer;
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

  // Create the player the first time the panel opens.
  useEffect(() => {
    if (st.view === "closed" || player.current || !host.current) return;
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
              registerController({
                play: (s: Source) => playSource(s),
                toggle: () => (getMusic().playing ? p.pauseVideo() : p.playVideo()),
                next: () => {
                  if (getMusic().source?.kind === "mix" && atEnd()) advanceMix();
                  else p.nextVideo();
                },
                prev: () => p.previousVideo(),
                stop: () => p.stopVideo(),
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
                setMusic({ playing: true, now: d.video_id ? { id: d.video_id, title: d.title ?? "", author: d.author ?? "" } : null });
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
  }, [st.view]);

  useEffect(() => () => registerController(null), []);

  function playSource(s: Source) {
    const p = player.current;
    if (!p) return;
    shufflePending.current = false;
    if (s.kind === "mix") {
      mix.current = { order: shuffled(ARTISTS), pos: 0 };
      loadArtist(mix.current.order[0]);
    } else if (s.kind === "artist") {
      const a = ARTISTS.find((x) => x.name === s.artist);
      if (a) loadArtist(a);
    } else if (s.kind === "videos") {
      p.loadPlaylist(
        s.tracks.map((x) => x.id),
        s.start
      );
    } else {
      p.loadPlaylist({ list: s.list, listType: "playlist", index: 0 });
    }
  }

  const view = st.view;
  return (
    <div
      className={`mp mp--${view} mp--${mobile ? "phone" : "desk"} mp--${st.side}`}
      role="region"
      aria-label={t("music.title")}
      aria-hidden={view === "closed"}
      data-ready={ready}
    >
      {mobile && view === "open" && <BackToMini />}
      {view === "open" && (
        <div className="mp-head">
          <span className="mp-head__title">♪ {t("music.title")}</span>
          <button className="mp-icon" onClick={music.minimize} aria-label={t("music.minimize")} title={t("music.minimize")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 15l6-6 6 6" transform="rotate(180 12 12)" />
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

      <div className="mp-strip">
        <div className="mp-now">
          <div className="mp-now__title">{st.notice ?? st.now?.title ?? (st.source ? "…" : t("music.nothing"))}</div>
          {view === "open" && st.now?.author && <div className="mp-now__author">{st.now.author}</div>}
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
              <button
                className="mp-icon"
                onClick={() => setMusic({ side: st.side === "right" ? "left" : "right" })}
                aria-label={t("music.side")}
              >
                ⇆
              </button>
              <button className="mp-icon" onClick={music.close} aria-label={t("music.close")}>
                ✕
              </button>
            </>
          )}
        </div>
      </div>

      {view === "open" && <MusicBrowser />}
    </div>
  );
}

/** On a phone, Back folds the full player into the small one. */
function BackToMini() {
  useBackClose(music.minimize);
  return null;
}

/** Favourites, search and links: what to play. */
function MusicBrowser() {
  const { t } = useT();
  const st = useMusic();
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
      <button
        className={`mp-mix${src?.kind === "mix" ? " is-on" : ""}`}
        onClick={() => music.play({ kind: "mix" })}
      >
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

      <div className="mp-label">{t("music.searchTitle")}</div>
      <form
        className="mp-row"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input
          className="mp-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("music.searchPh")}
          enterKeyHint="search"
          aria-label={t("music.searchTitle")}
        />
        <button className="mp-btn" type="submit" disabled={busy || !q.trim()}>
          {busy ? "…" : t("music.search")}
        </button>
      </form>
      {error && (
        <div className="mp-note">
          {error === "no-key" ? t("music.noKey") : error === "quota" ? t("music.quota") : `${t("music.searchError")} ${error}`}{" "}
          {q.trim() && (
            <a href={youtubeSearchUrl(q)} target="_blank" rel="noopener noreferrer">
              {t("music.openYt")} ↗
            </a>
          )}
        </div>
      )}
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
        st.view !== "closed"
          ? "bg-[#C9A96E] text-[#0A1931] border-[#C9A96E]"
          : "bg-transparent text-white border-white/35 hover:border-[#C9A96E]"
      }`}
    >
      {st.playing ? "♫" : "♪"}
    </button>
  );
}
