from pathlib import Path
import json,base64
R=Path(__file__).resolve().parents[1]
data={'memo':json.loads((R/'source/memo-content.json').read_text()),'images':{},'pdfs':{}}
for p in (R/'prototype/assets').glob('*.webp'):data['images'][p.stem]='assets/'+p.name
data['qr']='assets/checkout-demo-qr.png'
for l in ['zh','en']:data['pdfs'][l]='documents/GEX_USDT_Income_Investment_Memorandum_'+l.upper()+'_v1.0.pdf'
css=(R/'source/income.css').read_text()+'\n'+(R/'source/income-dark.css').read_text();js=(R/'source/income-app.js').read_text().replace('/*PAYMENT_MODULE*/',(R/'source/fiat-purchase-module.js').read_text());shell=(R/'source/shell.html').read_text()
def build(d):return shell.replace('/*CSS*/',css).replace('/*DATA*/',json.dumps(d,ensure_ascii=False).replace('</','<\\/')).replace('/*JS*/',js)
(R/'prototype/h5-income.html').write_text(build(data))
for k,v in data['images'].items():data['images'][k]='data:image/webp;base64,'+base64.b64encode((R/'prototype'/v).read_bytes()).decode()
data['qr']='data:image/png;base64,'+base64.b64encode((R/'prototype/assets/checkout-demo-qr.png').read_bytes()).decode()
for k,v in data['pdfs'].items():data['pdfs'][k]='data:application/pdf;base64,'+base64.b64encode((R/'prototype'/v).read_bytes()).decode()
(R/'GEXFI_H5_Income_Standalone.html').write_text(build(data))
print('Built prototype and standalone')
