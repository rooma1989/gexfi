import { createHmac, randomBytes } from 'node:crypto';

const API_PATH = '/api/open-api/gexfi/rate-board';
const API_URL = `https://admin.gexfi.com${API_PATH}`;
const PAIRS = ['NZDUSDT', 'AUDUSDT', 'USDUSDT', 'USDTNZD', 'USDTAUD', 'CNYUSDT', 'USDTCNY'];
const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/;

function reply(body, status, cacheControl = 'no-store') {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export default async function rateBoard(request) {
  if (request.method !== 'GET') {
    const response = reply({ error: 'method_not_allowed' }, 405);
    response.headers.set('Allow', 'GET');
    return response;
  }

  const key = process.env.GEXFI_RATE_BOARD_APP_KEY;
  const secret = process.env.GEXFI_RATE_BOARD_APP_SECRET;
  if (!key || !secret) return reply({ error: 'rates_unavailable' }, 503);

  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(16).toString('hex');
  const signed = ['GET', API_PATH, `app_key=${key}`, `timestamp=${timestamp}`, `nonce=${nonce}`, 'body='].join('\n');
  const signature = createHmac('sha256', secret).update(signed).digest('hex');

  try {
    const response = await fetch(API_URL, {
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
    if (!response.ok) return reply({ error: 'rates_unavailable' }, 502);

    const payload = await response.json();
    const data = payload?.data;
    const generatedAt = Date.parse(data?.generated_at);
    if (payload?.error_code !== 0 || !Array.isArray(data?.pairs) ||
        !Number.isFinite(generatedAt) || Math.abs(Date.now() - generatedAt) > 300_000) {
      return reply({ error: 'rates_unavailable' }, 502);
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

    return reply({ generated_at: data.generated_at, pairs }, 200, 'public, max-age=30');
  } catch {
    return reply({ error: 'rates_unavailable' }, 502);
  }
}
