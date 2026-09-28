# GEXFI website

Static website served by the existing Netlify project `gexfi` from `www.gexfi.com`.

## September 27, 2026 update

- Source: user-supplied `GEXFI_4_Languages_IT_Upload (3)` directory.
- Twenty-eight current pages: home, wallet, Visa card, business OTC, more services, USDT card, and NZD/AUD-to-USDT exchange in English (`/`), Simplified Chinese (`/zh/`), Indonesian (`/id/`), and Vietnamese (`/vi/`). Language menus preserve the current product page.
- Original product paths, blog posts, and legal documents are retained: 13 legacy English pages remain available, for 41 HTML pages in total.
- Login and product actions keep the existing H5 application: Chinese pages use `https://h5.gexfi.com/?lang=zh-Hans`; English pages use `https://h5.gexfi.com/?lang=en`. Indonesian and Vietnamese pages currently use English H5 until support for their language parameters is confirmed. The H5 application is separate and is not modified here.
- Existing mobile-menu accessible labels and native language navigation fixes are preserved in the English and Chinese pages. Shared `assets/header-dropdowns.css` styles the language picker and service arrows; `assets/locale-picker.js` provides outside-click and Escape dismissal for language menus.
- Updated product copy, page titles/descriptions, canonical/hreflang metadata, and the sitemap are taken from the latest package.
- Site ID: `49276980-1130-48b5-a792-6651a8a3151c`; custom domain: `gexfi.com`.

## Preview and release

Run `python3 -m http.server 4195 --directory www.gexfi.com` for local preview. No build step or npm dependencies are required.

Source is maintained in `rooma1989/gexfi` on `main`, which is connected to the same Netlify project. Pushes to `main` use the publish directory in `netlify.toml`.

## Cloudflare Web Analytics

The public Cloudflare Web Analytics beacon is embedded exactly once before `</body>` in every HTML page, including all four languages and retained legacy routes. New HTML pages should include the same beacon. The separate H5 application is not instrumented by this website.

## H5 language links

All H5 entry links include `lang=en` or `lang=zh-Hans` according to the mapping above. The 13 retained Framer pages also load `h5-language.js` to preserve the parameter when Framer replaces navigation links at responsive breakpoints. Validate this behavior with `node tests/h5-language.test.cjs`.
