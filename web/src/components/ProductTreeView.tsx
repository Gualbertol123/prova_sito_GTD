import { useMemo, useState } from "react";
import { useT } from "../lib/i18n";
import {
  allIds,
  countLeaves,
  glossary,
  marginSteps,
  readingNotesKeys,
  searchIndex,
  sections,
  type TreeNode,
  type TreeSection,
} from "../lib/productTree";

// The ISP product taxonomy (dicui2.xlsx) as a browsable tree.
//
// Read-only reference data: nothing here touches the board, Supabase or any Op.
// It uses only the utility classes the rest of the app already uses, so the
// Liquid Glass skin picks it up with no CSS of its own.

/** Rows open on first paint: the roots and their direct children. */
function defaultOpen(section: TreeSection): Set<string> {
  const open = new Set<string>();
  section.roots.forEach((r) => {
    open.add(r.id);
    r.children?.forEach((c) => open.add(c.id));
  });
  return open;
}

/** Marks the matched substring inside a label without breaking the text flow. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const at = text.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-[#FEF3C7] text-[#92400E] rounded px-0.5">
        {text.slice(at, at + q.length)}
      </mark>
      {text.slice(at + q.length)}
    </>
  );
}

export function ProductTreeView() {
  const { t } = useT();
  const [sectionId, setSectionId] = useState(sections[0].id);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => defaultOpen(sections[0]));

  const section = sections.find((s) => s.id === sectionId) ?? sections[0];
  const searching = query.trim().length > 0;

  const { keep, hits } = useMemo(
    () => searchIndex(section.roots, query),
    [section, query]
  );

  // Hits per section too: the tree on screen is only one of three, and a search
  // that finds nothing here may well have found something next door.
  const hitsBySection = useMemo(() => {
    const out: Record<string, number> = {};
    sections.forEach((s) => {
      out[s.id] = searchIndex(s.roots, query).hits.size;
    });
    return out;
  }, [query]);

  const pickSection = (id: string) => {
    const next = sections.find((s) => s.id === id);
    if (!next) return;
    setSectionId(id);
    setOpen(defaultOpen(next));
  };

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const expandAll = () => setOpen(new Set(allIds(section.roots)));
  const collapseAll = () => setOpen(new Set());

  // While searching, every branch on the way to a hit is forced open so no
  // match can hide behind a closed parent.
  const isOpen = (id: string) => (searching ? keep.has(id) : open.has(id));

  const renderNodes = (nodes: TreeNode[], depth: number) => {
    const visible = searching ? nodes.filter((nd) => keep.has(nd.id)) : nodes;
    if (!visible.length) return null;
    return (
      <ul
        className={
          depth === 0
            ? "space-y-px"
            : "space-y-px ml-[9px] pl-3 border-l border-[#E8E6E1]"
        }
      >
        {visible.map((node) => {
          const kids = node.children ?? [];
          const branch = kids.length > 0;
          const expanded = branch && isOpen(node.id);
          const hit = hits.has(node.id);
          return (
            <li key={node.id}>
              <div
                className={`group flex items-start gap-2 rounded-lg px-2 py-[5px] ${
                  hit ? "bg-[#FBF6EC]" : ""
                }`}
              >
                {branch ? (
                  <button
                    onClick={() => toggle(node.id)}
                    aria-expanded={expanded}
                    aria-label={node.label}
                    className="shrink-0 mt-[1px] w-[18px] h-[18px] rounded-md bg-[#F5F3EF] text-[#6B6B6B] text-[9px] leading-none flex items-center justify-center hover:text-[#0A1931]"
                  >
                    {expanded ? "▾" : "▸"}
                  </button>
                ) : (
                  <span className="shrink-0 mt-[1px] w-[18px] h-[18px] flex items-center justify-center">
                    <span className="w-[5px] h-[5px] rounded-full bg-[#C9A96E]" />
                  </span>
                )}

                <div className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span
                    className={`text-[13px] ${
                      branch
                        ? "font-semibold text-[#0A1931] cursor-pointer"
                        : "text-[#0A1931]"
                    }`}
                    onClick={branch ? () => toggle(node.id) : undefined}
                  >
                    <Highlight text={node.label} query={query} />
                  </span>
                  {node.note && (
                    <span className="text-[11px] text-[#8A8A8A]">
                      <Highlight text={node.note} query={query} />
                    </span>
                  )}
                </div>

                {branch && (
                  <span className="shrink-0 text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full bg-[#EFECE6] text-[#6B6B6B]">
                    {countLeaves(node)}
                  </span>
                )}
              </div>
              {expanded && renderNodes(kids, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  const elsewhere = searching
    ? sections.filter((s) => s.id !== section.id && (hitsBySection[s.id] ?? 0) > 0)
    : [];

  const visibleRoots = searching
    ? section.roots.filter((r) => keep.has(r.id))
    : section.roots;

  return (
    <div className="max-w-[900px] mx-auto space-y-4">
      <div>
        <h2 className="font-trajan text-[16px] uppercase tracking-widest text-[#0A1931]">
          {t("tree.title")}
        </h2>
        <p className="text-[12px] text-[#6B6B6B] mt-2">{t("tree.intro")}</p>
        <p className="text-[11px] text-[#A8A29E] mt-1">{t("tree.source")}</p>
      </div>

      {/* Section picker + search */}
      <div className="rounded-[14px] border border-[#E3DFD7] bg-[#EFECE6] p-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {sections.map((s) => {
            const active = s.id === section.id;
            const total = s.roots.reduce((n, r) => n + countLeaves(r), 0);
            const found = hitsBySection[s.id] ?? 0;
            const empty = searching && found === 0;
            return (
              <button
                key={s.id}
                onClick={() => pickSection(s.id)}
                aria-pressed={active}
                title={
                  searching
                    ? found === 1
                      ? t("tree.inSection1")
                      : t("tree.inSection", { n: found })
                    : undefined
                }
                className={`h-9 px-4 rounded-full text-[11px] font-semibold uppercase tracking-wide border ${
                  active
                    ? "bg-[#0A1931] text-[#C9A96E] border-[#0A1931]"
                    : "bg-white text-[#0A1931] border-[#E8E6E1]"
                } ${empty ? "opacity-40" : ""}`}
              >
                {t(s.labelKey)}
                <span className="ml-1.5 opacity-60 tabular-nums">
                  {searching ? found : total}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-[#6B6B6B]">{t(section.blurbKey)}</p>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("tree.search")}
              className="w-full h-9 rounded-full bg-white border border-[#E8E6E1] pl-3 pr-16 text-[12px] outline-none focus:border-[#C9A96E]"
            />
            {searching && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-[#8A8A8A] hover:text-[#0A1931]"
              >
                {t("tree.clear")}
              </button>
            )}
          </div>
          <button
            onClick={expandAll}
            disabled={searching}
            className="h-9 px-3 rounded-full bg-white border border-[#E8E6E1] text-[11px] text-[#0A1931] disabled:opacity-40"
          >
            {t("tree.expand")}
          </button>
          <button
            onClick={collapseAll}
            disabled={searching}
            className="h-9 px-3 rounded-full bg-white border border-[#E8E6E1] text-[11px] text-[#0A1931] disabled:opacity-40"
          >
            {t("tree.collapse")}
          </button>
        </div>

        {searching && (
          <p className="text-[11px] text-[#8A8A8A]">
            {hits.size === 0
              ? t("tree.match0")
              : hits.size === 1
                ? t("tree.match1")
                : t("tree.matches", { n: hits.size })}
            {elsewhere.length > 0 && (
              <>
                {" · "}
                {t("tree.alsoIn")}{" "}
                {elsewhere.map((s, i) => (
                  <span key={s.id}>
                    {i > 0 && ", "}
                    <button
                      onClick={() => pickSection(s.id)}
                      className="underline text-[#0A1931]"
                    >
                      {t(s.labelKey)} ({hitsBySection[s.id]})
                    </button>
                  </span>
                ))}
              </>
            )}
          </p>
        )}
      </div>

      {/* The trees — one panel per root, so ASSETS and LIABILITIES read apart */}
      {visibleRoots.length === 0 ? (
        <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-8 text-center text-[13px] text-[#A8A29E]">
          {t("tree.noMatch")}
        </div>
      ) : (
        visibleRoots.map((root) => {
          const expanded = isOpen(root.id);
          return (
            <div
              key={root.id}
              className="bg-white rounded-[14px] border border-[#E8E6E1] overflow-hidden"
            >
              <button
                onClick={() => toggle(root.id)}
                aria-expanded={expanded}
                className="w-full flex items-center gap-2 px-4 py-3 text-left"
              >
                <span className="text-[10px] text-[#8A8A8A] w-3">
                  {expanded ? "▾" : "▸"}
                </span>
                <span className="font-trajan text-[11px] uppercase tracking-widest text-[#0A1931]">
                  <Highlight text={root.label} query={query} />
                </span>
                {root.note && (
                  <span className="text-[11px] text-[#8A8A8A]">{root.note}</span>
                )}
                <span className="ml-auto text-[10px] font-semibold tabular-nums px-2 py-0.5 rounded-full bg-[#EFECE6] text-[#6B6B6B]">
                  {countLeaves(root) === 1
                    ? t("tree.leaves1")
                    : t("tree.leaves", { n: countLeaves(root) })}
                </span>
              </button>
              {expanded && root.children?.length ? (
                <div className="px-3 pb-3 pt-1 border-t border-[#E8E6E1]">
                  {renderNodes(root.children, 0)}
                </div>
              ) : null}
            </div>
          );
        })
      )}

      {/* The COMM sheets end in a margin build-up, which is a sequence, not a tree */}
      {section.id === "comm" && !searching && (
        <div className="rounded-[14px] border border-[#C9A96E]/40 bg-[#FBF6EC] p-4">
          <h3 className="font-trajan text-[11px] uppercase tracking-widest text-[#0A1931]">
            {t("tree.margin")}
          </h3>
          <p className="text-[11px] text-[#6B6B6B] mt-1 mb-3">{t("tree.marginBlurb")}</p>
          <ol className="space-y-1">
            {marginSteps.map((step, i) => (
              <li key={i} className="flex items-baseline gap-2">
                <span
                  className={`shrink-0 w-4 text-[12px] ${
                    step.kind === "total" ? "text-[#065F46]" : "text-[#DC2626]"
                  }`}
                >
                  {step.kind === "total" ? "→" : "−"}
                </span>
                <span
                  className={`text-[12px] ${
                    step.kind === "total"
                      ? "font-semibold text-[#0A1931]"
                      : "text-[#6B6B6B]"
                  }`}
                >
                  {step.label}
                </span>
                {step.note && (
                  <span className="text-[11px] text-[#8A8A8A]">({step.note})</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Abbreviations + the caveats that change how the tree should be read */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-4">
          <h3 className="font-trajan text-[11px] uppercase tracking-widest text-[#8A8A8A]">
            {t("tree.glossary")}
          </h3>
          <dl className="mt-3 space-y-1.5">
            {glossary.map(([abbr, meaning]) => (
              <div key={abbr} className="flex gap-2 text-[12px]">
                <dt className="shrink-0 w-12 font-semibold text-[#0A1931]">{abbr}</dt>
                <dd className="text-[#6B6B6B]">{meaning}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-4">
          <h3 className="font-trajan text-[11px] uppercase tracking-widest text-[#8A8A8A]">
            {t("tree.notes")}
          </h3>
          <ul className="mt-3 space-y-2">
            {readingNotesKeys.map((key) => (
              <li key={key} className="flex gap-2 text-[12px] text-[#6B6B6B]">
                <span className="text-[#C9A96E]">•</span>
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
