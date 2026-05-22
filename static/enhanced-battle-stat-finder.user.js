// ==UserScript==
// @name         Enhanced Battle Stat Finder v2
// @namespace    Fries91.Torn.BattleStatFinder
// @version      2.1.0
// @description  Advanced Battle Stat Predictor with draggable profile icon, clean honor-only badges, scrollable Feed the Finder panel, and difficulty-based colors.
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
    #ebsf2-btn{display:none;position:fixed;left:18px;bottom:116px;z-index:999996;width:54px;height:54px;border-radius:10px;border:1px solid #806500;background:#111827;color:#fde68a;font-size:28px;box-shadow:0 2px 10px #000c}
    #ebsf2-panel{position:fixed;left:8px;right:8px;top:188px;max-height:70vh;overflow:auto;z-index:999997;background:#0b1120;color:#e5e7eb;border:1px solid #806500;border-radius:14px;box-shadow:0 6px 22px #000d;font-family:Arial,sans-serif;display:none}
    #ebsf2-panel.open{display:block}
    #ebsf2-panel h2{margin:0;padding:12px 14px;color:#facc15;font-size:18px;background:#020617;border-radius:14px 14px 0 0}
    #ebsf2-panel .body{padding:12px}
    #ebsf2-panel input{box-sizing:border-box;width:100%;background:#020617;color:#f8fafc;border:1px solid #374151;border-radius:8px;padding:9px;margin:6px 0}
    #ebsf2-panel button{background:#1f2937;color:#fde68a;border:1px solid #806500;border-radius:8px;padding:8px 10px;margin:4px;font-weight:900}
    #ebsf2-panel .box{background:#111827;border:1px solid #334155;border-radius:10px;padding:10px;margin:8px 0}
    #ebsf2-save{display:none!important}

    .ebsf2-pop{position:fixed;z-index:999999;background:#0b1120;color:#e5e7eb;border:1px solid #806500;border-radius:12px;box-shadow:0 6px 22px #000d;width:250px;font:12px Arial,sans-serif;overflow:hidden}
    .ebsf2-pop-head{display:flex;justify-content:space-between;align-items:center;background:#020617;color:#facc15;padding:8px 10px}
    .ebsf2-pop-close{background:#1f2937!important;color:#facc15!important;border:1px solid #806500!important;border-radius:6px!important;padding:1px 6px!important;margin:0!important}
    .ebsf2-pop-body{padding:10px;line-height:1.45}
    .ebsf2-pill{display:inline-block;margin-left:4px;padding:1px 5px;border:1px solid #475569;border-radius:999px;background:#111827;color:#fde68a;font-weight:900}
    .ebsf2-shape{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:6px}
    .ebsf2-shape div{background:#111827;border:1px solid #334155;border-radius:8px;padding:5px;display:flex;justify-content:space-between}
    .ebsf2-note{color:#94a3b8;font-size:11px;margin:8px 0 0}

    .ebsf2-tag{display:inline-flex;align-items:center;justify-content:center;min-width:54px;padding:2px 6px;border-radius:999px;font-weight:900;border:1px solid #64748b;background:#111827;color:#cbd5e1}
    .ebsf2-tag-red{background:#450a0a!important;color:#fca5a5!important;border-color:#ef4444!important}
    .ebsf2-tag-green{background:#052e16!important;color:#86efac!important;border-color:#22c55e!important}
    .ebsf2-tag-blue{background:#172554!important;color:#93c5fd!important;border-color:#3b82f6!important}
    .ebsf2-tag-grey{background:#111827!important;color:#cbd5e1!important;border-color:#64748b!important}

    .ebsf2-tag-orange{background:#431407!important;color:#fdba74!important;border-color:#f97316!important}
    .ebsf2-tag-yellow{background:#422006!important;color:#fde68a!important;border-color:#facc15!important}

    .ebsf2-conf{display:inline-flex;align-items:center;justify-content:center;margin-left:5px;padding:2px 7px;border-radius:999px;font-weight:900;border:1px solid #64748b}



    #ebsf2-panel.feed-theme{background:linear-gradient(145deg,#05070d 0%,#0b1220 55%,#111827 100%)!important;border:1px solid rgba(250,204,21,.55)!important;border-radius:22px!important;box-shadow:0 0 0 1px rgba(250,204,21,.12),0 18px 45px #000f, inset 0 0 24px rgba(59,130,246,.08)!important;overflow:hidden}
    #ebsf2-panel.feed-theme h2{position:relative;background:radial-gradient(circle at top left,rgba(250,204,21,.22),transparent 38%),linear-gradient(90deg,#020617,#0f172a 70%,#111827)!important;border-bottom:1px solid rgba(250,204,21,.35)!important;color:#fde68a!important;text-transform:uppercase;letter-spacing:.8px;text-shadow:0 0 8px rgba(250,204,21,.25)}
    .ebsf-feed-hero{margin:0 0 10px;padding:14px;border:1px solid rgba(250,204,21,.35);border-radius:18px;background:linear-gradient(135deg,rgba(250,204,21,.12),rgba(59,130,246,.08) 55%,rgba(15,23,42,.9));box-shadow:inset 0 0 18px rgba(250,204,21,.06)}
    .ebsf-feed-title{font-size:22px;font-weight:1000;color:#facc15;letter-spacing:.5px;text-transform:uppercase}
    .ebsf-feed-sub{color:#cbd5e1;margin-top:4px;line-height:1.35}
    .ebsf-feed-grid{display:grid;grid-template-columns:1fr;gap:10px}
    .ebsf-feed-card{position:relative;padding:12px 12px 12px 14px;border-radius:18px;background:linear-gradient(145deg,rgba(15,23,42,.96),rgba(2,6,23,.96));border:1px solid rgba(148,163,184,.25);box-shadow:inset 3px 0 0 rgba(250,204,21,.55),0 6px 14px rgba(0,0,0,.35)}
    .ebsf-feed-card:before{content:"";position:absolute;inset:0;border-radius:18px;background:radial-gradient(circle at top right,rgba(59,130,246,.12),transparent 42%);pointer-events:none}
    .ebsf-feed-card b{display:block;color:#fde68a;font-size:14px;margin-bottom:7px;text-transform:uppercase;letter-spacing:.3px}
    .ebsf-feed-card p,.ebsf-feed-card li{color:#dbeafe;line-height:1.42}
    .ebsf-feed-card ul{margin:7px 0 0 18px;padding:0}
    .ebsf-feed-login{border-color:rgba(250,204,21,.48)!important;background:linear-gradient(145deg,rgba(30,41,59,.96),rgba(2,6,23,.98))!important;box-shadow:inset 0 0 18px rgba(250,204,21,.05),0 8px 18px rgba(0,0,0,.42)!important}
    .ebsf-feed-status{margin-top:8px;padding:8px;border-radius:12px;background:rgba(2,6,23,.72);border:1px solid rgba(59,130,246,.25);color:#bfdbfe!important}
    .ebsf-feed-chip{display:inline-flex;align-items:center;gap:4px;margin:3px 4px 0 0;padding:3px 7px;border-radius:999px;background:#020617;border:1px solid rgba(250,204,21,.32);color:#fde68a;font-weight:900;font-size:11px}
    #ebsf2-panel.feed-theme input{border-radius:14px!important;border:1px solid rgba(250,204,21,.28)!important;background:#020617!important}
    #ebsf2-panel.feed-theme button{border-radius:14px!important;background:linear-gradient(180deg,#2a2110,#111827)!important;border:1px solid rgba(250,204,21,.52)!important;color:#fde68a!important;box-shadow:0 4px 12px rgba(0,0,0,.35)}


    /* v2.1.0 css fixes */

    #ebsf2-panel{top:74px!important;bottom:66px!important;max-height:none!important;overflow:hidden!important}
    #ebsf2-panel .body{max-height:calc(100vh - 165px)!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;padding-bottom:24px!important}
    #ebsf2-btn{width:42px!important;height:42px!important;font-size:22px!important;border-radius:9px!important;touch-action:none!important}
    .ebsf2-fair{background:#422006!important;color:#fde68a!important;border-color:#facc15!important}
    .ebsf2-difficult{background:#431407!important;color:#fdba74!important;border-color:#f97316!important}
    .ebsf2-avoid{background:#450a0a!important;color:#fca5a5!important;border-color:#ef4444!important}
    .ebsf2-low{background:#172554!important;color:#93c5fd!important;border-color:#3b82f6!important}

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
      if(id){ remember(id,(row?.textContent||'Enemy').trim().slice(0,40)); /* silent: target remembered */ }
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



  /* v2.0.3 colored popup chips */

  function ebsf203ClassForValue(v){
    v = String(v || 'Unknown').toLowerCase();
    if(v.includes('high') || v.includes('heavy')) return 'ebsf2-tag-red';
    if(v.includes('equal')) return 'ebsf2-tag-green';
    if(v.includes('low') || v.includes('light')) return 'ebsf2-tag-blue';
    return 'ebsf2-tag-grey';
  }

  function ebsf203ClassForConfidence(conf){
    conf = Number(conf || 0);
    if(conf >= 70) return 'ebsf2-tag-green';
    if(conf >= 45) return 'ebsf2-tag-blue';
    return 'ebsf2-tag-red';
  }

  function ebsf203Tag(v){
    const val = v || 'Unknown';
    return `<span class="ebsf2-tag ${ebsf203ClassForValue(val)}">${esc(val)}</span>`;
  }

  function ebsf203Conf(conf){
    const c = Math.round(Number(conf || 0));
    return `<span class="ebsf2-conf ${ebsf203ClassForConfidence(c)}">${c}%</span>`;
  }

  function ebsf203RelationTag(total){
    const rel = ebsf202Relation ? ebsf202Relation(total) : 'Unknown';
    return ebsf203Tag(rel);
  }

  // Override popup with colored High/Equal/Low/Unknown and confidence colors.
  if(typeof ebsf202MakePopup === 'function'){
    ebsf202MakePopup = function(targetId, intel, anchor){
      document.querySelectorAll('.ebsf2-pop').forEach(x=>x.remove());

      const ff = ebsf202ParseFFVisibleInfo ? ebsf202ParseFFVisibleInfo() : {};
      const total = Number(intel?.best_total || intel?.total || 0);
      const shape = ebsf202ShapeFromIntel ? ebsf202ShapeFromIntel(intel || {}) : {STR:'Unknown',DEF:'Unknown',SPD:'Unknown',DEX:'Unknown'};
      const source = intel?.source || 'none';
      const conf = Number(intel?.confidence || 0);

      const armor = intel?.armor_signal || intel?.armor || 'Unknown';
      const temp = intel?.temp_seen || intel?.temp || 'Unknown';

      const pop = document.createElement('div');
      pop.className = 'ebsf2-pop';
      pop.innerHTML = `
        <div class="ebsf2-pop-head">
          <b>⚔️ Battle Intel</b>
          <button class="ebsf2-pop-close">×</button>
        </div>
        <div class="ebsf2-pop-body">
          <div><b>Total:</b> ${total ? fmt(total) : 'N/A'} ${ebsf203RelationTag(total)}</div>
          <div><b>Source:</b> ${esc(source)}</div>
          <div><b>Confidence:</b> ${ebsf203Conf(conf)}</div>
          ${ff.fair_fight ? `<div><b>FF:</b> ${esc(ff.fair_fight)}</div>` : ''}
          ${ff.estimated_stats ? `<div><b>FF Est:</b> ${esc(ff.estimated_stats)}</div>` : ''}
          <hr>
          <div class="ebsf2-shape">
            <div><b>STR</b>${ebsf203Tag(shape.STR)}</div>
            <div><b>DEF</b>${ebsf203Tag(shape.DEF)}</div>
            <div><b>SPD</b>${ebsf203Tag(shape.SPD)}</div>
            <div><b>DEX</b>${ebsf203Tag(shape.DEX)}</div>
            <div><b>Armor</b>${ebsf203Tag(armor)}</div>
            <div><b>Temp</b>${ebsf203Tag(temp)}</div>
          </div>
          <p class="ebsf2-note">Colors: High/Heavy red, Equal green, Low/Light blue, Unknown grey. Confidence: high green, mid blue, low red.</p>
        </div>
      `;

      document.body.appendChild(pop);
      const r = anchor?.getBoundingClientRect?.();
      if(r){
        pop.style.left = Math.max(8, Math.min(window.innerWidth - 270, r.left)) + 'px';
        pop.style.top = Math.max(80, Math.min(window.innerHeight - 270, r.bottom + 6)) + 'px';
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
    };
  }



  /* v2.0.4 Silent background mode
     - No target remembered toast
     - No saved data toast
     - No Save Last Fight backup box
     - No debug box in overlay
     - Learning still runs in the background
  */

  window.EBSF2_SILENT_MODE = true;

  function ebsf204CleanUI(){
    const save = document.getElementById('ebsf2-save');
    if(save) save.style.display = 'none';

    // Remove any old toast-like boxes from earlier versions.
    document.querySelectorAll('[data-ebsf-toast], .ebsf-toast').forEach(x=>x.remove());
  }

  // Override visible toast function to be silent.
  if(typeof alertToast === 'function'){
    alertToast = function(msg){
      // intentionally silent
    };
  }

  // Keep debug data internal, but do not show it.
  const ebsf204OldDbg = typeof dbg === 'function' ? dbg : null;
  if(ebsf204OldDbg){
    dbg = function(k,v){
      try{ ebsf204OldDbg(k,v); }catch(e){}
      // no UI message
    };
  }

  // Override render to remove debug box and hide save-last-fight area.
  const ebsf204OldRender = render;
  render = function(){
    ebsf204OldRender();

    const panel = document.getElementById('ebsf2-panel');
    if(panel){
      // Remove Debug section created by older render.
      [...panel.querySelectorAll('.box')].forEach(box=>{
        const txt = (box.textContent || '').trim();
        if(/^Debug\b/i.test(txt) || /Remembered:|Result detected:|Saved:/i.test(txt)){
          box.remove();
        }
      });

      // Replace wording to make it clear learning is background-only.
      [...panel.querySelectorAll('.box')].forEach(box=>{
        if((box.textContent || '').includes('How it works')){
          box.innerHTML = `
            <b>How it works</b><br>
            Badges show N/A until there is usable intel. FF/BSP visible estimates are used when readable. Fight learning runs quietly in the background and improves over time.
          `;
        }
      });
    }

    ebsf204CleanUI();
  };

  // Override backup box display; no manual buttons.
  if(typeof watchFight === 'function'){
    const ebsf204OldWatchFight = watchFight;
    watchFight = function(){
      ebsf204OldWatchFight();
      const save = document.getElementById('ebsf2-save');
      if(save) save.style.display = 'none';
      // keep hiding it in case old timeout tries to show it
      setTimeout(ebsf204CleanUI, 19000);
      setTimeout(ebsf204CleanUI, 26000);
    };
  }

  // Override saveFight to avoid visible status spam; still saves and repaints.
  if(typeof saveFight === 'function'){
    const ebsf204OldSaveFight = saveFight;
    saveFight = async function(result, manual){
      const oldMsg = app.msg;
      await ebsf204OldSaveFight(result, manual);
      app.msg = oldMsg || 'Learning quietly in background.';
      ebsf204CleanUI();
      setTimeout(()=>paintAll?.(true), 500);
      setTimeout(()=>paintAll?.(true), 1600);
    };
  }

  // Strictly hide the old manual save box forever.
  const ebsf204HideInterval = setInterval(ebsf204CleanUI, 1500);

  setTimeout(()=>render?.(), 500);



  /* v2.0.5 Force profile-page-only main icon
     Prediction badges still show on faction/war/profile honor bars.
     Only the large ⚔️ launcher icon is hidden outside profile pages.
  */

  function ebsf205IsRealProfilePage(){
    const url = location.href;
    const title = document.title || '';
    const text = (document.body?.innerText || '').slice(0, 5000);

    if(/factions\.php/i.test(url)) return false;
    if(/Faction|Members\s+Score|Status\s+Attack|Lead Target|No active chain|Chain active/i.test(title + ' ' + text)) {
      // PDA sometimes leaves "Profile" in title weirdly, so faction markers win.
      if(/Members\s+Score|Status\s+Attack|Lead Target/i.test(text)) return false;
    }

    return /profiles\.php/i.test(url) ||
           /'s Profile/i.test(title) ||
           /User Information|Medals|Awards|Actions/i.test(text);
  }

  function ebsf205ForceIconVisibility(){
    const btn = document.getElementById('ebsf2-btn');
    if(!btn) return;
    btn.style.display = ebsf205IsRealProfilePage() ? 'block' : 'none';
  }

  // Override earlier profile check if it exists.
  if(typeof ebsf202IsProfilePage === 'function'){
    ebsf202IsProfilePage = ebsf205IsRealProfilePage;
  }

  if(typeof ebsf202UpdateMainIconVisibility === 'function'){
    ebsf202UpdateMainIconVisibility = ebsf205ForceIconVisibility;
  }

  const ebsf205OldPaintAll = typeof paintAll === 'function' ? paintAll : null;
  if(ebsf205OldPaintAll){
    paintAll = async function(force){
      const result = await ebsf205OldPaintAll(force);
      ebsf205ForceIconVisibility();
      return result;
    };
  }

  ebsf205ForceIconVisibility();
  setTimeout(ebsf205ForceIconVisibility, 500);
  setTimeout(ebsf205ForceIconVisibility, 1500);
  setInterval(ebsf205ForceIconVisibility, 1000);



  /* v2.0.6 Clean main icon panel:
     Only Rules, How It Works, ToS, API Key Use/Storage, then Login at bottom.
  */

  function ebsf206RenderCleanPanel(){
    const panel = document.getElementById('ebsf2-panel');
    if(!panel) return;

    panel.className = app.open ? 'open' : '';
    panel.innerHTML = `
      <h2>⚔️ Battle Stat Finder <button style="float:right" id="ebsf2-close">Close</button></h2>
      <div class="body">
        <div class="box">
          <b>📜 Rules</b><br>
          <ul style="margin:8px 0 0 18px;padding:0;line-height:1.45">
            <li>Use this as a prediction helper, not a guaranteed outcome.</li>
            <li>Do not share another player’s private spy/manual data unless you are allowed to.</li>
            <li>Predictions need time to learn and improve.</li>
            <li>Respect Torn’s rules, API limits, and fair-use expectations.</li>
          </ul>
        </div>

        <div class="box">
          <b>⚔️ How It Works</b><br>
          <p style="margin:8px 0 0;line-height:1.45">
            The app shows a small stat badge on player honor bars. Tap the badge to see the intel popup.
            It can use visible FF/BSP estimates when readable, stored backend intel, and quiet fight-learning signals.
            New targets may show <b>N/A</b> until enough information is available.
          </p>
          <p style="margin:8px 0 0;line-height:1.45">
            The app improves over time as more users fight, scan, and gather estimates. One fight gives a rough signal;
            multiple fights and stronger sources make predictions better.
          </p>
        </div>

        <div class="box">
          <b>✅ Terms of Service</b><br>
          <p style="margin:8px 0 0;line-height:1.45">
            By using this tool, you understand that all numbers are estimates and may be wrong.
            You are responsible for your own attacks, choices, and risk. The app does not guarantee wins,
            respect gains, or exact enemy stats.
          </p>
          <p style="margin:8px 0 0;line-height:1.45">
            This tool is intended to organize information already visible to you, information you provide,
            or estimates collected through allowed API/visible-page use.
          </p>
        </div>

        <div class="box">
          <b>🔑 API Key Use & Storage</b><br>
          <p style="margin:8px 0 0;line-height:1.45">
            Use a <b>limited Torn API key</b>. Your key is saved locally in your browser/PDA userscript storage so the
            script can log you in and detect your own battle stats for comparison.
          </p>
          <p style="margin:8px 0 0;line-height:1.45">
            The backend uses your key only when needed for login/stat detection or optional estimate lookups.
            No Torn password is ever requested. The app is designed around limited-key use and avoids asking for
            unnecessary access.
          </p>
          <p style="margin:8px 0 0;line-height:1.45">
            To stay aligned with Torn’s API rules, the script should not spam requests, should respect rate limits,
            and should only use data the user is allowed to access.
          </p>
        </div>

        <div class="box">
          <b>Login</b><br>
          <input id="ebsf2-key" type="password" placeholder="Torn limited API key" value="${esc(app.key || '')}">
          <label style="display:block;margin:8px 0">
            <input id="ebsf2-ff" type="checkbox" ${app.ff?'checked':''} style="width:auto">
            Use FF Scouter base intel when available
          </label>
          <button id="ebsf2-login">Login / Save</button>
          <button id="ebsf2-repaint">Repaint badges</button>
          <div style="margin-top:8px;color:#cbd5e1">
            Status: ${app.user?.name ? `${esc(app.user.name)} [${esc(app.user.user_id)}] • ${fmt(app.total)}` : 'Not logged in'}
          </div>
        </div>
      </div>
    `;

    const close = panel.querySelector('#ebsf2-close');
    if(close) close.onclick = ()=>{ app.open=false; render(); };

    const loginBtn = panel.querySelector('#ebsf2-login');
    if(loginBtn) loginBtn.onclick = login;

    const repaintBtn = panel.querySelector('#ebsf2-repaint');
    if(repaintBtn) repaintBtn.onclick = ()=>paintAll?.(true);

    ebsf205ForceIconVisibility?.();
  }

  render = ebsf206RenderCleanPanel;

  setTimeout(()=>render?.(), 250);



  /* v2.0.7 Feed Me Info themed main panel */

  function ebsf207RenderFeedPanel(){
    const panel = document.getElementById('ebsf2-panel');
    if(!panel) return;

    panel.className = app.open ? 'open feed-theme' : 'feed-theme';
    panel.innerHTML = `
      <h2>🍽️ FEED ME INFO <button style="float:right" id="ebsf2-close">Close</button></h2>
      <div class="body">
        <div class="ebsf-feed-hero">
          <div class="ebsf-feed-title">Feed the Finder</div>
          <div class="ebsf-feed-sub">
            Give it clean intel, let it chew through fights, and watch the badges get smarter over time.
          </div>
          <div style="margin-top:8px">
            <span class="ebsf-feed-chip">silent learning</span>
            <span class="ebsf-feed-chip">honor badges</span>
            <span class="ebsf-feed-chip">tap for intel</span>
          </div>
        </div>

        <div class="ebsf-feed-grid">
          <div class="ebsf-feed-card">
            <b>📜 Rules</b>
            <ul>
              <li>Use predictions as guidance, not guaranteed wins.</li>
              <li>Do not share private spy/manual data unless you are allowed to.</li>
              <li>Fresh intel is better. Old intel may be wrong.</li>
              <li>Respect Torn’s API rules, rate limits, and fair-use expectations.</li>
            </ul>
          </div>

          <div class="ebsf-feed-card">
            <b>⚔️ How It Works</b>
            <p>
              The finder places small stat badges on player honor bars. Tap a badge to open the mini intel popup.
              It can read visible FF/BSP estimates, saved backend intel, and quiet fight-learning signals.
            </p>
            <p>
              New targets may show <b>N/A</b>. Feed it more info through scans, visible estimates, and fights so it can grow.
            </p>
          </div>

          <div class="ebsf-feed-card">
            <b>✅ Terms of Service</b>
            <p>
              All numbers are estimates and may be wrong. You are responsible for your own attacks, choices,
              losses, wins, and respect gains.
            </p>
            <p>
              This tool organizes information visible to you, provided by you, or gathered through allowed limited-key use.
            </p>
          </div>

          <div class="ebsf-feed-card">
            <b>🔑 API Key Use & Storage</b>
            <p>
              Use a <b>limited Torn API key</b>. Your key is stored locally in your browser/PDA userscript storage
              so the script can log you in and compare targets against your own battle stats.
            </p>
            <p>
              No Torn password is ever requested. The backend uses the key only for login/stat detection or optional
              estimate support. The script avoids unnecessary API access and is built around limited-key use.
            </p>
          </div>

          <div class="ebsf-feed-card ebsf-feed-login">
            <b>🍟 Login — Feed Me Your Key</b>
            <input id="ebsf2-key" type="password" placeholder="Torn limited API key" value="${esc(app.key || '')}">
            <label style="display:block;margin:8px 0;color:#dbeafe">
              <input id="ebsf2-ff" type="checkbox" ${app.ff?'checked':''} style="width:auto">
              Use FF Scouter base intel when available
            </label>
            <button id="ebsf2-login">Login / Save</button>
            <button id="ebsf2-repaint">Repaint badges</button>
            <div class="ebsf-feed-status">
              Status: ${app.user?.name ? `${esc(app.user.name)} [${esc(app.user.user_id)}] • ${fmt(app.total)}` : 'Not logged in'}
            </div>
          </div>
        </div>
      </div>
    `;

    const close = panel.querySelector('#ebsf2-close');
    if(close) close.onclick = ()=>{ app.open=false; render(); };

    const loginBtn = panel.querySelector('#ebsf2-login');
    if(loginBtn) loginBtn.onclick = login;

    const repaintBtn = panel.querySelector('#ebsf2-repaint');
    if(repaintBtn) repaintBtn.onclick = ()=>paintAll?.(true);

    ebsf205ForceIconVisibility?.();
  }

  render = ebsf207RenderFeedPanel;
  setTimeout(()=>render?.(), 250);



  /* v2.0.8 fixes:
     - Prediction boxes remain on faction/war rows.
     - Big main icon only shows on the logged-in user's own profile.
     - Closing intel popup does not remove the prediction badge.
  */

  function ebsf208OwnProfileId(){
    const id = extractId(location.href) || extractId(document.body?.innerHTML || '');
    return id ? Number(id) : null;
  }

  function ebsf208IsOwnProfilePage(){
    const text = (document.body?.innerText || '').slice(0, 5000);
    if(/factions\.php/i.test(location.href)) return false;
    if(/Members\s+Score|Status\s+Attack|Lead Target|Chain active|No active chain/i.test(text)) return false;
    if(!(/profiles\.php/i.test(location.href) || /Profile/i.test(document.title || '') || /User Information|Actions|Medals|Awards/i.test(text))) return false;

    const me = Number(app.user?.user_id || 0);
    if(!me) return false;

    const pid = ebsf208OwnProfileId();
    if(pid) return pid === me;

    // PDA may hide XID on own profile; fall back to title/name match only when no visible XID.
    const title = document.title || '';
    if(app.user?.name && title.toLowerCase().includes(String(app.user.name).toLowerCase())) return true;

    return false;
  }

  function ebsf208ForceMainIcon(){
    const btn = document.getElementById('ebsf2-btn');
    if(!btn) return;
    btn.style.display = ebsf208IsOwnProfilePage() ? 'block' : 'none';
  }

  // Override old icon visibility checks.
  if(typeof ebsf202IsProfilePage === 'function') ebsf202IsProfilePage = ebsf208IsOwnProfilePage;
  if(typeof ebsf205IsRealProfilePage === 'function') ebsf205IsRealProfilePage = ebsf208IsOwnProfilePage;
  if(typeof ebsf202UpdateMainIconVisibility === 'function') ebsf202UpdateMainIconVisibility = ebsf208ForceMainIcon;
  if(typeof ebsf205ForceIconVisibility === 'function') ebsf205ForceIconVisibility = ebsf208ForceMainIcon;

  // Strong faction row painter that does not depend on previous route wrappers.
  function ebsf208IsFactionWarPage(){
    const text = (document.body?.innerText || '').slice(0, 6000);
    return /factions\.php/i.test(location.href) || /Members\s+Score|Status\s+Attack|Lead Target|Chain active|No active chain/i.test(text);
  }

  async function ebsf208PaintFactionRows(){
    if(!ebsf208IsFactionWarPage()) return;

    const rows2 = rows ? rows() : [];
    for(const row of rows2){
      const cell = memberCell ? memberCell(row) : null;
      const mount = honorMount ? honorMount(cell) : null;
      if(!mount) continue;
      const intel = intelFor ? await intelFor(row, mount) : null;
      attach?.(mount, intel);
    }
  }

  // Patch popup close: remove only the popup, never badges.
  function ebsf208SafeClosePopups(){
    document.querySelectorAll('.ebsf2-pop').forEach(p=>p.remove());
  }

  // Override popup maker with a close handler that cannot catch/remove badges.
  if(typeof ebsf202MakePopup === 'function'){
    const ebsf208OldMakePopup = ebsf202MakePopup;
    ebsf202MakePopup = function(targetId, intel, anchor){
      ebsf208OldMakePopup(targetId, intel, anchor);
      const pop = document.querySelector('.ebsf2-pop');
      if(pop){
        const close = pop.querySelector('.ebsf2-pop-close');
        if(close){
          close.onclick = (ev)=>{
            ev.preventDefault();
            ev.stopPropagation();
            pop.remove();
            setTimeout(()=>paintAll?.(true), 100);
          };
        }
      }
    };
  }

  // Extra safety: if any close click happens, repaint badges shortly after.
  document.addEventListener('click', e=>{
    if(e.target.closest?.('.ebsf2-pop-close')){
      setTimeout(()=>paintAll?.(true), 150);
      setTimeout(()=>ebsf208PaintFactionRows(), 500);
    }
  }, true);

  // Wrap paintAll so faction row badges always return after PDA tab switching.
  const ebsf208OldPaintAll = typeof paintAll === 'function' ? paintAll : null;
  if(ebsf208OldPaintAll){
    paintAll = async function(force){
      const r = await ebsf208OldPaintAll(force);
      await ebsf208PaintFactionRows();
      ebsf208ForceMainIcon();
      return r;
    };
  }

  // Repaint faction rows on PDA route/tab changes and delayed loads.
  [400, 1200, 2500, 5000, 9000, 15000].forEach(t=>setTimeout(()=>{ ebsf208PaintFactionRows(); ebsf208ForceMainIcon(); }, t));
  setInterval(()=>{ ebsf208PaintFactionRows(); ebsf208ForceMainIcon(); }, 2500);

  try{
    if(!window.__ebsf208Obs){
      window.__ebsf208Obs = new MutationObserver(()=>{
        clearTimeout(window.__ebsf208Debounce);
        window.__ebsf208Debounce = setTimeout(()=>{ ebsf208PaintFactionRows(); ebsf208ForceMainIcon(); }, 400);
      });
      window.__ebsf208Obs.observe(document.body, {childList:true, subtree:true});
    }
  }catch(e){}

  ebsf208ForceMainIcon();



  /* v2.0.9 confidence color tiers:
     1-25 red
     26-45 orange
     46-65 yellow
     66-100 green
  */

  function ebsf209ClassForConfidence(conf){
    conf = Number(conf || 0);
    if(conf >= 66) return 'ebsf2-tag-green';
    if(conf >= 46) return 'ebsf2-tag-yellow';
    if(conf >= 26) return 'ebsf2-tag-orange';
    return 'ebsf2-tag-red';
  }

  function ebsf209Conf(conf){
    const c = Math.max(0, Math.min(100, Math.round(Number(conf || 0))));
    return `<span class="ebsf2-conf ${ebsf209ClassForConfidence(c)}">${c}%</span>`;
  }

  // Override earlier confidence function used by popup.
  if(typeof ebsf203ClassForConfidence === 'function'){
    ebsf203ClassForConfidence = ebsf209ClassForConfidence;
  }
  if(typeof ebsf203Conf === 'function'){
    ebsf203Conf = ebsf209Conf;
  }



  /* v2.1.0 fixes:
     - Difficulty colors: Easy green, Fair yellow, Difficult orange, Avoid red, Low blue.
     - Overlay scrolls so Login is reachable.
     - Prediction badges are only on player honor/name bars.
     - Feed hero stays funny, no "silent learning" chip.
     - Main title is Advanced Battle Stat Predictor.
     - Main icon is smaller and draggable.
  */

  function ebsf210DifficultyClass(labelText, total){
    const l = String(labelText || '').toLowerCase();
    if(l.includes('avoid')) return 'avoid';
    if(l.includes('difficult') || l.includes('hard')) return 'difficult';
    if(l.includes('fair') || l.includes('good')) return 'fair';
    if(l.includes('easy')) return 'easy';
    if(l.includes('low')) return 'low';
    if(total && app.total){
      const r = Number(total) / Number(app.total);
      if(r <= .75) return 'easy';
      if(r <= 1.15) return 'fair';
      if(r <= 1.75) return 'difficult';
      return 'avoid';
    }
    return 'unknown';
  }

  function ebsf210ColorText(labelText, total){
    const cls = ebsf210DifficultyClass(labelText, total);
    if(cls === 'easy') return 'Easy';
    if(cls === 'fair') return 'Fair';
    if(cls === 'difficult') return 'Difficult';
    if(cls === 'avoid') return 'Avoid';
    if(cls === 'low') return 'Low';
    return 'Unknown';
  }

  // Override badge coloring so difficulty matches your rules.
  if(typeof updateBadge === 'function'){
    updateBadge = function(b, intel){
      let n = Number(intel?.best_total || intel?.total || 0);
      let diff = ebsf210DifficultyClass(intel?.label, n);
      if(!n){
        b.className = 'ebsf2-badge';
        b.textContent = 'N/A';
        b.title = 'No intel yet';
        return;
      }
      b.className = 'ebsf2-badge ebsf2-' + diff;
      b.textContent = fmt(n);
      b.title = `${intel?.source || 'intel'} • ${ebsf210ColorText(intel?.label, n)} • ${Math.round(intel?.confidence || 0)}% • Tap for details`;
    };
  }

  // Override relation chip: Easy green, Fair yellow, Difficult orange, Avoid red.
  function ebsf210Relation(total){
    const diff = ebsf210DifficultyClass('', total);
    if(diff === 'easy') return 'Easy';
    if(diff === 'fair') return 'Fair';
    if(diff === 'difficult') return 'Difficult';
    if(diff === 'avoid') return 'Avoid';
    if(diff === 'low') return 'Low';
    return 'Unknown';
  }

  if(typeof ebsf202Relation === 'function'){
    ebsf202Relation = ebsf210Relation;
  }

  if(typeof ebsf203ClassForValue === 'function'){
    const oldValueClass = ebsf203ClassForValue;
    ebsf203ClassForValue = function(v){
      const l = String(v || '').toLowerCase();
      if(l.includes('avoid') || l.includes('high') || l.includes('heavy')) return 'ebsf2-tag-red';
      if(l.includes('difficult')) return 'ebsf2-tag-orange';
      if(l.includes('fair') || l.includes('equal')) return 'ebsf2-tag-yellow';
      if(l.includes('easy') || l.includes('green')) return 'ebsf2-tag-green';
      if(l.includes('low') || l.includes('light')) return 'ebsf2-tag-blue';
      return 'ebsf2-tag-grey';
    };
  }

  // Better confidence tier text stays exact from v2.0.9.
  if(typeof ebsf203ClassForConfidence === 'function'){
    ebsf203ClassForConfidence = function(conf){
      conf = Number(conf || 0);
      if(conf >= 66) return 'ebsf2-tag-green';
      if(conf >= 46) return 'ebsf2-tag-yellow';
      if(conf >= 26) return 'ebsf2-tag-orange';
      return 'ebsf2-tag-red';
    };
  }

  function ebsf210IsMemberRow(row){
    if(!row) return false;
    const text = (row.textContent || '').replace(/\s+/g,' ').trim();
    if(!text) return false;

    // Exclude headers/team panels/attack logs/history rows.
    if(/Members\s+Score\s+Status\s+Attack/i.test(text)) return false;
    if(/Cosa-?Nostra\s+vs|7DS\*:|Lead Target|No active chain|Chain active|Your faction is not in a war/i.test(text)) return false;
    if(/used 25 energy attacking|initiated an attack|lost to|won against|sprayed|fired .* rounds|hitting .* for/i.test(text)) return false;
    if(/^Members\b|^Score\b|^Status\b|^Attack\b/i.test(text)) return false;

    const hasStatus = /\bOkay\b|\bHospital\b|\bTravel\b|\bJail\b|\bAbroad\b/i.test(text);
    const hasAttack = /\bAttack\b/i.test(text);
    const hasNamePlate = !!row.querySelector?.('img,[style*="background-image"],[class*="honor"],[class*="name"],a[href*="profiles.php"]');
    const rect = row.getBoundingClientRect?.();

    return !!(rect && rect.width > 150 && rect.height > 18 && hasNamePlate && (hasStatus || hasAttack));
  }

  function ebsf210CleanBadBadges(){
    document.querySelectorAll('.ebsf2-badge').forEach(b=>{
      if(b.closest?.('.ebsf2-pop')) return;
      const row = b.closest?.('tr,li,[class*="row"],[class*="member"]');
      const isProfile = ebsf202IsProfilePage?.() || ebsf205IsRealProfilePage?.() || ebsf208IsOwnProfilePage?.();
      if(row){
        if(!ebsf210IsMemberRow(row)) b.remove();
        return;
      }
      // On non-profile pages, badges outside member rows are wrong.
      if(!isProfile) b.remove();
    });
  }

  // Strong faction row painter that only attaches to valid member rows.
  async function ebsf210PaintFactionRows(){
    const text = (document.body?.innerText || '').slice(0,6000);
    const isFaction = /factions\.php/i.test(location.href) || /Members\s+Score|Status\s+Attack|Lead Target|Chain active|No active chain/i.test(text);
    if(!isFaction) return;

    ebsf210CleanBadBadges();

    const allRows = [...document.querySelectorAll('tr,li,[class*="row"],[class*="member"]')].filter(ebsf210IsMemberRow).slice(0, 180);
    for(const row of allRows){
      const cell = memberCell ? memberCell(row) : null;
      const mount = honorMount ? honorMount(cell) : null;
      if(!mount) continue;
      const intel = intelFor ? await intelFor(row, mount) : null;
      attach?.(mount, intel);
    }

    ebsf210CleanBadBadges();
  }

  // Replace/augment paintAll so row badges return and bad badges disappear.
  const ebsf210OldPaintAll = typeof paintAll === 'function' ? paintAll : null;
  if(ebsf210OldPaintAll){
    paintAll = async function(force){
      const r = await ebsf210OldPaintAll(force);
      await ebsf210PaintFactionRows();
      ebsf210CleanBadBadges();
      ebsf210ForceOwnIcon();
      return r;
    };
  }

  function ebsf210RenderFeedPanel(){
    const panel = document.getElementById('ebsf2-panel');
    if(!panel) return;

    panel.className = app.open ? 'open feed-theme' : 'feed-theme';
    panel.innerHTML = `
      <h2>🧠⚔️ ADVANCED BATTLE STAT PREDICTOR <button style="float:right" id="ebsf2-close">Close</button></h2>
      <div class="body">
        <div class="ebsf-feed-hero">
          <div class="ebsf-feed-title">Feed the Finder</div>
          <div class="ebsf-feed-sub">
            Toss it intel snacks, let it chew through fights, and it may stop guessing like a drunk goblin.
          </div>
          <div style="margin-top:8px">
            <span class="ebsf-feed-chip">honor badges</span>
            <span class="ebsf-feed-chip">tap for intel</span>
            <span class="ebsf-feed-chip">gets smarter</span>
          </div>
        </div>

        <div class="ebsf-feed-grid">
          <div class="ebsf-feed-card">
            <b>📜 Rules</b>
            <ul>
              <li>Use predictions as guidance, not guaranteed wins.</li>
              <li>Do not share private spy/manual data unless you are allowed to.</li>
              <li>Fresh intel is tastier. Old intel may be stale.</li>
              <li>Respect Torn’s API rules, rate limits, and fair-use expectations.</li>
            </ul>
          </div>

          <div class="ebsf-feed-card">
            <b>⚔️ How It Works</b>
            <p>
              The predictor places small stat badges on player honor bars. Tap a badge to open the mini intel popup.
              It can use visible FF/BSP estimates, saved backend intel, and fight-learning signals.
            </p>
            <p>
              New targets may show <b>N/A</b>. Feed it more info through visible estimates and fights so it can grow teeth.
            </p>
          </div>

          <div class="ebsf-feed-card">
            <b>✅ Terms of Service</b>
            <p>
              All numbers are estimates and may be wrong. You are responsible for your own attacks, choices,
              losses, wins, and respect gains.
            </p>
            <p>
              This tool organizes information visible to you, provided by you, or gathered through allowed limited-key use.
            </p>
          </div>

          <div class="ebsf-feed-card">
            <b>🔑 API Key Use & Storage</b>
            <p>
              Use a <b>limited Torn API key</b>. Your key is stored locally in your browser/PDA userscript storage
              so the script can log you in and compare targets against your own battle stats.
            </p>
            <p>
              No Torn password is ever requested. The backend uses the key only for login/stat detection or optional
              estimate support. The script avoids unnecessary API access and is built around limited-key use.
            </p>
          </div>

          <div class="ebsf-feed-card ebsf-feed-login">
            <b>🍽️ Login — Feed the Beast</b>
            <input id="ebsf2-key" type="password" placeholder="Torn limited API key" value="${esc(app.key || '')}">
            <label style="display:block;margin:8px 0;color:#dbeafe">
              <input id="ebsf2-ff" type="checkbox" ${app.ff?'checked':''} style="width:auto">
              Use FF Scouter base intel when available
            </label>
            <button id="ebsf2-login">Login / Save</button>
            <button id="ebsf2-repaint">Repaint badges</button>
            <div class="ebsf-feed-status">
              Status: ${app.user?.name ? `${esc(app.user.name)} [${esc(app.user.user_id)}] • ${fmt(app.total)}` : 'Not logged in'}
            </div>
          </div>
        </div>
      </div>
    `;

    panel.querySelector('#ebsf2-close').onclick = ()=>{ app.open=false; render(); };
    panel.querySelector('#ebsf2-login').onclick = login;
    panel.querySelector('#ebsf2-repaint').onclick = ()=>paintAll?.(true);
    ebsf210ForceOwnIcon();
  }

  render = ebsf210RenderFeedPanel;

  function ebsf210IsOwnProfile(){
    const text = (document.body?.innerText || '').slice(0, 5000);
    if(/factions\.php/i.test(location.href)) return false;
    if(/Members\s+Score|Status\s+Attack|Lead Target|Chain active|No active chain/i.test(text)) return false;
    const me = Number(app.user?.user_id || 0);
    if(!me) return false;
    const pid = extractId?.(location.href) || extractId?.(document.body?.innerHTML || '');
    if(pid) return Number(pid) === me;
    const title = document.title || '';
    return !!(app.user?.name && title.toLowerCase().includes(String(app.user.name).toLowerCase()));
  }

  function ebsf210ForceOwnIcon(){
    const btn = document.getElementById('ebsf2-btn');
    if(!btn) return;
    btn.style.display = ebsf210IsOwnProfile() ? 'block' : 'none';
  }

  // Make main icon draggable and remember position.
  function ebsf210MakeIconDraggable(){
    const btn = document.getElementById('ebsf2-btn');
    if(!btn || btn.dataset.dragReady === '1') return;
    btn.dataset.dragReady = '1';

    const saved = safeJson(GM_getValue('ebsf2_icon_pos', 'null'));
    if(saved && saved.left != null && saved.top != null){
      btn.style.left = saved.left + 'px';
      btn.style.top = saved.top + 'px';
      btn.style.bottom = 'auto';
    }

    let dragging = false, sx = 0, sy = 0, startL = 0, startT = 0, moved = false;

    const down = (e)=>{
      const p = e.touches ? e.touches[0] : e;
      dragging = true; moved = false;
      sx = p.clientX; sy = p.clientY;
      const r = btn.getBoundingClientRect();
      startL = r.left; startT = r.top;
    };

    const move = (e)=>{
      if(!dragging) return;
      const p = e.touches ? e.touches[0] : e;
      const dx = p.clientX - sx, dy = p.clientY - sy;
      if(Math.abs(dx) + Math.abs(dy) > 5) moved = true;
      const left = Math.max(4, Math.min(window.innerWidth - btn.offsetWidth - 4, startL + dx));
      const top = Math.max(54, Math.min(window.innerHeight - btn.offsetHeight - 54, startT + dy));
      btn.style.left = left + 'px';
      btn.style.top = top + 'px';
      btn.style.bottom = 'auto';
      e.preventDefault?.();
    };

    const up = (e)=>{
      if(!dragging) return;
      dragging = false;
      GM_setValue('ebsf2_icon_pos', JSON.stringify({left: parseInt(btn.style.left || '18'), top: parseInt(btn.style.top || '120')}));
      if(moved){
        e.preventDefault?.();
        e.stopPropagation?.();
      }
    };

    btn.addEventListener('mousedown', down, true);
    btn.addEventListener('touchstart', down, {passive:false, capture:true});
    document.addEventListener('mousemove', move, true);
    document.addEventListener('touchmove', move, {passive:false, capture:true});
    document.addEventListener('mouseup', up, true);
    document.addEventListener('touchend', up, true);

    // Prevent accidental open after drag.
    const oldClick = btn.onclick;
    btn.onclick = (e)=>{
      if(moved){
        moved = false;
        return;
      }
      if(oldClick) oldClick(e);
    };
  }

  // Override old own icon checks too.
  if(typeof ebsf202IsProfilePage === 'function') ebsf202IsProfilePage = ebsf210IsOwnProfile;
  if(typeof ebsf205IsRealProfilePage === 'function') ebsf205IsRealProfilePage = ebsf210IsOwnProfile;
  if(typeof ebsf208IsOwnProfilePage === 'function') ebsf208IsOwnProfilePage = ebsf210IsOwnProfile;
  if(typeof ebsf202UpdateMainIconVisibility === 'function') ebsf202UpdateMainIconVisibility = ebsf210ForceOwnIcon;
  if(typeof ebsf205ForceIconVisibility === 'function') ebsf205ForceIconVisibility = ebsf210ForceOwnIcon;
  if(typeof ebsf208ForceMainIcon === 'function') ebsf208ForceMainIcon = ebsf210ForceOwnIcon;

  ebsf210MakeIconDraggable();
  ebsf210ForceOwnIcon();

  [400,1200,2500,5000,9000,15000].forEach(t=>setTimeout(()=>{ ebsf210PaintFactionRows(); ebsf210CleanBadBadges(); ebsf210ForceOwnIcon(); ebsf210MakeIconDraggable(); }, t));
  setInterval(()=>{ ebsf210PaintFactionRows(); ebsf210CleanBadBadges(); ebsf210ForceOwnIcon(); ebsf210MakeIconDraggable(); }, 2500);
  setTimeout(()=>render?.(), 300);

})();
