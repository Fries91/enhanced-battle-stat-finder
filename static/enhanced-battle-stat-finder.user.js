// ==UserScript==
// @name         Enhanced Battle Stat Finder v2
// @namespace    Fries91.Torn.BattleStatFinder
// @version      2.0.2
// @description  Stable PDA battle stat badges with clickable intel popup, FF/BSP info bridge, profile-only app icon, and fight learning.
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
    .ebsf2-badge{position:absolute!important;right:3px!important;top:2px!important;z-index:80!important;display:inline-flex!important;align-items:center;justify-content:center;min-width:30px;max-width:52px;padding:1px 5px!important;border-radius:4px!important;border:1px solid #64748b;background:#111827;color:#cbd5e1;font:900 9px Arial,sans-serif!important;line-height:1!important;box-shadow:0 1px 4px #0009;pointer-events:auto;cursor:pointer;white-space:nowrap;overflow:hidden}
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

    .ebsf2-pop{position:fixed;z-index:999999;background:#0b1120;color:#e5e7eb;border:1px solid #806500;border-radius:12px;box-shadow:0 6px 22px #000d;width:250px;font:12px Arial,sans-serif;overflow:hidden}
    .ebsf2-pop-head{display:flex;justify-content:space-between;align-items:center;background:#020617;color:#facc15;padding:8px 10px}
    .ebsf2-pop-close{background:#1f2937!important;color:#facc15!important;border:1px solid #806500!important;border-radius:6px!important;padding:1px 6px!important;margin:0!important}
    .ebsf2-pop-body{padding:10px;line-height:1.45}
    .ebsf2-pill{display:inline-block;margin-left:4px;padding:1px 5px;border:1px solid #475569;border-radius:999px;background:#111827;color:#fde68a;font-weight:900}
    .ebsf2-shape{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:6px}
    .ebsf2-shape div{background:#111827;border:1px solid #334155;border-radius:8px;padding:5px;display:flex;justify-content:space-between}
    .ebsf2-note{color:#94a3b8;font-size:11px;margin:8px 0 0}

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
      app.user=r.user; app.total=r.stats.total; app.str_stat=r.stats.strength||0; app.def_stat=r.stats.defense||0; app.spd_stat=r.stats.speed||0; app.dex_stat=r.stats.dexterity||0;
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


  /* v2.0.1 fixes:
     - Do not badge profile action/history rows.
     - Profile page gets one badge on honor/name plate only.
     - Visible FF/BSP estimate beats weak fight fallback.
     - Fight loss fallback explains/updates only if no stronger estimate exists.
  */

  function ebsf201SourceRank(intel){
    if(!intel) return 0;
    const src = String(intel.source || '').toLowerCase();
    if(src.includes('manual') || src.includes('spy')) return 95;
    if(src.includes('ffscouter') || src.includes('visible_ff_bsp')) return 70;
    if(src.includes('bsp')) return 66;
    if(src.includes('fight')) return 40;
    return Number(intel.confidence || 0);
  }

  const ebsf201OldSaveIntel = saveIntel;
  saveIntel = function(id, intel){
    if(!id || !intel) return;
    const old = getIntel(id);
    if(old && ebsf201SourceRank(old) > ebsf201SourceRank(intel)){
      return; // do not let 42m fight fallback overwrite 246m FF/BSP
    }
    return ebsf201OldSaveIntel(id, intel);
  };

  function ebsf201PageKind(){
    const txt = (document.body?.innerText || '').slice(0, 5000);
    if(/Attack log|initiated an attack|lost to|won against|attacking/i.test(document.title + ' ' + txt)) return 'attacklog';
    if(/User Information|Medals|Awards|Actions/i.test(txt) || /Profile/i.test(document.title || '') || /profiles\.php/.test(location.href)) return 'profile';
    if(/Members\s+Score|Status\s+Attack|No active chain|Chain active|Lead target/i.test(txt) || /factions\.php/.test(location.href)) return 'faction';
    return 'other';
  }

  function ebsf201VisibleIntel(){
    const intel = visibleIntel?.();
    if(!intel) return null;
    intel.source = 'visible_ff_bsp';
    intel.confidence = Math.max(Number(intel.confidence || 0), 70);
    return intel;
  }

  function ebsf201FindProfileMount(){
    const txt = document.body?.innerText || '';
    if(!/User Information|Profile/i.test(txt + ' ' + document.title)) return null;

    const candidates = [...document.querySelectorAll('img,[style*="background-image"],[class*="honor"],[class*="name"]')];
    let best = null, score = -999;

    for(const el of candidates){
      if(el.closest('#ebsf2-panel')) continue;
      if(el.closest('#ebsf2-save')) continue;

      const wrapText = (el.parentElement?.innerText || el.closest('div')?.innerText || '').slice(0, 200);
      if(/Level|Rank|years|months|days|Actions|Awards|Medals/i.test(wrapText)) continue;

      const r = el.getBoundingClientRect?.();
      if(!r || r.width < 120 || r.height < 10 || r.width > 620 || r.height > 90) continue;
      if(r.top < 160 || r.top > window.innerHeight + 900) continue;

      const cls = String(el.className || '').toLowerCase();
      const st = String(el.getAttribute('style') || '').toLowerCase();
      const alt = String(el.getAttribute('alt') || el.getAttribute('title') || '').toLowerCase();

      let s = 0;
      if(cls.includes('honor')) s += 50;
      if(cls.includes('name')) s += 30;
      if(st.includes('background-image')) s += 35;
      if(el.tagName === 'IMG') s += 20;
      if(alt) s += 10;
      s += Math.min(45, r.width / 8);
      s -= Math.abs(r.height - 32) * .4;

      // Prefer the left/center honor image over right side stat boxes.
      if(r.left < window.innerWidth * .72) s += 15;
      if(s > score){ score = s; best = el; }
    }

    return best ? (best.parentElement || best) : null;
  }

  async function ebsf201PaintProfile(){
    const mount = ebsf201FindProfileMount();
    if(!mount) return;

    // Remove duplicate profile badges first.
    document.querySelectorAll('.ebsf2-profile-badge').forEach(b => {
      if(!mount.contains(b)) b.remove();
    });

    const id = extractId(location.href) || extractId(document.body.innerHTML);
    let intel = (id && getIntel(id)) || ebsf201VisibleIntel() || (id && bspIntel?.(id)) || null;
    if(id && intel) saveIntel(id, intel);

    attach(mount, intel);
    const badge = mount.querySelector(':scope > .ebsf2-badge');
    if(badge) badge.classList.add('ebsf2-profile-badge');
  }

  function ebsf201Rows(){
    const possible = [...document.querySelectorAll('tr,li,[class*="row"],[class*="member"]')];
    return possible.filter(r => {
      const text = (r.textContent || '').trim();
      const rect = r.getBoundingClientRect?.();
      if(!text || !rect || rect.width < 140 || rect.height < 14) return false;
      if(rect.bottom < -120 || rect.top > innerHeight + 800) return false;

      // Never badge attack history/log rows.
      if(/used 25 energy attacking|initiated an attack|lost to|won against|sprayed|fired .* rounds|hitting .* for/i.test(text)) return false;

      const shape = r.querySelectorAll?.('td,[class*="cell"],[class*="column"]').length >= 2;
      const warWords = /Okay|Hospital|Travel|Jail/i.test(text);
      const hasAttackButton = /(^|\s)Attack(\s|$)/i.test(text);
      const honor = !!r.querySelector?.('img,[style*="background-image"],[class*="honor"],[class*="name"]');

      return shape && honor && (warWords || hasAttackButton);
    }).slice(0, 160);
  }

  async function ebsf201PaintFaction(){
    for(const row of ebsf201Rows()){
      const cell = memberCell(row);
      const mount = honorMount(cell);
      if(!mount) continue;
      const intel = await intelFor(row, mount);
      attach(mount, intel);
    }
  }

  const ebsf201OriginalPaintAll = paintAll;
  paintAll = async function(force){
    const kind = ebsf201PageKind();

    // Clean all wrong badges from attack logs/history.
    if(kind === 'attacklog'){
      document.querySelectorAll('.ebsf2-badge').forEach(b => b.remove());
      return;
    }

    if(kind === 'profile'){
      // Remove row/history badges on profile page, then add only the honor badge.
      document.querySelectorAll('.ebsf2-badge').forEach(b => b.remove());
      await ebsf201PaintProfile();
      return;
    }

    if(kind === 'faction'){
      await ebsf201PaintFaction();
      return;
    }

    return ebsf201OriginalPaintAll(force);
  };

  const ebsf201OldSaveFight = saveFight;
  saveFight = async function(result, manual){
    const p = pending?.();
    const before = p ? getIntel(p.id) : null;

    await ebsf201OldSaveFight(result, manual);

    // If visible FF/BSP estimate is present after fight, restore it over weak fallback.
    const afterVisible = ebsf201VisibleIntel();
    if(p && before && ebsf201SourceRank(before) > ebsf201SourceRank(getIntel(p.id))){
      saveIntel(p.id, before);
    } else if(p && afterVisible) {
      saveIntel(p.id, afterVisible);
    }

    setTimeout(()=>paintAll(true), 400);
    setTimeout(()=>paintAll(true), 1500);
  };

  // Better attack-log result detection from screenshots:
  const ebsf201OldResultFromText = resultFromText;
  resultFromText = function(raw){
    const t = String(raw || '').replace(/\s+/g, ' ');
    const me = app.user?.name ? app.user.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
    if(me && new RegExp(me + '\\s+lost\\s+to\\s+', 'i').test(t)) return 'generic_loss';
    if(me && new RegExp(me + '\\s+won\\s+against\\s+', 'i').test(t)) return 'generic_win';
    if(/YOU LOST/i.test(t)) return 'generic_loss';
    if(/YOU WON|VICTORY/i.test(t)) return 'generic_win';
    return ebsf201OldResultFromText(raw);
  };

  setTimeout(()=>paintAll(true), 800);
  setTimeout(()=>paintAll(true), 2500);



  /* v2.0.2 clickable intel popup + profile-only app icon */

  function ebsf202IsProfilePage(){
    const txt = (document.body?.innerText || '').slice(0, 5000);
    return /profiles\.php/.test(location.href) || /Profile/i.test(document.title || '') || /User Information|Medals|Awards|Actions/i.test(txt);
  }

  function ebsf202UpdateMainIconVisibility(){
    const btn = document.getElementById('ebsf2-btn');
    if(!btn) return;
    btn.style.display = ebsf202IsProfilePage() ? 'block' : 'none';
  }

  function ebsf202Relation(total){
    total = Number(total || 0);
    if(!app.total || !total) return 'Unknown';
    const r = total / app.total;
    if(r <= .75) return 'Low';
    if(r <= 1.15) return 'Equal';
    return 'High';
  }

  function ebsf202ParseFFVisibleInfo(){
    const txt = (document.body?.innerText || '').replace(/\s+/g, ' ');
    const out = {};
    let m = txt.match(/FairFight:\s*([0-9.]+[^E]*?)(?=\s*Est\.|\s*Stats:|\s*$)/i);
    if(m) out.fair_fight = m[1].trim();
    m = txt.match(/Est\.?\s*Stats:\s*([0-9.,]+\s*[kmbt]?)/i) || txt.match(/Estimated\s*Stats:\s*([0-9.,]+\s*[kmbt]?)/i);
    if(m) out.estimated_stats = m[1].trim();
    return out;
  }

  function ebsf202CompareStat(enemy, mine){
    enemy = Number(enemy || 0);
    mine = Number(mine || 0);
    if(!enemy || !mine) return 'Unknown';
    const r = enemy / mine;
    if(r < .85) return 'Low';
    if(r <= 1.15) return 'Equal';
    return 'High';
  }

  function ebsf202ShapeFromIntel(intel){
    const shape = {STR:'Unknown', DEF:'Unknown', SPD:'Unknown', DEX:'Unknown'};
    if(intel?.strength || intel?.str_stat) shape.STR = ebsf202CompareStat(intel.strength || intel.str_stat, app.str_stat || 0);
    if(intel?.defense || intel?.def_stat) shape.DEF = ebsf202CompareStat(intel.defense || intel.def_stat, app.def_stat || 0);
    if(intel?.speed || intel?.spd_stat) shape.SPD = ebsf202CompareStat(intel.speed || intel.spd_stat, app.spd_stat || 0);
    if(intel?.dexterity || intel?.dex_stat) shape.DEX = ebsf202CompareStat(intel.dexterity || intel.dex_stat, app.dex_stat || 0);
    return shape;
  }

  function ebsf202MakePopup(targetId, intel, anchor){
    document.querySelectorAll('.ebsf2-pop').forEach(x=>x.remove());

    const ff = ebsf202ParseFFVisibleInfo();
    const total = Number(intel?.best_total || intel?.total || 0);
    const shape = ebsf202ShapeFromIntel(intel || {});
    const rel = ebsf202Relation(total);

    const pop = document.createElement('div');
    pop.className = 'ebsf2-pop';
    pop.innerHTML = `
      <div class="ebsf2-pop-head">
        <b>⚔️ Battle Intel</b>
        <button class="ebsf2-pop-close">×</button>
      </div>
      <div class="ebsf2-pop-body">
        <div><b>Total:</b> ${total ? fmt(total) : 'N/A'} <span class="ebsf2-pill">${rel}</span></div>
        <div><b>Source:</b> ${esc(intel?.source || 'none')}</div>
        <div><b>Confidence:</b> ${Math.round(Number(intel?.confidence || 0))}%</div>
        ${ff.fair_fight ? `<div><b>FF:</b> ${esc(ff.fair_fight)}</div>` : ''}
        ${ff.estimated_stats ? `<div><b>FF Est:</b> ${esc(ff.estimated_stats)}</div>` : ''}
        <hr>
        <div class="ebsf2-shape">
          <div><b>STR</b><span>${shape.STR}</span></div>
          <div><b>DEF</b><span>${shape.DEF}</span></div>
          <div><b>SPD</b><span>${shape.SPD}</span></div>
          <div><b>DEX</b><span>${shape.DEX}</span></div>
        </div>
        <p class="ebsf2-note">Stat split needs spy/manual split or more detailed fight-log learning. FF/BSP gives a total estimate, not always exact STR/DEF/SPD/DEX.</p>
      </div>
    `;

    document.body.appendChild(pop);
    const r = anchor?.getBoundingClientRect?.();
    if(r){
      pop.style.left = Math.max(8, Math.min(window.innerWidth - 260, r.left)) + 'px';
      pop.style.top = Math.max(80, Math.min(window.innerHeight - 250, r.bottom + 6)) + 'px';
    } else {
      pop.style.left = '12px';
      pop.style.top = '120px';
    }

    pop.querySelector('.ebsf2-pop-close').onclick = ()=>pop.remove();
    setTimeout(()=>{
      document.addEventListener('click', function closer(e){
        if(!pop.contains(e.target) && !e.target.closest('.ebsf2-badge')){
          pop.remove();
          document.removeEventListener('click', closer, true);
        }
      }, true);
    }, 100);
  }

  function ebsf202BadgeIntelFromElement(badge){
    const id = badge.dataset.targetId || '';
    if(id && getIntel(id)) return {id, intel:getIntel(id)};

    const total = parseNum(badge.textContent || '');
    if(total) return {id, intel:{total,best_total:total,label:label(total),confidence:0,source:'badge'}};

    return {id, intel:null};
  }

  function ebsf202InstallBadgeClick(){
    if(window.__ebsf202BadgeClick) return;
    window.__ebsf202BadgeClick = true;

    document.addEventListener('click', e=>{
      const b = e.target.closest?.('.ebsf2-badge');
      if(!b) return;
      e.preventDefault();
      e.stopPropagation();
      const got = ebsf202BadgeIntelFromElement(b);
      ebsf202MakePopup(got.id, got.intel, b);
    }, true);
  }

  function ebsf202SetBadgeTargetId(mount, badge){
    if(!badge) return;
    const row = mount.closest?.('tr,li,[class*="row"],[class*="member"]') || mount;
    const id = extractId([location.href, row?.innerHTML, mount?.innerHTML].filter(Boolean).join(' '));
    if(id) badge.dataset.targetId = String(id);
  }

  const ebsf202OldAttach = attach;
  attach = function(mount, intel){
    ebsf202OldAttach(mount, intel);
    const b = mount?.querySelector?.(':scope > .ebsf2-badge');
    if(b){
      b.style.pointerEvents = 'auto';
      b.style.cursor = 'pointer';
      b.title = (b.title || 'Battle Stat Finder') + ' • Tap for details';
      ebsf202SetBadgeTargetId(mount, b);
    }
  };

  const ebsf202OldVisibleIntel = visibleIntel;
  visibleIntel = function(){
    const intel = ebsf202OldVisibleIntel();
    if(!intel) return null;
    const ff = ebsf202ParseFFVisibleInfo();
    if(ff.fair_fight || ff.estimated_stats){
      intel.source = 'visible_ff_bsp';
      intel.source_detail = [ff.fair_fight ? `FF ${ff.fair_fight}` : '', ff.estimated_stats ? `Est ${ff.estimated_stats}` : ''].filter(Boolean).join(' • ');
      intel.confidence = Math.max(Number(intel.confidence || 0), 70);
    }
    return intel;
  };

  const ebsf202OldPaintAll = paintAll;
  paintAll = async function(force){
    await ebsf202OldPaintAll(force);
    ebsf202UpdateMainIconVisibility();
  };

  ebsf202InstallBadgeClick();
  ebsf202UpdateMainIconVisibility();
  setInterval(ebsf202UpdateMainIconVisibility, 1500);

})();
