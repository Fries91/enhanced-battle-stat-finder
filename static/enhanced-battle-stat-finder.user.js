// ==UserScript==
// @name         Advanced Battle Stat Predictor
// @namespace    Fries91.Torn.AdvancedBattleStatPredictor
// @version      3.3.2
// @description  Feed the Finder build: shared total + per-stat trait learning, armor/temp tracking, old-style popup, profile icon, and safe badge clicks.
// @author       Fries91
// @match        https://www.torn.com/profiles.php*
// @match        https://www.torn.com/bringafriend.php*
// @match        https://www.torn.com/halloffame.php*
// @match        https://www.torn.com/index.php?page=people*
// @match        https://www.torn.com/factions.php*
// @match        https://www.torn.com/page.php*
// @match        https://www.torn.com/joblist.php*
// @match        https://www.torn.com/competition.php*
// @match        https://www.torn.com/bounties.php*
// @match        https://www.torn.com/hospitalview.php*
// @match        https://www.torn.com/forums.php*
// @match        https://www.torn.com/pmarket.php*
// @match        https://www.torn.com/properties.php*
// @match        https://www.torn.com/war.php*
// @match        https://www.torn.com/preferences.php*
// @match        https://www.torn.com/loader.php?sid=attack*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      enhanced-battle-stat-finder.onrender.com
// @updateURL    https://enhanced-battle-stat-finder.onrender.com/static/enhanced-battle-stat-finder.user.js
// @downloadURL  https://enhanced-battle-stat-finder.onrender.com/static/enhanced-battle-stat-finder.user.js
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  const BASE = 'https://enhanced-battle-stat-finder.onrender.com';
  const VERSION = '3.3.2';
  const KEY = { api:'absp_key', user:'absp_user', total:'absp_total', stats:'absp_stats', cache:'absp_intel_cache_v330', sent:'absp_shared_sent_v330', ff:'absp_ff_enabled' };
  const state = { key:GM_getValue(KEY.api,'')||GM_getValue('ebsf2_key',''), user:safeJson(GM_getValue(KEY.user,'null'))||safeJson(GM_getValue('ebsf2_user','null')), total:Number(GM_getValue(KEY.total,0)||GM_getValue('ebsf2_total',0)||0), stats:safeJson(GM_getValue(KEY.stats,'{}'))||{}, ff:!!GM_getValue(KEY.ff,true), panelOpen:false, pending:false, lastPaint:0 };

  GM_addStyle(`
    .ebsf2-badge,#ebsf2-btn,#ebsf2-panel,#ebsf2-save,.ebsf2-pop,.absp-badge,.absp-hb-badge,.absp3-badge,.absp31-badge,.absp-bsp-badge,.absp320-holder,.absp320-badge,.absp321-inject,.TDup_BSPProfileInjection.absp321-profile{display:none!important;visibility:hidden!important;pointer-events:none!important}
    .TDup_ColoredStatsInjectionDiv.absp330-inject{position:absolute!important;z-index:25!important;display:block!important;visibility:visible!important;pointer-events:auto!important}
    .TDup_ColoredStatsInjectionDivWithoutHonorBar.absp330-inject{z-index:25!important;display:inline-block!important;visibility:visible!important;pointer-events:auto!important}
    .iconStats.absp330-badge{height:20px!important;width:48px!important;position:relative!important;text-align:center!important;font-size:11px!important;font-weight:bold!important;box-sizing:border-box!important;border:1px solid black!important;line-height:18px!important;font-family:initial!important;border-radius:5px!important;box-shadow:0 1px 4px rgba(0,0,0,.7)!important;cursor:pointer!important;pointer-events:auto!important;overflow:hidden!important;white-space:nowrap!important}
    .absp330-easy{background:#052e16!important;color:#86efac!important;border-color:#22c55e!important}.absp330-fair{background:#422006!important;color:#fde68a!important;border-color:#facc15!important}.absp330-good{background:#172554!important;color:#93c5fd!important;border-color:#3b82f6!important}.absp330-difficult{background:#431407!important;color:#fdba74!important;border-color:#f97316!important}.absp330-avoid{background:#450a0a!important;color:#fca5a5!important;border-color:#ef4444!important}.absp330-unknown{background:#111827!important;color:#cbd5e1!important;border-color:#64748b!important}
    #absp330-main{display:none!important;width:42px!important;height:42px!important;border-radius:10px!important;border:1px solid #806500!important;background:#111827!important;color:#fde68a!important;font-size:22px!important;box-shadow:0 2px 10px #000c!important;touch-action:none!important;z-index:35!important;position:relative!important;align-items:center!important;justify-content:center!important}#absp330-main.absp330-main-visible{display:inline-flex!important}.absp330-main-wrap{display:inline-flex!important;align-items:center!important;justify-content:center!important;margin:4px!important;position:relative!important;z-index:35!important}
    #absp330-panel{position:fixed;left:8px;right:8px;top:74px;bottom:66px;z-index:999997;background:linear-gradient(145deg,#05070d,#0b1220 55%,#111827);color:#e5e7eb;border:1px solid rgba(250,204,21,.55);border-radius:22px;box-shadow:0 18px 45px #000f;overflow:hidden;font-family:Arial,sans-serif;display:none}#absp330-panel.open{display:block}#absp330-panel h2{margin:0;padding:13px 14px;color:#fde68a;background:linear-gradient(90deg,#020617,#0f172a 70%,#111827);border-bottom:1px solid rgba(250,204,21,.35);font-size:17px;text-transform:uppercase;letter-spacing:.4px}#absp330-panel .body{max-height:calc(100vh - 165px);overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 12px 26px}#absp330-panel button{background:linear-gradient(180deg,#2a2110,#111827);color:#fde68a;border:1px solid rgba(250,204,21,.52);border-radius:14px;padding:8px 10px;margin:4px;font-weight:900}#absp330-panel input{box-sizing:border-box;width:100%;background:#020617;color:#f8fafc;border:1px solid rgba(250,204,21,.28);border-radius:14px;padding:10px;margin:6px 0}
    .absp330-hero{margin:0 0 10px;padding:14px;border:1px solid rgba(250,204,21,.35);border-radius:18px;background:linear-gradient(135deg,rgba(250,204,21,.12),rgba(59,130,246,.08) 55%,rgba(15,23,42,.9))}.absp330-hero-title{font-size:22px;font-weight:1000;color:#facc15;text-transform:uppercase}.absp330-chip{display:inline-flex;margin:7px 4px 0 0;padding:3px 7px;border-radius:999px;background:#020617;border:1px solid rgba(250,204,21,.32);color:#fde68a;font-weight:900;font-size:11px}.absp330-card{position:relative;padding:12px 12px 12px 14px;border-radius:18px;background:linear-gradient(145deg,rgba(15,23,42,.96),rgba(2,6,23,.96));border:1px solid rgba(148,163,184,.25);box-shadow:inset 3px 0 0 rgba(250,204,21,.55),0 6px 14px rgba(0,0,0,.35);margin-bottom:10px}.absp330-card:nth-of-type(2){box-shadow:inset 3px 0 0 rgba(34,197,94,.70),0 6px 14px rgba(0,0,0,.35)}.absp330-card:nth-of-type(3){box-shadow:inset 3px 0 0 rgba(59,130,246,.70),0 6px 14px rgba(0,0,0,.35)}.absp330-card:nth-of-type(4){box-shadow:inset 3px 0 0 rgba(250,204,21,.70),0 6px 14px rgba(0,0,0,.35)}.absp330-card:nth-of-type(5){box-shadow:inset 3px 0 0 rgba(168,85,247,.70),0 6px 14px rgba(0,0,0,.35)}.absp330-card b{display:block;color:#fde68a;font-size:14px;margin-bottom:7px;text-transform:uppercase}.absp330-card p,.absp330-card li{color:#dbeafe;line-height:1.42}.absp330-card ul{margin:7px 0 0 18px;padding:0}.absp330-status{margin-top:8px;padding:8px;border-radius:12px;background:rgba(2,6,23,.72);border:1px solid rgba(59,130,246,.25);color:#bfdbfe}
    .TDup_BSPProfileInjection.absp330-profile{margin:8px 0 4px 0!important;padding:6px 8px!important;border-radius:8px!important;background:#111827!important;border:1px solid #64748b!important;color:#cbd5e1!important;font:900 12px Arial,sans-serif!important;display:inline-flex!important;align-items:center!important;gap:6px!important}
    .absp330-pop{position:fixed;z-index:999999;background:#0b1120;color:#e5e7eb;border:1px solid #806500;border-radius:12px;box-shadow:0 6px 22px #000d;width:280px;font:12px Arial,sans-serif;overflow:hidden}.absp330-pop-head{display:flex;justify-content:space-between;align-items:center;background:#020617;color:#facc15;padding:8px 10px}.absp330-pop-head button{background:#1f2937!important;color:#facc15!important;border:1px solid #806500!important;border-radius:6px!important;padding:1px 6px!important}.absp330-pop-body{padding:10px;line-height:1.45}.absp330-tag{display:inline-flex;align-items:center;justify-content:center;min-width:54px;padding:2px 6px;border-radius:999px;font-weight:900;border:1px solid #64748b;background:#111827;color:#cbd5e1}.absp330-row{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.absp330-row button{font-size:11px!important;padding:5px 7px!important;margin:0!important;border-radius:9px!important}.absp330-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:8px}.absp330-grid div{background:#111827;border:1px solid #334155;border-radius:8px;padding:6px;display:flex;justify-content:space-between;align-items:center}.absp330-feed-actions button{background:#111827!important;color:#fde68a!important;border:1px solid rgba(250,204,21,.65)!important}.absp330-feed-actions{display:flex;gap:5px;flex-wrap:wrap;margin-top:10px}.absp330-trait-controls{display:grid;grid-template-columns:1fr;gap:6px;margin-top:9px}.absp330-trait-controls label{display:flex;justify-content:space-between;align-items:center;gap:7px;color:#dbeafe;font-weight:900}.absp330-trait-controls select{background:#020617;color:#f8fafc;border:1px solid #64748b;border-radius:9px;padding:5px;max-width:155px}
  `);

  function safeJson(s){try{return JSON.parse(s)}catch{return null}} function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))} function cleanText(el){return(el?.textContent||'').replace(/\s+/g,' ').trim()} function fmt(n){n=Number(n||0);if(n>=1e12)return(n/1e12).toFixed(1).replace('.0','')+'t';if(n>=1e9)return(n/1e9).toFixed(1).replace('.0','')+'b';if(n>=1e6)return(n/1e6).toFixed(1).replace('.0','')+'m';if(n>=1e3)return(n/1e3).toFixed(1).replace('.0','')+'k';return String(Math.round(n))}
  function parseNum(v){const m=String(v??'').toLowerCase().replace(/,/g,'').match(/([0-9]+(?:\.[0-9]+)?)\s*([kmbt])?/);if(!m)return 0;let n=Number(m[1]);if(m[2]==='k')n*=1e3;if(m[2]==='m')n*=1e6;if(m[2]==='b')n*=1e9;if(m[2]==='t')n*=1e12;return Math.round(n)}
  function extractId(blob){blob=String(blob||'');let m=blob.match(/profiles\.php\?XID=(\d{3,10})|[?&]XID=(\d{3,10})|[?&]user2ID=(\d{3,10})/i);if(m)return Number(m[1]||m[2]||m[3]);m=blob.match(/(?:XID|user2ID|userID|targetID|profileId|targetId|data-userid|data-user|data-id)[=\\"':%26 ]+(\d{3,10})/i);return m?Number(m[1]):null}
  function req(method,path,data){return new Promise(resolve=>{GM_xmlhttpRequest({method,url:BASE+path,headers:{'Content-Type':'application/json'},data:data?JSON.stringify(data):undefined,timeout:20000,onload:r=>{try{resolve(JSON.parse(r.responseText))}catch{resolve({ok:false,error:'bad json'})}},onerror:e=>resolve({ok:false,error:String(e)}),ontimeout:()=>resolve({ok:false,error:'timeout'})})})}
  function cache(){return safeJson(GM_getValue(KEY.cache,'{}'))||{}} function getIntel(id){return id?cache()[String(id)]||null:null} function saveIntel(id,intel){if(!id||!intel)return;const c=cache();c[String(id)]={...intel,user_id:Number(id),saved_at:Date.now()};GM_setValue(KEY.cache,JSON.stringify(c))} function sentMap(){return safeJson(GM_getValue(KEY.sent,'{}'))||{}} function canSend(id,src){const s=sentMap();return Date.now()-(s[id+':'+src]||0)>21600000} function markSent(id,src){const s=sentMap();s[id+':'+src]=Date.now();GM_setValue(KEY.sent,JSON.stringify(s))}
  function diff(total,label){const l=String(label||'').toLowerCase();if(l.includes('avoid'))return'avoid';if(l.includes('difficult')||l.includes('hard'))return'difficult';if(l.includes('good'))return'good';if(l.includes('fair'))return'fair';if(l.includes('easy'))return'easy';if(total&&state.total){const r=Number(total)/Number(state.total);if(r<=.75)return'easy';if(r<=1.15)return'fair';if(r<=1.35)return'good';if(r<=1.75)return'difficult';return'avoid'}return'unknown'}
  function riskConfidence(intel){let conf=Number(intel?.confidence||0);const total=Number(intel?.best_total||intel?.total||0);if(!total||!state.total)return conf;const src=String(intel?.source||'').toLowerCase();const exact=/spy|manual|exact/.test(src);const ratio=total/state.total;if(exact)return Math.max(1,Math.min(100,Math.round(conf||80)));const cap=ratio>=20?18:ratio>=10?25:ratio>=5?35:ratio>=2.5?45:ratio>=1.75?55:ratio>=1.15?65:78;return Math.max(1,Math.min(100,Math.round(Math.min(conf||cap,cap))))}
  function isBadContainer(el){if(!el)return true;for(let n=el,i=0;n&&n!==document.body&&i<10;n=n.parentElement,i++){const cls=String(n.className||'').toLowerCase();const id=String(n.id||'').toLowerCase();const aria=String(n.getAttribute?.('aria-label')||'').toLowerCase();const t=cleanText(n);if(n.closest?.('#absp330-panel,.absp330-pop'))return true;if(/chat|message|msg|conversation|channel|compose|textarea|chatbox|tooltip|tip|popover|dialog|modal|dropdown|profile-mini|preview|hover/.test(cls+' '+id+' '+aria))return true;if(/Type your message here|Last message:|New message|Cash Me if You Can|Best of the Lot/i.test(t))return true}return false} function visible(el){const r=el?.getBoundingClientRect?.();return!!(r&&r.width>0&&r.height>0&&r.bottom>-100&&r.top<innerHeight+600)} function pageProfile(){return location.href.startsWith('https://www.torn.com/profiles.php')} function currentProfileId(){return pageProfile()?(extractId(location.href)||extractId(document.body?.innerHTML||'')):null}
  function bspIntel(id){for(const k of['tdup.battleStatsPredictor.cache.prediction.'+id,'BSP_prediction_'+id,'battleStatsPredictor_'+id]){try{const raw=localStorage.getItem(k)||GM_getValue(k,'');if(!raw)continue;const p=JSON.parse(raw);const n=parseNum(p.TBS||p.TargetTBS||p.bs_estimate||p.estimate||p.total||p.Total);if(n)return{total:n,best_total:n,label:diff(n),confidence:66,source:'bsp_cache'}}catch{}}return null}
  function visibleIntel(){const body=(document.body?.innerText||'').replace(/\s+/g,' ');const m=body.match(/Est\.?\s*Stats:\s*([0-9.,]+\s*[kmbt]?)/i)||body.match(/Estimated\s*Stats:\s*([0-9.,]+\s*[kmbt]?)/i);const n=m?parseNum(m[1]):0;return n?{total:n,best_total:n,label:diff(n),confidence:68,source:'visible_ff_bsp'}:null}
  function shareIntel(id,intel,name=''){if(!id||!intel?.total)return;const src=intel.source||'shared';if(!canSend(id,src))return;markSent(id,src);req('POST','/api/estimate/manual',{target_id:id,target_name:name,estimate_total:intel.total,your_total:state.total,confidence:riskConfidence(intel)||60,source:src,source_detail:'shared by ABSP '+VERSION}).then(r=>{if(r?.ok&&r.player){saveIntel(id,r.player);schedule(300)}})}
  function addTarget(out,seen,id,mount,type){if(!id||!mount||isBadContainer(mount)||!visible(mount))return;const r=mount.getBoundingClientRect();const key=type+':'+id+':'+Math.round(r.top/10)+':'+Math.round(r.left/10);if(seen.has(key))return;seen.add(key);out.push({id:Number(id),mount,type})}
  function collectTargets(root=document){const out=[],seen=new Set();if(pageProfile()){const pid=currentProfileId();if(pid){const m=document.querySelector('.buttons-wrap')||document.querySelector('.user-information');if(m)addTarget(out,seen,pid,m,'profile');return out}} if(/loader\.php\?sid=attack|page\.php\?sid=attack/i.test(location.href)){const id=extractId(location.href);const m=Array.from(document.querySelectorAll('*')).find(e=>String(e.className).includes('titleContainer'));if(id&&m)addTarget(out,seen,id,m,'attack');return out} root.querySelectorAll?.('.target.left').forEach(t=>{const a=t.querySelector('a[href*="XID="]');const id=extractId(a?.href);if(id)addTarget(out,seen,id,t,'bounty')});root.querySelectorAll?.('a[href*="profiles.php?XID="],a[href^="/profiles.php?"],a[href*="XID="]').forEach(a=>{if(isBadContainer(a)||!visible(a))return;const id=extractId(a.href||a.getAttribute('href'));if(!id)return;const p=a.parentNode;if(p&&String(p.className).includes('honorWrap'))return addTarget(out,seen,id,p,'honorWrap');if(p&&String(p.className).includes('dataGridData'))return addTarget(out,seen,id,p,'dataGridData');if(a.rel==='noopener noreferrer'||String(a.className)==='user name ')return addTarget(out,seen,id,a,'link');for(const c of a.children){if(c.tagName==='IMG')return addTarget(out,seen,id,c,'img');const cls=String(c.className||'').toLowerCase();const st=String(c.getAttribute?.('style')||'').toLowerCase();if(cls.includes('honor')||cls.includes('name')||st.includes('background-image')||c.querySelector?.('img'))return addTarget(out,seen,id,c,'child')}});root.querySelectorAll?.('.user.name').forEach(e=>{const m=(e.innerHTML||e.title||'').match(/\[(\d{3,10})\]/);if(m)addTarget(out,seen,Number(m[1]),e,'username')});return out}
  function marginFor(type,mount){if(type==='profile')return'';if(location.href.includes('hospitalview'))return'0px 6px';if(location.href.includes('forums.php#/p=threads'))return'-26px 28px';if(location.href.includes('factions.php')&&mount.className==='user name ')return'-28px 54px';return'-10px -9px'}
  function updateBadge(badge,intel){const total=Number(intel?.best_total||intel?.total||0);if(!total){badge.className='iconStats absp330-badge absp330-unknown';badge.textContent='N/A';badge.title='No shared intel yet • tap to feed';return}const d=diff(total,intel?.label);badge.className='iconStats absp330-badge absp330-'+d;badge.textContent=fmt(total);badge.title=`${intel?.source||'shared'} • ${d} • ${riskConfidence(intel)}% • tap for details/feed`}
  function buildInjection(target,intel){if(target.mount.querySelector('.absp330-inject,.TDup_BSPProfileInjection.absp330-profile'))return null;let div=document.createElement('div');if(target.type==='profile'){div.className='TDup_BSPProfileInjection absp330-profile';div.dataset.targetId=String(target.id);div.appendChild(document.createTextNode('ABSP '))}else{div.className=target.type==='dataGridData'?'TDup_ColoredStatsInjectionDivWithoutHonorBar absp330-inject':'TDup_ColoredStatsInjectionDiv absp330-inject';div.dataset.targetId=String(target.id);if(target.type!=='dataGridData')div.style.margin=marginFor(target.type,target.mount)}const badge=document.createElement('div');badge.dataset.targetId=String(target.id);badge.setAttribute('role','button');badge.setAttribute('tabindex','0');updateBadge(badge,intel);div.appendChild(badge);target.mount.insertBefore(div,target.mount.firstChild);return badge}
  function fetchIntel(id,badge){req('GET',`/api/player/${id}/intel?your_total=${state.total||0}`).then(r=>{if(r?.ok&&r.player){saveIntel(id,r.player);if(badge)updateBadge(badge,r.player)}})}
  function paint(root=document){state.pending=false;state.lastPaint=Date.now();mountIcon();for(const target of collectTargets(root)){let intel=getIntel(target.id)||bspIntel(target.id);if(!intel&&pageProfile())intel=visibleIntel();if(intel){saveIntel(target.id,intel);shareIntel(target.id,intel)}const badge=buildInjection(target,intel);if(badge&&!intel)fetchIntel(target.id,badge);else if(badge&&intel)setTimeout(()=>fetchIntel(target.id,badge),800)}} function schedule(ms=900,root=document){if(state.pending)return;state.pending=true;clearTimeout(window.__absp330Timer);window.__absp330Timer=setTimeout(()=>paint(root),ms)}

  function rangeText(v){
    if(!v) return '<span class="absp330-tag">Unknown</span>';
    if(typeof v === 'string') return `<span class="absp330-tag">${esc(v)}</span>`;
    const low = Number(v.low || v.range_low || 0);
    const high = Number(v.high || v.range_high || 0);
    const mid = Number(v.mid || v.value || 0);
    if(low && high) return `<span class="absp330-tag">${fmt(low)}-${fmt(high)}</span>`;
    if(mid) return `<span class="absp330-tag">~${fmt(mid)}</span>`;
    return '<span class="absp330-tag">Unknown</span>';
  }
  function breakdownFromIntel(intel){ return intel?.breakdown || intel?.traits || intel?.stat_breakdown || {}; }
  function breakdownGrid(intel){
    const b = breakdownFromIntel(intel);
    const stats = b.stats || b.stat_ranges || {};
    const armor = b.armor || b.armor_profile || 'Unknown';
    const temp = b.temp || b.temp_profile || 'Unknown';
    return `<div class="absp330-grid">
      <div><b>STR</b>${rangeText(stats.strength || stats.str || intel?.strength)}</div>
      <div><b>DEF</b>${rangeText(stats.defense || stats.def || intel?.defense)}</div>
      <div><b>SPD</b>${rangeText(stats.speed || stats.spd || intel?.speed)}</div>
      <div><b>DEX</b>${rangeText(stats.dexterity || stats.dex || intel?.dexterity)}</div>
      <div><b>Armor</b>${rangeText(armor)}</div>
      <div><b>Temp</b>${rangeText(temp)}</div>
    </div>`;
  }
  function traitPayload(targetId, pop){
    const bias = pop?.querySelector('#absp330-bias')?.value || 'unknown';
    const armor = pop?.querySelector('#absp330-armor')?.value || 'unknown';
    const temp = pop?.querySelector('#absp330-temp')?.value || 'unknown';
    return { target_id: targetId, stat_bias: bias, armor, temp_used: temp, your_total: state.total, source: 'ABSP popup traits', version: VERSION };
  }
  function sendTraits(targetId, pop, thenFetch=true){
    const payload = traitPayload(targetId, pop);
    if(payload.stat_bias === 'unknown' && payload.armor === 'unknown' && payload.temp_used === 'unknown') return Promise.resolve(null);
    return req('POST', `/api/target/${targetId}/traits`, payload).then(r=>{
      if(r?.ok && r.player){ saveIntel(targetId, r.player); }
      if(thenFetch) fetchIntel(targetId, null);
      return r;
    });
  }
  function popup(badge){
    document.querySelectorAll('.absp330-pop').forEach(x=>x.remove());
    const id=Number(badge.dataset.targetId);
    const intel=getIntel(id)||bspIntel(id)||{total:parseNum(badge.textContent),confidence:0,source:'badge'};
    const total=Number(intel?.best_total||intel?.total||0);
    const d=diff(total,intel?.label);
    const conf=riskConfidence(intel);
    const tagHtml=(txt)=>`<span class="absp330-tag">${esc(txt||'Unknown')}</span>`;
    const pop=document.createElement('div');
    pop.className='absp330-pop';
    pop.innerHTML=`
      <div class="absp330-pop-head"><b>🧠⚔️ ABSP Intel</b><button class="close">×</button></div>
      <div class="absp330-pop-body">
        <div><b>Total:</b> ${total?fmt(total):'N/A'} ${tagHtml(d)}</div>
        <div><b>Source:</b> ${esc(intel?.source||'none')}</div>
        <div><b>Confidence:</b> ${conf}%</div>
        ${total&&state.total&&total/state.total>=2.5?'<div style="margin-top:7px;padding:6px;border-radius:8px;background:#431407;color:#fdba74;border:1px solid #f97316;font-weight:900">Confidence reduced: high stat gap</div>':''}
        <hr style="border:0;border-top:1px solid #334155;margin:9px 0">
        ${breakdownGrid(intel)}
        <div class="absp330-trait-controls">
          <label>Stat read <select id="absp330-bias"><option value="unknown">Unknown</option><option value="balanced">Balanced</option><option value="strength">STR heavy</option><option value="defense">DEF heavy</option><option value="speed">SPD heavy</option><option value="dexterity">DEX heavy</option></select></label>
          <label>Armor read <select id="absp330-armor"><option value="unknown">Unknown</option><option value="light">Light / weak</option><option value="medium">Medium</option><option value="heavy">Heavy / tanky</option></select></label>
          <label>Temp used often <select id="absp330-temp"><option value="unknown">Unknown</option><option value="yes">Yes / often</option><option value="no">No / rarely</option></select></label>
        </div>
        <div class="absp330-feed-actions">
          <button data-r="easy_win">Easy win</button><button data-r="close_win">Close win</button><button data-r="close_loss">Close loss</button><button data-r="hard_loss">Hard loss</button><button data-trait="1">Save traits</button>
        </div>
        <div style="margin-top:8px;color:#bfdbfe">Fight buttons feed total learning. Trait controls feed STR/DEF/SPD/DEX, armor, and temp-used learning for everyone.</div>
      </div>`;
    document.body.appendChild(pop);
    const r=badge.getBoundingClientRect();
    pop.style.left=Math.max(8,Math.min(innerWidth-300,r.left))+'px';
    pop.style.top=Math.max(78,Math.min(innerHeight-410,r.bottom+6))+'px';
    pop.querySelector('.close').onclick=e=>{e.stopPropagation();pop.remove()};
    pop.querySelectorAll('[data-r]').forEach(btn=>btn.onclick=()=>feedFight(id,btn.dataset.r,pop));
    const traitBtn = pop.querySelector('[data-trait="1"]');
    if(traitBtn) traitBtn.onclick=()=>sendTraits(id,pop,true).then(()=>{pop.remove();schedule(80)});
  }
  function feedFight(targetId,result,pop){
    if(!state.user?.user_id||!state.total){alert('Login first so ABSP knows your battle stats.');return}
    const traits = traitPayload(targetId, pop);
    req('POST','/api/attack/result',{attacker_id:state.user.user_id,attacker_name:state.user.name,attacker_total:state.total,target_id:targetId,target_name:'Enemy',result,fight_meta:{source:'ABSP popup feed',version:VERSION,traits}}).then(r=>{
      const afterFight = r?.ok&&r.player ? (saveIntel(targetId,r.player), true) : false;
      sendTraits(targetId,pop,false).then(()=>{
        if(afterFight){pop.remove();schedule(80)} else alert('Feed failed: '+(r?.error||'unknown'));
      });
    })
  }
  function openBadge(e){const b=e.target.closest?.('.absp330-badge');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation?.();popup(b);return false}document.addEventListener('click',openBadge,true);document.addEventListener('mousedown',e=>{if(e.target.closest?.('.absp330-badge')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation?.()}},true);document.addEventListener('keydown',e=>{const b=e.target.closest?.('.absp330-badge');if(!b)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();popup(b)}},true)
  document.addEventListener('click',e=>{const el=e.target.closest?.('a,button,[onclick]');if(!el)return;const blob=[el.href,el.getAttribute?.('href'),el.getAttribute?.('onclick'),el.textContent,el.getAttribute?.('title')].filter(Boolean).join(' ');if(!/sid=attack|user2ID|attack|fight/i.test(blob))return;const id=extractId(blob);if(id)GM_setValue('absp_last_attack_target',JSON.stringify({id,ts:Date.now()}))},true)
  function initUI(){if(!document.getElementById('absp330-main')){const btn=document.createElement('button');btn.id='absp330-main';btn.type='button';btn.textContent='🧠';btn.title='Advanced Battle Stat Predictor';btn.onclick=e=>{e.preventDefault();e.stopPropagation();state.panelOpen=!state.panelOpen;renderPanel()};document.body.appendChild(btn)}if(!document.getElementById('absp330-panel')){const panel=document.createElement('div');panel.id='absp330-panel';document.body.appendChild(panel)}renderPanel();mountIcon()}
  function ownProfile(){if(!state.user?.user_id||!pageProfile())return false;const pid=currentProfileId();if(pid)return Number(pid)===Number(state.user.user_id);return!!(state.user?.name&&String(document.title||'').toLowerCase().includes(String(state.user.name).toLowerCase()))} function mountIcon(){const btn=document.getElementById('absp330-main');if(!btn)return;if(!ownProfile()){btn.classList.remove('absp330-main-visible');if(btn.parentElement&&btn.parentElement.classList.contains('absp330-main-wrap'))document.body.appendChild(btn);return}let target=document.querySelector('.buttons-wrap')||document.querySelector('.profile-wrapper .actions,.actions,[class*="buttons-wrap"]');if(!target){btn.classList.add('absp330-main-visible');btn.style.position='fixed';btn.style.left='16px';btn.style.bottom='116px';document.body.appendChild(btn);return}let wrap=document.getElementById('absp330-main-wrap');if(!wrap){wrap=document.createElement('span');wrap.id='absp330-main-wrap';wrap.className='absp330-main-wrap'}if(wrap.parentElement!==target)target.appendChild(wrap);if(btn.parentElement!==wrap)wrap.appendChild(btn);btn.style.position='relative';btn.style.left='';btn.style.bottom='';btn.classList.add('absp330-main-visible')}
  function renderPanel(){
    const p=document.getElementById('absp330-panel');
    if(!p)return;
    p.className=state.panelOpen?'open':'';
    p.innerHTML=`
      <h2>🧠⚔️ Advanced Battle Stat Predictor <button style="float:right" id="absp330-close">Close</button></h2>
      <div class="body">
        <div class="absp330-hero">
          <div class="absp330-hero-title">🍽️ Feed the Finder</div>
          <div style="color:#cbd5e1;margin-top:4px;line-height:1.35">Funny enough to feed the stat gremlin, serious enough to not get anyone cooked. Shared intel saves to the backend so everyone using this app can see better predictions.</div>
          <span class="absp330-chip">Old intel popup restored</span>
          <span class="absp330-chip">Shared learning</span>
          <span class="absp330-chip">v${VERSION}</span>
        </div>
        <div class="absp330-card"><b>📜 Rules — funny, but serious</b><ul><li><b>N/A means “I’m starving.”</b> The finder has no usable intel yet. Feed it fights or estimates.</li><li><b>Green is not a free buffet.</b> Easy/fair/good/difficult/avoid are estimates, not guaranteed wins.</li><li><b>Old intel gets crusty.</b> Stats change, people train, and cached numbers can go stale.</li><li><b>Fresh fights feed everyone.</b> Fight-result buttons and trait controls send safe learning to the backend for shared total, per-stat, armor, and temp-used predictions.</li><li><b>Do not leak private spy/manual data.</b> Only feed intel you are allowed to use/share.</li><li><b>Respect Torn rules.</b> Use limited-key access, avoid spammy refreshes, and keep it fair-use friendly.</li></ul></div>
        <div class="absp330-card"><b>🧠 How It Works — feed in, prediction out</b><p><b>Advanced Battle Stat Predictor</b> places badges using BSP-style mount points, so the prediction sits where BSP-style stat boxes belong.</p><p>The popup shows <b>confidence</b>, <b>source</b>, and the old-style STR / DEF / SPD / DEX / Armor / Temp boxes again. Trait votes can now narrow individual stat ranges over time.</p><p>Visible FF/BSP-style estimates, saved cache, backend intel, fight-result feeds, and trait controls can improve shared total and per-stat estimates.</p><p>Tap a badge to open intel. The tap is blocked from clicking the player name or attack link behind it.</p></div>
        <div class="absp330-card"><b>✅ Terms of Service</b><p>This tool gives estimates only. It cannot promise wins, losses, respect gains, fair-fight values, exact battle stats, or that your target forgot to train today.</p><p>You are responsible for attacks, target choices, losses, wins, cooldowns, and any game consequences. Use ABSP as a helper, not a guarantee button.</p><p>Shared learning may be imperfect. Better-confidence and fresher backend intel should win over weak old guesses, but bad inputs can still happen.</p></div>
        <div class="absp330-card"><b>🔑 API Key Use & Storage</b><p>Use a <b>limited Torn API key</b>. No Torn password is ever requested.</p><p>Your key is stored locally in PDA/browser userscript storage. It is used to log you in, identify your own profile, compare targets against your own battle stats, and support prediction features.</p><p>The backend stores shared target estimates and fight-learning records by target ID. It should not need your Torn password, and it should avoid unnecessary API calls.</p></div>
        <div class="absp330-card"><b>🍽️ Login — Feed the Finder</b><input id="absp330-key" type="password" placeholder="Torn limited API key" value="${esc(state.key||'')}"><label style="display:block;margin:8px 0;color:#dbeafe"><input id="absp330-ff" type="checkbox" ${state.ff?'checked':''} style="width:auto"> Use FF/BSP visible/base intel when available</label><button id="absp330-login">Login / Save</button><button id="absp330-repaint">Repaint badges</button><div class="absp330-status">Status: ${state.user?.name?`${esc(state.user.name)} [${esc(state.user.user_id)}] • ${fmt(state.total)}`:'Not logged in'}</div></div>
      </div>`;
    p.querySelector('#absp330-close').onclick=()=>{state.panelOpen=false;renderPanel()};
    p.querySelector('#absp330-login').onclick=login;
    p.querySelector('#absp330-repaint').onclick=()=>schedule(50);
    mountIcon();
  }
  function login(){state.key=document.getElementById('absp330-key')?.value.trim()||'';state.ff=!!document.getElementById('absp330-ff')?.checked;GM_setValue(KEY.api,state.key);GM_setValue(KEY.ff,state.ff);req('POST','/api/login',{api_key:state.key}).then(r=>{if(r?.ok){state.user=r.user;state.total=Number(r.stats?.total||0);state.stats={strength:r.stats?.strength||0,defense:r.stats?.defense||0,speed:r.stats?.speed||0,dexterity:r.stats?.dexterity||0};GM_setValue(KEY.user,JSON.stringify(state.user));GM_setValue(KEY.total,state.total);GM_setValue(KEY.stats,JSON.stringify(state.stats))}else alert('Login failed: '+(r?.error||'unknown'));renderPanel();schedule(80)})}
  function boot(){initUI();setTimeout(()=>schedule(500),1200);setTimeout(()=>schedule(900),3500);let lastMutation=0;try{const obs=new MutationObserver(mutations=>{const now=Date.now();const gap=(location.href.includes('factions.php')||location.href.includes('war.php'))?2200:900;if(now-lastMutation<gap)return;lastMutation=now;let root=document;for(const m of mutations){for(const n of m.addedNodes){if(n&&n.nodeType===1&&n.querySelector){root=n;break}}}schedule(gap,root)});obs.observe(document.body,{childList:true,subtree:true})}catch{}setInterval(()=>{mountIcon();if(Date.now()-state.lastPaint>9000)schedule(800)},3000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
