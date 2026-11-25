"""Executa o subconjunto de blocos usado na ponte AIA com componentes simulados.
Modela a codificacao de URL do Web iOS e coleta os callbacks RunJavaScript.
Nao executa o Companion real nem faz requisicoes externas.
"""
from pathlib import Path
import json,sys,zipfile,urllib.parse,xml.etree.ElementTree as E
ROOT=Path(__file__).resolve().parents[1]
with zipfile.ZipFile(ROOT/'aplicativo/EcoColeta.aia') as archive:
    root=E.fromstring(archive.read(next(n for n in archive.namelist() if n.endswith('.bky'))))
for element in root.iter():element.tag=element.tag.split('}')[-1]
events={b.find('mutation').get('event_name'):b for b in root.findall('block')}
properties={};scripts=[];requests=[]
def evaluate(block,context):
    kind=block.get('type');m=block.find('mutation')
    def val(name):return evaluate(block.find(f"value[@name='{name}']/block"),context)
    def fld(name):return block.find(f"field[@name='{name}']").text or ''
    if kind=='text':return fld('TEXT')
    if kind=='math_number':return int(fld('NUM'))
    if kind=='lexical_variable_get':return context[m.find('eventparam').get('name')]
    if kind=='lists_create_with':return [val('ADD'+str(i)) for i in range(int(m.get('items')))]
    if kind=='lists_select_item':return val('LIST')[val('NUM')-1]
    if kind=='text_join':return ''.join(str(val('ADD'+str(i))) for i in range(int(m.get('items'))))
    if kind=='component_set_get':
        key=(m.get('instance_name'),m.get('property_name'))
        if m.get('set_or_get')=='get':return properties[key]
        value=val('VALUE')
        if key==('Web1','Url'):
            value=urllib.parse.quote(value,safe=":/?&=+@!$'(),;~-._")
        properties[key]=value;return None
    if kind=='component_method':
        method=m.get('method_name')
        if method=='JsonTextDecode':return json.loads(val('ARG0'))
        if method=='JsonObjectEncode':return json.dumps(val('ARG0'),ensure_ascii=False,separators=(',',':'))
        if method=='RunJavaScript':scripts.append(val('ARG0'));return None
        if method=='Get':requests.append(properties[('Web1','Url')]);return None
    raise AssertionError('Unsupported block: '+kind)
def run_event(name,context):
    block=events[name].find('statement/block')
    while block is not None:
        evaluate(block,context);block=block.find('next/block')

instant=1795620000000
original='https://api.us-e1.tago.io/data?variable%5B%5D=nivel&qty=500&start_date=2026-11-24T12%3A00%3A00.000Z'
native='https://api.us-e1.tago.io/data?variable[]=nivel&qty=500&start_date=2026-11-24T12:00:00.000Z&end_date='+__import__('datetime').datetime.fromtimestamp(instant/1000,__import__('datetime').timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
run_event('WebViewStringChange',{'value':json.dumps([native,'TOKEN_FICTICIO'])})
assert requests and '%255B' not in requests[0] and '%23' not in requests[0]
assert properties[('Web1','RequestHeaders')]==[['Device-Token','TOKEN_FICTICIO']]
body=json.dumps({'status':True,'result':[{'variable':'nivel','value':35,'time':'2026-11-25T12:00:00.000Z','metadata':{'note':"Patio d'Agua\nSala \\ B"}}]},indent=2,ensure_ascii=False)
run_event('GotText',{'url':requests[0],'responseCode':200,'responseContent':body})
assert scripts[0].startswith('window.EcoTransport.ack(')
assert scripts[1].startswith('window.EcoTransport.receive(')
fixture={'time':instant,'original':original,'request':native,'reported':requests[0],'body':body,'scripts':scripts}
if '--fixture' in sys.argv:print(json.dumps(fixture,ensure_ascii=False))
else:print('PASS: blocos BKY executados com componentes simulados, URL iOS codificada uma vez, cabecalho e callbacks JSON sem WebViewString de retorno')
