(function() {
  'use strict';
  const $ = id => document.getElementById(id);
  const C = EcoCore;
  let mode = 'demo', hours = 24, rows = [], busy = false;
  const defaultPoints=[
    {id:'LIXEIRA_01',name:'Entrada principal',location:'Escola · acesso principal'},
    {id:'LIXEIRA_02',name:'Pátio',location:'Escola · área de convivência'},
    {id:'LIXEIRA_03',name:'Cantina',location:'Escola · praça de alimentação'}
  ];
  const storageKey='ecocoleta.points.v2';
  function loadPoints(){
    try {
      const saved=JSON.parse(localStorage.getItem(storageKey));
      if(!Array.isArray(saved)||!saved.length) return defaultPoints;
      const valid=[];
      saved.forEach(candidate=>{try{const point=C.validatePoint(candidate,valid);point.region=candidate.region;valid.push(point);}catch(e){}});
      return valid.length?valid:defaultPoints;
    }catch(e){return defaultPoints;}
  }
  const points=loadPoints();
  const states=new Map(points.map((point,i)=>[point.id,{
    demoRows:[],cloudRows:[],demoLevel:i===1?85:i===2?96:35,collections:0,
    detector:new C.CollectionDetector(),token:'',
    region:['https://api.us-e1.tago.io','https://api.eu-w1.tago.io'].includes(point.region)?point.region:'https://api.us-e1.tago.io',
    capped:false,lastCloudSuccess:null,lastError:''
  }]));
  let selectedId=points[0].id;
  const alertStates=new Map(),notices=[];
  let toastTimer=null;
  const selectedPoint=()=>points.find(p=>p.id===selectedId);
  const selectedState=()=>states.get(selectedId);
  function savePoints(){
    try{localStorage.setItem(storageKey,JSON.stringify(points.map(p=>({id:p.id,name:p.name,location:p.location,region:states.get(p.id).region}))));return true;}
    catch(e){return false;}
  }
  const nativeBridge = !!window.AppInventor;
  const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const timestamp = time => new Date(time).toLocaleString('pt-BR', {hour12:false});
  const number = value => value == null ? '—' : value.toLocaleString('pt-BR',{maximumFractionDigits:1}) + '%';
  const periodName = () => hours === 1 ? 'Última hora' : hours === 24 ? 'Últimas 24 horas' : 'Últimos 7 dias';

  function observeAlert(point,source,summary){
    if(!summary.latest||summary.sensorFailed||summary.stale)return;
    const key=source+':'+point.id;
    if(!alertStates.has(key))alertStates.set(key,new C.AlertDetector());
    const severity=alertStates.get(key).observe(summary.latest.value,true,Date.parse(summary.latest.time));
    if(!severity)return;
    const notice={pointId:point.id,name:point.name,source,severity,level:summary.latest.value,time:new Date().toISOString()};
    notice.title=(severity==='critical'?'Crítico':'Atenção')+' · '+point.name;
    notice.message='Preenchimento estimado de '+number(notice.level)+'. '+(severity==='critical'?'Priorize a coleta.':'Planeje a coleta.');
    notices.unshift(notice);if(notices.length>100)notices.pop();
    const toast=$('alertToast');
    if(!$('internalNotices').checked)return;
    if(!toast.classList.contains('hidden')&&toast.classList.contains('critical')&&severity!=='critical')return;
    if(toastTimer)clearTimeout(toastTimer);
    $('toastTitle').textContent=notice.title;
    $('toastText').textContent=notice.message+(source==='demo'?' Simulação: nenhum SMS ou push real foi enviado.':' Aviso interno; confira entregas no provedor.');
    toast.className='alert-toast'+(severity==='critical'?' critical':'');
    toastTimer=setTimeout(()=>toast.classList.add('hidden'),12000);
  }
  function renderNotices(){
    const visible=notices.filter(n=>n.source===mode);
    $('noticeCount').textContent=visible.length;
    $('noticeList').innerHTML=visible.length?visible.slice(0,12).map(n=>'<div class="notice-row"><strong>'+esc(n.title)+'</strong><p>'+esc(n.message)+'</p><small>'+esc(timestamp(n.time))+' · '+(n.source==='demo'?'SIMULAÇÃO':'AVISO INTERNO')+'</small></div>').join(''):'<p class="muted">Nenhum aviso interno nesta sessão e modo.</p>';
  }

  function syncSelectors(){
    const options=points.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' · '+esc(p.id)+'</option>').join('');
    $('pointSelect').innerHTML=options;$('configPoint').innerHTML=options;
    $('pointSelect').value=selectedId;$('configPoint').value=selectedId;
    $('region').value=selectedState().region;$('token').value=selectedState().token;
    $('demoLevel').value=selectedState().demoLevel;$('demoValue').textContent=selectedState().demoLevel+'%';
  }
  function choosePoint(id){
    if(!states.has(id))return;
    selectedId=id;syncSelectors();$('csvPanel').classList.add('hidden');render();
  }
  function fleetData(){
    return C.fleet(points.map(p=>({...p,rows:mode==='demo'?states.get(p.id).demoRows:states.get(p.id).cloudRows,
      error:mode==='cloud'?states.get(p.id).lastError:''})),Date.now()-hours*3600000);
  }
  function renderFleet(){
    const fleet=fleetData();
    $('pointCount').textContent=points.length;
    $('priorityCount').textContent=fleet.filter(p=>p.priority<2).length;
    $('unknownCount').textContent=fleet.filter(p=>p.unavailable).length;
    $('pointList').innerHTML=fleet.map(p=>{
      const n=p.summary.latest?.value;
      const label=mode==='cloud'&&!states.get(p.id).token?'Token não configurado':p.label;
      return '<button type="button" class="point-card '+(p.id===selectedId?'selected':'')+'" data-point="'+esc(p.id)+'" aria-pressed="'+(p.id===selectedId)+'"><div class="point-card-top"><strong class="point-card-name">'+esc(p.name)+'</strong><strong class="point-card-level">'+(n==null?'—':Math.round(n)+'%')+'</strong></div><small>'+esc(p.location)+'</small><div class="point-card-bottom"><span class="badge '+(p.unavailable?'warn':n>=90?'danger':n>=80?'warn':'soft')+'">'+esc(label)+'</span><small>'+esc(p.id)+'</small></div></button>';
    }).join('');
    $('fleetReport').innerHTML=fleet.map(p=>'<div class="comparison-row"><strong>'+esc(p.name)+'</strong><small>'+esc(p.label)+'</small><div class="comparison-values"><span>Nível: '+number(p.summary.latest?.value)+'</span><span>Média: '+number(p.summary.average)+'</span><span>Coletas: '+p.summary.collections.length+'</span></div></div>').join('');
    $('refreshAllButton').disabled=busy;
    $('refreshAllButton').textContent=busy?'Atualizando…':'Atualizar todos';
  }

  function showPage(id) {
    document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id));
    document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===id));
    window.scrollTo(0,0);
  }
  document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.page)));

  function drawChart(levels) {
    if (!levels.length) { $('chart').innerHTML = '<div class="chart-empty">Ainda não há medições neste período.</div>'; return; }
    const width=450, height=140, padding=26;
    const first=Date.parse(levels[0].time), span=Math.max(1,Date.parse(levels[levels.length-1].time)-first);
    const points=levels.map(r=>[(padding+(Date.parse(r.time)-first)/span*(width-padding-4)).toFixed(1),(height-20-r.value/100*(height-32)).toFixed(1)]);
    let svg='<svg viewBox="0 0 450 140" aria-hidden="true">';
    [0,50,80,100].forEach(n=>{const y=height-20-n/100*(height-32);svg+='<line x1="26" y1="'+y+'" x2="446" y2="'+y+'" stroke="'+(n===80?'#cf9c65':'#e5ecdf')+'" stroke-dasharray="3 4"/><text x="0" y="'+(y+3)+'" fill="#7b8e75" font-size="8">'+n+'</text>';});
    if(points.length>1) svg+='<polygon points="'+points[0][0]+',120 '+points.map(p=>p.join(',')).join(' ')+' '+points[points.length-1][0]+',120" fill="#eaf3db"/><polyline points="'+points.map(p=>p.join(',')).join(' ')+'" fill="none" stroke="#5f9342" stroke-width="2.5" stroke-linejoin="round"/>';
    else svg+='<circle cx="'+points[0][0]+'" cy="'+points[0][1]+'" r="4" fill="#5f9342"/>';
    const clock=t=>new Date(t).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    svg+='<text x="26" y="137" fill="#7b8e75" font-size="8">'+clock(first)+'</text><text x="446" y="137" text-anchor="end" fill="#7b8e75" font-size="8">'+clock(Date.parse(levels[levels.length-1].time))+'</text></svg>';
    $('chart').innerHTML=svg;
  }

  function render() {
    const point=selectedPoint(),state=selectedState();
    const {capped,lastCloudSuccess,lastError}=state;
    rows = mode === 'demo' ? state.demoRows : state.cloudRows;
    $('selectedPointName').textContent=point.name;
    $('selectedLocation').textContent=point.location+' · '+point.id;
    document.querySelectorAll('.selected-point-label').forEach(e=>e.textContent=point.name+' · '+point.location);
    renderFleet();
    renderNotices();
    const s=C.summarize(rows,Date.now()-hours*3600000), latest=s.latest;
    const val=latest ? latest.value : null;
    const unavailable = s.sensorFailed || s.stale;
    const label=s.sensorFailed?'Falha no sensor':s.stale?'Sem leitura recente':C.status(val);
    $('modeBadge').textContent=mode==='demo'?'SIMULAÇÃO':'NUVEM';
    $('statusBadge').textContent=label;
    $('statusBadge').className='badge '+(unavailable?'warn':val>=90?'danger':val>=80?'warn':'soft');
    $('levelValue').textContent=val==null?'—':Math.round(val);
    $('levelDescription').textContent=unavailable && latest?'Última leitura conhecida':label==='Normal'?'Capacidade disponível':label==='Atenção'?'Planejar a coleta':label==='Crítico'?'Priorizar a coleta':'Aguardando dados';
    $('binFill').style.height=(val||0)+'%'; $('progressFill').style.width=(val||0)+'%';
    const color=unavailable?'#c5cec1':val>=90?'#e18a75':val>=80?'#ebc77c':'#b8da7c';
    $('binFill').style.background=color; $('progressFill').style.background=color;
    $('collectionCount').textContent=s.collections.length;
    $('lastTime').textContent=latest?new Date(latest.time).toLocaleTimeString('pt-BR',{hour12:false}):'—';
    $('connectionText').textContent=s.sensorFailed?'Falha no sensor':s.stale?'Sem leitura há mais de 2 min':mode==='demo'?'Leitura simulada':'Leitura recente';
    $('demoPanel').classList.toggle('hidden',mode!=='demo');
    $('refreshButton').disabled=busy;
    $('refreshButton').textContent=busy?'Consultando a plataforma…':'Atualizar dados';
    const message=$('message'); message.className='notice';
    if(mode==='demo') message.textContent='Demonstração local. Nenhum SMS ou e-mail é enviado neste modo.';
    else if(lastError){ message.textContent=lastError+(lastCloudSuccess?' Os dados anteriores foram mantidos.':'');message.classList.add('error'); }
    else if(s.sensorFailed){message.textContent='O dispositivo informou uma falha no sensor. Confira a montagem; o nível mostrado é uma leitura anterior.';message.classList.add('warning');}
    else if(s.stale){message.textContent='Não há leitura recente. Confira se o dispositivo está enviando dados e se o token e a região estão corretos.';message.classList.add('warning');}
    else message.textContent='Dados recebidos da TagoIO. Consulta: '+timestamp(lastCloudSuccess)+'. SMS e e-mail são executados pela nuvem.';
    document.querySelectorAll('.period-label').forEach(e=>e.textContent=periodName());
    $('limitWarning').classList.toggle('hidden',mode==='demo'||!capped);
    $('collectionList').innerHTML=s.collections.length?s.collections.slice().reverse().map(r=>'<div class="data-row"><div><strong>Coleta provável #'+esc(r.value)+'</strong><small>'+esc(timestamp(r.time))+(r.metadata&&r.metadata.hora_estimada?' · horário do envio':'')+'</small></div><span class="badge soft">ESTIMADA</span></div>').join(''):'<p class="muted">Nenhuma coleta provável no período.</p>';
    $('readingsList').innerHTML=s.levels.length?s.levels.slice(-30).reverse().map(r=>'<div class="data-row"><span>'+esc(timestamp(r.time))+'</span><strong>'+number(r.value)+'</strong></div>').join(''):'<p class="muted">Nenhuma leitura no período.</p>';
    $('minLevel').textContent=number(s.min);$('maxLevel').textContent=number(s.max);$('avgLevel').textContent=number(s.average);$('alertCount').textContent=s.alerts;
    $('reportSource').textContent=mode==='demo'?'Dados simulados localmente. Nenhum envio de alerta foi realizado.':(capped?'Amostra limitada a 500 registros; o período pode estar incompleto.':'Dados recebidos da plataforma para o período selecionado.')+(lastError?' A última consulta falhou; os registros podem estar desatualizados.':'');
    $('reportText').textContent=s.levels.length?'No ponto '+point.name+', foram analisadas '+s.levels.length+' medições, com nível médio de '+number(s.average)+'. Houve '+s.collections.length+' coleta(s) provável(is) e '+s.alerts+' leitura(s) a partir de 80% de preenchimento.':'Ainda não há medições para gerar o resumo deste ponto.';
    drawChart(s.levels);
  }

  function demoTick() {
    if(mode!=='demo') return;
    const time=new Date().toISOString();
    points.forEach(point=>{
      const s=states.get(point.id),value=s.demoLevel;
      s.demoRows.push({variable:'nivel',value,time},{variable:'sensor_ok',value:1,time});
      if(s.detector.update(value)) {
        s.collections++;
        s.demoRows.push({variable:'coleta',value:s.collections,time,metadata:{event_id:'DEMO-'+point.id+'-'+s.collections,tipo:'provavel',hora_estimada:false}});
      }
      if(s.demoRows.length>2000)s.demoRows.splice(0,s.demoRows.length-2000);
      observeAlert(point,'demo',C.summarize(s.demoRows,Date.now()-hours*3600000));
    });
    render();
  }

  function requestCloud(url, secret) {
    if(nativeBridge) return window.EcoTransport.request(url,secret);
    const control=new AbortController(), timer=setTimeout(()=>control.abort(),18000);
    return fetch(url,{headers:{'Device-Token':secret},signal:control.signal})
      .then(r=>{if(!r.ok) throw new Error('A plataforma retornou HTTP '+r.status+'. Confira token, região e limites da conta.');return r.json();})
      .finally(()=>clearTimeout(timer));
  }

  async function readPoint(id){
    const state=states.get(id);
    if(!state.token){state.lastError='Informe o token deste ponto na aba Ajustes.';return false;}
    try{
      const result=await requestCloud(C.buildUrl(state.region,hours),state.token);
      if(result.status!==true||!Array.isArray(result.result))throw new Error('A plataforma não confirmou a consulta.');
      const received=C.normalize(result.result);
      const latestLevel=received.filter(row=>row.variable==='nivel').slice(-1)[0];
      const origin=latestLevel&&latestLevel.metadata&&latestLevel.metadata.ponto_id;
      if(origin&&origin!==id)throw new Error('Os dados são de '+origin+', mas este ponto é '+id+'. Confira o token do dispositivo.');
      state.cloudRows=received.filter(row=>!row.metadata||!row.metadata.ponto_id||row.metadata.ponto_id===id);
      state.capped=result.result.length>=500;
      state.lastCloudSuccess=Date.now();state.lastError='';
      observeAlert(points.find(point=>point.id===id),'cloud',C.summarize(state.cloudRows,Date.now()-hours*3600000));
      return true;
    }catch(e){state.lastError=e.name==='AbortError'?'Tempo de consulta esgotado.':e.message;return false;}
  }
  async function refresh() {
    if(mode==='demo'){demoTick();return;}
    if(busy) return;
    busy=true;render();
    try{await readPoint(selectedId);}finally{busy=false;render();}
  }
  async function refreshAll(){
    if(mode==='demo'){demoTick();$('fleetMessage').textContent='Todos os pontos usam dados simulados.';return;}
    if(busy)return;
    busy=true;let successes=0;render();
    try{
      // One request at a time: the native Web component is shared by all devices.
      for(const point of points){
        $('fleetMessage').textContent='Consultando '+point.name+'…';
        if(await readPoint(point.id))successes++;
        render();
      }
    }finally{
      busy=false;$('fleetMessage').textContent=successes+' de '+points.length+' ponto(s) consultado(s) com sucesso. Confira os demais cartões.';render();
    }
  }

  $('settingsForm').addEventListener('submit',event=>{
    event.preventDefault();
    if(busy){$('settingsMessage').textContent='Aguarde a consulta atual terminar.';return;}
    const next=$('mode').value, secret=$('token').value.trim(),id=$('configPoint').value;
    if(next==='cloud'&&!secret){$('settingsMessage').textContent='Cole o token do dispositivo antes de conectar.';return;}
    const duplicate=secret&&points.find(point=>point.id!==id&&states.get(point.id).token===secret);
    if(next==='cloud'&&duplicate){$('settingsMessage').textContent='Esse token já está configurado em '+duplicate.name+'. Cada lixeira precisa de um dispositivo e token próprios.';return;}
    const state=states.get(id);
    if(secret!==state.token||state.region!==$('region').value){state.cloudRows=[];state.lastCloudSuccess=null;state.lastError='';alertStates.delete('cloud:'+id);}
    mode=next;state.token=secret;state.region=$('region').value;$('fleetMessage').textContent='';
    savePoints();choosePoint(id);
    $('settingsMessage').textContent=next==='demo'?'Demonstração ativada.':'Conexão configurada para esta sessão.';
    showPage('monitor');refresh();
  });
  $('pointSelect').addEventListener('change',()=>choosePoint($('pointSelect').value));
  $('configPoint').addEventListener('change',()=>{
    const state=states.get($('configPoint').value);$('token').value=state.token;$('region').value=state.region;
  });
  $('pointList').addEventListener('click',event=>{
    const card=event.target.closest('[data-point]');if(card)choosePoint(card.dataset.point);
  });
  $('pointForm').addEventListener('submit',event=>{
    event.preventDefault();
    if(busy){$('pointFormMessage').textContent='Aguarde a consulta atual terminar.';return;}
    try{
      const point=C.validatePoint({id:$('newPointId').value,name:$('newPointName').value,location:$('newPointLocation').value},points);
      points.push(point);states.set(point.id,{demoRows:[],cloudRows:[],demoLevel:35,collections:0,detector:new C.CollectionDetector(),token:'',region:'https://api.us-e1.tago.io',capped:false,lastCloudSuccess:null,lastError:''});
      const stored=savePoints();choosePoint(point.id);if(mode==='demo')demoTick();
      $('pointForm').reset();$('pointFormMessage').textContent='Ponto cadastrado.'+(stored?' Nomes e locais salvos neste aparelho.':' Cadastro mantido somente nesta sessão.');
    }catch(e){$('pointFormMessage').textContent=e.message;}
  });
  $('refreshButton').addEventListener('click',refresh);
  $('refreshAllButton').addEventListener('click',refreshAll);
  $('period').addEventListener('change',()=>{
    if(busy){$('period').value=String(hours);return;}
    hours=Number($('period').value);
    if(mode==='cloud'){states.forEach(s=>{s.cloudRows=[];s.capped=false;});refreshAll();}else render();
  });
  $('demoLevel').addEventListener('input',()=>{selectedState().demoLevel=Number($('demoLevel').value);$('demoValue').textContent=$('demoLevel').value+'%';});
  function setDemo(value){selectedState().demoLevel=value;$('demoLevel').value=value;$('demoValue').textContent=value+'%';}
  $('fillButton').addEventListener('click',()=>setDemo(85));
  $('emptyButton').addEventListener('click',()=>setDemo(10));
  $('criticalButton').addEventListener('click',()=>setDemo(97));
  $('dismissToast').addEventListener('click',()=>$('alertToast').classList.add('hidden'));
  $('internalNotices').addEventListener('change',()=>{if(!$('internalNotices').checked)$('alertToast').classList.add('hidden');});
  $('csvButton').addEventListener('click',()=>{
    const csv=C.csv(C.summarize(rows,Date.now()-hours*3600000).data,selectedPoint());
    $('csvText').value=csv;$('csvPanel').classList.remove('hidden');
    if(!nativeBridge){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.href=url;a.download='EcoColeta_'+selectedId+'_'+(mode==='demo'?'simulacao':'nuvem')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  });
  setInterval(demoTick,1000);
  setInterval(()=>{if(mode==='cloud'&&$('autoRefresh').checked)refreshAll();},60000);
  setInterval(()=>{if(mode==='cloud')render();},5000);
  syncSelectors();demoTick();
})();
