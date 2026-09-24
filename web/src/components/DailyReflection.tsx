import { useEffect, useMemo, useState } from "react";
import type { Board, Op, Reflection } from "../lib/types";
import { useT, localeCode, type Lang } from "../lib/i18n";
import { useMe } from "../lib/identity";
import { toISODate } from "../lib/dates";
import { ensureReflectionAccess } from "../lib/db";
import { PersonalNotes } from "./PersonalNotes";
import {
  readReviewedToday,
  writeReviewedToday,
  isReflAuthed,
  setReflAuth,
  clearReflAuth,
  reflAuthValue,
  readPref,
  writePref,
} from "../lib/prefs";

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

type Pane = "diary" | "notes";

interface Props {
  board: Board;
  members: string[];
  send: (op: Op, onError?: (message: string) => void) => void;
}

const DURATIONS: { k: string; days: number | "never" }[] = [
  { k: "reflAuth.d1", days: 1 },
  { k: "reflAuth.d7", days: 7 },
  { k: "reflAuth.d30", days: 30 },
  { k: "reflAuth.d365", days: 365 },
  { k: "reflAuth.never", days: "never" },
];

function RememberSelect({
  value,
  onChange,
}: {
  value: number | "never";
  onChange: (v: number | "never") => void;
}) {
  const { t } = useT();
  return (
    <label className="inline-flex items-center gap-2 text-[11px] text-[#8A8A8A]">
      {t("reflAuth.remember")}
      <select
        value={String(value)}
        onChange={(e) => onChange(e.target.value === "never" ? "never" : Number(e.target.value))}
        className="h-8 rounded-full bg-[#F5F3EF] border border-[#E8E6E1] px-3 text-[12px] text-[#0A1931] outline-none focus:border-[#C9A96E]"
      >
        {DURATIONS.map((d) => (
          <option key={d.k} value={String(d.days)}>{t(d.k)}</option>
        ))}
      </select>
    </label>
  );
}

export function DailyReflection({ board, members, send }: Props) {
  const { t, lang } = useT();
  const { me, setMe } = useMe();
  const today = toISODate(new Date());
  const [tick, setTick] = useState(0);
  // Which half of this tab you are looking at. Remembered per browser: the
  // notes used to sit under everything else, which made them a scroll away.
  const [pane, setPane] = useState<Pane>(() =>
    readPref("reflpane") === "notes" ? "notes" : "diary"
  );
  const pickPane = (next: Pane) => {
    setPane(next);
    writePref("reflpane", next);
  };
  const bump = () => setTick((n) => n + 1);

  // Seed a reflection_access row per member (default 'password') so every
  // member is visible/resettable in the Supabase table editor.
  const membersKey = members.join("|");
  useEffect(() => {
    ensureReflectionAccess(members);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membersKey]);

  const authed = !!me && isReflAuthed(me);

  if (!authed) {
    return (
      <ReflectionLogin
        board={board}
        members={members}
        onAuthed={(user) => {
          setMe(user);
          bump();
        }}
      />
    );
  }

  const noteCount = (board.personalNotes ?? []).filter((n) => n.member === me).length;
  const id = `${today}::${me}`;
  const existing = board.reflections.find((r) => r.id === id) ?? null;

  return (
    <div className="space-y-4" data-t={tick}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-trajan text-[12px] uppercase tracking-widest text-[#C9A96E]">
          {t("reflAuth.title")} · {me}
        </h3>
        <button
          onClick={() => {
            clearReflAuth(me);
            bump();
          }}
          className="h-8 px-4 rounded-full text-[12px] font-semibold text-[#8A8A8A] border border-[#E8E6E1] hover:border-[#DC2626] hover:text-[#DC2626]"
        >
          {t("reflAuth.logout")}
        </button>
      </div>

      {/* One click between the two halves, so neither is a scroll away. */}
      <div className="flex gap-1.5">
        {(["diary", "notes"] as Pane[]).map((key) => {
          const on = pane === key;
          const count = key === "notes" ? noteCount : 0;
          return (
            <button
              key={key}
              onClick={() => pickPane(key)}
              aria-pressed={on}
              className={`h-9 px-4 rounded-full text-[11px] font-semibold uppercase tracking-wide border ${
                on
                  ? "bg-[#0A1931] text-[#C9A96E] border-[#0A1931]"
                  : "bg-white text-[#0A1931] border-[#E8E6E1]"
              }`}
            >
              {t(key === "diary" ? "reflection.paneDiary" : "reflection.paneNotes")}
              {count > 0 && <span className="ml-1.5 opacity-60 tabular-nums">{count}</span>}
            </button>
          );
        })}
      </div>

      {pane === "diary" ? (
        <>
          <ReflectionForm key={id} id={id} me={me} date={today} existing={existing} send={send} />

          <SpacedReview me={me} today={today} reflections={board.reflections} />

          <RecentList reflections={board.reflections} member={me} lang={lang} />
        </>
      ) : (
        <PersonalNotes board={board} me={me} send={send} />
      )}

      <AccountSection me={me} board={board} send={send} />
    </div>
  );
}

function ReflectionLogin({
  board,
  members,
  onAuthed,
}: {
  board: Board;
  members: string[];
  onAuthed: (user: string) => void;
}) {
  const { t } = useT();
  const { me } = useMe();
  const [user, setUser] = useState(me && members.includes(me) ? me : members[0] ?? "");
  const [pwd, setPwd] = useState("");
  const [remember, setRemember] = useState<number | "never">(30);
  const [err, setErr] = useState(false);

  const submit = () => {
    if (!user) return;
    const expected = board.reflectionPasswords[user] ?? "password";
    if (pwd === expected) {
      setReflAuth(user, remember);
      onAuthed(user);
    } else {
      setErr(true);
    }
  };

  return (
    <div className="max-w-[420px] mx-auto mt-8 bg-white rounded-[16px] border border-[#E8E6E1] p-6">
      <div className="w-12 h-12 rounded-full bg-[#0A1931] text-[#C9A96E] flex items-center justify-center mx-auto text-[20px]">
        📓
      </div>
      <h3 className="font-trajan text-[14px] uppercase tracking-widest text-[#0A1931] mt-4 text-center">
        {t("reflAuth.title")}
      </h3>
      <p className="text-[12px] text-[#8A8A8A] mt-2 mb-4 text-center">{t("reflAuth.prompt")}</p>
      <div className="space-y-2">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-[#8A8A8A]">{t("reflAuth.user")}</span>
          <select
            value={user}
            onChange={(e) => {
              setUser(e.target.value);
              setErr(false);
            }}
            className="mt-1 w-full h-10 rounded-lg bg-[#F5F3EF] border border-[#E8E6E1] px-3 text-[13px] outline-none focus:border-[#C9A96E]"
          >
            {members.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-[#8A8A8A]">{t("reflAuth.password")}</span>
          <input
            type="password"
            value={pwd}
            autoFocus
            onChange={(e) => {
              setPwd(e.target.value);
              setErr(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className={`mt-1 w-full h-10 rounded-lg bg-[#F5F3EF] border px-3 text-[13px] outline-none ${
              err ? "border-[#DC2626]" : "border-[#E8E6E1] focus:border-[#C9A96E]"
            }`}
          />
        </label>
        {err && <p className="text-[11px] text-[#DC2626]">{t("reflAuth.wrong")}</p>}
        <div className="pt-1">
          <RememberSelect value={remember} onChange={setRemember} />
        </div>
      </div>
      <button
        onClick={submit}
        className="mt-4 w-full h-10 rounded-full bg-[#0A1931] text-[#C9A96E] text-[13px] font-semibold"
      >
        {t("reflAuth.enter")}
      </button>
      <p className="text-[11px] text-[#A8A29E] mt-3 text-center">{t("reflAuth.hint")}</p>
    </div>
  );
}

function AccountSection({ me, board, send }: { me: string; board: Board; send: (op: Op) => void }) {
  const { t } = useT();
  const current = board.reflectionPasswords[me] ?? "password";
  const [show, setShow] = useState(false);
  const [np, setNp] = useState("");
  const [saved, setSaved] = useState(false);
  const [remember, setRemember] = useState<number | "never">(() =>
    reflAuthValue(me) === "never" ? "never" : 30
  );

  const change = () => {
    const v = np.trim();
    if (!v || v === current) return;
    send({ type: "reflectionPasswordSet", member: me, password: v });
    setNp("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-4 space-y-3">
      <h4 className="font-trajan text-[11px] uppercase tracking-widest text-[#8A8A8A]">
        {t("reflAuth.account")}
      </h4>
      <div className="flex items-center gap-2 text-[12px] flex-wrap">
        <span className="text-[#8A8A8A]">{t("reflAuth.password")}:</span>
        <span className="font-mono text-[#0A1931]">
          {show ? current : "•".repeat(Math.max(6, current.length))}
        </span>
        <button onClick={() => setShow((s) => !s)} className="text-[11px] text-[#8B6F3E] underline underline-offset-2">
          {show ? t("reflAuth.hide") : t("reflAuth.show")}
        </button>
      </div>
      <div className="flex gap-2">
        <input
          value={np}
          onChange={(e) => setNp(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && change()}
          placeholder={t("reflAuth.newPassword")}
          className="flex-1 min-w-0 h-9 rounded-lg bg-[#F5F3EF] border border-[#E8E6E1] px-3 text-[13px] outline-none focus:border-[#C9A96E]"
        />
        <button onClick={change} className="h-9 px-4 rounded-full bg-[#0A1931] text-[#C9A96E] text-[12px] font-semibold shrink-0">
          {t("settings.save")}
        </button>
      </div>
      {saved && <div className="text-[12px] text-[#065F46]">{t("reflAuth.changed")}</div>}
      <RememberSelect
        value={remember}
        onChange={(v) => {
          setRemember(v);
          setReflAuth(me, v);
        }}
      />
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

function RecentList({
  reflections,
  member,
  lang,
}: {
  reflections: Reflection[];
  member: string;
  lang: Lang;
}) {
  const { t } = useT();
  const recent = useMemo(
    () =>
      reflections
        .filter((r) => r.member === member)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
        .slice(0, 14),
    [reflections, member]
  );

  if (recent.length === 0) {
    return <div className="text-[12px] text-[#A8A29E]">{t("reflection.none")}</div>;
  }

  const row = (label: string, text: string, color: string) =>
    text.trim() ? (
      <div className="flex gap-2">
        <span className={`w-[104px] shrink-0 text-[9px] font-semibold uppercase tracking-wide pt-0.5 ${color}`}>
          {label}
        </span>
        <span className="flex-1 min-w-0 text-[12px] text-[#0A1931] whitespace-pre-wrap break-words">{text}</span>
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
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-[#0A1931] text-white text-[9px] font-bold flex items-center justify-center">
                {r.member.charAt(0).toUpperCase()}
              </span>
              <span className="text-[12px] font-semibold text-[#0A1931]">{r.member}</span>
              <span className="text-[10px] text-[#A8A29E] ml-auto">{dayLabel(r.date, lang, t)}</span>
            </div>
            <div className="space-y-1.5">
              {row(t("reflection.done"), r.done, "text-[#065F46]")}
              {row(t("reflection.well"), r.well, "text-[#8B6F3E]")}
              {row(t("reflection.improve"), r.improve, "text-[#92400E]")}
              {row(t("reflection.learning"), r.learning, "text-[#3A5A8A]")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
