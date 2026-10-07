import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { createRateBoardHandler } from '../netlify/functions/rate-board.mjs';

const request = new Request('https://gexfi.com/.netlify/functions/rate-board');
const credentials = () => ({ key: 'test-key', secret: 'test-secret' });
const snapshot = (timestamp, rate = '0.5510') => ({ error_code: 0, data: {
  generated_at: new Date(timestamp).toISOString(),
  pairs: [
    { pair: 'NZDUSDT', available: true, enabled: true, client_rate: rate,
      source: { stale: false, rate: '0.5605' }, adjustment: { total_pct: '-1.69' } },
    { pair: 'AUDUSDT', available: true, enabled: true, client_rate: '0.6500', source: { stale: true } },
    { pair: 'USDUSDT', available: true, enabled: false, client_rate: '1.0000', source: { stale: false } },
    { pair: 'USDTNZD', available: false, reason: 'rate_unavailable' },
  ],
} });

test('signs the upstream request and returns only public customer rates', async () => {
  const now = Date.now();
  const handler = createRateBoardHandler({ now: () => now, credentials, fetchUpstream: async (url, options) => {
    assert.equal(url, 'https://admin.gexfi.com/api/open-api/gexfi/rate-board');
    assert.equal(options.headers['X-Open-Api-Key'], 'test-key');
    const timestamp = options.headers['X-Open-Timestamp'];
    const nonce = options.headers['X-Open-Nonce'];
    assert.match(nonce, /^[0-9a-f]{32}$/);
    const signed = ['GET', '/api/open-api/gexfi/rate-board', 'app_key=test-key',
      `timestamp=${timestamp}`, `nonce=${nonce}`, 'body='].join('\n');
    const expected = createHmac('sha256', 'test-secret').update(signed).digest('hex');
    assert.equal(options.headers['X-Open-Sign'], expected);
    return Response.json(snapshot(now));
  } });
  const response = await handler(request);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Netlify-CDN-Cache-Control'),
    'public, durable, s-maxage=60, stale-while-revalidate=180');
  const body = await response.json();
  assert.equal(body.pairs.length, 7);
  assert.deepEqual(body.pairs[0], { pair: 'NZDUSDT', available: true, rate: '0.5510' });
  assert.deepEqual(body.pairs[1], { pair: 'AUDUSDT', available: false, rate: null });
  assert.deepEqual(body.pairs[2], { pair: 'USDUSDT', available: false, rate: null });
  assert.deepEqual(body.pairs[3], { pair: 'USDTNZD', available: false, rate: null });
  assert.ok(!JSON.stringify(body).includes('adjustment'));
  assert.ok(!JSON.stringify(body).includes('0.5605'));
});

test('does not call the upstream API without server credentials', async () => {
  const handler = createRateBoardHandler({ credentials: () => ({ key: '', secret: '' }),
    fetchUpstream: () => { throw new Error('fetch must not be called'); } });
  const response = await handler(request);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'rates_unavailable' });
});

test('rejects an outdated upstream snapshot instead of displaying it', async () => {
  const now = Date.now();
  const handler = createRateBoardHandler({ now: () => now, credentials,
    fetchUpstream: async () => Response.json(snapshot(now - 3_600_000)) });
  const response = await handler(request);
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: 'rates_unavailable' });
});

test('coalesces simultaneous refreshes, caches for 60 seconds, and limits stale fallback to four minutes', async () => {
  let now = Date.now();
  let calls = 0;
  let fail = false;
  const handler = createRateBoardHandler({ now: () => now, credentials, fetchUpstream: async () => {
    calls++;
    if (fail) throw new Error('upstream down');
    return Response.json(snapshot(now));
  } });

  const responses = await Promise.all(Array.from({ length: 10 }, () => handler(request)));
  assert.equal(calls, 1);
  assert.ok(responses.every(response => response.status === 200));
  now += 59_000;
  assert.equal((await handler(request)).status, 200);
  assert.equal(calls, 1);
  now += 2_000;
  fail = true;
  const stale = await handler(request);
  assert.equal(stale.status, 200);
  assert.equal(stale.headers.get('Netlify-CDN-Cache-Control'), 'no-store');
  assert.equal((await stale.json()).pairs[0].rate, '0.5510');
  assert.equal(calls, 2);
  now += 10_000;
  assert.equal((await handler(request)).status, 200);
  assert.equal(calls, 2);
  now += 170_000;
  const expired = await handler(request);
  assert.equal(expired.status, 502);
  assert.deepEqual(await expired.json(), { error: 'rates_unavailable' });
  assert.equal(calls, 3);
});
