(() => {
  const board = document.querySelector('[data-rate-board]');
  if (!board) return;

  const labels = {
    en: { loading: 'Loading reference rates…', unavailable: 'Rates temporarily unavailable.', asOf: 'Retrieved', noRate: 'Unavailable', locale: 'en-US' },
    zh: { loading: '正在获取参考汇率…', unavailable: '参考汇率暂不可用。', asOf: '获取时间', noRate: '暂不可用', locale: 'zh-CN' },
    id: { loading: 'Memuat kurs referensi…', unavailable: 'Kurs referensi sementara tidak tersedia.', asOf: 'Diambil', noRate: 'Tidak tersedia', locale: 'id-ID' },
    vi: { loading: 'Đang tải tỷ giá tham khảo…', unavailable: 'Tỷ giá tham khảo tạm thời không khả dụng.', asOf: 'Lấy lúc', noRate: 'Không khả dụng', locale: 'vi-VN' },
  };
  const text = labels[board.dataset.locale] || labels.en;
  const pairs = [
    ['NZDUSDT', 'NZD', 'USDT'], ['AUDUSDT', 'AUD', 'USDT'], ['USDUSDT', 'USD', 'USDT'],
    ['USDTNZD', 'USDT', 'NZD'], ['USDTAUD', 'USDT', 'AUD'],
    ['CNYUSDT', 'CNY', 'USDT'], ['USDTCNY', 'USDT', 'CNY'],
  ];
  const status = board.querySelector('[data-rate-status]');
  const grid = board.querySelector('[data-rate-grid]');

  function render(rows = []) {
    const byPair = new Map(rows.map(row => [row.pair, row]));
    grid.replaceChildren();
    for (const [pair, base, quote] of pairs) {
      const row = byPair.get(pair);
      const card = document.createElement('div');
      card.className = 'gex-rate-card';
      const name = document.createElement('strong');
      name.className = 'gex-rate-pair';
      name.textContent = `${base} / ${quote}`;
      const value = document.createElement('span');
      value.className = 'gex-rate-value';
      value.textContent = row?.available === true && typeof row.rate === 'string' ? row.rate : '—';
      const detail = document.createElement('small');
      detail.className = 'gex-rate-unit';
      detail.textContent = row?.available === true ? `1 ${base} → ${quote}` : text.noRate;
      card.append(name, value, detail);
      grid.append(card);
    }
  }

  render();
  status.textContent = text.loading;
  fetch('/.netlify/functions/rate-board', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  }).then(async response => {
    if (!response.ok) throw new Error('rate request failed');
    const result = await response.json();
    if (!Array.isArray(result.pairs) || !Number.isFinite(Date.parse(result.generated_at))) throw new Error('invalid rates');
    render(result.pairs);
    const date = new Intl.DateTimeFormat(text.locale, {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
    }).format(new Date(result.generated_at));
    status.textContent = `${text.asOf}: ${date} UTC`;
  }).catch(() => {
    status.textContent = text.unavailable;
  });
})();
