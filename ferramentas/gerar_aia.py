"""Recria o projeto importavel do MIT App Inventor com os arquivos locais."""
from pathlib import Path
import json, zipfile, xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
serial = 0
def block(kind, **attrs):
    global serial
    serial += 1
    return ET.Element('block', {'type':kind, 'id':f'eco{serial}', **attrs})
def field(parent,name,text):
    ET.SubElement(parent,'field',{'name':name}).text=str(text)
def value(parent,name,child):
    ET.SubElement(parent,'value',{'name':name}).append(child)
def text(s):
    b=block('text'); field(b,'TEXT',s); return b
def number(n):
    b=block('math_number');field(b,'NUM',n);return b
def variable(name):
    b=block('lexical_variable_get')
    ET.SubElement(ET.SubElement(b,'mutation'),'eventparam',{'name':name})
    field(b,'VAR',name);return b
def method(ctype,instance,name,args=(),returns=True):
    b=block('component_method')
    ET.SubElement(b,'mutation',{'component_type':ctype,'instance_name':instance,
        'method_name':name,'is_generic':'false','shape':'value' if returns else 'statement'})
    field(b,'COMPONENT_SELECTOR',instance)
    for i,arg in enumerate(args):value(b,f'ARG{i}',arg)
    return b
def setter(ctype,instance,name,child):
    b=block('component_set_get')
    ET.SubElement(b,'mutation',{'component_type':ctype,'instance_name':instance,
        'property_name':name,'is_generic':'false','set_or_get':'set'})
    field(b,'COMPONENT_SELECTOR',instance);field(b,'PROP',name);value(b,'VALUE',child);return b
def getter(ctype,instance,name):
    b=block('component_set_get')
    ET.SubElement(b,'mutation',{'component_type':ctype,'instance_name':instance,
        'property_name':name,'is_generic':'false','set_or_get':'get'})
    field(b,'COMPONENT_SELECTOR',instance);field(b,'PROP',name);return b
def list_of(*args):
    b=block('lists_create_with');ET.SubElement(b,'mutation',{'items':str(len(args))})
    for i,arg in enumerate(args):value(b,f'ADD{i}',arg)
    return b
def select(index):
    b=block('lists_select_item')
    value(b,'LIST',method('Web','Web1','JsonTextDecode',[variable('value')]))
    value(b,'NUM',number(index));return b
def join(*args):
    b=block('text_join');ET.SubElement(b,'mutation',{'items':str(len(args))})
    for i,arg in enumerate(args):value(b,f'ADD{i}',arg)
    return b
def callback(name,*args):
    payload=method('Web','Web1','JsonObjectEncode',[list_of(*args)])
    script=join(text('window.EcoTransport.'+name+'('),payload,text(');'))
    return method('WebViewer','WebViewer1','RunJavaScript',[script],returns=False)
def event(ctype,instance,name,statements,x,y):
    b=block('component_event',x=str(x),y=str(y))
    ET.SubElement(b,'mutation',{'component_type':ctype,'instance_name':instance,
        'event_name':name,'is_generic':'false'})
    field(b,'COMPONENT_SELECTOR',instance)
    container=ET.SubElement(b,'statement',{'name':'DO'})
    for i,statement in enumerate(statements):
        container.append(statement)
        if i<len(statements)-1:container=ET.SubElement(statement,'next')
    return b

def build():
    root=ET.Element('xml',{'xmlns':'https://developers.google.com/blockly/xml'})
    root.append(event('WebViewer','WebViewer1','WebViewStringChange',[
        setter('Web','Web1','Url',select(1)),
        setter('Web','Web1','RequestHeaders',list_of(list_of(text('Device-Token'),select(2)))),
        callback('ack',getter('Web','Web1','Url')),
        method('Web','Web1','Get',returns=False)
    ],20,20))
    root.append(event('Web','Web1','GotText',[
        callback('receive',variable('url'),variable('responseCode'),variable('responseContent'))
    ],20,360))
    root.append(event('Web','Web1','TimedOut',[
        callback('fail',variable('url'),text('Tempo de consulta esgotado. Verifique a internet.'))
    ],20,550))
    root.append(event('Form','Screen1','ErrorOccurred',[
        callback('fail',text(''),variable('message'))
    ],20,720))
    ET.SubElement(root,'yacodeblocks',{'ya-version':'240','language-version':'41'})
    scm={'authURL':['ai2.appinventor.mit.edu'],'YaVersion':'240','Source':'Form','Properties':{
        '$Name':'Screen1','$Type':'Form','$Version':'32','Uuid':'0',
        'AppName':'EcoColeta','Title':'EcoColeta','TitleVisible':'False','ShowStatusBar':'True',
        'Sizing':'Responsive','Scrollable':'False','Theme':'AppTheme.Light',
        'BackgroundColor':'&HFFF4F6F0','PrimaryColor':'&HFF163E32','PrimaryColorDark':'&HFF163E32',
        '$Components':[
            {'$Name':'WebViewer1','$Type':'WebViewer','$Version':'11','Uuid':'1001',
             'Width':'-2','Height':'-2','HomeUrl':'http://localhost/index.html',
             'FollowLinks':'False','UsesLocation':'False','PromptforPermission':'False'},
            {'$Name':'Web1','$Type':'Web','$Version':'9','Uuid':'1002','Timeout':'15000'}
        ]}}
    properties='''main=appinventor.ai_ecocoleta.EcoColeta.Screen1
name=EcoColeta
assets=../assets
source=../src
build=../build
versioncode=6
versionname=6.0
useslocation=False
aname=EcoColeta
sizing=Responsive
showlistsasjson=True
theme=AppTheme.Light
primarycolor=&HFF163E32
primarycolordark=&HFF163E32
accentcolor=&HFF196449
'''
    output=ROOT/'aplicativo'/'EcoColeta.aia'
    prefix='src/appinventor/ai_ecocoleta/EcoColeta/'
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('youngandroidproject/project.properties',properties)
        archive.writestr(prefix+'Screen1.scm','#|\n$JSON\n'+json.dumps(scm,ensure_ascii=False,separators=(',',':'))+'\n|#')
        archive.writestr(prefix+'Screen1.bky',ET.tostring(root,encoding='unicode'))
        for path in sorted((ROOT/'aplicativo'/'web').iterdir()):
            if path.is_file():archive.write(path,'assets/'+path.name)
    print(output)

if __name__=='__main__':build()
