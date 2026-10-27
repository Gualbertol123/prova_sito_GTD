#!/usr/bin/env python3
"""Turn the canteen's monthly menu PDF into web/src/data/menu.json.

    python3 -I menu/menu_from_pdf.py Menu.pdf [--today YYYY-MM-DD]

Each PDF page is one week: a grid with the courses down the left and
Monday-Friday across. The cells are read from the grid lines, so a dish that
wraps over several lines stays one dish. Every day before --today (default:
today) is dropped, from the PDF and from what menu.json already holds; days in
the PDF replace the same days in the file, so running it twice is harmless.
Commit the new menu.json and deploy. See menu/README.md.

Needs PyMuPDF (pip install pymupdf).
"""
import argparse
import datetime as dt
import json
import pathlib
import re
import sys

import pymupdf

OUT = pathlib.Path(__file__).resolve().parent.parent / "web" / "src" / "data" / "menu.json"


# Course label in the PDF (lower case, spaces squeezed) -> key used by the site.
COURSES = {
    "piatto del giorno": "daily",
    "primi": "first",
    "secondi": "second",
    "contorni lavorati": "sideHot",
    "contorni caldi": "sideHot",
    "contorni freddi": "sideRaw",
    "contorni crudi": "sideRaw",
    "piatti freddi": "cold",
    "insalatone": "salad",
    "frutta": "fruit",
    "dessert": "dessert",
}

# Words a wrapped dish name can stop on before its next line.
UNFINISHED = re.compile(
    r"\b(?:a|al|allo|alla|alle|ai|agli|all[’']|con|e|ed|di|del|dello|della|delle|dei|degli|in|da|su|sul|sulla|per|tra|fra)$",
    re.IGNORECASE,
)
ALLERGENS = re.compile(r"\s*((?:\d+\s*-+\s*)*\d+)\s*-?\s*$")


def grid(page):
    """Row bands (y) and day columns (x) from the table's ruling lines."""
    segs = []
    for d in page.get_drawings():
        for it in d["items"]:
            if it[0] == "re" and it[1].height < 2.5 and it[1].width > 40:
                segs.append(it[1])
    ys = sorted({round(r.y0) for r in segs if r.x0 < 40})  # lines that cross the label column
    first_cell = [r for r in segs if r.x0 < 40 and r.x1 < 120]
    label_right = min(r.x1 for r in first_cell)
    xs = sorted({round(r.x0) for r in segs if r.x0 > label_right - 2}
                | {round(r.x1) for r in segs if r.x1 > label_right})
    # day columns: the five cells right of the label column
    cols = []
    for r in segs:
        if round(r.y0) == ys[1] and r.x0 > label_right - 2:
            cols.append((r.x0, r.x1))
    cols.sort()
    return ys, label_right, cols


def lines_in(page, rect):
    out = []
    for b in page.get_text("dict", clip=rect)["blocks"]:
        for l in b.get("lines", []):
            text = "".join(s["text"] for s in l["spans"]).strip()
            if text:
                out.append((l["bbox"][1], l["bbox"][0], text))
    out.sort()
    return [t for _, _, t in out]


def squeeze(s):
    return re.sub(r"\s+", " ", s).strip()


def dishes(lines):
    """Join wrapped lines into dishes.

    A new dish starts with a capital letter, unless the line before is clearly
    unfinished: no allergen numbers yet and ending in a word like "alla", "con"
    or "e", or in a comma ("Risotto alla" / "Milanese 7" is one dish).
    """
    items = []
    for line in lines:
        line = squeeze(line)
        unfinished = bool(items) and not ALLERGENS.search(items[-1]) and bool(
            UNFINISHED.search(items[-1]) or items[-1].endswith(",")
        )
        starts_new = bool(re.match(r"[A-ZÀ-Ý]", line)) and not unfinished
        if items and not starts_new:
            sep = "" if items[-1].endswith("-") and line[:1].isdigit() else " "
            items[-1] = items[-1] + sep + line
        else:
            items.append(line)
    out = []
    for raw in items:
        raw = squeeze(raw)
        m = ALLERGENS.search(raw)
        allergens = []
        name = raw
        if m and m.start() > 0:
            nums = [int(n) for n in re.findall(r"\d+", m.group(1))]
            allergens = sorted({n for n in nums if 1 <= n <= 14})
            name = raw[: m.start()].strip().rstrip(",")
        out.append({"name": name, "allergens": allergens})
    return out


def parse_week(page):
    text = page.get_text()
    m = re.search(r"Settimana\s+(?:dal\s+)?(\d{2})/(\d{2})/(\d{4})", text)
    if not m:
        raise SystemExit(f"page {page.number + 1}: no 'Settimana dal dd/mm/yyyy' heading")
    monday = dt.date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
    if monday.weekday() != 0:
        raise SystemExit(f"page {page.number + 1}: {monday} is not a Monday")
    ys, label_right, cols = grid(page)
    if len(cols) != 5:
        raise SystemExit(f"page {page.number + 1}: expected 5 day columns, found {len(cols)}")
    days = [{"date": (monday + dt.timedelta(days=i)).isoformat(), "courses": []} for i in range(5)]
    for y0, y1 in zip(ys, ys[1:]):
        label_rect = pymupdf.Rect(28, y0 + 0.5, label_right, y1 - 0.5)
        label = squeeze(" ".join(lines_in(page, label_rect))).lower()
        key = COURSES.get(label)
        if key is None:
            if label and not label.startswith("settimana"):
                raise SystemExit(f"page {page.number + 1}: unknown course '{label}'")
            continue
        for i, (x0, x1) in enumerate(cols):
            items = dishes(lines_in(page, pymupdf.Rect(x0 + 0.5, y0 + 0.5, x1 - 0.5, y1 - 0.5)))
            if items:
                days[i]["courses"].append({"course": key, "items": items})
    return days


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--today", default=dt.date.today().isoformat())
    ap.add_argument("--out", default=str(OUT))
    a = ap.parse_args()

    out = pathlib.Path(a.out)
    old = json.loads(out.read_text()) if out.exists() else {"days": []}
    by_date = {d["date"]: d for d in old.get("days", [])}
    doc = pymupdf.open(a.pdf)
    venue = squeeze(doc[0].get_text().splitlines()[0])
    for page in doc:
        for day in parse_week(page):
            if day["courses"]:
                by_date[day["date"]] = day
    days = [by_date[k] for k in sorted(by_date) if k >= a.today]  # the past menu goes
    if not days:
        raise SystemExit("No day from --today on: nothing to write.")
    # One day per line, so a monthly update reads well in a diff.
    body = ",\n".join("  " + json.dumps(d, ensure_ascii=False) for d in days)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text('{\n "venue": %s,\n "days": [\n%s\n ]\n}\n' % (json.dumps(venue, ensure_ascii=False), body))
    print(f"{out}: {len(days)} days, {days[0]['date']} -> {days[-1]['date']}", file=sys.stderr)


if __name__ == "__main__":
    main()
