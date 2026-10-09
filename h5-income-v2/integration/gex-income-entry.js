/**
 * GEXFI Income entry component — additive integration only.
 * No network requests, no balance writes, no global stylesheet or router changes.
 * Host supplies authoritative values and handles `gex-income-open`.
 * This is an entry component, not the Income transaction engine.
 */
(function () {
  'use strict';
  if (customElements.get('gex-income-entry')) return;
  class GexIncomeEntry extends HTMLElement {
    static get observedAttributes() { return ['variant', 'lang', 'principal-usdt', 'enabled']; }
    constructor() { super(); this.attachShadow({mode: 'open'}); }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { if (this.isConnected) this.render(); }
    render() {
      if (this.getAttribute('enabled') !== 'true') { this.shadowRoot.innerHTML = ''; return; }
      const zh = this.getAttribute('lang') !== 'en';
      const kind = this.getAttribute('variant') || 'home';
      const s = (a,b) => zh ? a : b;
      const rows = [{d:90,r:'3.80'},{d:180,r:'4.50'},{d:365,r:'5.00'}];
      const root = this.shadowRoot;
      root.innerHTML = `<style>
      :host{display:block;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif}
      *{box-sizing:border-box}button{display:block;width:100%;text-align:left;cursor:pointer;border:1px solid #2e425e;border-radius:12px;padding:16px;color:#eff3fa;background:#142238;font-family:inherit}
      button:focus-visible{outline:2px solid #7393b3;outline-offset:3px}.top{display:flex;align-items:center;gap:9px;font-weight:650;font-size:14px}.coin{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;width:28px;height:28px;font-size:21px;background:#229b86;color:white;font-weight:500;flex-shrink:0}
      .sub{font-size:10px;line-height:1.7;color:#a1b2c9;margin:8px 0 12px}.rates{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:13px 0}.rates span{display:block;font-size:10px;color:#9fb0c8;margin-bottom:5px}.rates strong{font-size:23px;letter-spacing:-.8px;font-weight:650}.rates small{font-size:13px}.tail{border-top:1px solid #30415b;padding-top:11px;display:flex;align-items:center;justify-content:space-between;color:#b6cff2;font-size:10px;line-height:1.6}.arrow{font-size:18px;margin-left:10px}
      .holdings{background:#142135;color:#f3f6fa;border-color:#263953}.holdings .tail{color:#9ab3d1;border-color:#283750}.principal{font-size:27px;letter-spacing:-.7px;margin:15px 0 12px}.principal small{font-size:11px;letter-spacing:0}
      .menu{padding:9px 3px;background:transparent;color:inherit;border:0;text-align:center}.menu .top{display:flex;flex-direction:column;font-size:12px;font-weight:500;gap:8px}.menu .coin{border-radius:12px;width:43px;height:43px;background:#1e2d43;color:#edf4fe;font-size:25px}.menu .sub,.menu .tail{display:none}
      </style><button type="button" class="${['home','holdings','menu'].includes(kind)?kind:'home'}"><span class="top"><span class="coin">${kind==='menu'?'↗':'₮'}</span><span class="title"></span></span><div class="sub"></div><div class="content"></div><div class="tail"><span class="tail-text"></span><span class="arrow">→</span></div></button>`;
      root.querySelector('.title').textContent = kind === 'menu' ? s('收益中心','Income centre') : kind === 'holdings' ? s('收益资产','Income holdings') : s('USDT 收益宝','GEX USDT Income');
      root.querySelector('.sub').textContent = kind === 'holdings' ? s('收益持仓与钱包可用余额分别记录。','Holdings are separate from available wallet funds.') : s('选择固定期限，以 USDT 申购与结算。','Choose a defined term, denominated and settled in USDT.');
      root.querySelector('.tail-text').textContent = kind === 'holdings' ? s('查看持仓与到期进度','View holdings & maturity') : s('扣管理费后目标年化 · 非保证收益','Net target p.a. · not guaranteed');
      if (kind === 'home') {
        const r = document.createElement('div'); r.className='rates';
        for (const p of rows) { const cell=document.createElement('div'); cell.innerHTML=`<span>${p.d}${s('天',' days')}</span><strong>${p.r}<small>%</small></strong>`; r.append(cell); }
        root.querySelector('.content').append(r);
      } else if (kind === 'holdings') {
        const raw=this.getAttribute('principal-usdt'); const value=raw!==null && /^\d+(\.\d{1,6})?$/.test(raw) ? Number(raw) : null;
        const v=document.createElement('div'); v.className='principal';
        v.textContent=value===null?'—':value.toLocaleString(zh?'zh-CN':'en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
        const u=document.createElement('small');u.textContent=' USDT';v.append(u);root.querySelector('.content').append(v);
      }
      root.querySelector('button').addEventListener('click', () => this.dispatchEvent(new CustomEvent('gex-income-open', { bubbles:true, composed:true, detail:{destination:kind==='holdings'?'holdings':'products',source:kind} })));
    }
  }
  customElements.define('gex-income-entry', GexIncomeEntry);
})();
