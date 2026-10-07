import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const pages = [
  ['en', 'www.gexfi.com/index.html'],
  ['zh', 'www.gexfi.com/zh/index.html'],
  ['id', 'www.gexfi.com/id/index.html'],
  ['vi', 'www.gexfi.com/vi/index.html'],
];
const sampleRates = [
  ['NZDUSDT', '0.5510'], ['AUDUSDT', '0.6900'], ['USDUSDT', '0.9900'],
  ['USDTNZD', '1.7300'], ['USDTAUD', '1.4200'], ['USDTCNY', '6.5800'],
];

for (const [locale, path] of pages) {
  test(`${locale} home quote uses each public buy and sell rate and blocks unavailable quotes`, () => {
    const html = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    assert.match(html, /fetch\('\/.netlify\/functions\/rate-board'/);
    assert.doesNotMatch(html, /0\.5863|0\.6512|7\.05/);
    const start = html.indexOf('function updateAmount(){');
    const end = html.indexOf('function modal(', start);
    assert.ok(start > 0 && end > start);

    const nodes = Object.fromEntries(['receive', 'rate', 'continue', 'amount-error'].map(id => [id, {}]));
    const context = {
      mode: 'buy', lastBuy: 'NZD', lastSell: 'CNY', amount: '1000',
      rateRows: new Map(sampleRates.map(([pair, rate]) => [pair, { pair, rate, available: true }])),
      lang: locale,
      extra: { [locale]: { unavailable: locale === 'zh' ? '暂不可用' : 'Unavailable' } },
      document: { getElementById: id => nodes[id] },
    };
    runInNewContext(`${html.slice(start, end)}\nthis.updateAmount = updateAmount;`, context);

    for (const [currency, expected] of [['NZD', '551.00'], ['AUD', '690.00'], ['USD', '990.00']]) {
      context.lastBuy = currency;
      context.updateAmount();
      assert.equal(nodes.receive.textContent, expected);
      assert.equal(nodes.rate.textContent, `1 ${currency} ≈ ${context.rateRows.get(`${currency}USDT`).rate} USDT`);
      assert.equal(nodes.continue.disabled, false);
    }
    context.mode = 'sell';
    for (const [currency, expected] of [['NZD', '1,730.00'], ['AUD', '1,420.00'], ['CNY', '6,580.00']]) {
      context.lastSell = currency;
      context.updateAmount();
      assert.equal(nodes.receive.textContent, expected);
      assert.equal(nodes.rate.textContent, `1 USDT ≈ ${context.rateRows.get(`USDT${currency}`).rate} ${currency}`);
    }
    context.rateRows = new Map();
    context.updateAmount();
    assert.equal(nodes.receive.textContent, context.extra[locale].unavailable);
    assert.equal(nodes.rate.textContent, context.extra[locale].unavailable);
    assert.equal(nodes.continue.disabled, true);
  });
}
