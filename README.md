# GEXFI website

Static website served by the existing Netlify project `gexfi` from `www.gexfi.com`.

## September 25, 2026 update

- Source: user-supplied `GEXFI_Production_Ready_Site.zip` (five English pages and five corresponding Chinese pages under `/zh/`).
- Login and product actions pass the current page language to H5: English pages (including retained legacy routes) use `https://h5.gexfi.com/?lang=en`; Chinese pages under `/zh/` use `https://h5.gexfi.com/?lang=zh-Hans`. Language switches navigate to the corresponding page, whose H5 links carry that language. New H5 links should follow this convention. The H5 application is not included or modified here.
- Original product paths and legal documents are retained so existing URLs continue to work.
- Language switches use native links to their corresponding language pages; redundant in-place toggling was removed. Mobile menu accessible labels follow the open/closed state.
- Production deploy: `6ab6539643118449cdd77c40`. Previous deploy for rollback: `6a33629dd78b6eeaeda8f890`.
- Site ID: `49276980-1130-48b5-a792-6651a8a3151c`; custom domain: `gexfi.com`.

## Preview and release

Run `python3 -m http.server 4195 --directory www.gexfi.com` for local preview. No build step or npm dependencies are required. Deploy `www.gexfi.com` to the existing Netlify project.

The initial release was published via the authorized Netlify CLI. Source is maintained in `rooma1989/gexfi` on `main`, which is connected to the same Netlify project. Pushes to `main` use the publish directory in `netlify.toml`.

Validation covered all ten new page scripts, internal file and anchor targets, existing H5 links, desktop and 390px mobile rendering, menu and language interactions, interactive service previews, and Netlify preview routing. No account creation or financial transaction was performed.

## Cloudflare Web Analytics

The public Cloudflare Web Analytics beacon is embedded once before `</body>` in every HTML page, including the bilingual pages and retained legacy routes. New HTML pages should include the same beacon. The H5 application is separate and was not modified. Analytics deployment: `6ab7306139e44c1016f12609`; all 23 published HTML pages were verified to contain exactly one beacon.

## H5 language links

All H5 entry links include `lang=en` or `lang=zh-Hans` according to the page language. The 13 retained Framer pages also load `h5-language.js` to preserve the parameter when Framer replaces navigation links at responsive breakpoints. Validate this behavior with `node tests/h5-language.test.cjs`.
