# GEXFI website

Static website for the existing Netlify project `gexfi`. Netlify publishes `www.gexfi.com` as configured in `netlify.toml`; no build step is required.

## October 7, 2026 release

The release started from the `public/` tree in the user-supplied `GEXFI_Production_20261007.zip` package. Its SHA-256 is `e4e3adfa09c3a256d3442a2ec54c8e8c488ee0306544d19852ece3c27216d113`. Every packaged file passed the package's `checksums.sha256` verification before import.

The release includes English (`/`), Simplified Chinese (`/zh/`), Indonesian (`/id/`), and Vietnamese (`/vi/`) product pages, shared assets, legal and about pages, a 404 page, and Netlify `_headers` and `_redirects`. The former site files that are absent from the new package were removed from the publish directory. The outdated USDT card (U card) page was also removed in all four languages; old URLs redirect to the corresponding Visa card page.

The separate H5 application at `h5.gexfi.com` is outside this repository. This branch contains the website release only; production follows the existing `main` deployment workflow.

## Local preview

Run `python3 -m http.server 4195 --directory www.gexfi.com` and open `http://localhost:4195/`.
