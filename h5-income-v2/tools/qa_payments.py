"""Local browser tests. No third-party payment service is contacted."""
from pathlib import Path
import json, shutil, subprocess, sys, time, hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];Q=R/'qa';tests=[];errors=[];requests=[]
def record(name,ok,detail=''):
 tests.append({'test':name,'passed':bool(ok),'detail':detail})
 if not ok:print('FAIL',name,detail,flush=True)
server=None
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=b.new_page(viewport={'width':390,'height':844},accept_downloads=True)
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('request',lambda r:requests.append(r.url))
  page.set_content((R/'GEXFI_H5_Income_Standalone.html').read_text(),wait_until='load')
  def call(js):
   v=page.evaluate(js);page.wait_for_timeout(70);return v
  def st():return call('GXIDemoTest.getState()')
  def go(r):call('App.go('+json.dumps(r)+')')
  def snap(name):page.screenshot(path=str(Q/(name+'.png')))
  def make():
   call('GXIPaymentTest.firstPurchase()');go('buy/180');call('GXIPaymentTest.setBuyConsent(true);GXIPaymentTest.createBuy()');return st()['fiatOrders'][0]['id']
  def sim(pid,ev):return call('GXIPaymentTest.simulatePay('+json.dumps(pid)+','+json.dumps(ev)+')')
  call('GXIPaymentTest.firstPurchase()');snap('v2-subscribe-fiat-zh')
  record('First-purchase account has no eligible or external USDT',st()['funds']['eligible']==0 and st()['funds']['external']==0)
  record('Fiat funding permits amount selection without using external USDT',not page.locator('#review-button').is_disabled())
  page.locator('#review-button').click();page.wait_for_timeout(100)
  record('Quote has final CNY amount and specified USDT quantity',call('GXIPaymentTest.getQuote().totalMinor')==721000 and call('GXIPaymentTest.getQuote().amount')==1000000000)
  record('Quote consent not prechecked and create button disabled',not page.locator('#buy-consent').is_checked() and page.locator('#create-buy-button').is_disabled())
  record('Alipay and WeChat are not enabled USDT payment methods',page.locator('#screen .payment-method[disabled]').count()==2)
  page.locator('#buy-consent').check();snap('v2-buy-zh');page.locator('#create-buy-button').click();page.wait_for_timeout(100)
  oid=st()['fiatOrders'][0]['id'];snap('v2-checkout-zh')
  record('Creating checkout neither credits USDT nor creates a holding',st()['funds']['eligible']==0 and len(st()['positions'])==0)
  call('GXIPaymentTest.createBuy()');record('Repeated creation using one quote returns same order',len(st()['fiatOrders'])==1)
  call('GXIPaymentTest.queryBuy('+json.dumps(oid)+')');record('Manual payment query cannot mark an order paid',st()['fiatOrders'][0]['status']=='awaiting_payment')
  record('Pending payment serializes its order, immutable quote and status for restoration',json.loads(json.dumps(st()))['fiatOrders'][0]['id']==oid and st()['fiatOrders'][0]['quoteId'])
  sim(oid,'confirming');record('Payment return is not a receipt or eligible credit',st()['fiatOrders'][0]['status']=='confirming' and st()['funds']['eligible']==0)
  sim(oid,'received');snap('v2-paid-review-zh');record('Provider receipt waits for reconciliation and release',st()['fiatOrders'][0]['status']=='awaiting_release' and st()['funds']['eligible']==0 and len(st()['orders'])==0)
  sim(oid,'credit');record('Cannot bypass finance release by crediting early',st()['funds']['eligible']==0)
  sim(oid,'release');record('Finance release starts conversion, does not credit USDT yet',st()['fiatOrders'][0]['status']=='converting' and st()['funds']['eligible']==0)
  sim(oid,'credit');snap('v2-buy-credited-zh');record('Executed settled purchase credits eligible USDT exactly once',st()['funds']['eligible']==1000000000 and len(st()['positions'])==0)
  sim(oid,'credit');record('Duplicate purchase credit does not duplicate funds',st()['funds']['eligible']==1000000000)
  call('GXIPaymentTest.continueAfterBuy('+json.dumps(oid)+')');snap('v2-review-zh')
  record('Subscription remains a separate explicit consent step',not page.locator('#consent-memo').is_checked() and not page.locator('#consent-risk').is_checked() and page.locator('#confirm-subscribe').is_disabled())
  page.locator('#consent-memo').check();page.locator('#consent-risk').check();page.locator('#confirm-subscribe').click();page.wait_for_timeout(100)
  s=st();sid=s['orders'][0]['id'];record('Subscription reservation links purchase and does not immediately create holding',s['orders'][0]['sourcePurchaseId']==oid and s['funds']['eligible']==0 and s['funds']['reserved']==1000000000 and len(s['positions'])==0)
  call('GXIPaymentTest.continueAfterBuy('+json.dumps(oid)+')');record('Repeat continuation points to existing subscription',len(st()['orders'])==1)
  call('GXIDemoTest.resolveOrder('+json.dumps(sid)+',"accepted")');s=st();record('Accepted subscription creates one holding and consumes reservation',len(s['positions'])==1 and s['funds']['reserved']==0)
  call('GXIDemoTest.advance('+json.dumps(s['positions'][0]['id'])+')');go('holding/'+s['positions'][0]['id']);snap('v2-holding-zh')
  oid=make();call('GXIPaymentTest.cancelBuy('+json.dumps(oid)+')');record('Cancel is a request, not immediate refund or cancellation',st()['fiatOrders'][0]['status']=='cancel_requested')
  sim(oid,'late-payment');snap('v2-late-refund-zh');record('Payment during cancellation routes to refund not purchase',st()['fiatOrders'][0]['status']=='refund_pending' and st()['funds']['eligible']==0)
  sim(oid,'refund-complete');snap('v2-refunded-zh');record('Refund confirmation creates no USDT or holding',st()['fiatOrders'][0]['status']=='refunded' and st()['funds']['eligible']==0 and not st()['positions'])
  sim(oid,'refund-complete');record('Duplicate refund confirmation cannot change funds',st()['funds']['eligible']==0)
  oid=make();sim(oid,'expired');record('Expired payment session prevents continued checkout',st()['fiatOrders'][0]['status']=='expired')
  sim(oid,'late-payment');record('Expired-order late funds do not become eligible USDT',st()['fiatOrders'][0]['status']=='refund_pending' and st()['funds']['eligible']==0)
  oid=make();sim(oid,'mismatch');snap('v2-mismatch-zh');record('Amount mismatch is held for review',st()['fiatOrders'][0]['status']=='review_required' and st()['funds']['eligible']==0)
  sim(oid,'release');record('Mismatch cannot be released without resolution',st()['fiatOrders'][0]['status']=='review_required')
  oid=make();sim(oid,'received');sim(oid,'release');sim(oid,'convert-failed');record('Failed conversion refunds rather than fabricating USDT',st()['fiatOrders'][0]['status']=='refund_pending' and st()['funds']['eligible']==0)
  call('GXIPaymentTest.firstPurchase()');go('buy/180');call('GXIPaymentTest.setBuyConsent(true);GXIPaymentTest.expire();GXIPaymentTest.createBuy()');record('Expired quote blocks order creation',len(st()['fiatOrders'])==0)
  call('GXIPaymentTest.makeBuyQuote()');go('buy/180');record('Refreshed quote requires a fresh acknowledgement',not page.locator('#buy-consent').is_checked())
  call('GXIPaymentTest.setRegion("CN");GXIPaymentTest.makeBuyQuote();GXIPaymentTest.setBuyConsent(true);GXIPaymentTest.createBuy()');snap('v2-region-block-zh');record('Restricted service market fails closed before collecting funds',len(st()['fiatOrders'])==0 and page.locator('#screen').get_by_text('当前无法提供购 U 支付').count()==1)
  call('GXIDemoTest.reset("external");GXIPaymentTest.setFundingMode("wallet")');go('subscribe/90');record('External USDT still cannot fund direct wallet subscription',page.locator('#review-button').is_disabled())
  # Generate a consistent full-journey set and responsive views.
  oid=make();go('home');snap('v2-home-zh');go('products');snap('v2-products-zh');go('product/180');snap('v2-product-zh')
  call('GXIPaymentTest.setFundingMode("fiat")');go('subscribe/180');snap('v2-subscribe-fiat-zh');go('buy/180');snap('v2-buy-zh');go('checkout/'+oid);snap('v2-checkout-zh')
  sim(oid,'received');snap('v2-paid-review-zh');sim(oid,'release');sim(oid,'credit');snap('v2-buy-credited-zh');call('GXIPaymentTest.continueAfterBuy('+json.dumps(oid)+')');snap('v2-review-zh')
  call('GXIDemoTest.setLanguage("en")');go('buy/180');snap('v2-buy-en');go('checkout/'+oid);snap('v2-paid-en')
  layouts=[]
  for w in [320,390,430]:
   page.set_viewport_size({'width':w,'height':844})
   for lang in ['zh','en']:
    call('GXIDemoTest.setLanguage('+json.dumps(lang)+')')
    for r in ['subscribe/180','buy/180','checkout/'+oid,'buy-order/'+oid,'payments','payment-unavailable','products','product/90','product/180','product/365','review','memo/terms']:
     go(r)
     if call('document.querySelector("#screen").scrollWidth>document.querySelector("#screen").clientWidth+1'):layouts.append({'width':w,'language':lang,'route':r})
  record('New payment screens and products fit 320/390/430px in both languages',not layouts,layouts)
  page.set_viewport_size({'width':1480,'height':1040});call('GXIDemoTest.setLanguage("zh")');go('subscribe/180');snap('v2-desktop-overview')
  record('No uncaught JS errors during payment tests',not errors,errors)
  remote=[x for x in requests if not x.startswith(('http://127.0.0.1:8776','data:','blob:'))]
  record('No requests to payment providers or third-party services',not remote,remote)
  b.close()
finally:
 if server:server.terminate()
(Q/'payment-tests.json').write_text(json.dumps({'tests':tests,'passed':sum(t['passed'] for t in tests),'total':len(tests),'errors':errors,'render_method':'Chromium set_content (container blocks HTTP/file navigation); JSON restoration fields checked, actual browser reload not verified'},ensure_ascii=False,indent=2))
print('PAYMENT PASSED',sum(t['passed'] for t in tests),'/',len(tests),flush=True)
