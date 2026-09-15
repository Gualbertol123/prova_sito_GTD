import { useMemo, useState } from "react";
import type { Board, Op, Reflection } from "../lib/types";
import { useT, localeCode, type Lang } from "../lib/i18n";
import { useMe } from "../lib/identity";
import { toISODate } from "../lib/dates";
import { readReviewedToday, writeReviewedToday } from "../lib/prefs";

function isoMinus(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() - days);
  return toISODate(d);
}

function dayLabel(iso: string, lang: Lang, t: (k: string, v?: Record<string, string | number>) => string): string {
  const today = toISODate(new Date());
  if (iso === today) return t("reflection.today");
  if (iso === isoMinus(today, 1)) return t("review.yesterday");
  return new Date(iso).toLocaleDateString(localeCode(lang));
}

const field =
  "w-full rounded-lg bg-[#F5F3EF] border border-[#E8E6E1] p-2 text-[12px] outline-none focus:border-[#C9A96E] resize-none";
const label = "font-trajan text-[10px] uppercase tracking-wide text-[#A8A29E] mb-1 block";

interface Props {
  board: Board;
  members: string[];
  send: (op: Op) => void;
}

export function DailyReflection({ board, members, send }: Props) {
  const { t, lang } = useT();
  const { me, setMe } = useMe();
  const today = toISODate(new Date());

  const id = `${today}::${me}`;
  const existing = board.reflections.find((r) => r.id === id) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-trajan text-[12px] uppercase tracking-widest text-[#C9A96E]">
          {t("reflection.title")}
        </h3>
        <label className="inline-flex items-center gap-2 text-[11px] text-[#8A8A8A]">
          {t("reflection.me")}
          <select
            value={members.includes(me) ? me : ""}
            onChange={(e) => setMe(e.target.value)}
            className="h-8 rounded-full bg-[#F5F3EF] border border-[#E8E6E1] px-3 text-[12px] text-[#0A1931] outline-none focus:border-[#C9A96E]"
          >
            <option value="">{t("reflection.pickMe")}</option>
            {members.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>

      {me ? (
        <ReflectionForm key={id} id={id} me={me} date={today} existing={existing} send={send} />
      ) : (
        <div className="text-[12px] text-[#A8A29E]">{t("reflection.pickMe")}</div>
      )}

      <SpacedReview me={me} today={today} reflections={board.reflections} />

      <RecentList reflections={board.reflections} lang={lang} />
    </div>
  );
}

function ReflectionForm({
  id,
  me,
  date,
  existing,
  send,
}: {
  id: string;
  me: string;
  date: string;
  existing: Reflection | null;
  send: (op: Op) => void;
}) {
  const { t } = useT();
  const [done, setDone] = useState(existing?.done ?? "");
  const [well, setWell] = useState(existing?.well ?? "");
  const [improve, setImprove] = useState(existing?.improve ?? "");
  const [learning, setLearning] = useState(existing?.learning ?? "");
  const [saved, setSaved] = useState(false);

  const save = () => {
    const reflection: Reflection = {
      id,
      member: me,
      date,
      done: done.trim(),
      well: well.trim(),
      improve: improve.trim(),
      learning: learning.trim(),
      updatedAt: Date.now(),
      createdAt: existing?.createdAt ?? Date.now(),
    };
    send({ type: "reflectionSave", reflection });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="bg-[#FAF9F6] rounded-[12px] border border-[#E8E6E1] p-3 space-y-3">
      {existing && (
        <div className="text-[11px] text-[#8B6F3E]">{t("reflection.editingToday")}</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <span className={label}>{t("reflection.done")}</span>
          <textarea rows={2} value={done} onChange={(e) => setDone(e.target.value)} className={field} />
        </div>
        <div>
          <span className={label}>{t("reflection.well")}</span>
          <textarea rows={2} value={well} onChange={(e) => setWell(e.target.value)} className={field} />
        </div>
        <div>
          <span className={label}>{t("reflection.improve")}</span>
          <textarea rows={2} value={improve} onChange={(e) => setImprove(e.target.value)} className={field} />
        </div>
        <div>
          <span className={label}>{t("reflection.learning")}</span>
          <textarea rows={2} value={learning} onChange={(e) => setLearning(e.target.value)} className={field} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} className="h-9 px-5 rounded-full bg-[#0A1931] text-[#C9A96E] text-[12px] font-semibold">
          {t("reflection.save")}
        </button>
        {saved && <span className="text-[12px] text-[#065F46]">{t("reflection.saved")}</span>}
      </div>
    </div>
  );
}

const OFFSETS = [1, 3, 7, 14, 30];

function SpacedReview({
  me,
  today,
  reflections,
}: {
  me: string;
  today: string;
  reflections: Reflection[];
}) {
  const { t, lang } = useT();
  const [reviewed, setReviewed] = useState<Set<string>>(() => readReviewedToday(today));
  const [randomId, setRandomId] = useState<string | null>(null);

  // Entries whose learning note is "due" at a spaced interval and not yet
  // reviewed today.
  const due = useMemo(() => {
    if (!me) return [];
    return OFFSETS.map((off) => ({ off, date: isoMinus(today, off) }))
      .map(({ off, date }) => ({
        off,
        date,
        r: reflections.find(
          (x) => x.member === me && x.date === date && (x.learning.trim() || x.improve.trim())
        ),
      }))
      .filter((x): x is { off: number; date: string; r: Reflection } => !!x.r && !reviewed.has(x.r.id));
  }, [me, today, reflections, reviewed]);

  const markReviewed = (rid: string) => {
    const next = new Set(reviewed);
    next.add(rid);
    setReviewed(next);
    writeReviewedToday(today, [...next]);
  };

  const pool = useMemo(
    () => reflections.filter((r) => r.member === me && r.learning.trim() && r.date !== today),
    [reflections, me, today]
  );
  const rollRandom = () => {
    if (pool.length === 0) return setRandomId(null);
    setRandomId(pool[Math.floor(Math.random() * pool.length)].id);
  };
  const randomR = randomId ? reflections.find((r) => r.id === randomId) : null;

  const daysAgo = (off: number) => (off === 1 ? t("review.yesterday") : t("review.daysAgo", { n: off }));

  return (
    <div className="bg-white rounded-[12px] border border-[#E8E6E1] p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <h4 className="font-trajan text-[11px] uppercase tracking-widest text-[#8A8A8A]">
          🧠 {t("review.title")}
        </h4>
        {pool.length > 0 && (
          <button onClick={rollRandom} className="h-7 px-3 rounded-full text-[11px] font-semibold bg-[#F5F3EF] border border-[#E8E6E1] text-[#6B6B6B] hover:border-[#C9A96E]">
            🎲 {t("review.random")}
          </button>
        )}
      </div>
      <p className="text-[11px] text-[#8A8A8A] mb-2">{t("review.hint")}</p>

      {randomR && (
        <div className="mb-2 rounded-lg border border-[#C9A96E]/50 bg-[#FBF6EC] p-2.5">
          <div className="text-[10px] uppercase tracking-wide text-[#8B6F3E] mb-1">
            {dayLabel(randomR.date, lang, t)}
          </div>
          <div className="text-[12px] text-[#0A1931] whitespace-pre-wrap">{randomR.learning}</div>
        </div>
      )}

      {due.length === 0 ? (
        <div className="text-[12px] text-[#A8A29E]">{t("review.none")}</div>
      ) : (
        <div className="space-y-2">
          {due.map(({ off, r }) => (
            <div key={r.id} className="rounded-lg border border-[#E8E6E1] bg-[#FAF9F6] p-2.5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] uppercase tracking-wide text-[#8A8A8A]">{daysAgo(off)}</span>
                <button
                  onClick={() => markReviewed(r.id)}
                  className="h-7 px-3 rounded-full text-[11px] font-semibold bg-[#0A1931] text-[#C9A96E]"
                >
                  {t("review.markReviewed")}
                </button>
              </div>
              {r.learning.trim() && (
                <div className="text-[12px] text-[#0A1931] whitespace-pre-wrap">{r.learning}</div>
              )}
              {r.improve.trim() && (
                <div className="text-[11px] text-[#92400E] mt-1 whitespace-pre-wrap">↻ {r.improve}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentList({ reflections, lang }: { reflections: Reflection[]; lang: Lang }) {
  const { t } = useT();
  const recent = useMemo(
    () =>
      [...reflections]
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
        .slice(0, 8),
    [reflections]
  );

  if (recent.length === 0) {
    return <div className="text-[12px] text-[#A8A29E]">{t("reflection.none")}</div>;
  }

  const row = (icon: string, text: string, color: string) =>
    text.trim() ? (
      <div className="text-[11px] text-[#6B6B6B]">
        <span className={color}>{icon}</span> {text}
      </div>
    ) : null;

  return (
    <div>
      <h4 className="font-trajan text-[11px] uppercase tracking-widest text-[#8A8A8A] mb-2">
        {t("reflection.recent")}
      </h4>
      <div className="space-y-2">
        {recent.map((r) => (
          <div key={r.id} className="rounded-lg border border-[#E8E6E1] bg-white p-2.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-[#0A1931] text-white text-[9px] font-bold flex items-center justify-center">
                {r.member.charAt(0).toUpperCase()}
              </span>
              <span className="text-[12px] font-semibold text-[#0A1931]">{r.member}</span>
              <span className="text-[10px] text-[#A8A29E] ml-auto">{dayLabel(r.date, lang, t)}</span>
            </div>
            <div className="space-y-0.5">
              {row("✓", r.done, "text-[#065F46]")}
              {row("★", r.well, "text-[#C9A96E]")}
              {row("↻", r.improve, "text-[#92400E]")}
              {row("🧠", r.learning, "")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
