import os,shutil
from pathlib import Path
import json,hashlib,zipfile
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];Q=R/'qa';tests=[];errors=[]
def record(name,ok,detail=''):
 tests.append({'test':name,'passed':bool(ok),'detail':detail})
 if not ok: print('FAIL',name,detail)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':390,'height':844},accept_downloads=True)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((R/'GEXFI_H5_Income_Standalone.html').read_text(),wait_until='load')
 def call(js):
  val=page.evaluate(js);page.wait_for_timeout(70);return val
 def st():return page.evaluate('GXIDemoTest.getState()')
 def go(r):call('(r)=>App.go(r)' if False else 'App.go('+json.dumps(r)+')')
 def snap(name):page.screenshot(path=str(Q/(name+'.png')))
 for days,expected in [(90,9.369863),(180,22.191781),(365,50)]:record(f'{days}-day 1000 USDT simple-interest calculation',call(f'GXIDemoTest.productCalculation(1000,{days})')==expected)
 call('GXIDemoTest.reset("empty")');go('subscribe/180')
 page.locator('#subscribe-amount').fill('2600');record('Eligible amount excludes external balance',page.locator('#review-button').is_disabled())
 page.locator('#subscribe-amount').fill('99');record('Demo minimum enforced',page.locator('#review-button').is_disabled())
 page.locator('#subscribe-amount').fill('1000');page.locator('#review-button').click();page.wait_for_timeout(80)
 record('Consent not preselected',not page.locator('#consent-memo').is_checked() and page.locator('#confirm-subscribe').is_disabled())
 page.locator('#consent-memo').check();page.locator('#consent-risk').check();page.locator('#confirm-subscribe').click();page.wait_for_timeout(90)
 s=st();oid=s['orders'][0]['id'];record('Submit reserves eligible USDT and does not create holding',s['funds']['eligible']==1500_000000 and s['funds']['reserved']==1000_000000 and len(s['positions'])==0)
 snap('subscription-pending-mobile')
 call(f'GXIDemoTest.resolveOrder("{oid}","cancelled")');s=st();record('Pre-acceptance cancellation releases exact reservation',s['funds']['eligible']==2500_000000 and s['funds']['reserved']==0)
 call(f'GXIDemoTest.resolveOrder("{oid}","cancelled")');record('Repeated cancellation cannot double release',st()['funds']['eligible']==2500_000000)
 call('GXIDemoTest.setAmount(1000,90); GXIDemoTest.submit()');oid=st()['orders'][0]['id'];call(f'GXIDemoTest.resolveOrder("{oid}","rejected")');record('Rejection releases reservation without creating holding',len(st()['positions'])==0 and st()['funds']['eligible']==2500_000000)
 call('GXIDemoTest.setAmount(1000,180); GXIDemoTest.submit()');oid=st()['orders'][0]['id'];call(f'GXIDemoTest.resolveOrder("{oid}","accepted")');s=st();pid=s['positions'][0]['id'];record('Acceptance moves reservation into principal',s['funds']['reserved']==0 and s['funds']['eligible']==1500_000000 and s['positions'][0]['principal']==1000_000000)
 call(f'GXIDemoTest.resolveOrder("{oid}","accepted")');record('Duplicate acceptance cannot create a second holding',len(st()['positions'])==1)
 call(f'GXIDemoTest.requestRedeem("{pid}")');record('Unmatured holding cannot redeem',st()['positions'][0]['status']=='active' and st()['funds']['returned']==0)
 call(f'GXIDemoTest.advance("{pid}")');call(f'GXIDemoTest.requestRedeem("{pid}")');record('Maturity request is not an immediate wallet credit',st()['positions'][0]['status']=='redeeming' and st()['funds']['returned']==0)
 snap('settlement-processing-mobile');call(f'GXIDemoTest.settle("{pid}",true)');record('Settlement failure preserves principal and creates no wallet credit',st()['positions'][0]['status']=='redeem_failed' and st()['funds']['returned']==0)
 snap('settlement-failed-mobile');call(f'GXIDemoTest.requestRedeem("{pid}")');call('App.openDemo()');page.locator('#actual-income').fill('15.00');page.locator('[data-act="settle"]').click();page.wait_for_timeout(100)
 s=st();record('Actual income may differ from target and is settled independently',s['funds']['returned']==1015_000000 and s['positions'][0]['actualIncome']==15_000000 and s['positions'][0]['status']=='redeemed')
 snap('settlement-credited-mobile');call(f'GXIDemoTest.settle("{pid}",false)');record('Duplicate settlement cannot double credit',st()['funds']['returned']==1015_000000)
 record('Redemption not silently relabelled as purchased eligible USDT',st()['funds']['eligible']==1500_000000)
 go('card-quote/'+pid);snap('card-quote-mobile');before=call('GXIDemoTest.available()');call('GXIDemoTest.expireQuote();GXIDemoTest.fundCard()');record('Expired card quote blocks execution and funds remain unchanged',call('GXIDemoTest.available()')==before and len(st()['cardOrders'])==0)
 snap('card-expired-mobile');call(f'GXIDemoTest.makeQuote(1000,"{pid}");GXIDemoTest.fundCard()');c=st()['cardOrders'][0];record('Card submission reserves wallet without card credit',st()['funds']['reserved']==1000_000000 and st()['cardUSD']==0)
 snap('card-processing-mobile');call(f'GXIDemoTest.resolveCard("{c["id"]}",true)');record('Card failure restores original funding buckets',call('GXIDemoTest.available()')==before and st()['funds']['reserved']==0)
 call(f'GXIDemoTest.makeQuote(1000,"{pid}");GXIDemoTest.fundCard()');c=st()['cardOrders'][0];call(f'GXIDemoTest.resolveCard("{c["id"]}",false)');record('Provider confirmation credits separate USD card balance',st()['cardUSD']==988.52 and st()['funds']['reserved']==0)
 snap('card-credited-mobile');call(f'GXIDemoTest.resolveCard("{c["id"]}",false)');record('Duplicate card result does not double credit',st()['cardUSD']==988.52)
 go('activity');snap('activity-mobile');record('All processed actions retain activity records',len(st()['events'])>=10)
 go('chain/'+pid);record('No fabricated transaction hashes or explorer links',page.locator('#screen').get_by_text('尚无可验证的链上记录').count()==1 and page.locator('#screen a[href*="scan"]').count()==0)
 call('GXIDemoTest.reset("external")');go('subscribe/90');record('External-only account cannot subscribe',page.locator('#review-button').is_disabled());snap('external-ineligible-mobile')
 go('eligibility');call('App.openDemo()');page.locator('[data-act="toggle-kyc"]').click();page.wait_for_timeout(80);record('KYC-incomplete path uses existing verification handoff',page.locator('#screen [data-go="bridge/kyc"]').count()==1)
 go('memo');
 for lang in ['zh','en']:
  try:
   with page.expect_download(timeout=5000) as dl:page.locator(f'#screen [data-lang="{lang}"]').click()
   d=dl.value;data=Path(d.path()).read_bytes();orig=(R/f'prototype/documents/GEX_USDT_Income_Investment_Memorandum_{lang.upper()}_v1.0.pdf').read_bytes();record(f'{lang.upper()} PDF download bytes match V8',data==orig)
  except Exception as e:record(f'{lang.upper()} PDF download',False,str(e)[:170])
 call('GXIDemoTest.reset()')
 layout=[]
 routes=['home','me','more','products','product/90','product/180','product/365','eligibility','subscribe/180','review','holdings','holding/IN-261009-001','income/IN-261009-001','receipt/IN-261009-001','chain/IN-261009-001','maturity/IN-261009-001','early/IN-261009-001','redeem/IN-261009-003','card-quote/','activity','memo','rules','support']
 for width in [320,390,430]:
  page.set_viewport_size({'width':width,'height':844})
  for lang in ['zh','en']:
   call('GXIDemoTest.setLanguage("'+lang+'")')
   for r in routes:
    go(r);bad=page.evaluate('document.querySelector("#screen").scrollWidth>document.querySelector("#screen").clientWidth+1')
    if bad:layout.append({'width':width,'lang':lang,'route':r})
   for chapter in ['overview','terms','eligibility','income-fees','management','maturity','records-card','risks','documents']:
    go('memo/'+chapter);bad=page.evaluate('document.querySelector("#screen").scrollWidth>document.querySelector("#screen").clientWidth+1')
    if bad:layout.append({'width':width,'lang':lang,'route':'memo/'+chapter})
 record('320/390/430px EN+ZH route overflow checks',not layout,layout)
 record('No uncaught JS errors throughout tested flows',not errors,errors)
 b.close()
# Document integrity is independent of browser navigation restrictions.
baseline=json.loads((R/'source/document-integrity.json').read_text())['sha256']
for lang in ['EN','ZH']:
 name=f'GEX_USDT_Income_Investment_Memorandum_{lang}_v1.0.pdf';new=(R/'prototype/documents'/name).read_bytes();actual=hashlib.sha256(new).hexdigest();record(lang+' PDF preserved byte-for-byte against V8 hash',actual==baseline['documents/'+name],actual)
record('Bilingual Memo source identical to V8 hash',hashlib.sha256((R/'source/memo-content.json').read_bytes()).hexdigest()==baseline['source/memo-content.json'])
(Q/'functional-tests.json').write_text(json.dumps({'tests':tests,'passed':sum(t['passed'] for t in tests),'total':len(tests),'render_method':'Chromium set_content with complete standalone HTML; file:// navigation prohibited by environment; static path checks separate','errors':errors},ensure_ascii=False,indent=2))
print('PASSED',sum(t['passed'] for t in tests),'/',len(tests))
