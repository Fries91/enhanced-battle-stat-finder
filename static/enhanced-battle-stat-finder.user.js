// ==UserScript==
// @name         Advanced Battle Stat Predictor Lite
// @namespace    Fries91.Torn.AdvancedBattleStatPredictor
// @version      2.1.2
// @description  Fast PDA-friendly battle stat predictor: lightweight honor-bar badges, own-profile icon, Feed the Finder panel, and quiet learning.
// @author       Fries91
// @match        https://www.torn.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      enhanced-battle-stat-finder.onrender.com
// @run-at       document-idle
// ==/UserScript==

(function(){
  'use strict';

  const BASE = 'https://enhanced-battle-stat-finder.onrender.com';
  const S = {
    key:'absp_key',
    user:'absp_user',
    total:'absp_total',
    stats:'absp_stats',
    cache:'absp_intel_cache',
    ff:'absp_ff_enabled',
    lastTarget:'absp_last_attack_target',
    icon:'absp_icon_pos'
  };

  const app = {
    key: GM_getValue(S.key,''),
    user: safeJson(GM_getValue(S.user,'null')),
    total: Number(GM_getValue(S.total,0)||0),
    stats: safeJson(GM_getValue(S.stats,'{}')) || {},
    ff: !!GM_getValue(S.ff,false),
    open:false
  };

  GM_addStyle(`
    .absp-badge{position:absolute!important;right:3px!important;top:2px!important;z-index:20!important;display:inline-flex!important;align-items:center;justify-content:center;min-width:32px;max-width:56px;padding:1px 5px!important;border-radius:5px!important;border:1px solid #64748b;background:#111827;color:#cbd5e1;font:900 9px Arial,sans-serif!important;line-height:1!important;box-shadow:0 1px 4px #0009;pointer-events:auto;cursor:pointer;white-space:nowrap;overflow:hidden}
    .absp-easy{background:#052e16!important;color:#86efac!important;border-color:#22c55e!important}
    .absp-fair{background:#422006!important;color:#fde68a!important;border-color:#facc15!important}
    .absp-difficult{background:#431407!important;color:#fdba74!important;border-color:#f97316!important}
    .absp-avoid{background:#450a0a!important;color:#fca5a5!important;border-color:#ef4444!important}
    #absp-main{display:none;position:fixed;left:16px;bottom:116px;z-index:999996;width:42px;height:42px;border-radius:9px;border:1px solid #806500;background:#111827;color:#fde68a;font-size:22px;box-shadow:0 2px 10px #000c;touch-action:none}
    #absp-panel{position:fixed;left:8px;right:8px;top:74px;bottom:66px;z-index:999997;background:linear-gradient(145deg,#05070d,#0b1220 55%,#111827);color:#e5e7eb;border:1px solid rgba(250,204,21,.55);border-radius:22px;box-shadow:0 18px 45px #000f;overflow:hidden;font-family:Arial,sans-serif;display:none}
    #absp-panel.open{display:block}
    #absp-panel h2{margin:0;padding:13px 14px;color:#fde68a;background:linear-gradient(90deg,#020617,#0f172a 70%,#111827);border-bottom:1px solid rgba(250,204,21,.35);font-size:18px;text-transform:uppercase;letter-spacing:.5px}
    #absp-panel .body{max-height:calc(100vh - 165px);overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 12px 24px}
    #absp-panel button{background:linear-gradient(180deg,#2a2110,#111827);color:#fde68a;border:1px solid rgba(250,204,21,.52);border-radius:14px;padding:8px 10px;margin:4px;font-weight:900}
    #absp-panel input{box-sizing:border-box;width:100%;background:#020617;color:#f8fafc;border:1px solid rgba(250,204,21,.28);border-radius:14px;padding:10px;margin:6px 0}
    .absp-hero{margin:0 0 10px;padding:14px;border:1px solid rgba(250,204,21,.35);border-radius:18px;background:linear-gradient(135deg,rgba(250,204,21,.12),rgba(59,130,246,.08) 55%,rgba(15,23,42,.9))}
    .absp-hero-title{font-size:22px;font-weight:1000;color:#facc15;text-transform:uppercase}
    .absp-chip{display:inline-flex;margin:7px 4px 0 0;padding:3px 7px;border-radius:999px;background:#020617;border:1px solid rgba(250,204,21,.32);color:#fde68a;font-weight:900;font-size:11px}
    .absp-card{position:relative;padding:12px 12px 12px 14px;border-radius:18px;background:linear-gradient(145deg,rgba(15,23,42,.96),rgba(2,6,23,.96));border:1px solid rgba(148,163,184,.25);box-shadow:inset 3px 0 0 rgba(250,204,21,.55),0 6px 14px rgba(0,0,0,.35);margin-bottom:10px}
    .absp-card b{display:block;color:#fde68a;font-size:14px;margin-bottom:7px;text-transform:uppercase}
    .absp-card p,.absp-card li{color:#dbeafe;line-height:1.42}
    .absp-card ul{margin:7px 0 0 18px;padding:0}
    .absp-status{margin-top:8px;padding:8px;border-radius:12px;background:rgba(2,6,23,.72);border:1px solid rgba(59,130,246,.25);color:#bfdbfe}
    .absp-pop{position:fixed;z-index:999999;background:#0b1120;color:#e5e7eb;border:1px solid #806500;border-radius:12px;box-shadow:0 6px 22px #000d;width:255px;font:12px Arial,sans-serif;overflow:hidden}
    .absp-pop-head{display:flex;justify-content:space-between;align-items:center;background:#020617;color:#facc15;padding:8px 10px}
    .absp-pop-body{padding:10px;line-height:1.45}
    .absp-tag{display:inline-flex;align-items:center;justify-content:center;min-width:54px;padding:2px 6px;border-radius:999px;font-weight:900;border:1px solid #64748b;background:#111827;color:#cbd5e1}
    .absp-red{background:#450a0a!important;color:#fca5a5!important;border-color:#ef4444!important}
    .absp-orange{background:#431407!important;color:#fdba74!important;border-color:#f97316!important}
    .absp-yellow{background:#422006!important;color:#fde68a!important;border-color:#facc15!important}
    .absp-green{background:#052e16!important;color:#86efac!important;border-color:#22c55e!important}
    .absp-blue{background:#172554!important;color:#93c5fd!important;border-color:#3b82f6!important}
    .absp-grey{background:#111827!important;color:#cbd5e1!important;border-color:#64748b!important}
    .absp-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:7px}
    .absp-grid div{background:#111827;border:1px solid #334155;border-radius:8px;padding:5px;display:flex;justify-content:space-between}
  `);

  function safeJson(s){ try{return JSON.parse(s)}catch(e){return null} }
  function esc(s){ return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) }
  function fmt(n){ n=Number(n||0); if(n>=1e12)return (n/1e12).toFixed(1).replace('.0','')+'t'; if(n>=1e9)return (n/1e9).toFixed(1).replace('.0','')+'b'; if(n>=1e6)return (n/1e6).toFixed(1).replace('.0','')+'m'; if(n>=1e3)return (n/1e3).toFixed(1).replace('.0','')+'k'; return String(Math.round(n)); }
  function parseNum(v){ if(v==null)return 0; const m=String(v).toLowerCase().replace(/,/g,'').match(/([0-9]+(?:\.[0-9]+)?)\s*([kmbt])?/); if(!m)return 0; let n=+m[1]; const u=m[2]||''; if(u==='k')n*=1e3;if(u==='m')n*=1e6;if(u==='b')n*=1e9;if(u==='t')n*=1e12; return Math.round(n); }
  function extractId(txt){ txt=String(txt||''); let m=txt.match(/profiles\.php\?XID=(\d{3,10})/i); if(m)return +m[1]; m=txt.match(/(?:XID|user2ID|userID|targetID|profileId|targetId)[=\\"':%26]+(\d{3,10})/i); if(m)return +m[1]; m=txt.match(/loader\.php\?sid=attack[^"']*?(\d{3,10})/i); if(m)return +m[1]; return null; }
  function cache(){ return safeJson(GM_getValue(S.cache,'{}')) || {} }
  function getIntel(id){ return cache()[String(id)] || null }
  function saveIntel(id,intel){ if(!id||!intel)return; const c=cache(); const old=c[String(id)]; if(old && rank(old)>rank(intel)) return; c[String(id)]={...intel,user_id:+id,saved_at:Date.now()}; GM_setValue(S.cache,JSON.stringify(c)); }
  function rank(i){ const s=String(i?.source||'').toLowerCase(); if(s.includes('manual')||s.includes('spy'))return 95; if(s.includes('ff')||s.includes('visible'))return 70; if(s.includes('bsp'))return 66; if(s.includes('fight'))return 40; return Number(i?.confidence||0); }
  function difficulty(total,label){ const l=String(label||'').toLowerCase(); if(l.includes('avoid'))return 'avoid'; if(l.includes('difficult')||l.includes('hard'))return 'difficult'; if(l.includes('fair')||l.includes('good'))return 'fair'; if(l.includes('easy'))return 'easy'; if(total&&app.total){ const r=total/app.total; if(r<=.75)return 'easy'; if(r<=1.15)return 'fair'; if(r<=1.75)return 'difficult'; return 'avoid'; } return 'unknown'; }
  function confClass(c){ c=Number(c||0); if(c>=66)return 'green'; if(c>=46)return 'yellow'; if(c>=26)return 'orange'; return 'red'; }

  function req(method,path,data){
    return new Promise(resolve=>{
      GM_xmlhttpRequest({method,url:BASE+path,headers:{'Content-Type':'application/json'},data:data?JSON.stringify(data):undefined,timeout:22000,
        onload:r=>{try{resolve(JSON.parse(r.responseText))}catch(e){resolve({ok:false,error:'bad json'})}},
        onerror:e=>resolve({ok:false,error:String(e)}),
        ontimeout:()=>resolve({ok:false,error:'timeout'})
      });
    });
  }

  function initUI(){
    if(document.getElementById('absp-main')) return;
    const btn=document.createElement('button');
    btn.id='absp-main';
    btn.textContent='🧠';
    btn.onclick=()=>{app.open=!app.open; renderPanel();};
    document.body.appendChild(btn);

    const panel=document.createElement('div');
    panel.id='absp-panel';
    document.body.appendChild(panel);

    makeDraggable(btn);
    renderPanel();
  }

  function renderPanel(){
    const p=document.getElementById('absp-panel'); if(!p)return;
    p.className=app.open?'open':'';
    p.innerHTML=`
      <h2>🧠⚔️ Advanced Battle Stat Predictor <button style="float:right" id="absp-close">Close</button></h2>
      <div class="body">
        <div class="absp-hero">
          <div class="absp-hero-title">Feed the Finder</div>
          <div style="color:#cbd5e1;margin-top:4px;line-height:1.35">Toss it intel snacks, let it chew through fights, and it may stop guessing like a drunk goblin.</div>
          <span class="absp-chip">honor badges</span><span class="absp-chip">tap for intel</span><span class="absp-chip">gets smarter</span>
        </div>
        <div class="absp-card"><b>📜 Rules</b><ul><li>Use predictions as guidance, not guaranteed wins.</li><li>Do not share private spy/manual data unless you are allowed to.</li><li>Fresh intel is tastier. Old intel may be stale.</li><li>Respect Torn’s API rules, rate limits, and fair-use expectations.</li></ul></div>
        <div class="absp-card"><b>⚔️ How It Works</b><p>The predictor places small stat badges on player honor bars. Tap a badge to open the mini intel popup. It can use visible FF/BSP estimates, saved backend intel, and fight-learning signals.</p><p>New targets may show <b>N/A</b>. Feed it more info through visible estimates and fights so it can grow teeth.</p></div>
        <div class="absp-card"><b>✅ Terms of Service</b><p>All numbers are estimates and may be wrong. You are responsible for your own attacks, choices, losses, wins, and respect gains.</p><p>This tool organizes information visible to you, provided by you, or gathered through allowed limited-key use.</p></div>
        <div class="absp-card"><b>🔑 API Key Use & Storage</b><p>Use a <b>limited Torn API key</b>. Your key is stored locally in your browser/PDA userscript storage so the script can log you in and compare targets against your own battle stats.</p><p>No Torn password is ever requested. The backend uses the key only for login/stat detection or optional estimate support. The script avoids unnecessary API access and is built around limited-key use.</p></div>
        <div class="absp-card">
          <b>🍽️ Login — Feed the Beast</b>
          <input id="absp-key" type="password" placeholder="Torn limited API key" value="${esc(app.key||'')}">
          <label style="display:block;margin:8px 0;color:#dbeafe"><input id="absp-ff" type="checkbox" ${app.ff?'checked':''} style="width:auto"> Use FF Scouter base intel when available</label>
          <button id="absp-login">Login / Save</button>
          <button id="absp-repaint">Repaint badges</button>
          <div class="absp-status">Status: ${app.user?.name?`${esc(app.user.name)} [${esc(app.user.user_id)}] • ${fmt(app.total)}`:'Not logged in'}</div>
        </div>
      </div>`;
    p.querySelector('#absp-close').onclick=()=>{app.open=false;renderPanel();};
    p.querySelector('#absp-login').onclick=login;
    p.querySelector('#absp-repaint').onclick=()=>paint(true);
    updateMainIcon();
  }

  async function login(){
    const key=document.getElementById('absp-key')?.value.trim()||'';
    app.key=key; app.ff=!!document.getElementById('absp-ff')?.checked;
    GM_setValue(S.key,app.key); GM_setValue(S.ff,app.ff);
    const r=await req('POST','/api/login',{api_key:app.key});
    if(r.ok){
      app.user=r.user; app.total=Number(r.stats.total||0);
      app.stats={strength:r.stats.strength||0,defense:r.stats.defense||0,speed:r.stats.speed||0,dexterity:r.stats.dexterity||0};
      GM_setValue(S.user,JSON.stringify(app.user)); GM_setValue(S.total,app.total); GM_setValue(S.stats,JSON.stringify(app.stats));
    }
    renderPanel(); paint(true); updateMainIcon();
  }

  function ownProfile(){
    if(!app.user?.user_id) return false;
    if(/factions\.php/i.test(location.href)) return false;
    const text=(document.body?.innerText||'').slice(0,5000);
    if(/Members\s+Score|Status\s+Attack|Lead Target|Chain active|No active chain/i.test(text)) return false;
    const pid=extractId(location.href) || extractId(document.body?.innerHTML||'');
    if(pid) return +pid === +app.user.user_id;
    return app.user?.name && (document.title||'').toLowerCase().includes(String(app.user.name).toLowerCase());
  }

  function updateMainIcon(){
    const b=document.getElementById('absp-main'); if(!b)return;
    b.style.display=ownProfile()?'block':'none';
  }

  function makeDraggable(btn){
    const saved=safeJson(GM_getValue(S.icon,'null'));
    if(saved){ btn.style.left=saved.left+'px'; btn.style.top=saved.top+'px'; btn.style.bottom='auto'; }
    let drag=false,moved=false,sx=0,sy=0,sl=0,st=0;
    const down=e=>{const p=e.touches?e.touches[0]:e;drag=true;moved=false;sx=p.clientX;sy=p.clientY;const r=btn.getBoundingClientRect();sl=r.left;st=r.top;};
    const move=e=>{if(!drag)return;const p=e.touches?e.touches[0]:e;let dx=p.clientX-sx,dy=p.clientY-sy;if(Math.abs(dx)+Math.abs(dy)>5)moved=true;const l=Math.max(4,Math.min(innerWidth-btn.offsetWidth-4,sl+dx));const t=Math.max(54,Math.min(innerHeight-btn.offsetHeight-54,st+dy));btn.style.left=l+'px';btn.style.top=t+'px';btn.style.bottom='auto';e.preventDefault?.();};
    const up=e=>{if(!drag)return;drag=false;GM_setValue(S.icon,JSON.stringify({left:parseInt(btn.style.left||16),top:parseInt(btn.style.top||120)}));if(moved){e.preventDefault?.();e.stopPropagation?.();setTimeout(()=>moved=false,50);}};
    btn.addEventListener('touchstart',down,{passive:false});btn.addEventListener('mousedown',down,true);
    document.addEventListener('touchmove',move,{passive:false});document.addEventListener('mousemove',move,true);
    document.addEventListener('touchend',up,true);document.addEventListener('mouseup',up,true);
    const old=btn.onclick; btn.onclick=e=>{if(moved)return;old?.(e);};
  }

  function visibleIntel(){
    const txt=(document.body?.innerText||'').replace(/\s+/g,' ');
    let m=txt.match(/Est\.?\s*Stats:\s*([0-9.,]+\s*[kmbt]?)/i)||txt.match(/Estimated\s*Stats:\s*([0-9.,]+\s*[kmbt]?)/i);
    if(!m)return null;
    const n=parseNum(m[1]); if(!n)return null;
    return {total:n,best_total:n,range_low:n*.88,range_high:n*1.12,label:difficulty(n),confidence:70,source:'visible_ff_bsp'};
  }

  function bspIntel(id){
    if(!id)return null;
    const keys=['tdup.battleStatsPredictor.cache.prediction.'+id,'BSP_prediction_'+id,'battleStatsPredictor_'+id];
    for(const k of keys){
      try{const raw=localStorage.getItem(k)||GM_getValue(k,''); if(!raw)continue; const p=JSON.parse(raw); const n=parseNum(p.TBS||p.TargetTBS||p.bs_estimate||p.estimate||p.total||p.Total); if(n)return {total:n,best_total:n,label:difficulty(n),confidence:65,source:'bsp_cache'};}catch(e){}
    }
    return null;
  }

  function rowText(row){ return (row?.textContent||'').replace(/\s+/g,' ').trim(); }
  function isFaction(){ const t=(document.body?.innerText||'').slice(0,7000); return /factions\.php/i.test(location.href)||/Members\s+Score|Status\s+Attack|Lead Target|Chain active|No active chain/i.test(t); }
  function isMemberRow(row){
    const t=rowText(row); const r=row?.getBoundingClientRect?.();
    if(!r||r.width<230||r.height<22||r.bottom<-150||r.top>innerHeight+900)return false;
    if(/Members\s+Score\s+Status\s+Attack|Lead Target|No active chain|Chain active|Your faction is not in a war|used 25 energy attacking|initiated an attack|lost to|won against|fired .* rounds/i.test(t))return false;
    return /\bOkay\b|\bHospital\b|\bTravel\b|\bJail\b|\bAbroad\b|\bAttack\b/i.test(t) && !!row.querySelector('img,[style*="background-image"],[class*="honor"],[class*="name"],a[href*="profiles.php"]');
  }

  function memberArea(row){
    const rr=row.getBoundingClientRect();
    const cells=[...row.querySelectorAll('td,[class*="cell"],[class*="column"]')];
    for(const c of cells.slice(0,2)){
      const r=c.getBoundingClientRect(); const t=rowText(c);
      if(r.width>75&&r.height>16&&r.left<rr.left+rr.width*.58&&!(/Score|Status|Attack|Okay/i.test(t)&&t.length<45)) return c;
    }
    for(const c of [...row.children].slice(0,3)){
      const r=c.getBoundingClientRect();
      if(r.width>75&&r.height>16&&r.left<rr.left+rr.width*.58) return c;
    }
    return null;
  }

  function honorMount(row){
    const area=memberArea(row); if(!area)return null;
    const rr=row.getBoundingClientRect();
    let best=null,score=-999;
    for(const el of [...area.querySelectorAll('[class*="honor"],[class*="name"],[style*="background-image"],img,a[href*="profiles.php"]')]){
      const r=el.getBoundingClientRect(); if(!r||r.width<45||r.height<10||r.width>290||r.height>90||r.left>rr.left+rr.width*.58)continue;
      const t=rowText(el.parentElement||el); if(/Score|Status|Attack|Okay/i.test(t)&&t.length<50)continue;
      const cls=String(el.className||'').toLowerCase(), st=String(el.getAttribute('style')||'').toLowerCase();
      let s=0; if(cls.includes('honor'))s+=55;if(cls.includes('name'))s+=35;if(st.includes('background-image'))s+=35;if(el.tagName==='IMG')s+=20;if(el.href&&/profiles\.php/i.test(el.href))s+=25;s+=Math.min(35,r.width/8);
      if(s>score){score=s;best=el;}
    }
    if(!best)return null;
    const p=best.parentElement||best; const pr=p.getBoundingClientRect();
    return pr&&pr.left<rr.left+rr.width*.58&&pr.width<=320&&pr.height<=110?p:best;
  }

  function attach(mount,intel,id){
    let b=mount.querySelector(':scope > .absp-badge');
    if(!b){ b=document.createElement('span'); b.className='absp-badge'; const cs=getComputedStyle(mount); if(cs.position==='static')mount.style.position='relative'; mount.appendChild(b); }
    updateBadge(b,intel); if(id)b.dataset.targetId=String(id);
  }

  function updateBadge(b,intel){
    const n=Number(intel?.best_total||intel?.total||0);
    if(!n){ b.className='absp-badge'; b.textContent='N/A'; b.title='No intel yet'; return; }
    const d=difficulty(n,intel?.label);
    b.className='absp-badge absp-'+d; b.textContent=fmt(n);
    b.title=`${intel?.source||'intel'} • ${d} • ${Math.round(intel?.confidence||0)}% • Tap for details`;
  }

  async function intelFor(row,mount){
    const id=extractId([location.href,row?.innerHTML,mount?.innerHTML].join(' '));
    let intel=id&&(getIntel(id)||bspIntel(id));
    if(!intel && /Profile/i.test(document.title||'')) intel=visibleIntel();
    if(id&&intel) saveIntel(id,intel);
    if(id&&!intel&&app.key){
      req('GET','/api/player/'+id+'/intel?your_total='+app.total).then(r=>{ if(r.ok&&r.player){saveIntel(id,r.player); schedulePaint(400);} });
    }
    return {id,intel};
  }

  function cleanWrong(){
    document.querySelectorAll('.absp-badge').forEach(b=>{
      if(b.closest('.absp-pop'))return;
      const row=b.closest('tr,li,[class*="row"],[class*="member"]');
      if(row){ const br=b.getBoundingClientRect(), rr=row.getBoundingClientRect(); if(!isMemberRow(row)||br.left>rr.left+rr.width*.62)b.remove(); }
      else if(!(/profiles\.php/i.test(location.href)||/User Information|Actions|Medals|Awards/i.test((document.body?.innerText||'').slice(0,4000)))) b.remove();
    });
  }

  async function paint(force=false){
    updateMainIcon();
    if(isFaction()){
      const rows=[...document.querySelectorAll('tr,li,[class*="row"],[class*="member"]')].filter(isMemberRow).slice(0,80);
      for(const row of rows){
        const mount=honorMount(row); if(!mount)continue;
        const got=await intelFor(row,mount); attach(mount,got.intel,got.id);
      }
      cleanWrong();
      return;
    }
    if(/profiles\.php/i.test(location.href)||/User Information|Actions|Medals|Awards/i.test((document.body?.innerText||'').slice(0,4000))){
      paintProfile();
    }
  }

  function paintProfile(){
    const id=extractId(location.href)||extractId(document.body?.innerHTML||'');
    let intel=(id&&getIntel(id))||visibleIntel()||(id&&bspIntel(id))||null;
    if(id&&intel)saveIntel(id,intel);
    const candidates=[...document.querySelectorAll('img,[style*="background-image"],[class*="honor"],[class*="name"]')];
    let best=null,score=-999;
    for(const el of candidates){
      if(el.closest('#absp-panel,.absp-pop'))continue;
      const r=el.getBoundingClientRect(); if(!r||r.width<80||r.height<10||r.width>620||r.height>120||r.top<125)continue;
      const wrap=rowText(el.parentElement||el); if(/Level|Rank|years|months|days|Actions|Awards|Medals/i.test(wrap))continue;
      let s=Math.min(50,r.width/8); if(el.tagName==='IMG')s+=20;if(String(el.getAttribute('style')||'').includes('background-image'))s+=25;if(r.left<innerWidth*.72)s+=15;
      if(s>score){score=s;best=el;}
    }
    if(best) attach(best.parentElement||best,intel,id);
  }

  function tag(v,kind='value'){
    let c='grey'; const l=String(v||'Unknown').toLowerCase();
    if(kind==='conf'){ const n=Number(v||0); c=confClass(n); v=Math.max(0,Math.min(100,Math.round(n)))+'%'; }
    else if(l.includes('avoid')||l.includes('high')||l.includes('heavy'))c='red';
    else if(l.includes('difficult'))c='orange';
    else if(l.includes('fair')||l.includes('equal'))c='yellow';
    else if(l.includes('easy'))c='green';
    else if(l.includes('low')||l.includes('light'))c='blue';
    return `<span class="absp-tag absp-${c}">${esc(v||'Unknown')}</span>`;
  }

  function popup(b){
    document.querySelectorAll('.absp-pop').forEach(x=>x.remove());
    const id=b.dataset.targetId; const intel=(id&&getIntel(id))||{total:parseNum(b.textContent),confidence:0,source:'badge'};
    const n=Number(intel.best_total||intel.total||0); const d=difficulty(n,intel.label);
    const pop=document.createElement('div'); pop.className='absp-pop';
    pop.innerHTML=`<div class="absp-pop-head"><b>⚔️ Battle Intel</b><button class="close">×</button></div>
      <div class="absp-pop-body">
        <div><b>Total:</b> ${n?fmt(n):'N/A'} ${tag(d)}</div>
        <div><b>Source:</b> ${esc(intel.source||'none')}</div>
        <div><b>Confidence:</b> ${tag(intel.confidence||0,'conf')}</div><hr>
        <div class="absp-grid"><div><b>STR</b>${tag('Unknown')}</div><div><b>DEF</b>${tag('Unknown')}</div><div><b>SPD</b>${tag('Unknown')}</div><div><b>DEX</b>${tag('Unknown')}</div><div><b>Armor</b>${tag('Unknown')}</div><div><b>Temp</b>${tag('Unknown')}</div></div>
      </div>`;
    document.body.appendChild(pop);
    const r=b.getBoundingClientRect(); pop.style.left=Math.max(8,Math.min(innerWidth-265,r.left))+'px'; pop.style.top=Math.max(78,Math.min(innerHeight-280,r.bottom+6))+'px';
    pop.querySelector('.close').onclick=e=>{e.stopPropagation();pop.remove();schedulePaint(200);};
  }

  document.addEventListener('click',e=>{
    const b=e.target.closest?.('.absp-badge'); if(!b)return;
    e.preventDefault(); e.stopPropagation(); popup(b);
  },true);

  function isAttackClick(el){
    if(!el)return false; const href=el.href||el.getAttribute?.('href')||'', oc=el.getAttribute?.('onclick')||'', tx=(el.textContent||'').trim(), ti=el.getAttribute?.('title')||'';
    return /sid=attack|user2ID=|attack/i.test(href)||/sid=attack|user2ID|attack/i.test(oc)||/^attack$/i.test(tx)||((el.tagName==='A'||el.tagName==='BUTTON')&&/attack|fight/i.test(href+oc+tx+ti));
  }
  document.addEventListener('click',e=>{
    const el=e.target.closest?.('a,button,[onclick]'); if(!isAttackClick(el))return;
    const row=el.closest('tr,li,[class*="row"],[class*="member"]'); const id=extractId([el.href,el.getAttribute?.('href'),el.getAttribute?.('onclick'),row?.innerHTML,location.href].join(' '));
    if(id) GM_setValue(S.lastTarget,JSON.stringify({id,name:rowText(row).slice(0,40)||'Enemy',ts:Date.now()}));
  },true);

  function schedulePaint(ms=700){ clearTimeout(window.__abspPaint); window.__abspPaint=setTimeout(()=>paint(false),ms); }

  function boot(){
    initUI(); updateMainIcon();
    [600,1800,4000].forEach(t=>setTimeout(()=>paint(false),t));
    let last=location.href;
    setInterval(()=>{ if(location.href!==last){ last=location.href; schedulePaint(900); updateMainIcon(); } },1000);
    try{ new MutationObserver(()=>schedulePaint(900)).observe(document.body,{childList:true,subtree:true}); }catch(e){}
  }

  boot();
})();
