import os,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
R=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 pg=b.new_page();err=[];pg.on('pageerror',lambda e:err.append(str(e)))
 pg.set_content('<style>body{background:rgb(12,20,32)}button{color:red!important;background:red!important}#legacy{color:rgb(23,45,67);font-size:19px}</style><div id="legacy">Original content</div><gex-income-entry id="e"></gex-income-entry>')
 before=pg.locator('#legacy').evaluate('(e)=>[getComputedStyle(e).color,getComputedStyle(e).fontSize,e.innerHTML]')
 pg.add_script_tag(content=(R/'integration/gex-income-entry.js').read_text())
 disabled=pg.locator('#e').evaluate('(e)=>e.shadowRoot.childElementCount===0')
 pg.evaluate("document.getElementById('e').setAttribute('enabled','true');window.seen=[];document.addEventListener('gex-income-open',e=>window.seen.push(e.detail))")
 pg.locator('gex-income-entry button').click();events=pg.evaluate('window.seen')
 isolated=pg.locator('gex-income-entry button').evaluate('(e)=>getComputedStyle(e).color')
 pg.evaluate("document.getElementById('e').setAttribute('variant','holdings')")
 missing=pg.locator('gex-income-entry .principal').inner_text()
 after=pg.locator('#legacy').evaluate('(e)=>[getComputedStyle(e).color,getComputedStyle(e).fontSize,e.innerHTML]')
 tests={'default_disabled':disabled,'only_expected_custom_event':events==[{'destination':'products','source':'home'}],'host_style_unchanged':before==after,'component_isolated_from_host_button_styles':isolated!='rgb(255, 0, 0)','unknown_balance_not_zero':missing.strip().startswith('—'),'uncaught_errors':err}
 (R/'qa/widget-tests.json').write_text(json.dumps(tests,ensure_ascii=False,indent=2));print(tests)
 b.close()
