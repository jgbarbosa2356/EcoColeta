(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EcoCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const status = n => n >= 90 ? 'Crítico' : n >= 80 ? 'Atenção' : 'Normal';
  const fillPercent = cm => Math.max(0, Math.min(100, (40 - cm) * 100 / 35));
  function normalize(rows) {
    if (!Array.isArray(rows)) throw new Error('Resposta sem uma lista de medições.');
    return rows.filter(r => r && typeof r.variable === 'string' && Number.isFinite(Date.parse(r.time)))
      .map(r => ({...r, value: r.value === null || r.value === '' ? NaN : Number(r.value)}))
      .filter(r => Number.isFinite(r.value))
      .sort((a,b) => Date.parse(a.time) - Date.parse(b.time));
  }
  function summarize(rows, since, now = Date.now()) {
    const data = normalize(rows).filter(r => Date.parse(r.time) >= since && Date.parse(r.time) <= now);
    const levels = data.filter(r => r.variable === 'nivel' && r.value >= 0 && r.value <= 100);
    const health = data.filter(r => r.variable === 'sensor_ok').slice(-1)[0];
    const seen = new Set();
    const collections = data.filter(r => {
      if (r.variable !== 'coleta') return false;
      const key = r.metadata && r.metadata.event_id || String(r.value);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
    const values = levels.map(r => r.value);
    const latest = levels.slice(-1)[0];
    return {data, levels, collections, latest, health,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      average: values.length ? values.reduce((a,b)=>a+b,0) / values.length : null,
      alerts: values.filter(n=>n>=80).length,
      stale: !latest || now - Date.parse(latest.time) > 120000,
      sensorFailed: !!health && health.value === 0 && (!latest || Date.parse(health.time) >= Date.parse(latest.time))};
  }
  class CollectionDetector {
    constructor() { this.armed = false; this.low = 0; }
    update(n, valid = true) {
      if (!valid || !Number.isFinite(n)) { this.low = 0; return false; }
      if (n >= 50) { this.armed = true; this.low = 0; return false; }
      if (!this.armed || n > 20) { this.low = 0; return false; }
      if (++this.low < 3) return false;
      this.armed = false; this.low = 0; return true;
    }
  }
  class AlertDetector {
    constructor(){this.attentionLocked=false;this.criticalLocked=false;this.lastTime=-Infinity;}
    observe(level, valid=true, time=Date.now()){
      if(!valid||!Number.isFinite(level)||level<0||level>100||!Number.isFinite(time)||time<=this.lastTime)return null;
      this.lastTime=time;
      if(level<70)this.attentionLocked=false;
      if(level<85)this.criticalLocked=false;
      if(level>=90&&!this.criticalLocked){this.criticalLocked=true;return 'critical';}
      if(level>=80&&level<90&&!this.attentionLocked){this.attentionLocked=true;return 'attention';}
      return null;
    }
  }
  function buildUrl(base, hours) {
    if (!['https://api.us-e1.tago.io','https://api.eu-w1.tago.io'].includes(base)) throw new Error('Região inválida.');
    if (![1,24,168].includes(Number(hours))) throw new Error('Período inválido.');
    const start = new Date(Date.now() - Number(hours)*3600000).toISOString();
    return base + '/data?variable%5B%5D=nivel&variable%5B%5D=coleta&variable%5B%5D=sensor_ok&qty=500&start_date=' + encodeURIComponent(start);
  }
  function fleet(points, since, now = Date.now()) {
    return points.map(point => {
      const summary = summarize(point.rows || [], since, now);
      const unavailable = summary.stale || summary.sensorFailed || !!point.error;
      const n = summary.latest ? summary.latest.value : null;
      return {...point, summary, unavailable,
        label: point.error ? 'Falha de consulta' : summary.sensorFailed ? 'Falha no sensor' : summary.stale ? 'Sem leitura recente' : status(n),
        priority: unavailable ? 2 : n >= 90 ? 0 : n >= 80 ? 1 : 3};
    }).sort((a,b) => a.priority-b.priority || ((b.summary.latest?.value || 0)-(a.summary.latest?.value || 0)) || a.id.localeCompare(b.id));
  }
  function validatePoint(candidate, existing = []) {
    const point={id:String(candidate.id || '').trim().toUpperCase(),name:String(candidate.name || '').trim(),location:String(candidate.location || '').trim()};
    if (!/^[A-Z0-9_-]{1,32}$/.test(point.id)) throw new Error('Use um identificador com até 32 letras, números, hífen ou sublinhado.');
    if (!point.name || point.name.length>60 || !point.location || point.location.length>120) throw new Error('Preencha nome e localização dentro dos limites indicados.');
    if (existing.some(p=>p.id.toUpperCase()===point.id)) throw new Error('Já existe um ponto com esse identificador.');
    return point;
  }
  function csv(rows, point) {
    const escape = v => '"' + String(v == null ? '' : v).replace(/"/g,'""') + '"';
    const header=['data_utc','variavel','valor','evento','hora_estimada'];
    if(point) header.unshift('ponto_id','ponto_nome','localizacao');
    return '\uFEFF' + [header].concat(normalize(rows).map(r=>[
      ...(point ? [point.id,point.name,point.location] : []),
      r.time, r.variable, r.value, r.metadata && r.metadata.event_id,
      r.variable === 'coleta' ? !!(r.metadata && r.metadata.hora_estimada) : ''
    ])).map(r=>r.map(escape).join(';')).join('\r\n');
  }
  return {status, fillPercent, normalize, summarize, CollectionDetector, AlertDetector, buildUrl, fleet, validatePoint, csv};
});
