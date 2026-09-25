# PDF fonts

Embedded by `src/lib/reportPdf.ts` when the report is downloaded as PDF. They
are fetched only on that click. They stand in for the template's own
commercial fonts:

| File | Family | Stands in for |
| --- | --- | --- |
| `eb-garamond-{400,700}-{normal,italic}.ttf` | EB Garamond 1.003 | Garamond (body text) |
| `cinzel-{400,700}-normal.ttf` | Cinzel 2.000 | Trajan Pro (letterhead, footer) |

These are the Latin subsets from [fontsource](https://fontsource.org)
(`cdn.jsdelivr.net/fontsource/fonts/<family>@latest/latin-<weight>-<style>.ttf`).
The Latin subset covers the Italian accents, dashes, curly quotes and €.

- EB Garamond — Copyright 2017 The EB Garamond Project Authors
  (https://github.com/octaviopardo/EBGaramond12)
- Cinzel — Copyright 2020 The Cinzel Project Authors
  (https://github.com/NDISCOVER/Cinzel)

Both are licensed under the SIL Open Font License 1.1:
https://openfontlicense.org
