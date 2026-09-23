// -----------------------------------------------------------------------------
// Product taxonomy of the Corporate / SME / Small Business reporting pack
// (source workbook: dicui2.xlsx — Actual 2026 August vs Budget 2026 August,
// cumulated, mln € at Actual August 2026 FX).
//
// 26 sheets = 13 client segments × 2 templates. Every A_L sheet carries the
// same product list, and so does every COMM sheet; only the segment changes.
// The source cells are empty, so this is structure only — no figures exist to
// show. It is static reference data: nothing here is fetched, stored or synced.
// -----------------------------------------------------------------------------

export interface TreeNode {
  id: string;
  label: string;
  /** Short qualifier shown beside the label (a split, a sign convention…). */
  note?: string;
  children?: TreeNode[];
}

export interface TreeSection {
  id: string;
  /** i18n key for the section's name. */
  labelKey: string;
  /** i18n key for the one-line description under it. */
  blurbKey: string;
  /** Which system colour keys this section off. */
  accent: "blue" | "indigo" | "green";
  roots: TreeNode[];
}

const n = (id: string, label: string, children?: TreeNode[], note?: string): TreeNode => ({
  id,
  label,
  ...(note ? { note } : {}),
  ...(children ? { children } : {}),
});

// The nine loan products that repeat in every performing / NPL block.
const loanProducts = (prefix: string, structuredFinanceSplit = false): TreeNode[] => [
  n(`${prefix}.overdraft`, "Overdraft Facilities"),
  n(`${prefix}.revolving`, "Revolving Credit Cards"),
  n(`${prefix}.charge`, "Charge Credit Cards"),
  n(`${prefix}.st`, "ST lending"),
  n(`${prefix}.mlt`, "MLT lending"),
  n(`${prefix}.leasing`, "Leasing"),
  n(`${prefix}.factoring`, "Factoring"),
  structuredFinanceSplit
    ? n(`${prefix}.structured`, "Structured Finance", [
        n(`${prefix}.structured.pf`, "Project Finance/Specialised Lending"),
        n(`${prefix}.structured.re`, "Real Estate"),
      ])
    : n(`${prefix}.structured`, "Structured Finance"),
  n(`${prefix}.other`, "Other"),
];

// ---- 1. Segments ------------------------------------------------------------
// Labels come from the sheet names. The rollups (SB = Micro + Business, and
// where FI sits) are inferred from those labels, not stated in the workbook.

const segments: TreeNode[] = [
  n(
    "cosme",
    "COSME",
    [
      n(
        "corp",
        "CORP",
        [
          n("dci", "DCI", undefined, "Domestic Corp. and Inst. · Prague Domestic"),
          n("multinat", "MULTINAT", undefined, "Multinational · Prague Multinational"),
        ],
        "Corporate · Prague Corporate"
      ),
      n("sme", "SME", undefined, "SME · Prague SME"),
      n("fi", "FI", undefined, "Financial Institutions"),
      n(
        "sb",
        "SB",
        [n("micro", "MICRO"), n("business", "BUSINESS")],
        "Small Business"
      ),
      n("prague", "PRAGUE", [
        n("pg_dci", "PG_DCI", undefined, "Prague Domestic"),
        n("pg_multinat", "PG_MULTINAT", undefined, "Prague Multinational"),
        n("pg_sme", "PG_SME", undefined, "Prague SME"),
      ]),
    ],
    "Corporate, SME, SB · Prague"
  ),
];

// ---- 2. Assets & Liabilities (A_L sheets) -----------------------------------

const assetsLiabilities: TreeNode[] = [
  n("assets", "ASSETS", [
    n("assets.loans", "Customer Loans", [
      n(
        "assets.loans.perf",
        "Performing Loans",
        loanProducts("assets.loans.perf"),
        "LC / FC — same products in each"
      ),
      n("assets.loans.npl", "Non Performing Loans", [
        n("assets.loans.npl.pastdue", "Past due", loanProducts("assets.loans.npl.pastdue", true)),
        n("assets.loans.npl.utp", "Unlikely to pay"),
        n("assets.loans.npl.doubtful", "Doubtful"),
      ]),
    ]),
    n("assets.interest", "Interest without volumes"),
    n("assets.banks", "Due from banks"),
    n("assets.securities", "Securities and equity investments"),
    n("assets.otherib", "Other interest-bearing assets"),
    n("assets.nonib", "Non interest-bearing assets"),
    n("assets.ftp", "FTP Waivers Assets"),
  ]),
  n("liab", "LIABILITIES", [
    n(
      "liab.deposits",
      "Customer Deposits",
      [
        n("liab.deposits.ca", "Current Accounts"),
        n("liab.deposits.sight", "Sight Dep."),
        n("liab.deposits.saving", "Saving Accounts"),
        n("liab.deposits.tdst", "Time/Term Deposits ST"),
        n("liab.deposits.tdmlt", "Time/Term Deposits MLT"),
        n("liab.deposits.structured", "Structured Deposits"),
        n("liab.deposits.securities", "Bank issued securities"),
        n("liab.deposits.other", "Other"),
      ],
      "LC / FC — same products in each"
    ),
    n("liab.banks", "Due to Banks"),
    n("liab.otherib", "Other interest-bearing liabilities"),
    n("liab.provisions", "Accumulated Provisions"),
    n("liab.nonib", "Non interest-bearing liabilities"),
    n("liab.equity", "Shareholders' Equity"),
    n("liab.ftp", "FTP Waivers Liabilities"),
  ]),
];

// ---- 3. Commissions (COMM sheets) -------------------------------------------

const commissions: TreeNode[] = [
  n("comm", "COMMISSION income/expense", [
    n("comm.cards", "Card Business", [
      n("comm.cards.issuing", "Cards Issuing", undefined, "income (+) / expenses (−)"),
      n("comm.cards.atm", "ATM acquiring", undefined, "income (+) / expenses (−)"),
      n("comm.cards.pos", "POS acquiring", undefined, "income (+) / expenses (−)"),
    ]),
    n("comm.loans", "Loans", [
      n("comm.loans.overdraft", "Overdraft Facilities"),
      n("comm.loans.st", "ST lending"),
      n("comm.loans.mlt", "MLT lending"),
      n("comm.loans.leasing", "Leasing"),
      n("comm.loans.factoring", "Factoring"),
      n("comm.loans.structured", "Structured Finance"),
      n("comm.loans.other", "Other"),
    ]),
    n("comm.deposits", "Deposits", [
      n("comm.deposits.ca", "Current Accounts", [
        n("comm.deposits.ca.savsight", "Saving Accounts/Sight Dep.", [
          n("comm.deposits.ca.savsight.sight", "Sight Dep."),
          n("comm.deposits.ca.savsight.saving", "Saving Accounts"),
        ]),
        n("comm.deposits.ca.tdst", "Time/Term Deposits ST"),
        n("comm.deposits.ca.tdmlt", "Time/Term Deposits MLT"),
        n("comm.deposits.ca.structured", "Structured Deposits"),
      ]),
      n("comm.deposits.securities", "Bank issued securities"),
      n("comm.deposits.other", "Other"),
    ]),
    n("comm.indirect", "Indirect Deposits", [
      n("comm.indirect.aum", "Asset Under Management", [
        n("comm.indirect.aum.mfclass", "Mutual Funds – Asset Class", [
          n("comm.indirect.aum.mfclass.isp", "ISP Group"),
          n("comm.indirect.aum.mfclass.third", "Third Parties"),
        ]),
        n("comm.indirect.aum.mfsaving", "Mutual Funds – Saving Scheme", [
          n("comm.indirect.aum.mfsaving.scheme", "Saving Scheme"),
          n("comm.indirect.aum.mfsaving.combi", "Combi"),
          n("comm.indirect.aum.mfsaving.simple", "Simple Investment"),
        ]),
        n("comm.indirect.aum.dpm", "Discretionary Portfolio Management"),
        n("comm.indirect.aum.pension", "Pension Products", [
          n("comm.indirect.aum.pension.funds", "Pension Funds"),
          n("comm.indirect.aum.pension.other", "Other Pension Products"),
          n("comm.indirect.aum.pension.life", "Life Insurance"),
        ]),
      ]),
      n("comm.indirect.auc", "Asset Under Custody"),
    ]),
    n("comm.pc", "Property and Casualty Insurance", [
      n("comm.pc.nonlife", "Other Non Life Products", [
        n("comm.pc.nonlife.health", "Health Insurance"),
        n("comm.pc.nonlife.house", "House and household Insurance"),
        n("comm.pc.nonlife.property", "Property Insurance (non household)"),
        n("comm.pc.nonlife.motor", "Motor Insurance"),
        n("comm.pc.nonlife.accident", "Accident Insurance"),
        n("comm.pc.nonlife.card", "Card Insurance"),
        n("comm.pc.nonlife.liability", "Liability Insurance"),
        n("comm.pc.nonlife.travel", "Travel Insurance"),
      ]),
      n("comm.pc.othernonlife", "Other non life insurances"),
      n("comm.pc.cpi", "CPI", [
        n("comm.pc.cpi.mortgages", "CPI Mortgages"),
        n("comm.pc.cpi.personal", "CPI Personal Loans"),
        n("comm.pc.cpi.card", "CPI Credit Card"),
        n("comm.pc.cpi.overdraft", "CPI Overdraft"),
        n("comm.pc.cpi.other", "Other CPI"),
      ]),
      n("comm.pc.lifeprot", "Life Protection", [
        n("comm.pc.lifeprot.risk", "Risk Life Insurance"),
        n("comm.pc.lifeprot.modular", "Modular Protection Products"),
      ]),
    ]),
    n("comm.cash", "Cash Management", [
      n("comm.cash.payments", "Payments and collections", [
        n("comm.cash.payments.domestic", "Domestic"),
        n("comm.cash.payments.foreign", "Foreign"),
      ]),
      n("comm.cash.services", "Cash management services"),
      n("comm.cash.other", "Other"),
    ]),
    n("comm.trade", "Trade Finance", [
      n("comm.trade.guarantees", "Trade Guarantees"),
      n("comm.trade.financial", "Financial Guarantees/SBLC"),
      n("comm.trade.lc", "Letter of Credit"),
      n("comm.trade.other", "Other"),
    ]),
    n("comm.services", "Other Services (ex Channels)", [
      n("comm.services.digital", "Digital Channels Contracts"),
      n("comm.services.einvoice", "e-invoices Contracts"),
      n("comm.services.aggregation", "Account Aggregation & Payment Contracts"),
      n("comm.services.other", "Other"),
    ]),
    n("comm.ib", "Investment banking"),
    n("comm.other", "Other Commission"),
  ]),
  n("trading", "TRADING income/expense"),
  n("otheropinc", "Other operating income/expense", [
    n("otheropinc.cards", "Cards"),
    n("otheropinc.other", "Other"),
  ]),
];

/** The margin build-up at the foot of every COMM sheet. Not a tree — a sequence. */
export interface MarginStep {
  kind: "total" | "deduction";
  label: string;
  note?: string;
}

export const marginSteps: MarginStep[] = [
  { kind: "total", label: "NON INTEREST MARGIN" },
  { kind: "total", label: "NET OPERATING MARGIN", note: "and excl. Waivers" },
  { kind: "deduction", label: "Provisions" },
  { kind: "total", label: "NET OPERATING MARGIN AFTER PROVISIONS", note: "and excl. Waivers" },
  { kind: "deduction", label: "Levies" },
];

export const sections: TreeSection[] = [
  { id: "segments", labelKey: "tree.segments", blurbKey: "tree.segmentsBlurb", accent: "indigo", roots: segments },
  { id: "al", labelKey: "tree.al", blurbKey: "tree.alBlurb", accent: "blue", roots: assetsLiabilities },
  { id: "comm", labelKey: "tree.comm", blurbKey: "tree.commBlurb", accent: "green", roots: commissions },
];

/** Abbreviations used across the workbook. */
export const glossary: [string, string][] = [
  ["LC", "local currency"],
  ["FC", "foreign currency"],
  ["ST", "short term"],
  ["MLT", "medium/long term"],
  ["NPL", "non-performing loans"],
  ["FTP", "funds transfer pricing"],
  ["CPI", "credit protection insurance"],
  ["SBLC", "standby letter of credit"],
];

/** Caveats from the source file that change how the tree should be read. */
export const readingNotesKeys = ["tree.note1", "tree.note2", "tree.note3"];

// ---- Helpers ----------------------------------------------------------------

/** Total descendants of a node (not just direct children). */
export function countLeaves(node: TreeNode): number {
  if (!node.children?.length) return 1;
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
}

export function maxDepth(node: TreeNode, depth = 1): number {
  if (!node.children?.length) return depth;
  return Math.max(...node.children.map((c) => maxDepth(c, depth + 1)));
}

const matches = (node: TreeNode, q: string) =>
  node.label.toLowerCase().includes(q) || (node.note?.toLowerCase().includes(q) ?? false);

/**
 * Ids of every node that either matches the query or has a matching
 * descendant — i.e. exactly the branches worth keeping on screen, plus the
 * path down to each hit so nothing matched is hidden behind a closed parent.
 */
export function searchIndex(roots: TreeNode[], query: string): { keep: Set<string>; hits: Set<string> } {
  const keep = new Set<string>();
  const hits = new Set<string>();
  const q = query.trim().toLowerCase();
  if (!q) return { keep, hits };

  const walk = (node: TreeNode, ancestors: string[]): boolean => {
    const self = matches(node, q);
    if (self) hits.add(node.id);
    const childHit = (node.children ?? []).reduce(
      (acc, c) => walk(c, [...ancestors, node.id]) || acc,
      false
    );
    if (self || childHit) {
      keep.add(node.id);
      ancestors.forEach((a) => keep.add(a));
    }
    return self || childHit;
  };
  roots.forEach((r) => walk(r, []));
  return { keep, hits };
}

/** Every id in a set of trees, for "expand all". */
export function allIds(roots: TreeNode[]): string[] {
  const out: string[] = [];
  const walk = (node: TreeNode) => {
    out.push(node.id);
    node.children?.forEach(walk);
  };
  roots.forEach(walk);
  return out;
}
