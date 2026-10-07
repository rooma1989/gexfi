import { createHmac, randomBytes } from 'node:crypto';

const API_PATH = '/api/open-api/gexfi/rate-board';
const API_URL = `https://admin.gexfi.com${API_PATH}`;
const PAIRS = ['NZDUSDT', 'AUDUSDT', 'USDUSDT', 'USDTNZD', 'USDTAUD', 'CNYUSDT', 'USDTCNY'];
const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/;
const FRESH_MS = 60_000;
const STALE_MS = 240_000;
const RETRY_MS = 15_000;
const CDN_CACHE = 'public, durable, s-maxage=60, stale-while-revalidate=180';

function reply(body, status, cacheAtCdn = false) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Netlify-CDN-Cache-Control': cacheAtCdn ? CDN_CACHE : 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export function createRateBoardHandler({ now = Date.now, fetchUpstream = (...args) => fetch(...args),
  credentials = () => ({ key: process.env.GEXFI_RATE_BOARD_APP_KEY, secret: process.env.GEXFI_RATE_BOARD_APP_SECRET }) } = {}) {
  let lastSuccess = null;
  let inFlight = null;
  let retryAfter = 0;

  async function load(key, secret) {
    const timestamp = String(Math.floor(now() / 1000));
    const nonce = randomBytes(16).toString('hex');
    const signed = ['GET', API_PATH, `app_key=${key}`, `timestamp=${timestamp}`, `nonce=${nonce}`, 'body='].join('\n');
    const signature = createHmac('sha256', secret).update(signed).digest('hex');
    const response = await fetchUpstream(API_URL, {
      method: 'GET',
      headers: {
        'X-Open-Api-Key': key,
        'X-Open-Timestamp': timestamp,
        'X-Open-Nonce': nonce,
        'X-Open-Sign': signature,
        Accept: 'application/json',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('upstream unavailable');

    const payload = await response.json();
    const data = payload?.data;
    const generatedAt = Date.parse(data?.generated_at);
    if (payload?.error_code !== 0 || !Array.isArray(data?.pairs) ||
        !Number.isFinite(generatedAt) || Math.abs(now() - generatedAt) > 300_000) {
      throw new Error('invalid upstream rates');
    }

    const byPair = new Map(data.pairs.map(row => [row?.pair, row]));
    const pairs = PAIRS.map(pair => {
      const row = byPair.get(pair);
      const rate = row?.client_rate;
      const available = row?.available === true && row?.enabled === true &&
        row?.source?.stale === false && typeof rate === 'string' &&
        DECIMAL.test(rate) && /[1-9]/.test(rate);
      return { pair, available, rate: available ? rate : null };
    });
    lastSuccess = { body: { generated_at: data.generated_at, pairs }, fetchedAt: now() };
    retryAfter = 0;
    return lastSuccess.body;
  }

  return async function rateBoard(request) {
    if (request.method !== 'GET') {
      const response = reply({ error: 'method_not_allowed' }, 405);
      response.headers.set('Allow', 'GET');
      return response;
    }

    const { key, secret } = credentials();
    if (!key || !secret) return reply({ error: 'rates_unavailable' }, 503);

    if (lastSuccess && now() - lastSuccess.fetchedAt < FRESH_MS) {
      return reply(lastSuccess.body, 200, true);
    }
    if (now() < retryAfter) {
      return lastSuccess && now() - lastSuccess.fetchedAt < STALE_MS
        ? reply(lastSuccess.body, 200)
        : reply({ error: 'rates_unavailable' }, 502);
    }

    if (!inFlight) inFlight = load(key, secret).finally(() => { inFlight = null; });
    try {
      return reply(await inFlight, 200, true);
    } catch {
      retryAfter = now() + RETRY_MS;
      return lastSuccess && now() - lastSuccess.fetchedAt < STALE_MS
        ? reply(lastSuccess.body, 200)
        : reply({ error: 'rates_unavailable' }, 502);
    }
  };
}

export default createRateBoardHandler();
