const assert=require('node:assert/strict');
const C=require('../aplicativo/web/core.js');
assert.equal(C.fillPercent(40),0);assert.equal(C.fillPercent(5),100);assert.equal(C.fillPercent(12),80);
assert.equal(C.status(79.9),'Normal');assert.equal(C.status(80),'Atenção');assert.equal(C.status(89.9),'Atenção');assert.equal(C.status(90),'Crítico');assert.equal(C.status(100),'Crítico');
const d=new C.CollectionDetector();
assert.equal(d.update(10),false);d.update(85);d.update(10);d.update(25);d.update(10);d.update(10);
assert.equal(d.update(10),true);assert.equal(d.update(10),false);
const now=Date.now(),time=new Date(now).toISOString();
const rows=[{variable:'nivel',value:80,time},{variable:'nivel',value:100,time},{variable:'nivel',value:null,time},
  {variable:'coleta',value:1,time,metadata:{event_id:'A-1'}},{variable:'coleta',value:1,time,metadata:{event_id:'A-1'}},
  {variable:'sensor_ok',value:0,time},{variable:'nivel',value:12,time:'invalid'}];
const s=C.summarize(rows,now-1000,now);
assert.equal(s.levels.length,2);assert.equal(s.min,80);assert.equal(s.max,100);assert.equal(s.average,90);
assert.equal(s.collections.length,1);assert.equal(s.alerts,2);assert.equal(s.sensorFailed,true);assert.equal(s.stale,false);
assert.equal(C.summarize([],now-1000,now).average,null);
assert.equal(C.summarize([{variable:'nivel',value:10,time:new Date(now-130000).toISOString()}],0,now).stale,true);
assert.throws(()=>C.buildUrl('http://unknown.test',24));assert.throws(()=>C.buildUrl('https://api.us-e1.tago.io',0));
assert.match(C.buildUrl('https://api.us-e1.tago.io',24),/qty=500/);
assert.match(C.csv(rows),/data_utc/);
console.log('PASS: calibracao, estados, coletas, deduplicacao, falha de sensor, dados antigos, estatisticas e CSV');
const fleet=C.fleet([
  {id:'A',name:'Entrada',rows:[{variable:'nivel',value:35,time}]},
  {id:'B',name:'Patio',rows:[{variable:'nivel',value:85,time}]},
  {id:'C',name:'Cantina',rows:[{variable:'nivel',value:96,time}]},
  {id:'D',name:'Biblioteca',rows:[]},
  {id:'E',name:'Secretaria',rows:[{variable:'nivel',value:99,time}],error:'HTTP 401'}
],now-1000,now);
assert.deepEqual(fleet.map(p=>p.id),['C','B','E','D','A']);
assert.equal(fleet.filter(p=>p.priority<2).length,2);
assert.equal(fleet.find(p=>p.id==='E').label,'Falha de consulta');
assert.equal(C.validatePoint({id:'lixeira_04',name:' Biblioteca ',location:'Bloco B'}).id,'LIXEIRA_04');
assert.throws(()=>C.validatePoint({id:'a',name:'X',location:'Y'},[{id:'A'}]));
assert.throws(()=>C.validatePoint({id:'<script>',name:'X',location:'Y'}));
assert.match(C.csv(rows,{id:'B',name:'Pátio',location:'Bloco B'}),/ponto_id/);
assert.match(C.csv(rows,{id:'B',name:'Pátio',location:'Bloco B'}),/Pátio/);
const localA=C.summarize([{variable:'coleta',value:1,time,metadata:{event_id:'A-1'}}],now-1000,now);
const localB=C.summarize([{variable:'coleta',value:1,time,metadata:{event_id:'B-1'}}],now-1000,now);
assert.equal(localA.collections.length,1);assert.equal(localB.collections.length,1);
console.log('PASS: prioridade de pontos, indisponibilidade, cadastro sem duplicacao, CSV identificado e coletas separadas');
const alert=new C.AlertDetector();
assert.equal(alert.observe(35,true,1),null);
assert.equal(alert.observe(80,true,2),'attention');
assert.equal(alert.observe(89.9,true,3),null);
assert.equal(alert.observe(90,true,4),'critical');
assert.equal(alert.observe(99,true,5),null);
assert.equal(alert.observe(93,true,6),null);
assert.equal(alert.observe(85,true,7),null);
assert.equal(alert.observe(90,true,8),null);
assert.equal(alert.observe(0,false,9),null);
assert.equal(alert.observe(97,true,10),null); // Sensor failure cannot rearm.
assert.equal(alert.observe(65,true,2),null); // Old samples cannot rearm either.
assert.equal(alert.observe(97,true,11),null);
assert.equal(alert.observe(65,true,12),null);
assert.equal(alert.observe(85,true,13),'attention');
assert.equal(alert.observe(90,true,14),'critical');
assert.equal(new C.AlertDetector().observe(97,true,1),'critical');
console.log('PASS: avisos de atencao e critico independentes, histerese, leituras antigas e invalidas');
