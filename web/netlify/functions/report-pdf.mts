// -----------------------------------------------------------------------------
// POST /.netlify/functions/report-pdf — turns the weekly report into a PDF on the server.
//
// Body: the ReportDoc the REPORT tab builds (web/src/lib/reportDoc.ts).
// Answer: the PDF. The layout and fonts live here, so the file is the same
// whichever device asked for it.
//
// Only a logged-in team account may use it: the caller's Supabase access token
// is checked with the database's own is_team_member() — the same rule every
// table uses — before anything is rendered. Nothing is stored.
// -----------------------------------------------------------------------------

import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { ReportDocument } from "../lib/reportPdf.mts";
import type { ReportDoc } from "../../src/lib/reportDoc";

const MAX_BODY = 1_000_000; // 1 MB of JSON is far more than any report

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

function reply(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function isTeamMember(authorization: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/is_team_member`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!res.ok) return false;
  return (await res.json()) === true;
}

// Just enough checking that a malformed body gives a clear error, not a crash.
function looksLikeDoc(d: unknown): d is ReportDoc {
  const x = d as ReportDoc;
  return (
    !!x &&
    x.version === 1 &&
    typeof x.fileName === "string" &&
    !!x.header &&
    !!x.cover &&
    Array.isArray(x.cover.tiles) &&
    Array.isArray(x.before) &&
    Array.isArray(x.after) &&
    !!x.planner &&
    Array.isArray(x.planner.columns)
  );
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return reply(405, "Use POST.");

  const authorization = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+$/.test(authorization)) return reply(401, "Log in first.");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return reply(500, "The server is missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.");
  }
  try {
    if (!(await isTeamMember(authorization))) return reply(403, "This login is not allowed to use the board.");
  } catch {
    return reply(502, "Could not check the login with Supabase.");
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY) return reply(413, "Report too large.");
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch {
    return reply(400, "Not valid JSON.");
  }
  if (!looksLikeDoc(doc)) return reply(400, "Not a report document.");

  let pdf: Buffer;
  try {
    pdf = await renderToBuffer(React.createElement(ReportDocument, { doc }) as never);
  } catch (e) {
    console.error("report-pdf render failed", e);
    return reply(500, `PDF render failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  const name = doc.fileName.replace(/[^\w.-]+/g, "_").slice(0, 120) || "Weekly_Report.pdf";
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
};

