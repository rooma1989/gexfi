import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import rateBoard from '../netlify/functions/rate-board.mjs';

const request = new Request('https://gexfi.com/.netlify/functions/rate-board');
const originalFetch = globalThis.fetch;
const originalKey = process.env.GEXFI_RATE_BOARD_APP_KEY;
const originalSecret = process.env.GEXFI_RATE_BOARD_APP_SECRET;

test('signs the upstream request and returns only public customer rates', async () => {
  process.env.GEXFI_RATE_BOARD_APP_KEY = 'test-key';
  process.env.GEXFI_RATE_BOARD_APP_SECRET = 'test-secret';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://admin.gexfi.com/api/open-api/gexfi/rate-board');
    assert.equal(options.headers['X-Open-Api-Key'], 'test-key');
    const timestamp = options.headers['X-Open-Timestamp'];
    const nonce = options.headers['X-Open-Nonce'];
    assert.match(nonce, /^[0-9a-f]{32}$/);
    const signed = ['GET', '/api/open-api/gexfi/rate-board', 'app_key=test-key',
      `timestamp=${timestamp}`, `nonce=${nonce}`, 'body='].join('\n');
    const expected = createHmac('sha256', 'test-secret').update(signed).digest('hex');
    assert.equal(options.headers['X-Open-Sign'], expected);
    return Response.json({ error_code: 0, data: {
      generated_at: new Date().toISOString(),
      pairs: [
        { pair: 'NZDUSDT', available: true, enabled: true, client_rate: '0.5510',
          source: { stale: false, rate: '0.5605' }, adjustment: { total_pct: '-1.69' } },
        { pair: 'AUDUSDT', available: true, enabled: true, client_rate: '0.6500', source: { stale: true } },
        { pair: 'USDUSDT', available: true, enabled: false, client_rate: '1.0000', source: { stale: false } },
        { pair: 'USDTNZD', available: false, reason: 'rate_unavailable' },
      ],
    } });
  };
  try {
    const response = await rateBoard(request);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.pairs.length, 7);
    assert.deepEqual(body.pairs[0], { pair: 'NZDUSDT', available: true, rate: '0.5510' });
    assert.deepEqual(body.pairs[1], { pair: 'AUDUSDT', available: false, rate: null });
    assert.deepEqual(body.pairs[2], { pair: 'USDUSDT', available: false, rate: null });
    assert.deepEqual(body.pairs[3], { pair: 'USDTNZD', available: false, rate: null });
    assert.ok(!JSON.stringify(body).includes('adjustment'));
    assert.ok(!JSON.stringify(body).includes('0.5605'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('does not call the upstream API without server credentials', async () => {
  delete process.env.GEXFI_RATE_BOARD_APP_KEY;
  delete process.env.GEXFI_RATE_BOARD_APP_SECRET;
  globalThis.fetch = () => { throw new Error('fetch must not be called'); };
  try {
    const response = await rateBoard(request);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'rates_unavailable' });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEXFI_RATE_BOARD_APP_KEY;
    else process.env.GEXFI_RATE_BOARD_APP_KEY = originalKey;
    if (originalSecret === undefined) delete process.env.GEXFI_RATE_BOARD_APP_SECRET;
    else process.env.GEXFI_RATE_BOARD_APP_SECRET = originalSecret;
  }
});

test('rejects an outdated upstream snapshot instead of displaying it', async () => {
  process.env.GEXFI_RATE_BOARD_APP_KEY = 'test-key';
  process.env.GEXFI_RATE_BOARD_APP_SECRET = 'test-secret';
  globalThis.fetch = async () => Response.json({ error_code: 0, data: {
    generated_at: new Date(Date.now() - 3600_000).toISOString(),
    pairs: [{ pair: 'NZDUSDT', available: true, enabled: true, client_rate: '0.5510', source: { stale: false } }],
  } });
  try {
    const response = await rateBoard(request);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'rates_unavailable' });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEXFI_RATE_BOARD_APP_KEY;
    else process.env.GEXFI_RATE_BOARD_APP_KEY = originalKey;
    if (originalSecret === undefined) delete process.env.GEXFI_RATE_BOARD_APP_SECRET;
    else process.env.GEXFI_RATE_BOARD_APP_SECRET = originalSecret;
  }
});
