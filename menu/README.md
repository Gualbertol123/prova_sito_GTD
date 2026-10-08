# Canteen menu

The weekly report's **MENU** section shows next week's canteen menu. It is read
from the Supabase table `public.canteen_menu` (migration 015), which only the
team account can read and only from today onwards.

## Monthly update

1. Put the canteen's PDF in `menu/private/` (e.g. `menu/private/Menu.pdf`).
2. Make the SQL:

   ```bash
   pip install pymupdf
   python3 -I menu/menu_from_pdf.py menu/private/Menu.pdf
   ```

   It writes `menu/private/menu-update-<first day>.sql` with every day from
   today on.
3. Run that file in **Supabase → SQL Editor**. It deletes past days, adds or
   replaces the PDF's days, and ends by showing the first day, the last day
   and how many days there are. Running it twice does no harm.

Nothing has to be deployed: the REPORT tab reads the table the next time it
opens.

## Never commit `menu/private/`

The repository is public and the menu is not. `.gitignore` keeps everything in
`menu/private/` (and any `menu-update*.sql`) out of git; only the empty
`.gitkeep` is tracked.
