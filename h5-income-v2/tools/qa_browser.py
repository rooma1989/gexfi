import os,shutil
import json,time
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];out=R/'qa';out.mkdir(exist_ok=True)
url=(R/'prototype/h5-income.html').as_uri()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1440,'height':1020},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((R/'GEXFI_H5_Income_Standalone.html').read_text(),wait_until='load');page.wait_for_timeout(300)
 print('loaded',page.title(),page.locator('#screen').inner_text()[:120],errors)
 page.evaluate('GXIDemoTest.reset()')
 routes=['home','products','product/180','subscribe/180','review','holdings','holding/IN-261009-001','income/IN-261009-001','receipt/IN-261009-001','chain/IN-261009-001','redeem/IN-261009-003','memo','memo/terms','more','me']
 info=[]
 for r in routes:
  page.evaluate('(r)=>App.go(r)',r);page.wait_for_timeout(100)
  page.screenshot(path=str(out/(r.replace('/','_')+'-desktop.png')))
  info.append({'route':r,'length':len(page.locator('#screen').inner_text()),'overflow':page.evaluate('document.querySelector("#screen").scrollWidth>document.querySelector("#screen").clientWidth')})
 print('routes',info,'errors',errors)
 page.set_viewport_size({'width':390,'height':844})
 for r in ['home','products','product/180','subscribe/180','review','holding/IN-261009-001','redeem/IN-261009-003','memo','memo/terms']:
  page.evaluate('(r)=>App.go(r)',r);page.wait_for_timeout(80);page.screenshot(path=str(out/(r.replace('/','_')+'-mobile.png')))
  info.append({'route':r,'mobile':True,'overflow':page.evaluate('document.querySelector("#screen").scrollWidth>document.querySelector("#screen").clientWidth')})
 (out/'initial-browser.json').write_text(json.dumps({'errors':errors,'routes':info},ensure_ascii=False,indent=2))
 b.close()
