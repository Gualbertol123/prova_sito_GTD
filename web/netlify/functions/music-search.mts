// -----------------------------------------------------------------------------
// GET /.netlify/functions/music-search?q=… — finds songs for the music player.
//
// Asks YouTube's official Data API for music videos that may be embedded, and
// answers with just what the player needs (id, title, channel, thumbnail).
// The API key stays here, on the server, in the YOUTUBE_API_KEY environment
// variable (free, from Google Cloud: see README §1e); without it the answer is
// 501 and the player offers YouTube's own search instead.
//
// Only a logged-in team account may use it (same check as report-pdf), so the
// key's daily quota cannot be spent by anyone else. Nothing is stored.
// -----------------------------------------------------------------------------

import { isTeamMember } from "../lib/teamAuth.mts";

const KEY = process.env.YOUTUBE_API_KEY ?? "";

function json(status: number, body: unknown, cache = "no-store"): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache },
  });
}

// The API returns titles with HTML entities (&#39; &amp; …).
function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

interface ApiItem {
  id?: { videoId?: string };
  snippet?: { title?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string }; default?: { url?: string } } };
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== "GET") return json(405, { error: "GET only" });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 120);
  if (!q) return json(400, { error: "Empty search" });
  if (!(await isTeamMember(req.headers.get("authorization") ?? ""))) return json(403, { error: "Log in first." });
  if (!KEY) return json(501, { error: "no-key" });

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.search = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoEmbeddable: "true",
    videoCategoryId: "10", // Music
    maxResults: "20",
    safeSearch: "moderate",
    q,
    key: KEY,
  }).toString();
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const quota = /quota/i.test(text);
    return json(quota ? 429 : 502, { error: quota ? "quota" : `YouTube ${res.status}` });
  }
  const data = (await res.json()) as { items?: ApiItem[] };
  const tracks = (data.items ?? [])
    .filter((it) => it.id?.videoId)
    .map((it) => ({
      id: it.id!.videoId!,
      title: decode(it.snippet?.title ?? ""),
      channel: decode(it.snippet?.channelTitle ?? ""),
      thumb: it.snippet?.thumbnails?.medium?.url ?? it.snippet?.thumbnails?.default?.url ?? "",
    }));
  // The same words give the same songs for a while: let the browser reuse it.
  return json(200, { tracks }, "private, max-age=600");
};
