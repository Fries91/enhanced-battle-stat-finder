// ==UserScript==
// @name         Advanced Battle Stat Predictor
// @namespace    Fries91.Torn.AdvancedBattleStatPredictor
// @version      3.4.2
// @description  One-script ABSP for PDA/mobile/PC browser/Violentmonkey: own-profile settings, profile badges, admin debug, shared learning.
// @author       Fries91
// @match        https://www.torn.com/*
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
// @grant        GM.xmlHttpRequest
// @grant        GM.addStyle
// @grant        GM.getValue
// @grant        GM.setValue
// @connect      enhanced-battle-stat-finder.onrender.com
// @updateURL    https://enhanced-battle-stat-finder.onrender.com/static/enhanced-battle-stat-finder.user.js
// @downloadURL  https://enhanced-battle-stat-finder.onrender.com/static/enhanced-battle-stat-finder.user.js
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const BASE = 'https://enhanced-battle-stat-finder.onrender.com';
  const VERSION = '3.4.2';
  const ADMIN_IDS = new Set(['3679030']);
  const KEY = { api:'absp_key', user:'absp_user', total:'absp_total', stats:'absp_stats', cache:'absp_intel_cache_v336', sent:'absp_shared_sent_v336', ff:'absp_ff_enabled',debug:'absp_debug_history_v336' };
  const state = { key:GMX.get(KEY.api,'')||GMX.get('ebsf2_key',''), user:safeJson(GMX.get(KEY.user,'null'))||safeJson(GMX.get('ebsf2_user','null')), total:Number(GMX.get(KEY.total,0)||GMX.get('ebsf2_total',0)||0), stats:safeJson(GMX.get(KEY.stats,'{}'))||{}, ff:!!GMX.get(KEY.ff,true), panelOpen:false, pending:false, lastPaint:0 };


  function isAdmin(){
    return !!(state.user?.user_id && ADMIN_IDS.has(String(state.user.user_id)));
  }

  GMX.addStyle(`
    .ebsf2-badge,#ebsf2-btn,#ebsf2-panel,#ebsf2-save,.ebsf2-pop,.absp-badge,.absp-hb-badge,.absp3-badge,.absp31-badge,.absp-bsp-badge,.absp320-holder,.absp320-badge,.absp321-inject,.TDup_BSPProfileInjection.absp321-profile{display:none!important;visibility:hidden!important;pointer-events:none!important}
    .TDup_ColoredStatsInjectionDiv.absp330-inject{position:absolute!important;z-index:25!important;display:block!important;visibility:visible!important;pointer-events:auto!important}
    .TDup_ColoredStatsInjectionDivWithoutHonorBar.absp330-inject{z-index:25!important;display:inline-block!important;visibility:visible!important;pointer-events:auto!important}
    .iconStats.absp330-badge{height:20px!important;width:48px!important;position:relative!important;text-align:center!important;font-size:11px!important;font-weight:bold!important;box-sizing:border-box!important;border:1px solid black!important;line-height:18px!important;font-family:initial!important;border-radius:5px!important;box-shadow:0 1px 4px rgba(0,0,0,.7)!important;cursor:pointer!important;pointer-events:auto!important;overflow:hidden!important;white-space:nowrap!important}
    .absp330-easy{background:#052e16!important;color:#86efac!important;border-color:#22c55e!important}.absp330-fair{background:#422006!important;color:#fde68a!important;border-color:#facc15!important}.absp330-good{background:#172554!important;color:#93c5fd!important;border-color:#3b82f6!important}.absp330-difficult{background:#431407!important;color:#fdba74!important;border-color:#f97316!important}.absp330-avoid{background:#450a0a!important;color:#fca5a5!important;border-color:#ef4444!important}.absp330-unknown{background:#111827!important;color:#cbd5e1!important;border-color:#64748b!important}
    #absp330-main{display:none!important;min-width:66px!important;height:38px!important;border-radius:10px!important;border:2px solid #facc15!important;background:#111827!important;color:#fde68a!important;font-size:13px!important;font-weight:1000!important;box-shadow:0 3px 14px #000!important;touch-action:none!important;z-index:2147483646!important;position:fixed!important;left:12px!important;bottom:82px!important;align-items:center!important;justify-content:center!important;padding:0 8px!important;letter-spacing:.4px!important}#absp330-main.absp330-main-visible{display:inline-flex!important}#absp330-main.absp330-main-floating{display:inline-flex!important;position:fixed!important;left:12px!important;bottom:82px!important;z-index:2147483646!important}.absp330-main-wrap{display:inline-flex!important;align-items:center!important;justify-content:center!important;margin:4px!important;position:relative!important;z-index:35!important}
    #absp330-panel#absp330-panel{position:fixed;left:8px;right:8px;top:74px;bottom:66px;z-index:999997;background:linear-gradient(145deg,#05070d,#0b1220 55%,#111827);color:#e5e7eb;border:1px solid rgba(250,204,21,.55);border-radius:22px;box-shadow:0 18px 45px #000f;overflow:hidden;font-family:Arial,sans-serif;display:none}#absp330-panel.open{display:block}#absp330-panel h2{margin:0;padding:13px 14px;color:#fde68a;background:linear-gradient(90deg,#020617,#0f172a 70%,#111827);border-bottom:1px solid rgba(250,204,21,.35);font-size:17px;text-transform:uppercase;letter-spacing:.4px}#absp330-panel .body{max-height:calc(100vh - 165px);overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 12px 26px}#absp330-panel button{background:linear-gradient(180deg,#2a2110,#111827);color:#fde68a;border:1px solid rgba(250,204,21,.52);border-radius:14px;padding:8px 10px;margin:4px;font-weight:900}#absp330-panel input{box-sizing:border-box;width:100%;background:#020617;color:#f8fafc;border:1px solid rgba(250,204,21,.28);border-radius:14px;padding:10px;margin:6px 0}
    .absp330-hero{margin:0 0 10px;padding:14px;border:1px solid rgba(250,204,21,.35);border-radius:18px;background:linear-gradient(135deg,rgba(250,204,21,.12),rgba(59,130,246,.08) 55%,rgba(15,23,42,.9))}.absp330-hero-title{font-size:22px;font-weight:1000;color:#facc15;text-transform:uppercase}.absp330-chip{display:inline-flex;margin:7px 4px 0 0;padding:3px 7px;border-radius:999px;background:#020617;border:1px solid rgba(250,204,21,.32);color:#fde68a;font-weight:900;font-size:11px}.absp330-card{position:relative;padding:12px 12px 12px 14px;border-radius:18px;background:linear-gradient(145deg,rgba(15,23,42,.96),rgba(2,6,23,.96));border:1px solid rgba(148,163,184,.25);box-shadow:inset 3px 0 0 rgba(250,204,21,.55),0 6px 14px rgba(0,0,0,.35);margin-bottom:10px}.absp330-card:nth-of-type(2){box-shadow:inset 3px 0 0 rgba(34,197,94,.70),0 6px 14px rgba(0,0,0,.35)}.absp330-card:nth-of-type(3){box-shadow:inset 3px 0 0 rgba(59,130,246,.70),0 6px 14px rgba(0,0,0,.35)}.absp330-card:nth-of-type(4){box-shadow:inset 3px 0 0 rgba(250,204,21,.70),0 6px 14px rgba(0,0,0,.35)}.absp330-card:nth-of-type(5){box-shadow:inset 3px 0 0 rgba(168,85,247,.70),0 6px 14px rgba(0,0,0,.35)}.absp330-card b{display:block;color:#fde68a;font-size:14px;margin-bottom:7px;text-transform:uppercase}.absp330-card p,.absp330-card li{color:#dbeafe;line-height:1.42}.absp330-card ul{margin:7px 0 0 18px;padding:0}.absp330-status{margin-top:8px;padding:8px;border-radius:12px;background:rgba(2,6,23,.72);border:1px solid rgba(59,130,246,.25);color:#bfdbfe}
    .TDup_BSPProfileInjection.absp330-profile{margin:8px 0 4px 0!important;padding:6px 8px!important;border-radius:8px!important;background:#111827!important;border:1px solid #64748b!important;color:#cbd5e1!important;font:900 12px Arial,sans-serif!important;display:inline-flex!important;align-items:center!important;gap:6px!important}
    .absp330-pop{position:fixed;z-index:999999;background:#0b1120;color:#e5e7eb;border:1px solid #806500;border-radius:12px;box-shadow:0 6px 22px #000d;width:280px;font:12px Arial,sans-serif;overflow:hidden}.absp330-pop-head{display:flex;justify-content:space-between;align-items:center;background:#020617;color:#facc15;padding:8px 10px}.absp330-pop-head button{background:#1f2937!important;color:#facc15!important;border:1px solid #806500!important;border-radius:6px!important;padding:1px 6px!important}.absp330-pop-body{padding:10px;line-height:1.45}.absp330-tag{display:inline-flex;align-items:center;justify-content:center;min-width:54px;padding:2px 6px;border-radius:999px;font-weight:900;border:1px solid #64748b;background:#111827;color:#cbd5e1}.absp330-row{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.absp330-row button{font-size:11px!important;padding:5px 7px!important;margin:0!important;border-radius:9px!important}.absp330-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:8px}.absp330-grid div{background:#111827;border:1px solid #334155;border-radius:8px;padding:6px;display:flex;justify-content:space-between;align-items:center}.absp330-feed-actions button{background:#111827!important;color:#fde68a!important;border:1px solid rgba(250,204,21,.65)!important}.absp330-feed-actions{display:flex;gap:5px;flex-wrap:wrap;margin-top:10px}
  `);

  function safeJson(s){try{return JSON.parse(s)}catch{return null}} function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))} function cleanText(el){return(el?.textContent||'').replace(/\s+/g,' ').trim()} function fmt(n){n=Number(n||0);if(n>=1e12)return(n/1e12).toFixed(1).replace('.0','')+'t';if(n>=1e9)return(n/1e9).toFixed(1).replace('.0','')+'b';if(n>=1e6)return(n/1e6).toFixed(1).replace('.0','')+'m';if(n>=1e3)return(n/1e3).toFixed(1).replace('.0','')+'k';return String(Math.round(n))}
  function parseNum(v){const m=String(v??'').toLowerCase().replace(/,/g,'').match(/([0-9]+(?:\.[0-9]+)?)\s*([kmbt])?/);if(!m)return 0;let n=Number(m[1]);if(m[2]==='k')n*=1e3;if(m[2]==='m')n*=1e6;if(m[2]==='b')n*=1e9;if(m[2]==='t')n*=1e12;return Math.round(n)}
  function extractId(blob){blob=String(blob||'');let m=blob.match(/profiles\.php\?XID=(\d{3,10})|[?&]XID=(\d{3,10})|[?&]user2ID=(\d{3,10})/i);if(m)return Number(m[1]||m[2]||m[3]);m=blob.match(/(?:XID|user2ID|userID|targetID|profileId|targetId|data-userid|data-user|data-id)[=\\"':%26 ]+(\d{3,10})/i);return m?Number(m[1]):null}
  function req(method,path,data){
    return new Promise(resolve=>{
      const xhr = (typeof GM_xmlhttpRequest === 'function') ? GM_xmlhttpRequest : (typeof GM !== 'undefined' && GM.xmlHttpRequest ? GM.xmlHttpRequest : null);
      if(!xhr){ debugAdd('api','GM request permission missing',false); resolve({ok:false,error:'GM request permission missing'}); return; }
      xhr({
        method,
        url:BASE+path,
        headers:{'Content-Type':'application/json'},
        data:data?JSON.stringify(data):undefined,
        timeout:20000,
        onload:r=>{ try{ const parsed=JSON.parse(r.responseText); debugAdd(method+' '+path, parsed.ok===false ? (parsed.error||'not ok') : 'ok', parsed.ok!==false); resolve(parsed); }catch{ debugAdd(method+' '+path,'bad json',false); resolve({ok:false,error:'bad json'}); } },
        onerror:e=>{ debugAdd(method+' '+path,String(e),false); resolve({ok:false,error:String(e)}); },
        ontimeout:()=>{ debugAdd(method+' '+path,'timeout',false); resolve({ok:false,error:'timeout'}); }
      });
    });
  }

  function cache(){return safeJson(GMX.get(KEY.cache,'{}'))||{}} function getIntel(id){return id?cache()[String(id)]||null:null} function saveIntel(id,intel){if(!id||!intel)return;const c=cache();c[String(id)]={...intel,user_id:Number(id),saved_at:Date.now()};GMX.set(KEY.cache,JSON.stringify(c))} function sentMap(){return safeJson(GMX.get(KEY.sent,'{}'))||{}} function canSend(id,src){const s=sentMap();return Date.now()-(s[id+':'+src]||0)>21600000} function markSent(id,src){const s=sentMap();s[id+':'+src]=Date.now();GMX.set(KEY.sent,JSON.stringify(s))}
  function diff(total,label){const l=String(label||'').toLowerCase();if(l.includes('avoid'))return'avoid';if(l.includes('difficult')||l.includes('hard'))return'difficult';if(l.includes('good'))return'good';if(l.includes('fair'))return'fair';if(l.includes('easy'))return'easy';if(total&&state.total){const r=Number(total)/Number(state.total);if(r<=.75)return'easy';if(r<=1.15)return'fair';if(r<=1.35)return'good';if(r<=1.75)return'difficult';return'avoid'}return'unknown'}
  function riskConfidence(intel){let conf=Number(intel?.confidence||0);const total=Number(intel?.best_total||intel?.total||0);if(!total||!state.total)return conf;const src=String(intel?.source||'').toLowerCase();const exact=/spy|manual|exact/.test(src);const ratio=total/state.total;if(exact)return Math.max(1,Math.min(100,Math.round(conf||80)));const cap=ratio>=20?18:ratio>=10?25:ratio>=5?35:ratio>=2.5?45:ratio>=1.75?55:ratio>=1.15?65:78;return Math.max(1,Math.min(100,Math.round(Math.min(conf||cap,cap))))}
  function isBadContainer(el){if(!el)return true;for(let n=el,i=0;n&&n!==document.body&&i<10;n=n.parentElement,i++){const cls=String(n.className||'').toLowerCase();const id=String(n.id||'').toLowerCase();const aria=String(n.getAttribute?.('aria-label')||'').toLowerCase();const t=cleanText(n);if(n.closest?.('#absp330-panel,.absp330-pop'))return true;if(/chat|message|msg|conversation|channel|compose|textarea|chatbox|tooltip|tip|popover|dialog|modal|dropdown|profile-mini|preview|hover/.test(cls+' '+id+' '+aria))return true;if(/Type your message here|Last message:|New message|Cash Me if You Can|Best of the Lot/i.test(t))return true}return false} function visible(el){const r=el?.getBoundingClientRect?.();return!!(r&&r.width>0&&r.height>0&&r.bottom>-100&&r.top<innerHeight+600)} function pageProfile(){return location.href.startsWith('https://www.torn.com/profiles.php')} function currentProfileId(){return pageProfile()?(extractId(location.href)||extractId(document.body?.innerHTML||'')):null}
  function bspIntel(id){for(const k of['tdup.battleStatsPredictor.cache.prediction.'+id,'BSP_prediction_'+id,'battleStatsPredictor_'+id]){try{const raw=localStorage.getItem(k)||GMX.get(k,'');if(!raw)continue;const p=JSON.parse(raw);const n=parseNum(p.TBS||p.TargetTBS||p.bs_estimate||p.estimate||p.total||p.Total);if(n)return{total:n,best_total:n,label:diff(n),confidence:66,source:'bsp_cache'}}catch{}}return null}
  function visibleIntel(){const body=(document.body?.innerText||'').replace(/\s+/g,' ');const m=body.match(/Est\.?\s*Stats:\s*([0-9.,]+\s*[kmbt]?)/i)||body.match(/Estimated\s*Stats:\s*([0-9.,]+\s*[kmbt]?)/i);const n=m?parseNum(m[1]):0;return n?{total:n,best_total:n,label:diff(n),confidence:68,source:'visible_ff_bsp'}:null}
  function shareIntel(id,intel,name=''){if(!id||!intel?.total){debugAdd('share skip','missing target/total',false);return;}const src=intel.source||'shared';if(!canSend(id,src)){debugAdd('share skip',id+' '+src+' cooldown');return;}markSent(id,src);debugAdd('share send','target '+id+' '+src+' total '+fmt(intel.total||intel.best_total||0));req('POST','/api/estimate/manual',{target_id:id,target_name:name,estimate_total:intel.total,your_total:state.total,confidence:riskConfidence(intel)||60,source:src,source_detail:'shared by ABSP '+VERSION}).then(r=>{if(r?.ok&&r.player){saveIntel(id,r.player);schedule(300)}})}
  function addTarget(out,seen,id,mount,type){if(!id||!mount||isBadContainer(mount)||!visible(mount))return;const r=mount.getBoundingClientRect();const key=type+':'+id+':'+Math.round(r.top/10)+':'+Math.round(r.left/10);if(seen.has(key))return;seen.add(key);out.push({id:Number(id),mount,type})}
  function collectTargets(root=document){const out=[],seen=new Set();if(pageProfile()){const pid=currentProfileId();if(pid){const m=document.querySelector('.buttons-wrap')||document.querySelector('.user-information');if(m)addTarget(out,seen,pid,m,'profile');return out}} if(/loader\.php\?sid=attack|page\.php\?sid=attack/i.test(location.href)){const id=extractId(location.href);const m=Array.from(document.querySelectorAll('*')).find(e=>String(e.className).includes('titleContainer'));if(id&&m)addTarget(out,seen,id,m,'attack');return out} root.querySelectorAll?.('.target.left').forEach(t=>{const a=t.querySelector('a[href*="XID="]');const id=extractId(a?.href);if(id)addTarget(out,seen,id,t,'bounty')});root.querySelectorAll?.('a[href*="profiles.php?XID="],a[href^="/profiles.php?"],a[href*="XID="]').forEach(a=>{if(isBadContainer(a)||!visible(a))return;const id=extractId(a.href||a.getAttribute('href'));if(!id)return;const p=a.parentNode;if(p&&String(p.className).includes('honorWrap'))return addTarget(out,seen,id,p,'honorWrap');if(p&&String(p.className).includes('dataGridData'))return addTarget(out,seen,id,p,'dataGridData');if(a.rel==='noopener noreferrer'||String(a.className)==='user name ')return addTarget(out,seen,id,a,'link');for(const c of a.children){if(c.tagName==='IMG')return addTarget(out,seen,id,c,'img');const cls=String(c.className||'').toLowerCase();const st=String(c.getAttribute?.('style')||'').toLowerCase();if(cls.includes('honor')||cls.includes('name')||st.includes('background-image')||c.querySelector?.('img'))return addTarget(out,seen,id,c,'child')}});root.querySelectorAll?.('.user.name').forEach(e=>{const m=(e.innerHTML||e.title||'').match(/\[(\d{3,10})\]/);if(m)addTarget(out,seen,Number(m[1]),e,'username')});return out}
  function marginFor(type,mount){if(type==='profile')return'';if(location.href.includes('hospitalview'))return'0px 6px';if(location.href.includes('forums.php#/p=threads'))return'-26px 28px';if(location.href.includes('factions.php')&&mount.className==='user name ')return'-28px 54px';return'-10px -9px'}
  function updateBadge(badge,intel){const total=Number(intel?.best_total||intel?.total||0);if(!total){badge.className='iconStats absp330-badge absp330-unknown';badge.textContent='N/A';badge.title='No shared intel yet • tap to feed';return}const d=diff(total,intel?.label);badge.className='iconStats absp330-badge absp330-'+d;badge.textContent=fmt(total);badge.title=`${intel?.source||'shared'} • ${d} • ${riskConfidence(intel)}% • tap for details/feed`}
  function buildInjection(target,intel){if(target.mount.querySelector('.absp330-inject,.TDup_BSPProfileInjection.absp330-profile'))return null;let div=document.createElement('div');if(target.type==='profile'){div.className='TDup_BSPProfileInjection absp330-profile';div.dataset.targetId=String(target.id);div.appendChild(document.createTextNode('ABSP '))}else{div.className=target.type==='dataGridData'?'TDup_ColoredStatsInjectionDivWithoutHonorBar absp330-inject':'TDup_ColoredStatsInjectionDiv absp330-inject';div.dataset.targetId=String(target.id);if(target.type!=='dataGridData')div.style.margin=marginFor(target.type,target.mount)}const badge=document.createElement('div');badge.dataset.targetId=String(target.id);badge.setAttribute('role','button');badge.setAttribute('tabindex','0');updateBadge(badge,intel);div.appendChild(badge);target.mount.insertBefore(div,target.mount.firstChild);return badge}
  function fetchIntel(id,badge){req('GET',`/api/player/${id}/intel?your_total=${state.total||0}`).then(r=>{if(r?.ok&&r.player){saveIntel(id,r.player);if(badge)updateBadge(badge,r.player)}})}
  function paint(root=document){state.pending=false;state.lastPaint=Date.now();mountIcon();for(const target of collectTargets(root)){let intel=getIntel(target.id)||bspIntel(target.id);if(!intel&&pageProfile())intel=visibleIntel();if(intel){saveIntel(target.id,intel);shareIntel(target.id,intel)}const badge=buildInjection(target,intel);if(badge&&!intel)fetchIntel(target.id,badge);else if(badge&&intel)setTimeout(()=>fetchIntel(target.id,badge),800)}} function schedule(ms=900,root=document){if(state.pending)return;state.pending=true;clearTimeout(window.__absp330Timer);window.__absp330Timer=setTimeout(()=>paint(root),ms)}

  function rangeText(lo, hi){
    lo = Number(lo || 0); hi = Number(hi || 0);
    if(!lo && !hi) return 'Unknown';
    if(lo && hi && Math.abs(hi-lo)/Math.max(hi,1) < .08) return fmt((lo+hi)/2);
    if(lo && hi) return fmt(lo) + ' - ' + fmt(hi);
    return fmt(lo || hi);
  }
  function statRange(intel, short, longName){
    if(!intel) return 'Unknown';
    return rangeText(
      intel[short + '_low'] || intel[longName + '_low'],
      intel[short + '_high'] || intel[longName + '_high']
    );
  }
  function armorText(intel){
    return intel?.armor_seen || intel?.armor || intel?.armor_detail || 'Unknown';
  }
  function tempText(intel){
    return intel?.temp_used_often || intel?.temp || intel?.temp_detail || 'Unknown';
  }
  function feedExtra(targetId, payload, pop){
    req('POST','/api/target/flags', {target_id: targetId, ...payload}).then(r=>{
      if(r?.ok && r.player){
        saveIntel(targetId, r.player);
        if(pop) pop.remove();
        schedule(80);
      } else {
        alert('Feed failed: ' + (r?.error || 'unknown'));
      }
    });
  }


  function autoTraitIntel(){
    const txt = (document.body?.innerText || '').replace(/\s+/g,' ').toLowerCase();
    const out = {};
    if(/(full armor|heavy armor|assault armor|riot|dune|marauder|sentinel|eod|helmet|vest|body armor)/i.test(txt)) out.armor_seen = 'Auto-detected armor notes';
    else if(/(no armor|unarmored|without armor)/i.test(txt)) out.armor_seen = 'Auto-detected light/no armor';
    if(/(temporary weapon|temp weapon|pepper spray|tear gas|smoke grenade|flash grenade|grenade|melatonin|sand|temp used)/i.test(txt)) out.temp_used_often = 'Auto-detected temp mention';
    return out;
  }

  function shareAutoTraits(targetId, intel){
    if(!targetId){debugAdd('attack log','no target id found',false);return;}
    const traits = autoTraitIntel();
    if(!traits.armor_seen && !traits.temp_used_often) return;
    req('POST','/api/estimate/manual', {
      target_id: targetId,
      estimate_total: Number(intel?.best_total || intel?.total || 1),
      your_total: state.total,
      confidence: Math.max(45, riskConfidence(intel) || 45),
      source: intel?.source || 'auto_trait',
      source_detail: 'auto armor/temp note from ABSP ' + VERSION,
      armor_seen: traits.armor_seen,
      temp_used_often: traits.temp_used_often
    }).then(r=>{
      if(r?.ok && r.player) saveIntel(targetId, r.player);
    });
  }

  function popup(badge){
    document.querySelectorAll('.absp330-pop').forEach(x=>x.remove());
    const id=Number(badge.dataset.targetId);
    const intel=getIntel(id)||bspIntel(id)||{total:parseNum(badge.textContent),confidence:0,source:'badge'};
    const total=Number(intel?.best_total||intel?.total||0);
    const d=diff(total,intel?.label);
    const conf=riskConfidence(intel);

    const pop=document.createElement('div');
    pop.className='absp330-pop';
    pop.innerHTML=`
      <div class="absp330-pop-head"><b>🧠⚔️ ABSP Intel</b><button class="close">×</button></div>
      <div class="absp330-pop-body">
        <div><b>Total:</b> ${total?fmt(total):'N/A'} <span class="absp330-tag">${esc(d)}</span></div>
        <div><b>Source:</b> ${esc(intel?.source||'none')}</div>
        <div><b>Confidence:</b> ${conf}%</div>
        ${total&&state.total&&total/state.total>=2.5?'<div style="margin-top:7px;padding:6px;border-radius:8px;background:#431407;color:#fdba74;border:1px solid #f97316;font-weight:900">Confidence reduced: high stat gap</div>':''}
        <hr style="border:0;border-top:1px solid #334155;margin:9px 0">
        <div class="absp330-grid">
          <div><b>STR</b><span>${statRange(intel,'str','strength')}</span></div>
          <div><b>DEF</b><span>${statRange(intel,'def','defense')}</span></div>
          <div><b>SPD</b><span>${statRange(intel,'spd','speed')}</span></div>
          <div><b>DEX</b><span>${statRange(intel,'dex','dexterity')}</span></div>
          <div><b>Armor</b><span>${esc(armorText(intel))}</span></div>
          <div><b>Temp</b><span>${esc(tempText(intel))}</span></div>
        </div>
      </div>`;
    document.body.appendChild(pop);
    const r=badge.getBoundingClientRect();
    pop.style.left=Math.max(8,Math.min(innerWidth-300,r.left))+'px';
    pop.style.top=Math.max(78,Math.min(innerHeight-360,r.bottom+6))+'px';
    pop.querySelector('.close').onclick=e=>{e.stopPropagation();pop.remove()};
  }

  function feedFight(targetId,result,pop){if(!state.user?.user_id||!state.total){alert('Login first so ABSP knows your battle stats.');return}req('POST','/api/attack/result',{attacker_id:state.user.user_id,attacker_name:state.user.name,attacker_total:state.total,target_id:targetId,target_name:'Enemy',result,attacker_stats:state.stats,fight_meta:{source:'ABSP popup feed',version:VERSION}}).then(r=>{if(r?.ok&&r.player){saveIntel(targetId,r.player);pop.remove();schedule(80)}else alert('Feed failed: '+(r?.error||'unknown'))})}
  function openBadge(e){const b=e.target.closest?.('.absp330-badge');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation?.();popup(b);return false}document.addEventListener('click',openBadge,true);document.addEventListener('mousedown',e=>{if(e.target.closest?.('.absp330-badge')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation?.()}},true);document.addEventListener('keydown',e=>{const b=e.target.closest?.('.absp330-badge');if(!b)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();popup(b)}},true)
  document.addEventListener('click',e=>{const el=e.target.closest?.('a,button,[onclick]');if(!el)return;const blob=[el.href,el.getAttribute?.('href'),el.getAttribute?.('onclick'),el.textContent,el.getAttribute?.('title')].filter(Boolean).join(' ');if(!/sid=attack|user2ID|attack|fight/i.test(blob))return;const id=extractId(blob);if(id)GMX.set('absp_last_attack_target',JSON.stringify({id,ts:Date.now()}))},true)
  function initUI(){if(!document.getElementById('absp330-main')){const btn=document.createElement('button');btn.id='absp330-main';btn.type='button';btn.textContent=isMobileLike()?'🧠':'🧠 ABSP';btn.title='Advanced Battle Stat Predictor - click to open';btn.onclick=e=>{e.preventDefault();e.stopPropagation();state.panelOpen=!state.panelOpen;renderPanel()};document.body.appendChild(btn)}if(!document.getElementById('absp330-panel')){const panel=document.createElement('div');panel.id='absp330-panel';document.body.appendChild(panel)}renderPanel();mountIcon();setTimeout(mountIcon,250);setTimeout(mountIcon,1000);setTimeout(mountIcon,2500)}
  function isMobileLike(){ return /Android|iPhone|iPad|iPod|Mobile|PDA/i.test(navigator.userAgent) || innerWidth < 760; }

  function ownProfile(){
    if(!state.user?.user_id || !pageProfile()) return false;
    const pid = currentProfileId();
    if(pid) return Number(pid) === Number(state.user.user_id);
    return !!(state.user?.name && String(document.title||'').toLowerCase().includes(String(state.user.name).toLowerCase()));
  }

  function hideMainIcon(btn){
    if(!btn) return;
    btn.classList.remove('absp330-main-visible','absp330-main-floating');
    btn.style.display='none';
    if(state.panelOpen){
      state.panelOpen=false;
      const p=document.getElementById('absp330-panel');
      if(p) p.className='';
    }
  }

  function showProfileIcon(btn){
    if(!btn) return;
    btn.textContent = isMobileLike() ? '🧠' : '🧠 ABSP';
    btn.style.position='fixed';
    btn.style.left='12px';
    btn.style.bottom=isMobileLike() ? '84px' : '18px';
    btn.style.display='inline-flex';
    btn.style.zIndex='2147483646';
    btn.classList.add('absp330-main-visible','absp330-main-floating');
  }

  function mountIcon(){
    const btn=document.getElementById('absp330-main');
    if(!btn) return;
    // One-script mode: same file works everywhere, but settings launcher is only on your own profile.
    if(!ownProfile()){
      hideMainIcon(btn);
      return;
    }
    showProfileIcon(btn);
  }

  function renderPanel(){
    const p=document.getElementById('absp330-panel');
    if(!p)return;
    p.className=state.panelOpen?'open':'';
    p.innerHTML=`
      <h2>🧠⚔️ Advanced Battle Stat Predictor <button style="float:right" id="absp330-close">Close</button></h2>
      <div class="body">
        <div class="absp330-hero">
          <div class="absp330-hero-title">🍽️ Feed the Finder <span style="font-size:11px;color:#fef3c7">v${VERSION}</span></div>
          <div style="color:#cbd5e1;margin-top:4px;line-height:1.3">
            Compact auto-only mode. One script works on PDA/mobile/PC/browser userscript managers. Main settings opens only on your own profile page; badges still show target intel on player profiles.
          </div>
          <span class="absp330-chip">Auto-only</span>
          <span class="absp330-chip">Shared learning</span>
          <span class="absp330-chip">STR/DEF/SPD/DEX</span>
          <span class="absp330-chip">Armor/Temp</span>
        </div>

        <div class="absp330-card absp330-compact-card">
          <b>📜 Rules</b>
          <p><b>No fake numbers.</b> Unknown means ABSP does not have safe intel yet. Estimates are guidance only, not guaranteed wins. Keep usage fair, clean, and within Torn rules.</p>
        </div>

        <div class="absp330-card absp330-compact-card">
          <b>🧠 How It Works</b>
          <p>ABSP checks visible estimates, saved cache, attack logs, shared backend intel, and safe auto-detected notes. Fight results help narrow totals and STR/DEF/SPD/DEX ranges; temp/armor notes save when they can be detected.</p>
        </div>

        <div class="absp330-card absp330-compact-card">
          <b>✅ ToS</b>
          <p>ABSP is only a helper. You choose your targets and accept the results. It cannot promise exact stats, wins, losses, fair-fight values, armor, or temporary weapon use.</p>
        </div>

        <div class="absp330-card absp330-compact-card">
          <b>🔑 API & Storage</b>
          <p>Use a <b>limited Torn API key</b>. No password is requested. Your key is saved locally in PDA/browser storage. Shared prediction data is stored by target ID for estimate support only.</p>
        </div>
        ${isAdmin() ? `
        <div class="absp330-card absp330-compact-card">
          <b>🛠️ Admin Debug History</b>
          <p>Admin-only backend send/fetch history. Hidden for normal users.</p>
          <button id="absp330-debug-refresh">Refresh</button>
          <button id="absp330-debug-clear">Clear</button>
          <div class="absp330-debug">${debugRowsHtml()}</div>
        </div>` : ``}

        <div class="absp330-card absp330-login-card">
          <b>🍽️ Login</b>
          <input id="absp330-key" type="password" placeholder="Torn limited API key" value="${esc(state.key||'')}">
          <label style="display:block;margin:6px 0;color:#dbeafe"><input id="absp330-ff" type="checkbox" ${state.ff?'checked':''} style="width:auto"> Use visible estimates when available</label>
          <button id="absp330-login">Save</button>
          <button id="absp330-repaint">Repaint</button>
          <div class="absp330-status">Status: ${state.user?.name ? `${esc(state.user.name)} [${esc(state.user.user_id)}] • ${fmt(state.total)}${isAdmin()?' • Admin':''}` : 'Not logged in'}</div>
        </div>
      </div>`;

    p.querySelector('#absp330-close').onclick=()=>{ state.panelOpen=false; renderPanel(); };
    p.querySelector('#absp330-login').onclick=login;
    p.querySelector('#absp330-repaint').onclick=()=>{ debugAdd('manual','repaint clicked'); schedule(50); };
    const dbgRefresh=p.querySelector('#absp330-debug-refresh'); if(dbgRefresh) dbgRefresh.onclick=()=>renderPanel();
    const dbgClear=p.querySelector('#absp330-debug-clear'); if(dbgClear) dbgClear.onclick=debugClear;
    mountIcon();
  }

  function login(){state.key=document.getElementById('absp330-key')?.value.trim()||'';state.ff=!!document.getElementById('absp330-ff')?.checked;GMX.set(KEY.api,state.key);GMX.set(KEY.ff,state.ff);req('POST','/api/login',{api_key:state.key}).then(r=>{if(r?.ok){state.user=r.user;state.total=Number(r.stats?.total||0);state.stats={strength:r.stats?.strength||0,defense:r.stats?.defense||0,speed:r.stats?.speed||0,dexterity:r.stats?.dexterity||0};GMX.set(KEY.user,JSON.stringify(state.user));GMX.set(KEY.total,state.total);GMX.set(KEY.stats,JSON.stringify(state.stats))}else alert('Login failed: '+(r?.error||'unknown'));renderPanel();schedule(80)})}

  function lastAttackTarget(){
    const saved=safeJson(GMX.get('absp_last_attack_target','null'));
    if(saved?.id && Date.now()-(saved.ts||0)<45*60*1000) return Number(saved.id);
    return extractId(location.href);
  }
  function detectTempFromLog(text){
    const t=String(text||'');
    const list=['Tear Gas Grenade','Smoke Grenade','Flash Grenade','Pepper Spray','Melatonin','Epinephrine','Grenade','HEG','Concussion Grenade','Sand','Claymore Mine'];
    for(const x of list){const re=new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'); if(re.test(t)) return x;}
    if(/threw .* grenade/i.test(t)) return 'Grenade used';
    if(/temporary weapon|temp weapon|temp used/i.test(t)) return 'Temp used';
    return '';
  }
  function detectArmorFromLog(text){
    const t=String(text||'').toLowerCase();
    if(/riot|dune|marauder|sentinel|eod|helmet|vest|body armor|armor/.test(t)) return 'Auto-detected armor mention';
    return '';
  }
  function detectFightResult(text){
    const me=String(state.user?.name||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const t=String(text||'').replace(/\s+/g,' ');
    if(me){
      if(new RegExp(me+'\\s+lost to','i').test(t)) return 'generic_loss';
      if(new RegExp(me+'\\s+was defeated by','i').test(t)) return 'generic_loss';
      if(new RegExp(me+'\\s+defeated|'+me+'\\s+won against|'+me+'\\s+hospitalized','i').test(t)) return 'generic_win';
    }
    if(/you lost|lost to/i.test(t)) return 'generic_loss';
    if(/you won|you defeated|hospitalized/i.test(t)) return 'generic_win';
    return '';
  }
  function maybeAutoFeedAttackLog(){
    const pageText=(document.body?.innerText||'');
    const isFight=/loader\.php\?sid=attack|attack log|Attacking|initiated an attack|lost to|fired .* rounds|threw .* grenade/i.test(location.href+' '+document.title+' '+pageText.slice(0,1600));
    if(!isFight) return;
    if(!state.user?.user_id || !state.total){debugAdd('attack log','not logged in',false);return;}
    const text=pageText.replace(/\s+/g,' ');
    const targetId=lastAttackTarget();
    if(!targetId) return;
    const result=detectFightResult(text);
    const temp=detectTempFromLog(text);
    const armor=detectArmorFromLog(text);
    const bucket=Math.floor(Date.now()/600000);
    if(result){debugAdd('attack log','detected '+result+' target '+targetId);
      const feedKey='absp_auto_fight_'+targetId+'_'+result+'_'+bucket;
      if(!GMX.get(feedKey,'')){
        GMX.set(feedKey,'1');
        req('POST','/api/attack/result',{
          attacker_id:state.user.user_id,
          attacker_name:state.user.name,
          attacker_total:state.total,
          attacker_stats:state.stats||{},
          target_id:targetId,
          target_name:'',
          result,
          fight_meta:{source:'auto attack-log parser',version:VERSION,temp_used:temp,armor_seen:armor}
        }).then(r=>{if(r?.ok&&r.player){saveIntel(targetId,r.player);schedule(150);}});
      }
    }
    if(temp || armor){debugAdd('traits','detected '+(temp||'')+' '+(armor||'')+' target '+targetId);
      const traitKey='absp_auto_trait_'+targetId+'_'+temp+'_'+armor+'_'+Math.floor(Date.now()/3600000);
      if(!GMX.get(traitKey,'')){
        GMX.set(traitKey,'1');
        req('POST','/api/target/flags',{
          target_id:targetId,
          estimate_total:Number(getIntel(targetId)?.total||getIntel(targetId)?.best_total||1),
          your_total:state.total,
          armor_seen:armor||undefined,
          temp_used_often:temp||undefined,
          source_detail:'auto attack-log trait parser '+VERSION
        }).then(r=>{if(r?.ok&&r.player){saveIntel(targetId,r.player);schedule(150);}});
      }
    }
  }

  document.addEventListener('keydown',e=>{if(e.altKey&&String(e.key).toLowerCase()==='a'&&ownProfile()){state.panelOpen=!state.panelOpen;renderPanel();mountIcon();}},true); // Alt+A PC opener, own profile only

  function boot(){initUI();setTimeout(()=>schedule(500),1200);setTimeout(()=>schedule(900),3500);let lastMutation=0;try{const obs=new MutationObserver(mutations=>{const now=Date.now();const gap=(location.href.includes('factions.php')||location.href.includes('war.php'))?2200:900;if(now-lastMutation<gap)return;lastMutation=now;let root=document;for(const m of mutations){for(const n of m.addedNodes){if(n&&n.nodeType===1&&n.querySelector){root=n;break}}}schedule(gap,root)});obs.observe(document.body,{childList:true,subtree:true})}catch{}setInterval(()=>{mountIcon();if(Date.now()-state.lastPaint>9000)schedule(800)},3000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
