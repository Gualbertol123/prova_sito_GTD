// -----------------------------------------------------------------------------
// The weekly report as a PDF, made on the server with @react-pdf/renderer.
//
// It receives the ReportDoc the browser built (web/src/lib/reportDoc.ts) and
// lays it out itself — its own layout engine, its own embedded fonts — so the
// same report gives the same PDF on every device. The look follows the Liquid
// Glass pages of the REPORT tab: soft colour washes behind white glass cards,
// Apple's light system colours, Inter. Text is real PDF text.
//
// Pages: the cover; the Done / Next / Projects sections flowing over portrait
// pages (a card is never split, a heading never ends a page); the planner on
// one landscape page; then the retro. Page numbers are automatic.
// -----------------------------------------------------------------------------

import React from "react";
import {
  Circle,
  Defs,
  Document,
  Font,
  LinearGradient,
  Page,
  Path,
  RadialGradient,
  Stop,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import type { DocCard, DocColumn, DocSection, ReportDoc } from "../../src/lib/reportDoc";
import { INTER, INTER_EXT } from "./fonts.generated.mjs";

const h = React.createElement;

Font.register({
  family: "Inter",
  fonts: Object.entries(INTER).map(([w, src]) => ({ src, fontWeight: Number(w) })),
});
Font.register({
  family: "InterExt",
  fonts: Object.entries(INTER_EXT).map(([w, src]) => ({ src, fontWeight: Number(w) })),
});
// Inter first, Latin Extended for anything it lacks.
const FONT = ["Inter", "InterExt"];
// Words are never hyphenated.
Font.registerHyphenationCallback((word) => [word]);

// ---- Tokens (pt; 1 CSS px = 0.75 pt) --------------------------------------------

const A4 = { w: 595.28, h: 841.89 };
const PAD_X = 42;
const TOP = 75;
const BOTTOM = 56;
const GAP = 10.5;

const INK = "#1d1d1f";
const INK2 = "rgba(29,29,31,0.72)";
const INK3 = "rgba(29,29,31,0.52)";

function rgba(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Blend between gradient stops, for the headline's colour sweep.
function mix(stops: string[], t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = parseInt(stops[i].slice(1), 16);
  const b = parseInt(stops[i + 1].slice(1), 16);
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}
// Dark ink into indigo and violet, like the headline on screen.
const HEADLINE = ["#1d1d1f", "#3a3a8c", "#7d3fd1"];

// ---- Page furniture ------------------------------------------------------------------

// Colour washes: three soft radial blooms, arranged per page like the screen.
const WASHES: [string, number, number, number, number][][] = [
  [["#007AFF", 0.38, 0.05, 0.08, 0.36], ["#AF52DE", 0.34, 1.02, 0.42, 0.32], ["#FF2D55", 0.22, 0.45, 1.04, 0.28]],
  [["#32ADE6", 0.32, 1.0, 0.02, 0.36], ["#34C759", 0.22, -0.02, 0.66, 0.32], ["#5856D6", 0.26, 0.95, 1.0, 0.28]],
  [["#AF52DE", 0.28, 0.02, 0.1, 0.36], ["#FF9500", 0.2, 1.0, 0.6, 0.32], ["#007AFF", 0.28, 0.2, 1.02, 0.28]],
  [["#FF2D55", 0.2, 0.98, 0.04, 0.34], ["#32ADE6", 0.3, -0.02, 0.5, 0.34], ["#AF52DE", 0.28, 0.96, 0.98, 0.3]],
];

function Background({ variant, w, hgt }: { variant: number; w: number; hgt: number }) {
  const blobs = WASHES[variant % WASHES.length];
  const d = Math.max(w, hgt);
  return h(
    View,
    { fixed: true, style: { position: "absolute", top: 0, left: 0, width: w, height: hgt } },
    h(
      Svg,
      { width: w, height: hgt, viewBox: `0 0 ${w} ${hgt}` },
      h(
        Defs,
        null,
        ...blobs.map(([c, a], i) =>
          h(
            RadialGradient,
            { key: i, id: `wash${i}` },
            h(Stop, { offset: "0", stopColor: c, stopOpacity: a }),
            h(Stop, { offset: "1", stopColor: c, stopOpacity: 0 })
          )
        ),
        h(
          LinearGradient,
          { id: "logo", x1: "0", y1: "0", x2: "1", y2: "1" },
          h(Stop, { offset: "0", stopColor: "#007AFF" }),
          h(Stop, { offset: "0.45", stopColor: "#AF52DE" }),
          h(Stop, { offset: "0.75", stopColor: "#FF2D55" }),
          h(Stop, { offset: "1", stopColor: "#FF9500" })
        )
      ),
      ...blobs.map(([, , x, y, r], i) =>
        h(Circle, { key: i, cx: x * w, cy: y * hgt, r: r * d, fill: `url(#wash${i})` })
      )
    )
  );
}

function LogoDot({ size = 7.5 }: { size?: number }) {
  return h(
    Svg,
    { width: size, height: size, viewBox: "0 0 10 10", style: { marginRight: 6 } },
    h(
      Defs,
      null,
      h(
        LinearGradient,
        { id: "dot", x1: "0", y1: "0", x2: "1", y2: "1" },
        h(Stop, { offset: "0", stopColor: "#007AFF" }),
        h(Stop, { offset: "0.45", stopColor: "#AF52DE" }),
        h(Stop, { offset: "0.75", stopColor: "#FF2D55" }),
        h(Stop, { offset: "1", stopColor: "#FF9500" })
      )
    ),
    h(Circle, { cx: 5, cy: 5, r: 5, fill: "url(#dot)" })
  );
}

function Header({ doc, w }: { doc: ReportDoc; w: number }) {
  return h(
    View,
    {
      fixed: true,
      style: {
        position: "absolute",
        top: 30,
        left: PAD_X,
        width: w - PAD_X * 2,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      },
    },
    h(
      View,
      { style: { flexDirection: "row", alignItems: "center" } },
      h(LogoDot, null),
      h(Text, { style: { fontSize: 8.25, fontWeight: 600, color: INK2 } }, doc.header.brand)
    ),
    h(Text, { style: { fontSize: 8.25, color: INK3 } }, doc.header.period)
  );
}

function Footer({ doc, w }: { doc: ReportDoc; w: number }) {
  return h(
    View,
    {
      fixed: true,
      style: {
        position: "absolute",
        bottom: 24,
        left: PAD_X,
        width: w - PAD_X * 2,
        flexDirection: "row",
        justifyContent: "space-between",
      },
    },
    h(Text, { style: { fontSize: 8.25, color: INK3 } }, doc.header.footer),
    h(Text, {
      style: { fontSize: 8.25, color: INK3 },
      render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
        `${pageNumber} / ${totalPages}`,
    })
  );
}

// ---- Glass ----------------------------------------------------------------------------

type Style = Record<string, unknown>;

// A glass card: a soft drop shadow under a white film with a light rim.
function Glass({ children, style, radius = 16.5, wrap = false }: { children?: React.ReactNode; style?: Style; radius?: number; wrap?: boolean }) {
  return h(
    View,
    { wrap, style: { position: "relative", ...style } },
    h(View, {
      style: {
        position: "absolute",
        top: 3,
        left: 1.5,
        right: 1.5,
        bottom: -3,
        borderRadius: radius,
        backgroundColor: "rgba(15,23,42,0.045)",
      },
    }),
    h(
      View,
      {
        style: {
          borderRadius: radius,
          backgroundColor: "rgba(255,255,255,0.80)",
          borderWidth: 0.75,
          borderColor: "rgba(60,60,67,0.09)",
          padding: 0,
          overflow: "hidden",
        },
      },
      children
    )
  );
}

function Accent({ color }: { color: string }) {
  return h(View, {
    style: {
      position: "absolute",
      left: 0,
      top: 13.5,
      bottom: 13.5,
      width: 3,
      borderTopRightRadius: 3,
      borderBottomRightRadius: 3,
      backgroundColor: color,
    },
  });
}

function Pill({ text, color, size = 8.25 }: { text: string; color: string; size?: number }) {
  return h(
    View,
    {
      style: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        height: size * 2,
        paddingHorizontal: size * 0.8,
        borderRadius: size,
        backgroundColor: rgba(color, 0.09),
      },
    },
    h(View, { style: { width: 5.25, height: 5.25, borderRadius: 2.7, backgroundColor: color, marginRight: 4 } }),
    h(Text, { style: { fontSize: size, fontWeight: 700, color } }, text)
  );
}

function CountBadge({ text, color, size = 11.25 }: { text: string; color: string; size?: number }) {
  if (!text) return null;
  return h(
    View,
    {
      style: {
        height: size * 2,
        minWidth: size * 2,
        paddingHorizontal: size * 0.75,
        borderRadius: size * 0.55,
        backgroundColor: rgba(color, 0.09),
        alignItems: "center",
        justifyContent: "center",
      },
    },
    h(Text, { style: { fontSize: size, fontWeight: 700, color } }, text)
  );
}

function Check({ done, size = 11 }: { done: boolean; size?: number }) {
  return h(
    Svg,
    { width: size, height: size, viewBox: "0 0 12 12", style: { marginRight: 7, marginTop: 1 } },
    done
      ? h(Circle, { cx: 6, cy: 6, r: 6, fill: "#34C759" })
      : h(Circle, { cx: 6, cy: 6, r: 5.3, fill: "none", stroke: "#c7c7cc", strokeWidth: 1.2 }),
    done
      ? h(Path, { d: "M3.3 6.2 5.2 8 8.8 4.2", fill: "none", stroke: "#ffffff", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" })
      : null
  );
}

function Progress({ value, label, color }: { value: number; label: string; color: string }) {
  return h(
    View,
    { style: { flexDirection: "row", alignItems: "center", marginTop: 9 } },
    h(
      View,
      { style: { flex: 1, height: 4.5, borderRadius: 2.25, backgroundColor: "rgba(60,60,67,0.09)" } },
      h(View, {
        style: {
          width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`,
          height: 4.5,
          borderRadius: 2.25,
          backgroundColor: color,
        },
      })
    ),
    label ? h(Text, { style: { fontSize: 8.6, fontWeight: 600, color: INK3, marginLeft: 7.5 } }, label) : null
  );
}

function Subs({ items, more, twoCols = false }: { items: { text: string; done: boolean }[]; more: string; twoCols?: boolean }) {
  if (!items.length) return null;
  return h(
    View,
    { style: twoCols ? { marginTop: 9, flexDirection: "row", flexWrap: "wrap" } : { marginTop: 9 } },
    ...items.map((s, i) =>
      h(
        View,
        {
          key: i,
          style: {
            flexDirection: "row",
            width: twoCols ? "50%" : "100%",
            paddingRight: twoCols ? 9 : 0,
            marginBottom: 5,
          },
        },
        h(Check, { done: s.done }),
        h(Text, { style: { flex: 1, fontSize: 9.4, lineHeight: 1.4, color: s.done ? INK3 : INK2 } }, s.text)
      )
    ),
    more ? h(Text, { style: { fontSize: 8.6, color: INK3, paddingLeft: 18, width: "100%" } }, more) : null
  );
}

// A task's date line; a leading "✓" (not in the font) is drawn as an icon.
function Meta({ text }: { text: string }) {
  const done = /^\s*✓\s*/.test(text);
  return h(
    View,
    { style: { flexDirection: "row", alignItems: "center", maxWidth: "60%" } },
    done
      ? h(
          Svg,
          { width: 7.5, height: 7.5, viewBox: "0 0 12 12", style: { marginRight: 3.5 } },
          h(Path, { d: "M2.2 6.4 4.9 9 9.8 3.4", fill: "none", stroke: "#8e8e93", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" })
        )
      : null,
    h(Text, { style: { fontSize: 8.6, fontWeight: 500, color: INK3, textAlign: "right" } }, text.replace(/^\s*✓\s*/, ""))
  );
}

// ---- Cards -----------------------------------------------------------------------------

function Card({ card }: { card: DocCard }) {
  if (card.kind === "empty") {
    return h(
      Glass,
      { style: { marginTop: GAP } },
      h(Text, { style: { padding: 16.5, fontSize: 9.75, color: INK3, textAlign: "center" } }, card.text)
    );
  }
  const body: React.ReactNode[] = [];
  if (card.kind === "task") {
    body.push(
      h(
        View,
        { key: "top", style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" } },
        h(Pill, { text: card.prio.text, color: card.prio.color }),
        h(Meta, { text: card.meta })
      ),
      h(Text, { key: "t", style: { marginTop: 7.5, fontSize: 12.75, lineHeight: 1.3, fontWeight: 600, color: INK } }, card.title)
    );
    if (card.desc) {
      body.push(h(Text, { key: "d", style: { marginTop: 3, fontSize: 9.75, lineHeight: 1.45, color: INK2 } }, card.desc));
    }
    if (card.progress) body.push(h(Progress, { key: "p", ...card.progress }));
    body.push(h(Subs, { key: "s", items: card.subs, more: card.more }));
  } else if (card.kind === "project") {
    body.push(
      h(
        View,
        { key: "top", style: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" } },
        h(Text, { style: { flex: 1, fontSize: 12.75, lineHeight: 1.3, fontWeight: 600, color: INK } }, card.title),
        h(Text, { style: { fontSize: 18, fontWeight: 700, color: "#6a4fd8", marginLeft: 9 } }, card.pct)
      ),
      h(Progress, { key: "p", ...card.progress }),
      h(Subs, { key: "s", items: card.items, more: card.more, twoCols: true })
    );
  } else if (card.kind === "retro") {
    body.push(
      h(Text, { key: "l", style: { fontSize: 8.25, fontWeight: 700, letterSpacing: 0.75, color: card.accent } }, card.label.toUpperCase()),
      h(
        View,
        { key: "b", style: { marginTop: 7.5 } },
        ...card.items.map((it, i) =>
          h(
            View,
            { key: i, style: { flexDirection: "row", marginBottom: 4 } },
            h(Text, { style: { width: 10, fontSize: 9.75, color: INK3 } }, "•"),
            h(Text, { style: { flex: 1, fontSize: 9.75, lineHeight: 1.45, color: INK2 } }, it)
          )
        )
      )
    );
  }
  return h(
    Glass,
    { style: { marginTop: GAP } },
    h(Accent, { color: card.accent }),
    h(View, { style: { paddingTop: 13.5, paddingBottom: 12, paddingLeft: 18, paddingRight: 16.5 } }, ...body)
  );
}

function SectionHead({ s }: { s: Pick<DocSection, "eyebrow" | "title" | "count" | "color"> }) {
  return h(
    View,
    { style: { paddingTop: 13.5, paddingBottom: 1.5, paddingHorizontal: 1.5 } },
    h(Text, { style: { fontSize: 8.25, fontWeight: 700, letterSpacing: 0.75, color: s.color } }, s.eyebrow.toUpperCase()),
    h(
      View,
      { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4.5 } },
      h(Text, { style: { flex: 1, fontSize: 25.5, lineHeight: 1.15, fontWeight: 700, letterSpacing: -0.6, color: INK } }, s.title),
      h(CountBadge, { text: s.count, color: s.color })
    )
  );
}

function Section({ s, first }: { s: DocSection; first: boolean }) {
  return h(
    View,
    { style: { marginTop: first ? 0 : GAP } },
    // A heading never sits alone at the bottom of a page.
    h(View, { wrap: false, minPresenceAhead: 110 }, h(SectionHead, { s })),
    ...s.cards.map((c, i) => h(View, { key: i, wrap: false }, h(Card, { card: c })))
  );
}

// ---- Pages -----------------------------------------------------------------------------

function Cover({ doc }: { doc: ReportDoc }) {
  const c = doc.cover;
  const words = c.title.split(/(\s+)/);
  const n = Math.max(1, words.filter((w) => w.trim()).length - 1);
  let k = 0;
  return h(
    Page,
    { size: "A4", style: { backgroundColor: "#f5f5f7", fontFamily: FONT, color: INK } },
    h(Background, { variant: 0, w: A4.w, hgt: A4.h }),
    h(
      View,
      { style: { position: "absolute", top: 36, left: PAD_X, right: PAD_X, bottom: 63 } },
      // Board name and period, as glass pills.
      h(
        View,
        { style: { flexDirection: "row", justifyContent: "space-between" } },
        ...[
          [true, c.board],
          [false, c.period],
        ].map(([logo, text], i) =>
          h(
            Glass,
            { key: i, radius: 12.75 },
            h(
              View,
              { style: { flexDirection: "row", alignItems: "center", height: 25.5, paddingHorizontal: 12 } },
              logo ? h(LogoDot, null) : null,
              h(Text, { style: { fontSize: 9.4, fontWeight: 600, color: INK2 } }, String(text))
            )
          )
        )
      ),
      // Headline.
      h(Text, { style: { marginTop: 63, fontSize: 9, fontWeight: 700, letterSpacing: 0.8, color: "#007AFF" } }, c.eyebrow.toUpperCase()),
      h(
        Text,
        { style: { marginTop: 7.5, fontSize: 51, lineHeight: 1.04, fontWeight: 800, letterSpacing: -1.8 } },
        ...words.map((w, i) => {
          if (!w.trim()) return w;
          const color = mix(HEADLINE, k++ / n);
          return h(Text, { key: i, style: { color } }, w);
        })
      ),
      c.subtitle
        ? h(Text, { style: { marginTop: 12, width: "82%", fontSize: 12.75, lineHeight: 1.45, color: INK2 } }, c.subtitle)
        : null,
      // Tiles.
      h(
        View,
        { style: { flexDirection: "row", marginTop: 42 } },
        ...c.tiles.map((tile, i) =>
          h(
            Glass,
            { key: i, radius: 15, style: { flex: 1, marginLeft: i ? 9 : 0 } },
            h(
              View,
              { style: { height: 78, paddingTop: 12, paddingHorizontal: 12, paddingBottom: 10.5, justifyContent: "space-between" } },
              h(Text, { style: { fontSize: 28.5, fontWeight: 800, letterSpacing: -1, color: tile.color } }, tile.value),
              h(Text, { style: { fontSize: 8.6, lineHeight: 1.3, fontWeight: 600, color: INK2 } }, tile.label)
            )
          )
        )
      ),
      // Highlights.
      c.highlights
        ? h(
            Glass,
            { style: { marginTop: 12 } },
            h(
              View,
              { style: { paddingVertical: 15, paddingHorizontal: 18 } },
              h(Text, { style: { fontSize: 8.25, fontWeight: 700, letterSpacing: 0.75, color: "#34C759" } }, c.highlights.title.toUpperCase()),
              h(
                View,
                { style: { flexDirection: "row", flexWrap: "wrap", marginTop: 9 } },
                ...c.highlights.items.map((it, i) =>
                  h(
                    View,
                    { key: i, style: { width: "50%", flexDirection: "row", paddingRight: 12, marginBottom: 7 } },
                    it.done
                      ? h(Check, { done: true })
                      : h(View, { style: { width: 11, height: 11, borderRadius: 5.5, backgroundColor: it.color, marginRight: 7, marginTop: 1, borderWidth: 3, borderColor: "rgba(255,255,255,0.75)" } }),
                    h(Text, { style: { flex: 1, fontSize: 10.1, lineHeight: 1.35, fontWeight: 600, color: INK } }, it.text)
                  )
                )
              )
            )
          )
        : null,
      // Summary, at the foot of the page.
      h(View, { style: { flex: 1 } }),
      h(
        Glass,
        null,
        h(
          View,
          { style: { paddingVertical: 15, paddingHorizontal: 18 } },
          h(Text, { style: { fontSize: 8.25, fontWeight: 700, letterSpacing: 0.75, color: "#007AFF" } }, c.note.title.toUpperCase()),
          h(Text, { style: { marginTop: 6, fontSize: 10.5, lineHeight: 1.55, color: INK2 } }, c.note.text)
        )
      )
    ),
    h(Footer, { doc, w: A4.w })
  );
}

function FlowPages({ doc, sections, variant }: { doc: ReportDoc; sections: DocSection[]; variant: number }) {
  if (!sections.length) return null;
  return h(
    Page,
    {
      size: "A4",
      wrap: true,
      style: { backgroundColor: "#f5f5f7", fontFamily: FONT, color: INK, paddingTop: TOP, paddingBottom: BOTTOM, paddingHorizontal: PAD_X },
    },
    h(Background, { variant, w: A4.w, hgt: A4.h }),
    h(Header, { doc, w: A4.w }),
    ...sections.map((s, i) => h(Section, { key: i, s, first: i === 0 })),
    h(Footer, { doc, w: A4.w })
  );
}

// The planner: one landscape page. A very full board is set smaller so it
// still fits; the size is found by measuring (see plannerScale below).
// How many sub-columns a column's cards are spread over: a long column takes
// more of the page width, so it does not have to shrink as much.
function spansOf(columns: DocColumn[]): number[] {
  return columns.map((c) => Math.min(3, Math.max(1, Math.ceil(c.items.length / 9))));
}

/** The planner's fitting: text scale, and how many cards each column shows. */
export interface PlannerFit {
  scale: number;
  /** Cards shown per column (the rest become "+N more"); null = all. */
  limit: number | null;
}

function PlannerPage({ doc, variant, fit }: { doc: ReportDoc; variant: number; fit: PlannerFit }) {
  const W = A4.h;
  const H = A4.w;
  const innerW = W - PAD_X * 2;
  const s = fit.scale;
  const p = {
    ...doc.planner,
    columns: doc.planner.columns.map((c) => {
      if (fit.limit === null || c.items.length <= fit.limit) return c;
      const rest = c.items.length - fit.limit;
      return {
        ...c,
        items: [...c.items.slice(0, fit.limit), { text: `+${rest}`, meta: "", dot: "#c7c7cc" }],
      };
    }),
  };
  const spans = spansOf(doc.planner.columns);
  const totalSpan = spans.reduce((a, b) => a + b, 0);
  const unit = (innerW - GAP * (p.columns.length - 1)) / totalSpan;
  return h(
    Page,
    {
      // Landscape A4 given as explicit dimensions (fixed height, one page).
      size: { width: A4.h, height: A4.w },
      style: { backgroundColor: "#f5f5f7", fontFamily: FONT, color: INK, paddingTop: TOP, paddingBottom: BOTTOM, paddingHorizontal: PAD_X },
    },
    h(Background, { variant, w: W, hgt: H }),
    h(Header, { doc, w: W }),
    h(SectionHead, { s: p }),
    h(
      View,
      { style: { flexDirection: "row", alignItems: "flex-start", marginTop: GAP } },
      ...p.columns.map((c, i) =>
        h(
          Glass,
          { key: i, radius: 16.5 * Math.max(0.7, s), style: { width: unit * spans[i] + GAP * (spans[i] - 1), marginLeft: i ? GAP : 0 } },
          h(
            View,
            { style: { padding: 12 * s } },
            h(
              View,
              { style: { flexDirection: "row", alignItems: "center" } },
              h(View, { style: { width: 7.5 * s, height: 7.5 * s, borderRadius: 3.75 * s, backgroundColor: c.color, marginRight: 6.75 * s } }),
              h(Text, { style: { flex: 1, fontSize: 11.25 * s, fontWeight: 700, color: INK } }, c.title),
              h(CountBadge, { text: c.count, color: c.color, size: 8.25 * s })
            ),
            c.items.length === 0
              ? h(Text, { style: { marginTop: 9 * s, fontSize: 9.4 * s, color: INK3 } }, c.empty)
              : h(
                  View,
                  {
                    style:
                      spans[i] > 1
                        ? { marginTop: 9 * s, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }
                        : { marginTop: 9 * s },
                  },
                  ...c.items.map((it, j) =>
                    h(
                      View,
                      {
                        key: j,
                        style: {
                          flexDirection: "row",
                          width: spans[i] > 1 ? `${100 / spans[i] - 1.5}%` : "100%",
                          marginTop: (spans[i] > 1 ? j >= spans[i] : j > 0) ? 6 * s : 0,
                          paddingVertical: 6.75 * s,
                          paddingHorizontal: 8.25 * s,
                          borderRadius: 10.5 * s,
                          backgroundColor: "rgba(255,255,255,0.85)",
                          borderWidth: 0.6,
                          borderColor: "rgba(60,60,67,0.09)",
                        },
                      },
                      h(View, { style: { width: 5.25 * s, height: 5.25 * s, borderRadius: 2.7 * s, backgroundColor: it.dot, marginRight: 6.75 * s, marginTop: 3.4 * s } }),
                      h(
                        View,
                        { style: { flex: 1 } },
                        h(Text, { style: { fontSize: 9.4 * s, lineHeight: 1.35, fontWeight: 500, color: INK } }, it.text),
                        it.meta ? h(Text, { style: { marginTop: 1.5 * s, fontSize: 7.9 * s, color: INK3 } }, it.meta) : null
                      )
                    )
                  )
                )
          )
        )
      )
    ),
    h(Footer, { doc, w: W })
  );
}

// Count the pages of a rendered PDF.
function pageCount(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
}

/**
 * How to fit the planner on one landscape page: the largest text scale at
 * which the planner page alone renders as a single page (found by halving the
 * interval, a few quick renders); if even the smallest readable scale is not
 * enough, the longest columns are cut and end with "+N". The same input always
 * gives the same answer.
 */
const MIN_SCALE = 0.5;
export async function fitPlanner(doc: ReportDoc, render: (el: React.ReactElement) => Promise<Buffer>): Promise<PlannerFit> {
  const fits = async (fit: PlannerFit) =>
    pageCount(await render(h(Document, null, h(PlannerPage, { doc, variant: 2, fit })))) <= 1;
  if (await fits({ scale: 1, limit: null })) return { scale: 1, limit: null };
  if (await fits({ scale: MIN_SCALE, limit: null })) {
    let lo = MIN_SCALE;
    let hi = 1;
    for (let i = 0; i < 6; i++) {
      const mid = (lo + hi) / 2;
      if (await fits({ scale: mid, limit: null })) lo = mid;
      else hi = mid;
    }
    return { scale: Math.floor(lo * 1000) / 1000, limit: null };
  }
  // Too many cards even at the smallest scale: show as many as fit.
  const longest = Math.max(...doc.planner.columns.map((c) => c.items.length));
  let lo = 0;
  let hi = longest;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (await fits({ scale: MIN_SCALE, limit: mid })) lo = mid;
    else hi = mid;
  }
  return { scale: MIN_SCALE, limit: lo };
}

export function ReportDocument({ doc, planner = { scale: 1, limit: null } }: { doc: ReportDoc; planner?: PlannerFit }) {
  return h(
    Document,
    { title: doc.fileName.replace(/\.pdf$/i, ""), author: doc.header.brand, creator: "TEAM GTD", producer: "TEAM GTD" },
    h(Cover, { doc }),
    h(FlowPages, { doc, sections: doc.before, variant: 1 }),
    h(PlannerPage, { doc, variant: 2, fit: planner }),
    h(FlowPages, { doc, sections: doc.after, variant: 3 })
  );
}
