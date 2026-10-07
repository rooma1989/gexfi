# GEXFI website

Static website for the existing Netlify project `gexfi`. Netlify publishes `www.gexfi.com` as configured in `netlify.toml`; no build step is required.

## October 7, 2026 release

The release started from the `public/` tree in the user-supplied `GEXFI_Production_20261007.zip` package. Its SHA-256 is `e4e3adfa09c3a256d3442a2ec54c8e8c488ee0306544d19852ece3c27216d113`. Every packaged file passed the package's `checksums.sha256` verification before import.

The release includes English (`/`), Simplified Chinese (`/zh/`), Indonesian (`/id/`), and Vietnamese (`/vi/`) product pages, shared assets, legal and about pages, a 404 page, and Netlify `_headers` and `_redirects`. The former site files that are absent from the new package were removed from the publish directory. The outdated USDT card (U card) page was also removed in all four languages; old URLs redirect to the corresponding Visa card page.

The separate H5 application at `h5.gexfi.com` is outside this repository. This branch contains the website release only; production follows the existing `main` deployment workflow.

## Local preview

Run `node scripts/preview.mjs` and open `http://localhost:4195/`. The preview serves both the static pages and the local rate function. For live rates, fill a local `.env` file using `.env.example` and run `node --env-file=.env scripts/preview.mjs`. The installed `gexfi-preview` user service also reads `.env` when restarted. Without credentials, the board displays an unavailable state.

## Exchange rate board

The four language versions of `nzd-aud-usdt-exchange.html` display the seven customer reference rates from the GEXFI rate board. A Netlify Function at `/.netlify/functions/rate-board` signs the upstream request and returns only the pair, availability, customer rate and retrieval time. It does not expose API credentials, source rates or company adjustments. Unavailable, disabled and stale rates are hidden. Final order quotes remain in the H5 application.

Set `GEXFI_RATE_BOARD_APP_KEY` and `GEXFI_RATE_BOARD_APP_SECRET` in the Netlify site's environment variables with **Functions** scope. Use the dedicated website client with the `gexfi-rate-board` scope. Do not put these values in the published files or `netlify.toml`. Redeploy after adding or changing them.

Run `node --test tests/rate-board.test.mjs` to verify request signing and response filtering without real credentials.
