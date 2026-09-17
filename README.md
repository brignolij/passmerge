# PassMerge

_(formerly "Bitwarden Cleaner" during development — the name lives on in
the page copy and meta tags since that's literally what people search
for.)_

A free, static, client-side web tool that merges Bitwarden (or Chrome /
Firefox / LastPass / Dashlane / Apple Passwords / NordPass) login exports
that belong to the same service across country-code domains — e.g.
`zalando.ch`, `fr.zalando.ch` and `accounts.zalando.com` become one
**Zalando** item with all three URLs attached — instead of several
near-duplicate vault entries.

**Everything runs in the browser.** No server, no upload, no build step.
Open any of the HTML files directly, or serve the folder as-is (this is
what GitHub Pages does).

**Live site:** `https://brignolij.github.io/passmerge/` (update
this once you know the final Pages/custom-domain URL — see [Publishing to
GitHub Pages](#publishing-to-github-pages) below).

## Languages

One full static page per language, for SEO (separate URLs + `hreflang`,
not a client-side toggle):

| Language | URL |
|---|---|
| English (default) | `/` |
| Français | `/fr/` |
| Deutsch | `/de/` |
| Italiano | `/it/` |
| Español | `/es/` |

All five share the same logic (`assets/app.js`) and only differ in the
static SEO copy in each `index.html` and the runtime UI strings in
`assets/i18n.js`.

## How to use it

1. Export your vault:
   - **Bitwarden**: web vault → Settings → Import/export data → Export
     vault → format `.csv`.
   - Or use a CSV export from Chrome/Edge/Brave, Firefox, LastPass,
     Dashlane, Apple Passwords, or NordPass — the tool auto-detects the
     format from the column headers.
2. Open the site, drop the CSV in, click **Analyze**.
3. Groups with no conflict merge automatically. Every group that *does*
   have a conflict (different password / folder / username / custom
   fields) is reviewed **one at a time**:
   - 🗑️ each row has its own trash icon — remove just the one item you're
     sure about, without touching the rest of the group (click again to
     undo).
   - Pick what happens to what's left: **🔗 Merge into one item**, **📎
     Keep separate**, or **🗑️ Delete all items**.
   - If merging and a field still conflicts, choose which value to keep
     (or type a custom one).
4. The download links at the bottom (`cleaned.json`, `cleaned.csv`,
   `report.txt`) update live after every action — download at any point,
   even mid-review; anything not yet reviewed just keeps its safe default.
5. Import `cleaned.json` into Bitwarden: web vault → Settings →
   Import/export data → Import data → format `.json (Bitwarden)`. Test in
   an empty/test vault first if unsure.

⚠️ Your export file — and `cleaned.csv`/`cleaned.json`/`report.txt` alike —
contain your passwords in plain text. None of them are ever uploaded
anywhere, but keep them local and delete all of them once you're done.
`report.txt` in particular may list a rejected/alternate password when a
merge had a conflict (see below); that plaintext is deliberately kept out
of the vault item itself and only ever written to this local file.

## How matching works

- Only login rows with an `http(s)` URL are candidates for merging. IP
  addresses and `localhost` are never merged.
- The "brand" is the registrable domain minus its country suffix, ignoring
  subdomains: `accounts.zalando.com` → `zalando`, `fr.zalando.ch` →
  `zalando`, `www.example.co.uk` → `example`. A built-in list of ~90
  common two-part suffixes (`co.uk`, `com.au`, `co.jp`, …) covers the
  domains people actually run into.
- By default, two items only merge if **both** the brand *and* the
  username match — a different account on the same domain family is never
  silently folded in. Tick "ignore username" to merge by brand alone
  (riskier).
- Usernames that differ only by case or stray spaces (`Jeffrey@x.com` vs
  `jeffrey@x.com`) are treated as the same login and merged automatically,
  keeping the shorter form — noted in the report, but never asked about.
  **Passwords are never treated this way**: a password is case-sensitive
  by definition, so any difference always stays a real conflict for you to
  resolve.
- Nothing is ever discarded silently on a real conflict: you resolve it in
  the wizard, or it's flagged in `report.txt`.

## Supported input formats

| Format | Detected via |
|---|---|
| Bitwarden | native `login_uri` / `login_username` / `login_password` columns |
| Chrome / Edge / Brave | `name,url,username,password` |
| Firefox | `url,username,password,httpRealm,…` |
| LastPass | `url,username,password,extra,grouping,…` |
| Dashlane / Apple Passwords | `title`/`url`/`username`/`password` + an OTP-ish column |
| NordPass | `name,url,username,password,note,folder` |
| Anything else | generic column-name fuzzy matching (needs at least URL + username + password columns) |

The output is always a Bitwarden-ready `cleaned.csv` / `cleaned.json`,
regardless of the input format.

## Project structure

```
index.html          English page (SEO content + the tool)
fr/index.html        Français
de/index.html        Deutsch
it/index.html        Italiano
es/index.html         Español
assets/
  app.js             Shared logic: CSV parsing, format detection, brand
                      matching, the merge wizard, output writers
  i18n.js            Runtime UI strings for all 5 languages
  style.css          Shared styles
sample_input.csv     Small made-up demo file (not real data)
robots.txt, sitemap.xml   SEO plumbing
```

Static SEO content (hero text, FAQ) lives directly in each language's
`index.html`, hand-translated — only the *dynamic* strings the app builds
at runtime (the wizard, the report) go through `assets/i18n.js`, so the
logic itself stays a single shared file across all 5 pages.

## Publishing to GitHub Pages

1. `git init`, commit, push to a GitHub repo (public — GitHub Pages on a
   free personal account requires it).
2. Repo → Settings → Pages → Source: deploy from branch, root of `main`.
3. Once you know the final URL (e.g. `https://<user>.github.io/<repo>/`,
   or a custom domain), **update the placeholder domain**
   `https://brignolij.github.io/passmerge` used in every
   `<link rel="canonical">` / `hreflang` tag, `sitemap.xml`, and
   `robots.txt` — a wrong canonical URL actively hurts SEO, so this isn't
   optional.
4. Submit `sitemap.xml` in Google Search Console / Bing Webmaster Tools
   once it's live.

## Before you push this to a public repo

The `.gitignore` excludes any `*.csv` except `sample_input.csv` — so a
real vault export sitting in this folder never gets committed. Double
check with `git status` before your first push regardless.

## Support / attribution

Each page has a "buy me a coffee" banner
([ko-fi.com/jeffreybrignoli](https://ko-fi.com/jeffreybrignoli)) and an
attribution line disclosing the tool was AI-assisted ("vibe-coded") and
reviewed/shipped by a real developer, linking to
[Jeffrey Brignoli's LinkedIn](https://www.linkedin.com/in/jeffrey-brignoli/).
