from pathlib import Path
import zipfile,json,xml.etree.ElementTree as ET
path=Path(__file__).resolve().parents[1]/'aplicativo/EcoColeta.aia'
with zipfile.ZipFile(path) as archive:
    assert archive.testzip() is None
    names=archive.namelist()
    assert 'youngandroidproject/project.properties' in names
    scm=next(n for n in names if n.endswith('.scm'))
    data=json.loads(archive.read(scm).decode().split('$JSON\n',1)[1].rsplit('\n|#',1)[0])
    components=data['Properties']['$Components']
    assert {c['$Name'] for c in components}=={'Web1','WebViewer1'}
    assert components[0]['HomeUrl']=='http://localhost/index.html'
    for asset in ['index.html','style.css','core.js','transport.js','app.js']:
        assert ('assets/'+asset) in names
        assert archive.read('assets/'+asset)==(path.parent/'web'/asset).read_bytes()
    root=ET.fromstring(archive.read(scm.replace('.scm','.bky')))
    ns={'b':'https://developers.google.com/blockly/xml'}
    events=root.findall('b:block',ns)
    assert {e.find('b:mutation',ns).get('event_name') for e in events}=={'WebViewStringChange','GotText','TimedOut','ErrorOccurred'}
    allowed={'WebViewer1':('WebViewer',{'WebViewString'}),'Web1':('Web',{'Url','RequestHeaders'}),'Screen1':('Form',set())}
    for b in root.findall('.//b:block',ns):
        m=b.find('b:mutation',ns)
        if b.get('type').startswith('component_'):
            name=m.get('instance_name');assert name in allowed
            assert m.get('component_type')==allowed[name][0]
            if b.get('type')=='component_set_get':assert m.get('property_name') in allowed[name][1]
            if b.get('type')=='component_set_get' and m.get('set_or_get')=='set':
                assert not (name=='WebViewer1' and m.get('property_name')=='WebViewString')
    assert len([b for b in root.findall('.//b:block',ns) if b.get('type')=='component_method' and b.find('b:mutation',ns).get('method_name')=='RunJavaScript'])==4
    print('PASS: ZIP AIA, estrutura SCM/BKY, componentes, eventos e assets sincronizados; importacao Android nao executada')
