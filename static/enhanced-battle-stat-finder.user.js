// ==UserScript==
// @name         Enhanced Battle Stat Finder v2
// @namespace    Fries91.Torn.BattleStatFinder
// @version      2.0.0
// @description  Clean stable PDA battle stat badges, FF/BSP bridge, manual/automatic fight learning.
// @author       Fries91
// @match        https://www.torn.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      enhanced-battle-stat-finder.onrender.com
// @connect      api.torn.com
// @run-at       document-idle
// ==/UserScript==

(function(){
  'use strict';

  const BASE = 'https://enhanced-battle-stat-finder.onrender.com';
  const S = {
    key:'ebsf2_key', user:'ebsf2_user', total:'ebsf2_total', intel:'ebsf2_intel_cache',
    ff:'ebsf2_ff_enabled', lastTarget:'ebsf2_last_target', lastDebug:'ebsf2_debug'
  };

  const app = {
    key: GM_getValue(S.key,''),
    user: safeJson(GM_getValue(S.user,'null')),
    total: Number(GM_getValue(S.total,0)||0),
    ff: !!GM_getValue(S.ff,false),
    open:false, msg:''
  };

  GM_addStyle(`
    .ebsf2-badge{position:absolute!important;right:3px!important;top:2px!important;z-index:80!important;display:inline-flex!important;align-items:center;justify-content:center;min-width:30px;max-width:52px;padding:1px 5px!important;border-radius:4px!important;border:1px solid #64748b;background:#111827;color:#cbd5e1;font:900 9px Arial,sans-serif!important;line-height:1!important;box-shadow:0 1px 4px #0009;pointer-events:none;white-space:nowrap;overflow:hidden}
    .ebsf2-easy{background:#052e16!important;color:#86efac!important;border-color:#22c55e!important}
    .ebsf2-fair{background:#172554!important;color:#93c5fd!important;border-color:#3b82f6!important}
    .ebsf2-good{background:#422006!important;color:#fde68a!important;border-color:#f59e0b!important}
    .ebsf2-difficult{background:#431407!important;color:#fdba74!important;border-color:#f97316!important}
    .ebsf2-avoid{background:#450a0a!important;color:#fca5a5!important;border-color:#ef4444!important}
    #ebsf2-btn{position:fixed;left:18px;bottom:116px;z-index:999996;width:54px;height:54px;border-radius:10px;border:1px solid #806500;background:#111827;color:#fde68a;font-size:28px;box-shadow:0 2px 10px #000c}
    #ebsf2-panel{position:fixed;left:8px;right:8px;top:188px;max-height:70vh;overflow:auto;z-index:999997;background:#0b1120;color:#e5e7eb;border:1px solid #806500;border-radius:14px;box-shadow:0 6px 22px #000d;font-family:Arial,sans-serif;display:none}
    #ebsf2-panel.open{display:block}
    #ebsf2-panel h2{margin:0;padding:12px 14px;color:#facc15;font-size:18px;background:#020617;border-radius:14px 14px 0 0}
    #ebsf2-panel .body{padding:12px}
    #ebsf2-panel input{box-sizing:border-box;width:100%;background:#020617;color:#f8fafc;border:1px solid #374151;border-radius:8px;padding:9px;margin:6px 0}
    #ebsf2-panel button{background:#1f2937;color:#fde68a;border:1px solid #806500;border-radius:8px;padding:8px 10px;margin:4px;font-weight:900}
    #ebsf2-panel .box{background:#111827;border:1px solid #334155;border-radius:10px;padding:10px;margin:8px 0}
    #ebsf2-save{position:fixed;left:12px;top:120px;z-index:999998;background:#111827;color:#fde68a;border:1px solid #facc15;border-radius:10px;padding:8px;display:none;font:900 12px Arial}
  `);

  function safeJson(s){ try{return JSON.parse(s)}catch(e){return null} }
  function esc(s){ return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) }
  function fmt(n){ n=Number(n||0); if(n>=1e12)return (n/1e12).toFixed(1).replace('.0','')+'t'; if(n>=1e9)return (n/1e9).toFixed(1).replace('.0','')+'b'; if(n>=1e6)return (n/1e6).toFixed(1).replace('.0','')+'m'; if(n>=1e3)return (n/1e3).toFixed(1).replace('.0','')+'k'; return String(Math.round(n)); }
  function parseNum(v){ if(v==null)return 0; let s=String(v).toLowerCase().replace(/,/g,'').trim(); let m=s.match(/([0-9]+(?:\.[0-9]+)?)\s*([kmbt])?/); if(!m)return 0; let n=Number(m[1]); let u=m[2]||''; if(u==='k')n*=1e3;if(u==='m')n*=1e6;if(u==='b')n*=1e9;if(u==='t')n*=1e12; return Math.round(n); }
  function label(total){ if(!app.total||!total)return 'unknown'; let r=total/app.total; if(r<=.75)return 'easy'; if(r<=1.10)return 'fair'; if(r<=1.35)return 'good'; if(r<=1.75)return 'difficult'; return 'avoid'; }
  function intelCache(){ return safeJson(GM_getValue(S.intel,'{}')) || {} }
  function saveIntel(id,intel){ if(!id||!intel)return; const c=intelCache(); c[String(id)]={...intel,user_id:Number(id),saved_at:Date.now()}; GM_setValue(S.intel,JSON.stringify(c)); }
  function getIntel(id){ const c=intelCache(); return c[String(id)] || null; }
  function dbg(k,v){ const d=safeJson(GM_getValue(S.lastDebug,'{}'))||{}; d[k]=v; d.updated=new Date().toLocaleTimeString(); GM_setValue(S.lastDebug,JSON.stringify(d)); }

  function req(method,path,data){
    return new Promise(resolve=>{
      GM_xmlhttpRequest({
        method,url:BASE+path,headers:{'Content-Type':'application/json'},
        data:data?JSON.stringify(data):undefined,timeout:25000,
        onload:r=>{try{resolve(JSON.parse(r.responseText))}catch(e){resolve({ok:false,error:'bad json',raw:r.responseText})}},
        onerror:e=>resolve({ok:false,error:String(e)}),
        ontimeout:()=>resolve({ok:false,error:'timeout'})
      });
    });
  }

  function initUI(){
    if(document.getElementById('ebsf2-btn')) return;
    const btn=document.createElement('button'); btn.id='ebsf2-btn'; btn.textContent='⚔️'; btn.onclick=()=>{app.open=!app.open; render();};
    document.body.appendChild(btn);
    const panel=document.createElement('div'); panel.id='ebsf2-panel'; document.body.appendChild(panel);
    const save=document.createElement('div'); save.id='ebsf2-save'; save.innerHTML=`⚔️ Save last fight <button data-r="easy_win">Easy</button><button data-r="close_win">Close</button><button data-r="generic_loss">Loss</button>`;
    save.addEventListener('click',e=>{const b=e.target.closest('button[data-r]'); if(b) saveFight(b.dataset.r,true);});
    document.body.appendChild(save);
    render();
  }

  function render(){
    const d=safeJson(GM_getValue(S.lastDebug,'{}'))||{};
    const panel=document.getElementById('ebsf2-panel'); if(!panel)return;
    panel.className=app.open?'open':'';
    panel.innerHTML=`
      <h2>⚔️ Enhanced Battle Stat Finder <button style="float:right" id="ebsf2-close">Close</button></h2>
      <div class="body">
        <div class="box">
          <b>Login / Settings</b>
          <input id="ebsf2-key" type="password" placeholder="Torn limited API key" value="${esc(app.key)}">
          <label><input id="ebsf2-ff" type="checkbox" ${app.ff?'checked':''} style="width:auto"> Use FF Scouter base intel</label><br>
          <button id="ebsf2-login">Login / Save</button>
          <button id="ebsf2-repaint">Repaint badges</button>
        </div>
        <div class="box">
          <b>Status</b><br>
          User: ${esc(app.user?.name||'not logged in')} ${app.user?.user_id?'['+app.user.user_id+']':''}<br>
          My total: ${fmt(app.total)}<br>
          ${esc(app.msg||'')}
        </div>
        <div class="box">
          <b>Debug</b><br>
          Remembered: ${esc(d.target_id||'no')} ${esc(d.target_name||'')}<br>
          Result detected: ${esc(d.result||'none')}<br>
          Saved: ${esc(d.saved||'no')}<br>
          Updated: ${esc(d.updated||'')}
        </div>
        <div class="box">
          <b>How it works</b><br>
          N/A means no usable intel yet. FF/BSP visible estimates are used when readable. After an attack, auto-save tries first; if Torn PDA hides the result, use the small Save Last Fight buttons.
        </div>
      </div>`;
    panel.querySelector('#ebsf2-close').onclick=()=>{app.open=false;render();};
    panel.querySelector('#ebsf2-login').onclick=login;
    panel.querySelector('#ebsf2-repaint').onclick=()=>paintAll(true);
  }

  async function login(){
    app.key=document.getElementById('ebsf2-key').value.trim();
    app.ff=document.getElementById('ebsf2-ff').checked;
    GM_setValue(S.key,app.key); GM_setValue(S.ff,app.ff);
    app.msg='Logging in...'; render();
    const r=await req('POST','/api/login',{api_key:app.key});
    if(r.ok){
      app.user=r.user; app.total=r.stats.total;
      GM_setValue(S.user,JSON.stringify(app.user)); GM_setValue(S.total,app.total);
      app.msg='Logged in. Badges active.';
      paintAll(true);
    }else app.msg='Login failed: '+JSON.stringify(r.error||r);
    render();
  }

  function extractId(txt){
    txt=String(txt||'');
    let m=txt.match(/(?:XID|user2ID|userID|targetID|profileId|targetId)[=\\":%26]+(\d{3,10})/i); if(m)return Number(m[1]);
    m=txt.match(/profiles\.php\?XID=(\d{3,10})/i); if(m)return Number(m[1]);
    m=txt.match(/loader\.php\?sid=attack[^"']*?(?:user2ID=)?(\d{3,10})/i); if(m)return Number(m[1]);
    return null;
  }

  function visibleIntel(){
    const txt=(document.body?.innerText||'').replace(/\s+/g,' ');
    for(const p of [/Est\.?\s*Stats:\s*([0-9.,]+\s*[kmbt]?)/i,/Estimated\s*Stats:\s*([0-9.,]+\s*[kmbt]?)/i]){
      const m=txt.match(p); if(m){ const n=parseNum(m[1]); if(n)return {total:n,best_total:n,range_low:n*.88,range_high:n*1.12,label:label(n),confidence:64,source:'visible_ff_bsp'}; }
    }
    return null;
  }

  function bspIntel(id){
    if(!id)return null;
    const keys=['tdup.battleStatsPredictor.cache.prediction.'+id,'BSP_prediction_'+id,'battleStatsPredictor_'+id];
    for(const k of keys){
      try{
        const raw=localStorage.getItem(k)||GM_getValue(k,''); if(!raw)continue;
        const p=JSON.parse(raw); const n=parseNum(p.TBS||p.TargetTBS||p.bs_estimate||p.estimate||p.total||p.Total);
        if(n)return {total:n,best_total:n,range_low:n*.88,range_high:n*1.12,label:label(n),confidence:65,source:'bsp_cache'};
      }catch(e){}
    }
    return null;
  }

  function makeBadge(intel){
    const b=document.createElement('span'); updateBadge(b,intel); return b;
  }
  function updateBadge(b,intel){
    let n=Number(intel?.best_total||intel?.total||0);
    let l=(intel?.label||label(n)||'unknown').toLowerCase();
    if(!n){ b.className='ebsf2-badge'; b.textContent='N/A'; b.title='No intel yet'; return; }
    b.className='ebsf2-badge ebsf2-'+l; b.textContent=fmt(n); b.title=`${intel.source||'intel'} • ${intel.label||''} • ${Math.round(intel.confidence||0)}%`;
  }
  function attach(mount,intel){
    if(!mount)return;
    let b=mount.querySelector(':scope > .ebsf2-badge');
    if(!b){ b=makeBadge(intel); const cs=getComputedStyle(mount); if(cs.position==='static')mount.style.position='relative'; mount.appendChild(b); }
    else updateBadge(b,intel);
  }

  function rows(){
    return [...document.querySelectorAll('tr,li,[class*="row"],[class*="member"]')].filter(r=>{
      const t=(r.textContent||'').trim(); const rect=r.getBoundingClientRect?.();
      if(!t||!rect||rect.width<140||rect.height<14||rect.bottom<-120||rect.top>innerHeight+800)return false;
      const shape=r.querySelectorAll?.('td,[class*="cell"],[class*="column"]').length>=2;
      const words=/Okay|Attack|Hospital|Travel|Jail/i.test(t);
      const honor=!!r.querySelector?.('img,[style*="background-image"],[class*="honor"],[class*="name"]');
      return (shape&&(words||honor))||(words&&honor);
    }).slice(0,160);
  }
  function memberCell(row){
    const cells=[...(row.querySelectorAll?.('td,[class*="cell"],[class*="column"]')||[])];
    for(const c of cells.slice(0,2)){ const t=(c.textContent||'').trim(); const r=c.getBoundingClientRect?.(); if(r&&r.width>45&&r.height>12&&!(/Score|Status|Attack|Okay/i.test(t)&&t.length<30))return c; }
    return [...row.children].find(c=>{const r=c.getBoundingClientRect?.();return r&&r.width>45&&r.height>12})||null;
  }
  function honorMount(scope){
    if(!scope)return null;
    const cs=[...(scope.querySelectorAll?.('[class*="honor"],[class*="name"],[style*="background-image"],img,a[href*="profiles.php"]')||[])];
    let best=null,sc=-999;
    for(const el of cs){ const r=el.getBoundingClientRect?.(); if(!r||r.width<35||r.height<10||r.width>400||r.height>130)continue; let s=Math.min(40,r.width/7); const cl=String(el.className||'').toLowerCase(), st=String(el.getAttribute('style')||'').toLowerCase(); if(cl.includes('honor'))s+=45;if(cl.includes('name'))s+=30;if(st.includes('background-image'))s+=25;if(el.tagName==='IMG')s+=20;if(s>sc){sc=s;best=el;} }
    return best?.parentElement || best || scope;
  }

  async function intelFor(row,mount){
    const id=extractId([location.href,row?.innerHTML,mount?.innerHTML].join(' '));
    let intel=id&&(getIntel(id)||bspIntel(id));
    if(!intel && /Profile/i.test(document.title||'')) intel=visibleIntel();
    if(id&&intel) saveIntel(id,intel);
    if(id && !intel && app.key){
      req('GET','/api/player/'+id+'/intel?your_total='+app.total).then(r=>{ if(r.ok&&r.player){saveIntel(id,r.player); paintAll(false);} });
    }
    return intel||null;
  }

  async function paintAll(force){
    if(!/Faction|Profile|Members|User Information|Awards|Medals|Attack|Status/i.test((document.body?.innerText||'').slice(0,5000))) return;
    for(const row of rows()){
      const cell=memberCell(row), mount=honorMount(cell);
      if(!mount)continue;
      const intel=await intelFor(row,mount);
      attach(mount,intel);
    }
    // profile honor
    const profIntel=visibleIntel();
    if(/Profile|User Information/i.test(document.body?.innerText||'')||/profiles\.php/.test(location.href)){
      const candidates=[...document.querySelectorAll('img,[style*="background-image"],[class*="honor"],[class*="name"]')];
      let best=null,score=-999;
      for(const el of candidates){ if(el.closest('#ebsf2-panel'))continue; const r=el.getBoundingClientRect?.(); if(!r||r.width<80||r.height<10||r.width>600||r.height>140||r.top<120)continue; let s=Math.min(50,r.width/8); if(el.tagName==='IMG')s+=20; if(String(el.getAttribute('style')||'').includes('background-image'))s+=25; if(s>score){score=s;best=el;} }
      if(best) attach(best.parentElement||best, profIntel || (extractId(location.href)?getIntel(extractId(location.href)):null));
    }
  }

  function isAttackClick(el){
    if(!el)return false;
    const href=el.href||el.getAttribute?.('href')||'', onclick=el.getAttribute?.('onclick')||'', txt=(el.textContent||'').trim(), title=el.getAttribute?.('title')||el.getAttribute?.('aria-label')||'';
    return /sid=attack|user2ID=|attack/i.test(href) || /sid=attack|user2ID|attack/i.test(onclick) || /^attack$/i.test(txt) || ((el.tagName==='A'||el.tagName==='BUTTON')&&/attack|fight/i.test(href+onclick+title+txt));
  }
  function remember(id,name){ const row={id:Number(id),name:name||'Enemy',ts:Date.now()}; GM_setValue(S.lastTarget,JSON.stringify(row)); dbg('target_id',id); dbg('target_name',row.name); watchFight(); }
  function pending(){ const p=safeJson(GM_getValue(S.lastTarget,'null')); return p&&Date.now()-p.ts<1000*60*12?p:null; }

  function resultFromText(raw){
    const t=String(raw||'').replace(/\s+/g,' ').toLowerCase();
    if(/you won|you mugged|you hospitalized|you hospitalised|you left|victory|respect gained|experience gained|you gained/.test(t))return 'generic_win';
    if(/you lost|you were defeated|defeated by|you were hospitalized|you ran away|stalemate/.test(t))return 'generic_loss';
    if(/leave them|mug them|hospitalize|claim rewards|continue/.test(t))return 'generic_win';
    return null;
  }
  async function saveFight(result,manual){
    const p=pending(); if(!p||!app.user||!app.total){dbg('saved','missing target/login');render();return;}
    dbg('result',result);
    const r=await req('POST','/api/attack/result',{attacker_id:app.user.user_id,attacker_name:app.user.name,attacker_total:app.total,target_id:p.id,target_name:p.name,result,fight_meta:{manual:!!manual}});
    if(r.ok&&r.player){ saveIntel(p.id,r.player); dbg('saved','ok '+fmt(r.player.total)); document.getElementById('ebsf2-save').style.display='none'; paintAll(true); }
    else dbg('saved','failed '+JSON.stringify(r.error||r));
    render();
  }
  function watchFight(){
    const tick=()=>{ const res=resultFromText(document.body?.innerText||''); if(res) saveFight(res,false); };
    clearInterval(window.__ebsf2FightWatch);
    window.__ebsf2FightWatch=setInterval(tick,900);
    setTimeout(()=>{clearInterval(window.__ebsf2FightWatch); const p=pending(); if(p)document.getElementById('ebsf2-save').style.display='block';},18000);
    try{
      if(window.__ebsf2Obs)window.__ebsf2Obs.disconnect();
      window.__ebsf2Obs=new MutationObserver(tick); window.__ebsf2Obs.observe(document.body,{childList:true,subtree:true,characterData:true});
      setTimeout(()=>window.__ebsf2Obs?.disconnect(),1000*60*7);
    }catch(e){}
  }

  function installAttackWatcher(){
    document.addEventListener('click',e=>{
      const el=e.target.closest?.('a,button,[onclick]'); if(!isAttackClick(el))return;
      const row=el.closest('tr,li,[class*="row"],[class*="member"]');
      const id=extractId([el.href,el.getAttribute?.('href'),el.getAttribute?.('onclick'),row?.innerHTML,location.href].join(' '));
      if(id){ remember(id,(row?.textContent||'Enemy').trim().slice(0,40)); alertToast('⚔️ Target remembered'); }
    },true);
  }
  function alertToast(msg){ const d=document.createElement('div'); d.textContent=msg; d.style.cssText='position:fixed;left:12px;top:90px;z-index:999999;background:#111827;color:#fde68a;border:1px solid #facc15;border-radius:9px;padding:8px;font:900 12px Arial'; document.body.appendChild(d); setTimeout(()=>d.remove(),1800); }

  function boot(){
    initUI(); installAttackWatcher();
    [500,1200,2500,4500,8000,13000,21000,30000].forEach(t=>setTimeout(()=>paintAll(false),t));
    let last=location.href;
    setInterval(()=>{ if(location.href!==last){last=location.href; setTimeout(()=>paintAll(true),600); setTimeout(()=>paintAll(true),1800);} },1000);
    new MutationObserver(()=>{clearTimeout(window.__ebsf2Paint); window.__ebsf2Paint=setTimeout(()=>paintAll(false),500);}).observe(document.body,{childList:true,subtree:true});
  }
  boot();
})();
