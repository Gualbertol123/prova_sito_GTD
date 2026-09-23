// -----------------------------------------------------------------------------
// Consolidated product taxonomy of the Corporate / SME / Small Business
// reporting pack (source workbook: dicui2.xlsx — Actual 2026 August vs Budget
// 2026 August, cumulated, mln € at Actual August 2026 FX).
//
// 26 sheets = 13 client segments × 2 templates (A_L = balance-sheet volumes,
// COMM = commissions and margins). Every segment carries the same products.
//
// Each product appears ONCE here, grouped into families, with tags saying which
// template reports it. The source cells hold no figures, so this is structure
// only. It is static reference data: nothing is fetched, stored or synced.
// -----------------------------------------------------------------------------

/** Where a product is reported. */
export type Tag = "V" | "NPL" | "C";

export const TAGS: Tag[] = ["V", "NPL", "C"];

export interface TreeNode {
  id: string;
  label: string;
  /** Short qualifier shown beside the label. */
  note?: string;
  /**
   * Declared where the source file declares it. A family tag covers every line
   * beneath it that does not declare tags of its own.
   */
  tags?: Tag[];
  children?: TreeNode[];
}

export interface TreeSection {
  id: string;
  /** i18n key for the section's name. */
  labelKey: string;
  /** i18n key for the one-line description under it. */
  blurbKey: string;
  roots: TreeNode[];
}

interface NodeOpts {
  note?: string;
  tags?: Tag[];
  children?: TreeNode[];
}

const n = (id: string, label: string, o: NodeOpts = {}): TreeNode => ({
  id,
  label,
  ...(o.note ? { note: o.note } : {}),
  ...(o.tags ? { tags: o.tags } : {}),
  ...(o.children ? { children: o.children } : {}),
});

const VNC: Tag[] = ["V", "NPL", "C"];
const VN: Tag[] = ["V", "NPL"];
const VC: Tag[] = ["V", "C"];
const C: Tag[] = ["C"];

// ---- 1. Client segments -----------------------------------------------------
// Labels come from the sheet names; the rollups are inferred from those labels.

const segments: TreeNode[] = [
  n("cosme", "COSME", {
    note: "Corporate, SME, SB · Prague",
    children: [
      n("corp", "CORP", {
        note: "Corporate · Prague Corporate",
        children: [
          n("dci", "DCI", { note: "Domestic Corp. and Inst. · Prague Domestic" }),
          n("multinat", "MULTINAT", { note: "Multinational · Prague Multinational" }),
        ],
      }),
      n("sme", "SME", { note: "SME · Prague SME" }),
      n("fi", "FI", { note: "Financial Institutions" }),
      n("sb", "SB", {
        note: "Small Business",
        children: [n("micro", "MICRO"), n("business", "BUSINESS")],
      }),
      n("prague", "PRAGUE", {
        children: [
          n("pg_dci", "PG_DCI", { note: "Prague Domestic" }),
          n("pg_multinat", "PG_MULTINAT", { note: "Prague Multinational" }),
          n("pg_sme", "PG_SME", { note: "Prague SME" }),
        ],
      }),
    ],
  }),
];

// ---- 2. Product tree --------------------------------------------------------
// One entry per product, grouped by family. A family-level tag covers the lines
// beneath it that carry no tags of their own, which is how the file writes them.

const products: TreeNode[] = [
  n("lending", "LENDING", {
    children: [
      n("lending.overdraft", "Overdraft Facilities", { tags: VNC }),
      n("lending.st", "ST lending", { tags: VNC }),
      n("lending.mlt", "MLT lending", { tags: VNC }),
      n("lending.leasing", "Leasing", { tags: VNC }),
      n("lending.factoring", "Factoring", { tags: VNC }),
      n("lending.structured", "Structured Finance", {
        tags: VNC,
        children: [
          n("lending.structured.pf", "Project Finance/Specialised Lending"),
          n("lending.structured.re", "Real Estate"),
        ],
      }),
      n("lending.other", "Other lending", { tags: VNC }),
    ],
  }),

  n("cards", "CARDS & ACQUIRING", {
    children: [
      n("cards.issuing", "Card issuing", {
        tags: C,
        note: "income / expense",
        children: [
          n("cards.issuing.revolving", "Revolving Credit Cards", { tags: VN }),
          n("cards.issuing.charge", "Charge Credit Cards", { tags: VN }),
        ],
      }),
      n("cards.acquiring", "Acquiring", {
        children: [
          n("cards.acquiring.atm", "ATM acquiring", { tags: C, note: "income / expense" }),
          n("cards.acquiring.pos", "POS acquiring", { tags: C, note: "income / expense" }),
        ],
      }),
    ],
  }),

  n("direct", "DIRECT DEPOSITS", {
    children: [
      n("direct.ca", "Current Accounts", { tags: VC }),
      n("direct.sightsaving", "Sight & Saving", {
        children: [
          n("direct.sightsaving.sight", "Sight Deposits", { tags: VC }),
          n("direct.sightsaving.saving", "Saving Accounts", { tags: VC }),
        ],
      }),
      n("direct.term", "Time/Term Deposits", {
        children: [
          n("direct.term.st", "ST", { tags: VC }),
          n("direct.term.mlt", "MLT", { tags: VC }),
        ],
      }),
      n("direct.structured", "Structured Deposits", { tags: VC }),
      n("direct.securities", "Bank issued securities", { tags: VC }),
      n("direct.other", "Other deposits", { tags: VC }),
    ],
  }),

  n("indirect", "INDIRECT DEPOSITS", {
    note: "investment products",
    tags: C,
    children: [
      n("indirect.aum", "Assets Under Management", {
        children: [
          n("indirect.aum.mfclass", "Mutual Funds – Asset Class", {
            children: [
              n("indirect.aum.mfclass.isp", "ISP Group funds"),
              n("indirect.aum.mfclass.third", "Third-party funds"),
            ],
          }),
          n("indirect.aum.mfsaving", "Mutual Funds – Saving Scheme", {
            children: [
              n("indirect.aum.mfsaving.scheme", "Saving Scheme"),
              n("indirect.aum.mfsaving.combi", "Combi"),
              n("indirect.aum.mfsaving.simple", "Simple Investment"),
            ],
          }),
          n("indirect.aum.dpm", "Discretionary Portfolio Management"),
          n("indirect.aum.pension", "Pension Products", {
            children: [
              n("indirect.aum.pension.funds", "Pension Funds"),
              n("indirect.aum.pension.other", "Other Pension Products"),
            ],
          }),
          n("indirect.aum.life", "Life Insurance", { note: "investment" }),
        ],
      }),
      n("indirect.auc", "Assets Under Custody"),
    ],
  }),

  n("insurance", "INSURANCE", {
    note: "protection",
    tags: C,
    children: [
      n("insurance.nonlife", "Non-life", {
        children: [
          n("insurance.nonlife.health", "Health"),
          n("insurance.nonlife.house", "House and household"),
          n("insurance.nonlife.property", "Property (non household)"),
          n("insurance.nonlife.motor", "Motor"),
          n("insurance.nonlife.accident", "Accident"),
          n("insurance.nonlife.card", "Card"),
          n("insurance.nonlife.liability", "Liability"),
          n("insurance.nonlife.travel", "Travel"),
          n("insurance.nonlife.other", "Other non-life"),
        ],
      }),
      n("insurance.cpi", "CPI", {
        children: [
          n("insurance.cpi.mortgages", "CPI Mortgages"),
          n("insurance.cpi.personal", "CPI Personal Loans"),
          n("insurance.cpi.card", "CPI Credit Card"),
          n("insurance.cpi.overdraft", "CPI Overdraft"),
          n("insurance.cpi.other", "Other CPI"),
        ],
      }),
      n("insurance.life", "Life Protection", {
        children: [
          n("insurance.life.risk", "Risk Life Insurance"),
          n("insurance.life.modular", "Modular Protection Products"),
        ],
      }),
    ],
  }),

  n("transaction", "TRANSACTION BANKING", {
    tags: C,
    children: [
      n("transaction.cash", "Cash Management", {
        children: [
          n("transaction.cash.payments", "Payments and collections", {
            children: [
              n("transaction.cash.payments.domestic", "Domestic"),
              n("transaction.cash.payments.foreign", "Foreign"),
            ],
          }),
          n("transaction.cash.services", "Cash management services"),
          n("transaction.cash.other", "Other"),
        ],
      }),
      n("transaction.trade", "Trade Finance", {
        children: [
          n("transaction.trade.guarantees", "Trade Guarantees"),
          n("transaction.trade.financial", "Financial Guarantees/SBLC"),
          n("transaction.trade.lc", "Letter of Credit"),
          n("transaction.trade.other", "Other"),
        ],
      }),
    ],
  }),

  n("digital", "DIGITAL & OTHER SERVICES", {
    note: "ex channels",
    tags: C,
    children: [
      n("digital.channels", "Digital Channels Contracts"),
      n("digital.einvoice", "e-invoices Contracts"),
      n("digital.aggregation", "Account Aggregation & Payment Contracts"),
      n("digital.other", "Other"),
    ],
  }),

  n("ib", "INVESTMENT BANKING", { tags: C }),
  n("othercomm", "OTHER COMMISSION", { tags: C }),
];

// ---- 3. Reporting frame (non-product lines) ---------------------------------

const frame: TreeNode[] = [
  n("bs", "BALANCE SHEET (A_L)", {
    children: [
      n("bs.assets", "Assets", {
        children: [
          n("bs.assets.loans", "Customer Loans", {
            children: [
              n("bs.assets.loans.perf", "Performing (LC / FC)", {
                note: "by lending + card product",
              }),
              n("bs.assets.loans.npl", "Non Performing", {
                children: [
                  n("bs.assets.loans.npl.pastdue", "Past due", {
                    note: "by lending + card product",
                  }),
                  n("bs.assets.loans.npl.utp", "Unlikely to pay", { note: "total only" }),
                  n("bs.assets.loans.npl.doubtful", "Doubtful", { note: "total only" }),
                ],
              }),
            ],
          }),
          n("bs.assets.interest", "Interest without volumes"),
          n("bs.assets.banks", "Due from banks"),
          n("bs.assets.securities", "Securities and equity investments"),
          n("bs.assets.otherib", "Other interest-bearing assets"),
          n("bs.assets.nonib", "Non interest-bearing assets"),
          n("bs.assets.ftp", "FTP Waivers Assets"),
        ],
      }),
      n("bs.liab", "Liabilities", {
        children: [
          n("bs.liab.deposits", "Customer Deposits (LC / FC)", {
            note: "by direct deposit product",
          }),
          n("bs.liab.banks", "Due to Banks"),
          n("bs.liab.otherib", "Other interest-bearing liabilities"),
          n("bs.liab.provisions", "Accumulated Provisions"),
          n("bs.liab.nonib", "Non interest-bearing liabilities"),
          n("bs.liab.equity", "Shareholders' Equity"),
          n("bs.liab.ftp", "FTP Waivers Liabilities"),
        ],
      }),
    ],
  }),
];

/** The margin cascade at the foot of the COMM template. Not a tree — a sequence. */
export interface MarginStep {
  /** The operator the source file prints in front of the line. */
  op: "" | "+" | "=" | "−";
  label: string;
  note?: string;
}

export const marginSteps: MarginStep[] = [
  { op: "", label: "Commission income/expense", note: "by product" },
  { op: "+", label: "Trading income/expense" },
  { op: "+", label: "Other operating income/expense", note: "Cards, Other" },
  { op: "=", label: "NON INTEREST MARGIN" },
  { op: "=", label: "NET OPERATING MARGIN", note: "and excl. Waivers" },
  { op: "−", label: "Provisions" },
  { op: "=", label: "NET OPERATING MARGIN AFTER PROVISIONS", note: "and excl. Waivers" },
  { op: "−", label: "Levies" },
];

export const sections: TreeSection[] = [
  { id: "segments", labelKey: "tree.segments", blurbKey: "tree.segmentsBlurb", roots: segments },
  { id: "products", labelKey: "tree.products", blurbKey: "tree.productsBlurb", roots: products },
  { id: "frame", labelKey: "tree.frame", blurbKey: "tree.frameBlurb", roots: frame },
];

/** The section holding the product families, for the overview graphic. */
export const PRODUCTS_SECTION = "products";

/** Abbreviations, as the source file lists them. */
export const glossary: [string, string][] = [
  ["ST", "short term"],
  ["MLT", "medium/long term"],
  ["AuM", "assets under management"],
  ["AuC", "assets under custody"],
  ["CPI", "credit protection insurance"],
  ["SBLC", "standby letter of credit"],
  ["FTP", "funds transfer pricing"],
];

/** Section 4 of the source: what was changed versus the raw sheets. */
export const changeNotesKeys = [
  "tree.change1",
  "tree.change2",
  "tree.change3",
  "tree.change4",
  "tree.change5",
  "tree.change6",
  "tree.change7",
];

// ---- Helpers ----------------------------------------------------------------

/** Total descendants of a node (not just direct children). */
export function countLeaves(node: TreeNode): number {
  if (!node.children?.length) return 1;
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
}

const matches = (node: TreeNode, q: string) =>
  node.label.toLowerCase().includes(q) || (node.note?.toLowerCase().includes(q) ?? false);

/**
 * Ids worth keeping on screen for a query and/or a tag, plus the text matches
 * to highlight. A branch is kept when it matches or has a matching descendant,
 * and every ancestor of a match is kept too, so nothing hides behind a closed
 * parent. A tag declared on a family counts for everything beneath it, which is
 * how the source file writes them.
 */
export function filterIndex(
  roots: TreeNode[],
  query: string,
  tag: Tag | null
): { keep: Set<string>; hits: Set<string>; active: boolean } {
  const keep = new Set<string>();
  const hits = new Set<string>();
  const q = query.trim().toLowerCase();
  const active = q.length > 0 || tag !== null;
  if (!active) return { keep, hits, active };

  const walk = (node: TreeNode, ancestors: string[], inherited: Tag[]): boolean => {
    // A node's own tags win outright; only a node that declares none inherits.
    // That is what the file means: a family tag covers the lines beneath it,
    // but Card issuing's [C] does not make the card balances under it
    // commission lines — those carry their own [V] [NPL].
    const own = node.tags ?? inherited;
    const textOk = !q || matches(node, q);
    const tagOk = tag === null || own.includes(tag);
    const self = textOk && tagOk;
    if (self && q) hits.add(node.id);

    const childHit = (node.children ?? []).reduce(
      (acc, c) => walk(c, [...ancestors, node.id], own) || acc,
      false
    );
    if (self || childHit) {
      keep.add(node.id);
      ancestors.forEach((a) => keep.add(a));
    }
    return self || childHit;
  };
  roots.forEach((r) => walk(r, [], []));
  return { keep, hits, active };
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

/** How many distinct products carry a tag, counting inherited family tags. */
export function countTagged(roots: TreeNode[], tag: Tag): number {
  let total = 0;
  const walk = (node: TreeNode, inherited: Tag[]) => {
    const own = node.tags ?? inherited;
    if (own.includes(tag) && !node.children?.length) total += 1;
    node.children?.forEach((c) => walk(c, own));
  };
  roots.forEach((r) => walk(r, []));
  return total;
}
