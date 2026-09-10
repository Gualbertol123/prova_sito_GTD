import { STATUS_HELP, STATUS_LABEL, STATUS_ORDER } from "../lib/constants";

const PRIOS = [
  { p: "P1", label: "Urgente", desc: "Focus P1 filtra solo P1.", dot: "bg-[#DC2626]" },
  { p: "P2", label: "Alta", desc: "Priorità alta standard.", dot: "bg-[#C9A96E]" },
  { p: "P3", label: "Media", desc: "Da pianificare.", dot: "bg-[#C9C5BE]" },
  {
    p: "P4",
    label: "Bassa",
    desc: "Nice-to-have.",
    dot: "bg-transparent border border-dashed border-[#E8E6E1]",
  },
];

const WORKFLOW = [
  { title: "Board:", body: "trascina le card tra le colonne. Ogni card ha owner, priorità, scadenza e sotto-attività." },
  { title: "Weekly Review:", body: "la sezione FATTO si aggiorna da DONE. Usa le 5 colonne WINS, LEARNINGS, TO IMPROVE, BLOCKERS, FOCUS per il retro." },
  { title: "Calendario:", body: "trascina un task su una data per impostare la scadenza." },
  { title: "Tracking:", body: "password Matusalemme per il monitoraggio carico team." },
  { title: "Mail:", body: "genera solo Lavori completati (DONE) + Prossimi step (FOCUS)." },
];

export function InstructionsView() {
  return (
    <div className="max-w-[900px] mx-auto space-y-4">
      {/* Stati & priorità */}
      <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-5">
        <h3 className="font-trajan text-[13px] uppercase tracking-widest text-[#C9A96E] mb-4">
          Stati & Priorità
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[#8A8A8A] mb-2">
              Stati
            </div>
            <div className="space-y-2">
              {STATUS_ORDER.map((s) => (
                <div key={s} className="flex items-start gap-3">
                  <span className="font-trajan text-[11px] uppercase text-[#0A1931] w-[92px] shrink-0">
                    {STATUS_LABEL[s]}
                  </span>
                  <span className="text-[12px] text-[#6B6B6B]">
                    {STATUS_HELP[s]}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[#8A8A8A] mb-2">
              Priorità
            </div>
            <div className="space-y-2">
              {PRIOS.map((p) => (
                <div key={p.p} className="flex items-start gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full mt-1 ${p.dot}`} />
                  <div>
                    <span className="font-semibold text-[12px] text-[#0A1931]">
                      {p.p} · {p.label}
                    </span>
                    <span className="text-[12px] text-[#6B6B6B]"> — {p.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Workflow */}
      <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-5">
        <h3 className="font-trajan text-[13px] uppercase tracking-widest text-[#C9A96E] mb-4">
          Workflow
        </h3>
        <div className="space-y-2">
          {WORKFLOW.map((w) => (
            <div key={w.title} className="text-[13px] text-[#6B6B6B]">
              <span className="font-semibold text-[#0A1931]">{w.title}</span>{" "}
              {w.body}
            </div>
          ))}
        </div>
      </div>

      {/* Sync note */}
      <div className="bg-[#0A1931] rounded-[14px] p-5 text-[#E6EDF8]">
        <h3 className="font-trajan text-[13px] uppercase tracking-widest text-[#C9A96E] mb-2">
          Collaborazione
        </h3>
        <p className="text-[12px] leading-relaxed">
          La board è condivisa in tempo reale: ogni modifica è salvata sul server
          Azure e propagata istantaneamente a tutti gli utenti collegati. Nulla è
          salvato in locale sul browser — chiudendo e riaprendo la pagina vedrai
          sempre lo stato aggiornato del team.
        </p>
      </div>
    </div>
  );
}
