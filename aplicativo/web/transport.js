(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.EcoTransport=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const allowed=new Set(['https://api.us-e1.tago.io','https://api.eu-w1.tago.io']);
  function canonical(value){
    try{
      let raw=String(value);
      // iOS Web.Url encodes an address before reporting it back in GotText.
      // This transport only uses controlled query values (dates and names).
      for(let i=0;i<2&&/%[0-9a-f]{2}/i.test(raw);i++)raw=decodeURIComponent(raw);
      const parsed=new URL(raw);
      const entries=Array.from(parsed.searchParams.entries()).sort((a,b)=>a[0].localeCompare(b[0])||a[1].localeCompare(b[1]));
      return parsed.origin+parsed.pathname+'?'+entries.map(([key,val])=>key+'='+val).join('&');
    }catch(e){return null;}
  }
  function nativeUrl(value,time){
    const parsed=new URL(value);
    if(!allowed.has(parsed.origin)||parsed.protocol!=='https:'||parsed.pathname!=='/data')throw new Error('Endereco de consulta invalido.');
    // A documented date parameter distinguishes requests without a URL fragment.
    // Provide raw [] and ISO dates: iOS applies its own URL encoding once.
    parsed.searchParams.set('end_date',new Date(time).toISOString());
    const entries=Array.from(parsed.searchParams.entries());
    for(const [key,val] of entries){
      if(!/^[a-z_\[\]]+$/.test(key)||!/^[-a-zA-Z0-9:._]+$/.test(val))throw new Error('Parametros de consulta invalidos.');
    }
    return parsed.origin+parsed.pathname+'?'+entries.map(([key,val])=>key+'='+val).join('&');
  }
  function create(options={}){
    const now=options.now||(()=>Date.now());
    const setTimer=options.setTimer||((fn,delay)=>root.setTimeout(fn,delay));
    const clearTimer=options.clearTimer||(id=>root.clearTimeout(id));
    const getBridge=options.getBridge||(()=>root.AppInventor);
    const timeoutMs=options.timeoutMs||20000;
    let pending=null,lastTime=0;
    function finish(error,result){
      if(!pending)return;
      const request=pending;pending=null;clearTimer(request.timer);
      if(error)request.reject(error);else request.resolve(result);
    }
    function matches(source){
      if(!pending)return false;
      const key=canonical(source);
      if(!key||key!==pending.key){pending.mismatches++;return false;}
      return true;
    }
    function request(url,secret){
      if(pending)return Promise.reject(new Error('Uma consulta ainda esta em andamento.'));
      return new Promise((resolve,reject)=>{
        const bridge=getBridge();
        if(!bridge||typeof bridge.setWebViewString!=='function')return reject(new Error('A ponte do Companion nao esta disponivel. Reconecte o projeto atualizado.'));
        let target;
        try{lastTime=Math.max(now(),lastTime+1);target=nativeUrl(url,lastTime);}catch(error){reject(error);return;}
        pending={key:canonical(target),resolve,reject,timer:null,started:false,mismatches:0};
        pending.timer=setTimer(()=>{
          const text=pending.mismatches?'A resposta recebida nao correspondeu a consulta. Reconecte ao projeto EcoColeta V4.':pending.started?
            'A consulta foi iniciada, mas nao houve resposta. Verifique a internet e tente novamente.':
            'O Companion nao confirmou o inicio da consulta. Reconecte ao projeto EcoColeta V4 e tente novamente.';
          finish(new Error(text));
        },timeoutMs);
        try{bridge.setWebViewString(JSON.stringify([target,secret]));}
        catch(error){finish(new Error('Falha ao iniciar a consulta pelo Companion. Reconecte o projeto atualizado.'));}
      });
    }
    function ack(payload){
      if(Array.isArray(payload)&&matches(payload[0]))pending.started=true;
    }
    function receive(payload){
      if(!Array.isArray(payload)||payload.length<3||!matches(payload[0]))return;
      const code=Number(payload[1]);
      if(!Number.isFinite(code)||code<200||code>=300){finish(new Error('A plataforma retornou HTTP '+code+'. Confira token, regiao e limites da conta.'));return;}
      try{finish(null,typeof payload[2]==='string'?JSON.parse(payload[2]):payload[2]);}
      catch(error){finish(new Error('A plataforma retornou um conteudo invalido.'));}
    }
    function fail(payload){
      if(!pending||!Array.isArray(payload)||payload.length<2)return;
      if(payload[0]&&!matches(payload[0]))return;
      finish(new Error(String(payload[1]||'Falha na consulta nativa.')));
    }
    return {request,ack,receive,fail};
  }
  return {canonical,nativeUrl,create,...create()};
});
