# Canteen menu

The BOARD's **Menu mensa** bar (below Archived) shows today and the next
menu days, and the weekly report's **MENU** section shows next week's menu,
both from `web/src/data/menu.json`.

## Monthly update

1. Get the canteen's PDF (one page per week, courses down the left,
   Monday–Friday across).
2. Run:

   ```bash
   pip install pymupdf
   python3 -I menu/menu_from_pdf.py Menu.pdf
   ```

   It rewrites `web/src/data/menu.json` with every day from today on: past
   days are deleted, the PDF's days are added (or replace the same days).
3. Commit `web/src/data/menu.json` and deploy.

The menu is not confidential, so it can live in this public repository.
