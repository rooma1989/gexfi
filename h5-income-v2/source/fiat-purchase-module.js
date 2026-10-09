/* V2 fiat purchase add-on. Local simulation only.
 * No payment provider SDK, live address, merchant number or real QR payload.
 * The production adapter must fail closed unless the server authorizes both market and rail.
 */
const FIAT_DEMO = Object.freeze({currency:'CNY', customerRate:7.21, channelFeeMinor:0, ttlSeconds:300, paymentTTL:900});
const oldSeed=seed;
seed=function(empty=false){const s=oldSeed(empty);s.schema=2;s.fiatOrders=[];s.demoRegion='DEMO';return s;};
const oldSubmit=submit;
submit=function(){
  const prior=selectedPurchaseId && state.orders.find(o=>o.sourcePurchaseId===selectedPurchaseId && ['pending','accepted'].includes(o.status));
  if(prior){go('order/'+prior.id);return;}
  oldSubmit();
};
const oldAmountError=amountError;
amountError=function(v){
  if(fundingMode!=='fiat')return oldAmountError(v);
  if(!state.verified)return t('请先完成账户认证。','Complete account verification first.');
  if(state.restriction)return t('账户暂不可申购。','Subscriptions are unavailable for this account.');
  if(!Number.isFinite(Number(v))||Number(v)<100)return t('演示最低金额为 100 USDT。','The demo minimum is 100 USDT.');
  if(v>50000)return t('演示单笔最高金额为 50,000 USDT。','The demo maximum is 50,000 USDT.');
  if(!/^\d+(\.\d{1,6})?$/.test(String(v)))return t('最多支持 6 位小数。','Use no more than six decimal places.');
  return '';
};
function fiatBlocked(){return state.demoRegion==='CN'||!!state.restriction;}
function cny(minor){return num(minor/100);}
function payOrder(pid){return (state.fiatOrders||[]).find(o=>o.id===pid);}
function payTotal(v){return Math.round(Number(v)*FIAT_DEMO.customerRate*100)+FIAT_DEMO.channelFeeMinor;}
function payLabel(status){return ({awaiting_payment:t('待付款','Awaiting payment'),confirming:t('支付结果确认中','Confirming payment'),awaiting_release:t('已收到付款 · 待入账审核','Payment received · settlement review'),converting:t('正在完成购 U','Completing USDT purchase'),credited:t('购 U 已完成','USDT purchase completed'),cancel_requested:t('取消请求处理中','Cancellation requested'),cancelled:t('订单已取消','Order cancelled'),expired:t('付款已超时','Payment expired'),payment_failed:t('付款未完成','Payment not completed'),review_required:t('付款信息待核对','Payment requires review'),refund_pending:t('退款处理中','Refund in progress'),refunded:t('已原路退款','Refunded to original method')})[status]||status;}
function payTone(status){return status==='credited'||status==='refunded'?'green':['review_required','payment_failed'].includes(status)?'red':['expired','cancelled','cancel_requested','refund_pending'].includes(status)?'amber':'';}
function flowSteps(current){return `<div class="flow-steps">${[t('申购金额','Amount'),t('购 U 付款','Payment'),t('确认申购','Subscribe')].map((s,i)=>`${i?'<span class="line"></span>':''}<span class="flow-step ${i+1===current?'active':i+1<current?'done':''}"><b>${i+1}</b>${s}</span>`).join('')}</div>`;}
function compactProjection(days,v){return `<div class="row"><span class="caption">${t('持满期限预计收益','Illustrative full-term income')}</span><strong class="green">+${money(calc(micro(v||0),days))} USDT</strong></div><p class="caption" style="margin:9px 0 0">${t('按净目标年化计算，不保证收益；不是已到账收入。','Calculated at the net target rate; not guaranteed or credited income.')}</p>`;}
function fundingHint(){return fundingMode==='fiat'?`<div class="funding-hint"><div class="row"><div><div class="caption">${t('人民币参考支付金额','Illustrative CNY payment')}</div><div class="price">¥ ${cny(payTotal(amount||0))}</div></div><span class="pill">CNY → USDT</span></div><div class="caption">${t('1 USDT = 7.2100 CNY · 演示报价，已含兑换价差','1 USDT = 7.2100 CNY · demo quote including spread')}</div><div class="caption" style="margin-top:5px">${t('下一步查看渠道及最终应付金额。','Review available methods and the final amount next.')}</div></div>`:`<div class="funding-hint"><div class="row"><span class="caption">${t('可用于本次申购','Eligible for this subscription')}</span><strong>${money(state.funds.eligible)} USDT</strong></div><p class="caption" style="margin:7px 0 0">${t('仅已结算的 GEXFI 购 U 余额；外部转入不计入。','Settled eligible GEXFI-purchased USDT only; external deposits are excluded.')}</p></div>`;}
subscribePage=function(days){
  chosen=Number(days);const err=amountError(amount);
  return header(t('申购收益宝','Subscribe to Income'),'product/'+days)+`<main class="page has-dock">${flowSteps(1)}<div class="card tight">${productLine(days)}</div><h2 style="margin-top:20px">${t('申购多少 USDT？','How much USDT?')}</h2><div class="card"><div class="row"><label class="input-label" for="subscribe-amount">${t('申购金额','Subscription amount')}</label><span class="caption">USDT</span></div><div class="amount-wrap"><input id="subscribe-amount" type="number" inputmode="decimal" min="100" max="50000" step="0.000001" value="${amount}" aria-label="${t('申购金额','Subscription amount')}"><span>USDT</span></div><div class="chips">${[100,500,1000,5000].map(n=>btn(num(n,0),'v2-amount','','data-value="'+n+'"')).join('')}</div><div id="amount-error" class="input-error">${err}</div></div><h2>${t('选择资金来源','Choose your funding source')}</h2><div class="funding-options">${['wallet','fiat'].map(mode=>`<button class="funding-option ${fundingMode===mode?'active':''}" data-act="funding-mode" data-value="${mode}"><div class="option-head"><span class="radio-dot"></span>${mode==='wallet'?t('USDT 余额','USDT balance'):t('法币购买 USDT','Buy USDT with fiat')}</div><div class="option-meta">${mode==='wallet'?t('使用可申购余额','Use eligible wallet funds'):t('先付款购 U，再确认申购','Pay for USDT, then subscribe')}</div></button>`).join('')}</div><div id="funding-hint">${fundingHint()}</div>${selectedPurchaseId&&fundingMode==='wallet'?`<div class="paid-wallet-label">${I('check',17)}${t('本次购 U 已到账，可继续申购。','Your purchase is settled. Continue to subscribe.')}</div>`:''}<div class="card mt"><h3>${t('收益试算','Income illustration')}</h3><div id="subscription-rows">${trialRows(days,amount||0)}</div></div><p class="footnote">${t('付款到账和申购受理是不同步骤。收益持有期从申购受理时开始；购 U 期间不计息。','Payment settlement and subscription acceptance are separate. The Income term begins on acceptance, not during the USDT purchase.')}</p></main>`+dock(fundingMode==='fiat'?t('下一步，选择付款方式','Choose payment method'):t('下一步，核对申购','Review subscription'),'review','id="review-button" '+(err?'disabled':''));
};
function makeBuyQuote(v=amount,days=chosen){
  if(fiatBlocked())return null;
  buyConsent=false;
  buyQuote={id:'DEMO-Q-'+Date.now(),amount:micro(v),days:Number(days),currency:'CNY',customerRate:FIAT_DEMO.customerRate,totalMinor:payTotal(v),feeMinor:0,expires:Date.now()+FIAT_DEMO.ttlSeconds*1000};
  return buyQuote;
}
function ensureBuyQuote(){if(!buyQuote||buyQuote.amount!==micro(amount)||buyQuote.days!==chosen)makeBuyQuote();return buyQuote;}
function methodRows(){return `<button class="payment-method selected" data-act="demo-method"><span class="method-icon demo">${I('card',19)}</span><span class="method-body"><strong>${t('演示收银台','Demo checkout')}</strong><small>${t('二维码 / 打开收银台 · 不产生真实收款','QR / hosted checkout · no real payment')}</small></span><span class="radio-dot"></span></button><button class="payment-method disabled" disabled aria-label="${t('支付宝购U渠道未开放','Alipay unavailable for this purchase')}"><span class="method-icon alipay">支</span><span class="method-body"><strong>${t('支付宝','Alipay')}</strong><small>${t('当前购 U 交易不支持','Unavailable for this USDT purchase')}</small></span><span class="pill">${t('未开放','Unavailable')}</span></button><button class="payment-method disabled" disabled aria-label="${t('微信支付购U渠道未开放','WeChat Pay unavailable for this purchase')}"><span class="method-icon wechat">${I('support',18)}</span><span class="method-body"><strong>${t('微信支付','WeChat Pay')}</strong><small>${t('当前购 U 交易不支持','Unavailable for this USDT purchase')}</small></span><span class="pill">${t('未开放','Unavailable')}</span></button>`;}
function buyPage(days){
  chosen=Number(days);fundingMode='fiat';if(fiatBlocked())return paymentUnavailablePage();
  const q=ensureBuyQuote(),err=amountError(amount),expires=q&&q.expires<=Date.now();
  if(!q)return paymentUnavailablePage();
  return header(t('购 U 与付款','Purchase USDT'),'subscribe/'+chosen)+`<main class="page has-dock">${flowSteps(2)}<div class="pay-summary"><div class="caption">${t('本次需要支付','Amount to pay')}</div><div class="large-number">¥ ${cny(q.totalMinor)}<small>CNY</small></div><div class="price-caption">${t('购 U 到账','USDT to receive')} <strong>${money(q.amount)} USDT</strong>　·　${chosen}${t('天收益宝','-day Income')}</div><div class="quote-bottom"><span id="buy-quote-clock">${expires?t('报价已过期','Quote expired'):t('报价剩余','Quote valid for')+' '+Math.max(0,Math.ceil((q.expires-Date.now())/1000))+'s'}</span>${btn(t('刷新报价','Refresh'),'refresh-buy','link')}</div></div><div class="card mt tight">${def(t('成交报价（含兑换价差）','Quoted rate (spread included)'),'1 USDT = '+q.customerRate.toFixed(4)+' CNY')}${def(t('额外支付渠道费 · 演示','Additional channel fee · demo'),'CNY '+cny(q.feeMinor))}${def(t('本次购 U 数量','USDT purchase amount'),money(q.amount)+' USDT')}${def(t('确认后的应付总额','Total payable'),'CNY '+cny(q.totalMinor))}<p class="caption">${t('本次全额购 U，不同时扣用其他钱包余额。参考报价仅用于演示。','This is a full USDT purchase; other wallet funds are not debited. The quote is illustrative only.')}</p></div><div class="section-line"><h2>${t('选择支付方式','Payment method')}</h2>${pill(t('演示环境','Demo'))}</div>${methodRows()}<p class="policy-method-note">${t('当前仅演示收银台交互。真实支付方式须与账户地区、交易用途及渠道许可匹配；订阅卡充值权限不等于购 U 权限。','Checkout interaction only. Live methods must match account jurisdiction, transaction purpose and provider permissions; card top-up permissions do not authorize USDT purchases.')}</p><div class="card mt">${compactProjection(chosen,amount)}</div><label class="check-row"><input id="buy-consent" type="checkbox" ${buyConsent?'checked':''}><span>${t('我已核对购 U 数量、CNY 应付金额及报价，了解购 U 完成后仍需确认收益宝申购。','I have reviewed the USDT amount, CNY payable and quote, and understand that I must separately confirm the Income subscription after purchase.')}</span></label><div class="input-error" id="buy-error">${err||''}</div></main>`+dock(t('创建模拟付款订单','Create demo payment order'),'create-buy','id="create-buy-button" '+(!buyConsent||!!err||expires?'disabled':''));
}
function createBuy(){
  if(fiatBlocked()){go('payment-unavailable');return null;}
  fundingMode='fiat';const err=amountError(amount);if(err){toast(err);return null;}
  if(!buyQuote||buyQuote.expires<=Date.now()){toast(t('报价已过期，请刷新并重新确认。','Quote expired. Refresh and confirm it again.'));render();return null;}
  if(!buyConsent){toast(t('请核对报价并勾选确认。','Review the quote and confirm it.'));return null;}
  const old=state.fiatOrders.find(o=>o.quoteId===buyQuote.id);if(old){go('checkout/'+old.id);return old;}
  const o={id:id('BUY'),paymentId:id('PAY'),quoteId:buyQuote.id,days:chosen,amount:buyQuote.amount,currency:'CNY',totalMinor:buyQuote.totalMinor,customerRate:buyQuote.customerRate,channelFeeMinor:0,method:'demo_checkout',status:'awaiting_payment',createdAt:new Date().toISOString(),date:state.now,expires:Date.now()+FIAT_DEMO.paymentTTL*1000,receivedMinor:0,credited:false,refundId:null,history:[],paymentPurpose:'USDT_PURCHASE',creditId:null,checkedAt:null};
  state.fiatOrders.unshift(o);payLog(o,'awaiting_payment',t('付款订单已创建，尚未扣用钱包资金。','Payment order created; wallet funds unchanged.'));event('purchase',['购 U 订单已创建 · 待付款','USDT purchase created · awaiting payment'],0,o.id);save();go('checkout/'+o.id);return o;
}
function payLog(o,status,note){o.status=status;o.history.push({status,at:new Date().toISOString(),note});save();}
function paymentControls(o){
  if(!o)return'';const a=(text,eventName)=>btn(text,'pay-sim','demo-control',`data-id="${o.id}" data-value="${eventName}"`);
  let c='';
  if(o.status==='awaiting_payment')c+=a(t('模拟付款返回：结果确认中','Simulate return: confirming'),'confirming')+a(t('模拟付款失败','Simulate payment failure'),'failed')+a(t('模拟付款超时','Simulate payment expiry'),'expired')+a(t('模拟已收到付款但金额不符','Simulate payment mismatch'),'mismatch');
  if(['awaiting_payment','confirming'].includes(o.status))c+=a(t('模拟渠道确认收款：等待入账审核','Simulate receipt: awaiting review'),'received');
  if(o.status==='awaiting_release')c+=a(t('模拟财务核对并放行：开始购 U','Simulate finance release: convert'),'release')+a(t('模拟入账未通过：原路退款','Simulate failed review: refund'),'reject');
  if(o.status==='converting')c+=a(t('模拟购 U 成交并入账','Simulate completed conversion & credit'),'credit')+a(t('模拟未成交：原路退款','Simulate no execution: refund'),'convert-failed');
  if(o.status==='cancel_requested')c+=a(t('模拟渠道确认取消','Simulate confirmed cancellation'),'cancel-confirmed')+a(t('模拟取消途中收到付款','Simulate payment during cancellation'),'late-payment');
  if(['cancelled','expired','payment_failed'].includes(o.status))c+=a(t('模拟关闭后迟到款：待退款','Simulate late funds: refund review'),'late-payment');
  if(o.status==='review_required')c+=a(t('模拟核对后原路退款','Simulate refund after review'),'refund-review');
  if(o.status==='refund_pending')c+=a(t('模拟原路退款已完成','Simulate confirmed refund'),'refund-complete');
  if(o.status==='credited')c+=a(t('重放成交入账通知（幂等测试）','Replay credit event (idempotency test)'),'credit');
  return c;
}
function checkoutPage(pid){
  const o=payOrder(pid);if(!o)return paymentsPage();
  if(o.status!=='awaiting_payment')return buyOrderPage(pid);
  if(o.expires<=Date.now()){payLog(o,'expired','DEMO expiry');return buyOrderPage(pid);}
  return header(t('收银台','Checkout'),'buy-order/'+o.id)+`<main class="page">${flowSteps(2)}<div class="checkout-center"><span class="caption">${t('购 U 付款 · 演示收银台','USDT purchase · demo checkout')}</span><div class="large-number">¥ ${cny(o.totalMinor)}<small>CNY</small></div><div class="caption">${t('预计购 U 到账','USDT purchase amount')} ${money(o.amount)} USDT</div><div class="qr-card"><img src="${D.qr}" width="178" height="178" alt="DEMO ONLY. Not a payment QR code."><div class="demo-caption">DEMO ONLY · ${t('非付款码','NOT A PAYMENT CODE')}</div></div><div class="caption">${t('同一部手机操作，请点击下方打开收银台。','On the same phone, use Open checkout below.')}</div>${btn(t('打开演示收银台','Open demo checkout'),'open-checkout','primary',`data-id="${o.id}"`)}<p class="caption"><span id="payment-clock" data-id="${o.id}" class="countdown">${t("剩余 ","Remaining ")}${Math.floor(Math.max(0,o.expires-Date.now())/60000)}:${String(Math.floor(Math.max(0,o.expires-Date.now())/1000)%60).padStart(2,"0")}</span>　${t('请勿向演示二维码付款','Do not pay this demo QR')}</p></div><div class="checkout-refresh"><div class="row"><span>${I('clock',14)} ${t('正在查询付款状态','Checking payment status')}</span>${btn(t('立即查询','Check now'),'query-buy','link',`data-id="${o.id}"`)}</div><div class="caption" id="payment-poll-text">${t('每 3 秒读取本地演示状态；返回页面不会自动判定付款成功。','Local demo status checks every 3 seconds. Returning here does not confirm payment.')}</div></div><div class="card tight">${def(t('订单编号','Order ID'),`<span class="inline-code">${o.id}</span>`)}${def(t('交易用途','Purpose'),t('购买 USDT','Purchase USDT'))}${def(t('购 U 数量','USDT amount'),money(o.amount)+' USDT')}${def(t('目标产品','Selected Income'),'USDT Income '+o.days)}</div><div class="action-pair mt">${goBtn(t('查看订单','Order details'),'buy-order/'+o.id,'secondary')}${btn(t('取消付款订单','Cancel payment order'),'cancel-buy','secondary',`data-id="${o.id}"`)}</div><p class="footnote">${t('关闭收银台不等于取消订单。付款成功后需完成核对及购 U，USDT 入账后再确认申购。','Closing checkout does not cancel the order. Payment must be reconciled and the USDT purchase settled before you confirm Income.')}</p></main>`;
}
function purchaseTimeline(o){
  const confirmed=['awaiting_release','converting','credited'].includes(o.status),released=['converting','credited'].includes(o.status),credited=o.status==='credited';
  const exceptional=['review_required','refund_pending','refunded','cancel_requested','cancelled','expired','payment_failed'].includes(o.status);
  if(exceptional)return timeline([['done',t('付款订单已创建','Payment order created'),o.id],[o.status==='refunded'||o.status==='cancelled'?'done':'pending',payLabel(o.status),o.status==='refunded'?t('退款已由渠道确认，未生成 USDT 或收益持仓。','Provider confirmed the refund; no USDT or Income holding was created.'):t('本次资金未进入收益宝；请以订单处理结果为准。','Funds have not entered Income. Follow the order status.')]]);
  return timeline([['done',t('创建购 U 付款订单','Create purchase payment'),t('记录金额、报价与交易用途','Amount, quote and purpose recorded')],[confirmed?'done':'pending',t('付款结果确认','Confirm payment'),confirmed?t('已收到渠道收款结果','Provider payment receipt confirmed'):t('付款返回或点击“我已支付”不代表入账','A return or “I paid” message is not a credit')],[released?'done':confirmed?'pending':'',t('核对到账与购 U 执行','Reconcile and execute purchase'),released?t('已核对付款，执行兑换','Payment reconciled; execution released'):t('审核通过前，不增加可申购金额','No eligible USDT is added before release')],[credited?'done':released?'pending':'',t('USDT 入账','Credit USDT'),credited?t('可申购金额已更新','Eligible funds updated'):t('实际成交后确认入账','Credit follows actual execution')],['',t('客户确认收益宝申购','Confirm Income subscription'),t('另行确认期限与风险，受理后开始持有','Confirm the term and risks; holding starts on acceptance')]]);
}
function buyOrderPage(pid){
  const o=payOrder(pid);if(!o)return paymentsPage();
  const credited=o.status==='credited',refund=['review_required','refund_pending','refunded'].includes(o.status),closed=['cancelled','expired','payment_failed'].includes(o.status),activeSub=state.orders.find(s=>s.sourcePurchaseId===o.id&&['pending','accepted'].includes(s.status));
  let action='';
  if(credited){action=activeSub?goBtn(t('查看关联申购','View linked subscription'),'order/'+activeSub.id):btn(t('继续，确认收益宝申购','Continue to Income confirmation'),'continue-after-buy','primary',`data-id="${o.id}"`);}
  else if(o.status==='awaiting_payment'){action=goBtn(t('继续付款','Continue payment'),'checkout/'+o.id)+`<div class="spacer-sm"></div>`+btn(t('取消付款订单','Cancel payment order'),'cancel-buy','secondary',`data-id="${o.id}"`);}
  else if(closed){action=btn(t('重新获取报价','Get a new quote'),'retry-buy','primary',`data-id="${o.id}"`);}
  else{action=btn(t('查询最新处理结果','Check latest status'),'query-buy','secondary',`data-id="${o.id}"`);}
  const desc=credited?t('USDT 已进入 GEXFI 钱包可申购余额。尚未自动投入收益宝。','USDT is now eligible in GEXFI Wallet. It has not been automatically invested.'):o.status==='awaiting_release'?t('付款已确认收到，正在核对到账。尚未生成 USDT 余额或收益持仓。','Payment receipt is confirmed and being reconciled. No USDT or Income holding has been credited yet.'):o.status==='converting'?t('到账核对已完成，正在执行购 U。请等待成交入账。','Payment is reconciled. Wait for purchase execution and USDT credit.'):o.status==='refunded'?t('已退回原付款方式。不会生成 USDT，也不会建立收益持仓。','Returned to the original payment method. No USDT or Income holding was created.'):refund?t('本次款项需核对或退款，不会自动购 U 或申购。','The payment needs review or refund. There is no automatic purchase or subscription.'):t('请以订单状态为准，勿重复付款。','Follow this order status and avoid duplicate payment.');
  return header(t('购 U 订单','USDT purchase order'),'payments')+`<main class="page"><div class="result-hero"><div class="result-icon ${credited||o.status==='refunded'?'':refund||closed?'failed':'pending'}">${I(credited||o.status==='refunded'?'check':refund||closed?'info':'clock',27)}</div><h1>${payLabel(o.status)}</h1><p class="subtle">${desc}</p><div class="large-number">${credited?money(o.amount):'¥ '+cny(o.status==='refunded'?o.receivedMinor||o.totalMinor:o.totalMinor)}<small>${credited?'USDT':'CNY'}</small></div></div>${action}<div class="card mt tight">${def(t('关联产品','Selected Income'),'USDT Income '+o.days)}${def(t('购 U 数量','USDT quantity'),money(o.amount)+' USDT')}${def(t('CNY 应付金额','CNY amount payable'),'¥ '+cny(o.totalMinor))}${o.receivedMinor?def(t('确认收到 CNY','CNY received'),'¥ '+cny(o.receivedMinor)):''}${def(t('支付方式','Payment method'),t('演示收银台','Demo checkout'))}${def(t('报价','Quoted rate'),'1 USDT = '+o.customerRate.toFixed(4)+' CNY')}${def(t('购 U 订单号','Purchase order'),`<span class="inline-code">${o.id}</span>`)}${def(t('付款单号','Payment reference'),`<span class="inline-code">${o.paymentId}</span>`)}${o.creditId?def(t('钱包入账凭证','Wallet credit reference'),`<span class="inline-code">${o.creditId}</span>`):''}${o.refundId?def(t('退款记录','Refund reference'),`<span class="inline-code">${o.refundId}</span>`):''}</div><h2>${t('处理进度','Progress')}</h2><div class="card">${purchaseTimeline(o)}</div><div class="spacer"></div>${credited?notice(t('取消或不继续申购时，已购买的 USDT 留在钱包，不自动退回原法币；后续兑换是独立服务。','If you do not subscribe, the purchased USDT stays in your wallet. There is no automatic fiat refund after execution; later conversion is separate.')):''}<div class="card tight mt"><button class="list-item" data-go="support"><span>${t('订单帮助','Get help with this order')}</span>${I('chevron',15)}</button><button class="list-item" data-go="payments"><span>${t('全部购 U 与付款记录','All purchase & payment records')}</span>${I('chevron',15)}</button></div></main>`;
}
function paymentsPage(){return header(t('购 U 与付款记录','Purchases & payments'),'products')+`<main class="page"><h1>${t('付款进度，一处查看。','Your payment progress.')}</h1><p class="subtle">${t('购 U 付款与收益宝申购分别记录，可以通过订单关联查询。','USDT purchase payments and Income subscriptions are recorded separately and linked by reference.')}</p><div class="spacer-sm"></div>${state.fiatOrders.length?state.fiatOrders.map(o=>`<button class="purchase-item" data-go="buy-order/${o.id}"><div class="row"><strong>${t('购买 USDT','USDT purchase')}</strong>${pill(payLabel(o.status),payTone(o.status))}</div><div class="money-line"><span>${money(o.amount)} <small>USDT</small></span><span>${cny(o.totalMinor)} <small>CNY</small></span></div><div class="row"><span class="caption">${o.days}${t('天收益宝 · ','-day Income · ')}${o.date}</span>${I('chevron',15)}</div></button>`).join(''):`<div class="card empty">${I('file',30)}<h3>${t('暂无购 U 付款记录','No purchase payments yet')}</h3><p>${t('从产品申购选择法币购 U，即可在这里查看付款及到账进度。','Choose fiat funding during subscription to track your payment and settlement here.')}</p></div>`}<div class="spacer"></div>${goBtn(t('选择产品并申购','Explore Income products'),'products')}</main>`;}
function paymentUnavailablePage(){return header(t('支付方式不可用','Payment unavailable'),'subscribe/'+chosen)+`<main class="page"><div class="result-hero"><div class="result-icon failed">${I('info',28)}</div><h1>${t('当前无法提供购 U 支付','USDT purchase payment unavailable')}</h1><p class="subtle">${t('当前账户地区或交易用途没有可用支付渠道。本次未创建收款订单，也未扣除资金。','No payment method is available for this account jurisdiction or transaction purpose. No payment order or debit was created.')}</p></div><div class="card"><ul class="policy-list"><li>${t('系统不以页面语言或持有中国身份证来判断地区，而读取已验证账户与实际服务市场规则。','Eligibility is based on verified account and service-market rules, not display language or Chinese identity alone.')}</li><li>${t('订阅卡充值、购买 USDT 与收益产品申购属于不同交易用途。','Card top-up, USDT purchase and Income subscription have distinct transaction purposes.')}</li><li>${t('不会切换商户名称、使用个人收款码，或引导绕过渠道限制。','No merchant relabelling, personal QR fallback or bypass of provider restrictions.')}</li></ul></div><div class="spacer"></div>${goBtn(t('返回产品','Back to products'),'products','secondary')}<div class="spacer-sm"></div>${goBtn(t('联系客户服务','Contact support'),'support','secondary')}</main>`;}
function simulatePay(pid,transition){
  const o=payOrder(pid);if(!o)return false;const before=o.status;
  const allowed={confirming:['awaiting_payment'],received:['awaiting_payment','confirming'],release:['awaiting_release'],credit:['converting'],failed:['awaiting_payment','confirming'],expired:['awaiting_payment'],mismatch:['awaiting_payment','confirming'],reject:['awaiting_release'],'convert-failed':['converting'],'cancel-confirmed':['cancel_requested'],'late-payment':['cancel_requested','cancelled','expired','payment_failed'],'refund-review':['review_required'],'refund-complete':['refund_pending']};
  if(!allowed[transition]?.includes(o.status)){toast(t('结果已处理或当前状态不允许该操作；未重复入账。','Already processed or invalid for the current state; no duplicate credit.'));return false;}
  if(transition==='received'&&o.expires<=Date.now())transition='late-payment';
  switch(transition){
    case'confirming':payLog(o,'confirming','DEMO payment return; not a receipt');break;
    case'received':o.receivedMinor=o.totalMinor;payLog(o,'awaiting_release','DEMO provider receipt matched; finance review required');break;
    case'release':if(o.receivedMinor!==o.totalMinor){payLog(o,'review_required','DEMO amount mismatch');break;}payLog(o,'converting','DEMO finance release');break;
    case'credit':if(o.credited)return false;o.credited=true;o.creditId=id('WAL');state.funds.eligible+=o.amount;payLog(o,'credited','DEMO conversion execution settled');event('purchase',['购 U 完成 · 已入账可申购余额','Purchase settled · eligible USDT credited'],o.amount,o.id);break;
    case'failed':payLog(o,'payment_failed','DEMO payment failed');break;
    case'expired':o.expires=Date.now()-1;payLog(o,'expired','DEMO payment deadline elapsed');break;
    case'mismatch':o.receivedMinor=o.totalMinor-100;payLog(o,'review_required','DEMO received amount differs by CNY 1');break;
    case'cancel-confirmed':payLog(o,'cancelled','DEMO provider confirmed cancellation');break;
    case'late-payment':o.receivedMinor=o.totalMinor;o.refundId=o.refundId||id('RF');payLog(o,'refund_pending','DEMO late payment; never automatically invests');break;
    case'reject':case'convert-failed':case'refund-review':o.refundId=o.refundId||id('RF');payLog(o,'refund_pending','DEMO original-method refund requested');break;
    case'refund-complete':payLog(o,'refunded','DEMO provider confirmed original-method refund');event('purchase',['购 U 未完成 · 已原路退款','Purchase not completed · original-method refund confirmed'],0,o.id);break;
  }
  save();if(before!==o.status)go('buy-order/'+o.id);return true;
}
function cancelBuy(pid){const o=payOrder(pid);if(!o||o.status!=='awaiting_payment'){toast(t('付款已在处理，不能在此直接取消；请查询订单。','Payment is processing; check its status instead of cancelling here.'));return false;}payLog(o,'cancel_requested','DEMO cancellation requested; not confirmed');go('buy-order/'+pid);return true;}
function continueAfterBuy(pid){
  const o=payOrder(pid);if(!o||o.status!=='credited')return false;
  const prior=state.orders.find(s=>s.sourcePurchaseId===pid&&['pending','accepted'].includes(s.status));if(prior){go('order/'+prior.id);return true;}
  chosen=o.days;amount=o.amount/SCALE;fundingMode='wallet';selectedPurchaseId=o.id;consent={memo:false,risk:false};
  if(oldAmountError(amount)){go('subscribe/'+chosen);toast(t('请核对当前可申购余额。','Review current eligible funds.'));return false;}
  go('review');return true;
}
const reviewOriginal=reviewPage;
reviewPage=function(){const html=reviewOriginal();if(!selectedPurchaseId)return html;return html.replace('<main class="page has-dock">','<main class="page has-dock">'+flowSteps(3)+`<div class="paid-wallet-label">${I('check',17)}<span>${t('购 U 已到账；本页单独确认收益宝申购。','USDT purchase settled. Confirm Income separately here.')}</span></div>`);};
const productsOriginal=productsPage;
productsPage=function(){return productsOriginal().replace('<div class="section-line"><h2>',`<div class="card mt tight"><button class="list-item" data-go="payments"><div class="row start"><span class="list-icon">${I('file',18)}</span><div><span class="list-title">${t('购 U 与付款记录','Purchase & payment records')}</span><p>${t('查看待付款、到账核对及购 U 结果','Track payment, reconciliation and purchase results')}</p></div></div>${I('chevron',15)}</button></div><div class="section-line"><h2>`);};
const oldOpenDemo=openDemo;
openDemo=function(){oldOpenDemo();const sh=document.querySelector('.sheet');if(!sh)return;const o=payOrder(routeId());sh.insertAdjacentHTML('afterbegin',`<div class="spacer-sm"></div><h3>${t('V2 付款场景','V2 payment scenarios')}</h3>${o?paymentControls(o):''}<div class="case-grid">${btn(t('首次购 U · 无余额','First purchase · no funds'),'first-purchase','demo-control')}${btn(t('地区不支持场景','Unsupported region'),'pay-region-block','demo-control')}${btn(t('恢复演示地区','Restore demo market'),'pay-region-demo','demo-control')}${buyQuote?btn(t('购 U 报价过期','Expire purchase quote'),'expire-buy-quote','demo-control'):''}</div><p class="caption">${t('支付宝与微信不是本演示的真实购 U 渠道，禁止用订阅卡商户号替代。','Alipay and WeChat Pay are not enabled purchase rails. Do not substitute a card top-up merchant account.')}</p><div class="divider"></div>`);};
function firstPurchase(){state=seed(true);state.funds.eligible=0;state.funds.external=0;state.funds.pending=0;fundingMode='fiat';amount=1000;chosen=180;selectedPurchaseId=null;buyQuote=null;buyConsent=false;consent={memo:false,risk:false};save();go('subscribe/180');}
function queryBuy(pid){const o=payOrder(pid);if(!o)return;o.checkedAt=new Date().toISOString();save();if(o.status!=='awaiting_payment')go('buy-order/'+pid);else{const node=document.getElementById('payment-poll-text');if(node)node.textContent=t('已查询：订单仍待付款，请勿重复创建订单。','Checked: awaiting payment. Do not create a duplicate order.');toast(t('仅查询订单，不会把点击按钮当作付款成功。','Status check only; the button does not mark payment as successful.'));}}
// Capture only the V2 actions, leaving existing subscription/holding/card actions in place.
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b||b.disabled)return;const act=b.dataset.act,pid=b.dataset.id;
  if(act==='start-subscribe'){selectedPurchaseId=null;buyQuote=null;buyConsent=false;fundingMode=state.funds.eligible>0?'wallet':'fiat';return;}
  if(act==='reset'){buyQuote=null;selectedPurchaseId=null;fundingMode=b.dataset.mode==='external'?'fiat':'wallet';buyConsent=false;return;}
  const acts=['funding-mode','v2-amount','create-buy','refresh-buy','cancel-buy','cancel-buy-confirm','open-checkout','query-buy','continue-after-buy','retry-buy','pay-sim','first-purchase','pay-region-block','pay-region-demo','expire-buy-quote','demo-method'];
  if(act==='review'&&fundingMode==='fiat'){e.preventDefault();e.stopImmediatePropagation();const err=amountError(amount);if(err){toast(err);return;}buyQuote=null;buyConsent=false;selectedPurchaseId=null;go('buy/'+chosen);return;}
  if(!acts.includes(act))return;e.preventDefault();e.stopImmediatePropagation();
  switch(act){
    case'funding-mode':fundingMode=b.dataset.value;buyQuote=null;buyConsent=false;consent={memo:false,risk:false};render();break;
    case'v2-amount':amount=Number(b.dataset.value);buyQuote=null;buyConsent=false;consent={memo:false,risk:false};render();break;
    case'create-buy':createBuy();break;
    case'refresh-buy':makeBuyQuote();render();break;
    case'cancel-buy':sheet(t('取消本次付款订单？','Cancel this payment order?'),`<p>${t('申请取消后需等待渠道确认。若取消途中收到付款，将进入核对与退款，不会自动购 U 或申购。','Cancellation requires provider confirmation. A payment received during cancellation goes to review and refund, not automatic purchase or investment.')}</p>${btn(t('提交取消请求','Request cancellation'),'cancel-buy-confirm','primary',`data-id="${pid}"`)}<div class="spacer-sm"></div>${btn(t('继续保留订单','Keep order'),'close','secondary')}`);break;
    case'cancel-buy-confirm':cancelBuy(pid);break;
    case'open-checkout':sheet(t('演示收银台','Demo hosted checkout'),`<div class="checkout-center"><div class="pending-icon" style="margin:4px auto 15px">${I('card',24)}</div><h3>${t('这里将打开获准渠道的收银台','An authorized checkout opens here')}</h3><p>${t('当前没有真实支付链接、商户号或扣款请求。付款效果请使用“演示控制”切换。','No live payment URL, merchant account or debit request exists. Use Demo controls to explore payment results.')}</p></div>${btn(t('返回订单','Return to order'),'close')}`);break;
    case'query-buy':queryBuy(pid);break;
    case'continue-after-buy':continueAfterBuy(pid);break;
    case'retry-buy':{const o=payOrder(pid);if(o){chosen=o.days;amount=o.amount/SCALE;}buyQuote=null;buyConsent=false;go('buy/'+chosen);break;}
    case'pay-sim':simulatePay(pid,b.dataset.value);break;
    case'first-purchase':firstPurchase();break;
    case'pay-region-block':state.demoRegion='CN';save();go('payment-unavailable');break;
    case'pay-region-demo':state.demoRegion='DEMO';save();buyQuote=null;go('buy/'+chosen);break;
    case'expire-buy-quote':if(buyQuote)buyQuote.expires=Date.now()-1;buyConsent=false;go('buy/'+chosen);break;
    case'demo-method':toast(t('仅提供演示付款，不连接真实渠道。','Demo checkout only; no live provider.'));break;
  }
},true);
document.addEventListener('input',e=>{if(e.target.id==='subscribe-amount'){buyQuote=null;buyConsent=false;consent={memo:false,risk:false};const h=document.getElementById('funding-hint');if(h)h.innerHTML=fundingHint();}if(e.target.id==='buy-consent'){buyConsent=e.target.checked;const b=document.getElementById('create-buy-button');if(b)b.disabled=!buyConsent||!buyQuote||buyQuote.expires<=Date.now()||!!amountError(amount);}});
document.addEventListener('change',e=>{if(e.target.id==='buy-consent'){buyConsent=e.target.checked;const b=document.getElementById('create-buy-button');if(b)b.disabled=!buyConsent||!buyQuote||buyQuote.expires<=Date.now()||!!amountError(amount);}});
setInterval(()=>{
  if(document.hidden||!state)return;
  const qc=document.getElementById('buy-quote-clock');if(qc&&buyQuote){const left=Math.max(0,Math.ceil((buyQuote.expires-Date.now())/1000));qc.textContent=left?t('报价剩余 ','Quote valid for ')+Math.floor(left/60)+':'+String(left%60).padStart(2,'0'):t('报价已过期，请刷新','Quote expired. Refresh to continue.');if(!left){const b=document.getElementById('create-buy-button');if(b)b.disabled=true;}}
  const pc=document.getElementById('payment-clock');if(pc){const o=payOrder(pc.dataset.id);if(o){const left=Math.max(0,Math.ceil((o.expires-Date.now())/1000));pc.textContent=t('剩余 ','Remaining ')+Math.floor(left/60)+':'+String(left%60).padStart(2,'0');if(!left&&o.status==='awaiting_payment'){payLog(o,'expired','DEMO timeout');go('buy-order/'+o.id);}}}
},1000);
setInterval(()=>{if(document.hidden||!state||!route.startsWith('checkout/'))return;const o=payOrder(routeId());if(!o)return;o.checkedAt=new Date().toISOString();const p=document.getElementById('payment-poll-text');if(p)p.textContent=t('最近查询 ','Last local check ')+new Date().toLocaleTimeString(lang==='zh'?'zh-CN':'en-GB',{hour12:false})+t(' · 状态未确认前，不计入可申购金额。',' · no eligible credit until settlement confirmation.');if(o.status!=='awaiting_payment')go('buy-order/'+o.id);},3000);
window.GXIPaymentTest={firstPurchase,makeBuyQuote,createBuy,simulatePay,cancelBuy,continueAfterBuy,queryBuy,setBuyConsent:v=>{buyConsent=!!v;},setFundingMode:v=>{fundingMode=v;},setRegion:r=>{state.demoRegion=r;save();},expire:()=>{if(buyQuote)buyQuote.expires=Date.now()-1;},getQuote:()=>buyQuote?JSON.parse(JSON.stringify(buyQuote)):null,getMode:()=>fundingMode};

const originalOrderPage=orderPage;
orderPage=function(oid){const o=state.orders.find(x=>x.id===oid),html=originalOrderPage(oid);if(!o?.sourcePurchaseId)return html;return html.replace('</main>',`<div class="card mt tight"><button class="list-item" data-go="buy-order/${o.sourcePurchaseId}"><div><span class="list-title">${t('查看本次购 U 与付款记录','View the linked purchase payment')}</span><p>${o.sourcePurchaseId}</p></div>${I('chevron',15)}</button></div></main>`);};
const originalEventPage=eventPage;
eventPage=function(eid){const x=state.events.find(x=>x.id===eid),html=originalEventPage(eid);if(x?.type!=='purchase')return html;return html.replace('</main>',`<div class="spacer"></div>${goBtn(t('查看购 U 订单','View purchase order'),'buy-order/'+x.ref,'secondary')}</main>`);};

const originalBridgePage=bridgePage;bridgePage=function(type){return type==='buy'?buyPage(chosen):originalBridgePage(type);};
