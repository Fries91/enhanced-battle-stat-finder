// ==UserScript==
// @name         Advanced Battle Stat Predictor
// @namespace    Fries91.Torn.AdvancedBattleStatPredictor
// @version      3.2.1
// @description  Clean BSP true-mount build: uses BSP's exact target collection/insertion style, while keeping ABSP learning/cache/backend features.
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
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  const BASE = 'https://enhanced-battle-stat-finder.onrender.com';
  const VERSION = '3.2.1';

  const KEY = {
    api: 'absp_key',
    user: 'absp_user',
    total: 'absp_total',
    stats: 'absp_stats',
    cache: 'absp_intel_cache',
    icon: 'absp_icon_pos',
    ff: 'absp_ff_enabled'
  };

  const state = {
    key: GM_getValue(KEY.api, '') || GM_getValue('ebsf2_key', ''),
    user: safeJson(GM_getValue(KEY.user, 'null')) || safeJson(GM_getValue('ebsf2_user', 'null')),
    total: Number(GM_getValue(KEY.total, 0) || GM_getValue('ebsf2_total', 0) || 0),
    stats: safeJson(GM_getValue(KEY.stats, '{}')) || {},
    ff: !!GM_getValue(KEY.ff, true),
    panelOpen: false,
    pending: false,
    lastPaint: 0
  };

  const URL_TORN_ATTACK = "https://www.torn.com/loader.php?sid=attack&user2ID=";

  GM_addStyle(`
    .ebsf2-badge,#ebsf2-btn,#ebsf2-panel,#ebsf2-save,.ebsf2-pop,.absp-badge,.absp-hb-badge,.absp3-badge,.absp31-badge,.absp-bsp-badge,.absp320-holder,.absp320-badge{
      display:none!important;visibility:hidden!important;pointer-events:none!important
    }

    .TDup_ColoredStatsInjectionDiv.absp321-inject{position:absolute!important;z-index:25!important;display:block!important;visibility:visible!important;pointer-events:auto!important}
    .TDup_ColoredStatsInjectionDivWithoutHonorBar.absp321-inject{z-index:25!important;display:inline-block!important;visibility:visible!important;pointer-events:auto!important}

    .iconStats.absp321-badge{
      height:20px!important;width:46px!important;position:relative!important;text-align:center!important;
      font-size:11px!important;font-weight:bold!important;box-sizing:border-box!important;
      border:1px solid black!important;line-height:18px!important;font-family:initial!important;
      border-radius:5px!important;box-shadow:0 1px 4px rgba(0,0,0,.7)!important;
      cursor:pointer!important;pointer-events:auto!important;overflow:hidden!important;white-space:nowrap!important;
    }

    .absp321-easy{background:#052e16!important;color:#86efac!important;border-color:#22c55e!important}
    .absp321-fair{background:#422006!important;color:#fde68a!important;border-color:#facc15!important}
    .absp321-difficult{background:#431407!important;color:#fdba74!important;border-color:#f97316!important}
    .absp321-avoid{background:#450a0a!important;color:#fca5a5!important;border-color:#ef4444!important}
    .absp321-unknown{background:#111827!important;color:#cbd5e1!important;border-color:#64748b!important}

    #absp321-main{
      display:none;position:fixed;left:16px;bottom:116px;z-index:999996;
      width:42px;height:42px;border-radius:10px;border:1px solid #806500;
      background:#111827;color:#fde68a;font-size:22px;box-shadow:0 2px 10px #000c;touch-action:none
    }

    #absp321-panel{
      position:fixed;left:8px;right:8px;top:74px;bottom:66px;z-index:999997;
      background:linear-gradient(145deg,#05070d,#0b1220 55%,#111827);
      color:#e5e7eb;border:1px solid rgba(250,204,21,.55);border-radius:22px;
      box-shadow:0 18px 45px #000f;overflow:hidden;font-family:Arial,sans-serif;display:none
    }
    #absp321-panel.open{display:block}
    #absp321-panel h2{margin:0;padding:13px 14px;color:#fde68a;background:linear-gradient(90deg,#020617,#0f172a 70%,#111827);border-bottom:1px solid rgba(250,204,21,.35);font-size:17px;text-transform:uppercase;letter-spacing:.4px}
    #absp321-panel .body{max-height:calc(100vh - 165px);overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 12px 26px}
    #absp321-panel button{background:linear-gradient(180deg,#2a2110,#111827);color:#fde68a;border:1px solid rgba(250,204,21,.52);border-radius:14px;padding:8px 10px;margin:4px;font-weight:900}
    #absp321-panel input{box-sizing:border-box;width:100%;background:#020617;color:#f8fafc;border:1px solid rgba(250,204,21,.28);border-radius:14px;padding:10px;margin:6px 0}

    .absp321-hero{margin:0 0 10px;padding:14px;border:1px solid rgba(250,204,21,.35);border-radius:18px;background:linear-gradient(135deg,rgba(250,204,21,.12),rgba(59,130,246,.08) 55%,rgba(15,23,42,.9))}
    .absp321-hero-title{font-size:22px;font-weight:1000;color:#facc15;text-transform:uppercase}
    .absp321-chip{display:inline-flex;margin:7px 4px 0 0;padding:3px 7px;border-radius:999px;background:#020617;border:1px solid rgba(250,204,21,.32);color:#fde68a;font-weight:900;font-size:11px}
    .absp321-card{position:relative;padding:12px 12px 12px 14px;border-radius:18px;background:linear-gradient(145deg,rgba(15,23,42,.96),rgba(2,6,23,.96));border:1px solid rgba(148,163,184,.25);box-shadow:inset 3px 0 0 rgba(250,204,21,.55),0 6px 14px rgba(0,0,0,.35);margin-bottom:10px}
    .absp321-card b{display:block;color:#fde68a;font-size:14px;margin-bottom:7px;text-transform:uppercase}
    .absp321-card p,.absp321-card li{color:#dbeafe;line-height:1.42}
    .absp321-card ul{margin:7px 0 0 18px;padding:0}
    .absp321-status{margin-top:8px;padding:8px;border-radius:12px;background:rgba(2,6,23,.72);border:1px solid rgba(59,130,246,.25);color:#bfdbfe}

    .TDup_BSPProfileInjection.absp321-profile{
      margin:8px 0 4px 0!important;padding:6px 8px!important;border-radius:8px!important;
      background:#111827!important;border:1px solid #64748b!important;color:#cbd5e1!important;
      font:900 12px Arial,sans-serif!important;display:inline-flex!important;align-items:center!important;gap:6px!important
    }

    .absp321-pop{position:fixed;z-index:999999;background:#0b1120;color:#e5e7eb;border:1px solid #806500;border-radius:12px;box-shadow:0 6px 22px #000d;width:255px;font:12px Arial,sans-serif;overflow:hidden}
    .absp321-pop-head{display:flex;justify-content:space-between;align-items:center;background:#020617;color:#facc15;padding:8px 10px}
    .absp321-pop-head button{background:#1f2937!important;color:#facc15!important;border:1px solid #806500!important;border-radius:6px!important;padding:1px 6px!important}
    .absp321-pop-body{padding:10px;line-height:1.45}
    .absp321-tag{display:inline-flex;align-items:center;justify-content:center;min-width:54px;padding:2px 6px;border-radius:999px;font-weight:900;border:1px solid #64748b;background:#111827;color:#cbd5e1}
    .absp321-red{background:#450a0a!important;color:#fca5a5!important;border-color:#ef4444!important}
    .absp321-orange{background:#431407!important;color:#fdba74!important;border-color:#f97316!important}
    .absp321-yellow{background:#422006!important;color:#fde68a!important;border-color:#facc15!important}
    .absp321-green{background:#052e16!important;color:#86efac!important;border-color:#22c55e!important}
    .absp321-blue{background:#172554!important;color:#93c5fd!important;border-color:#3b82f6!important}
    .absp321-grey{background:#111827!important;color:#cbd5e1!important;border-color:#64748b!important}
    .absp321-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:7px}
    .absp321-grid div{background:#111827;border:1px solid #334155;border-radius:8px;padding:5px;display:flex;justify-content:space-between}
  `);

  function safeJson(s){ try { return JSON.parse(s); } catch { return null; } }
  function esc(s){ return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function cleanText(el){ return (el?.textContent || '').replace(/\s+/g,' ').trim(); }

  function IsPageStart(url){ return window.location.href.startsWith(url); }
  function IsUrlEndsWith(value){ return window.location.href.endsWith(value); }

  const Page = {
    Profile: () => IsPageStart('https://www.torn.com/profiles.php'),
    Faction: () => IsPageStart('https://www.torn.com/factions.php'),
    FactionControl: () => window.location.href.includes('/tab=controls'),
    FactionControlPayday: () => window.location.href.includes('tab=controls&option=pay-day'),
    FactionControlApplications: () => window.location.href.includes('tab=controls&option=application'),
    Chain: () => IsPageStart('https://www.torn.com/factions.php?step=your#/war/chain'),
    HallOfFame: () => IsPageStart('https://www.torn.com/page.php?sid=hof') || IsPageStart('https://www.torn.com/halloffame.php'),
    Search: () => IsPageStart('https://www.torn.com/page.php?sid=UserList'),
    Company: () => IsPageStart('https://www.torn.com/joblist.php'),
    RecruitCitizens: () => IsPageStart('https://www.torn.com/bringafriend.php'),
    Friends: () => IsPageStart('https://www.torn.com/page.php?sid=list&type=friends'),
    Enemies: () => IsPageStart('https://www.torn.com/page.php?sid=list&type=enemies'),
    Targets: () => IsPageStart('https://www.torn.com/page.php?sid=list&type=targets'),
    PointMarket: () => IsPageStart('https://www.torn.com/pmarket.php'),
    Market: () => IsPageStart('https://www.torn.com/page.php?sid=ItemMarket'),
    Hospital: () => IsPageStart('https://www.torn.com/hospitalview.php'),
    Abroad: () => IsPageStart('https://www.torn.com/index.php?page=people'),
    Forum: () => IsPageStart('https://www.torn.com/forums.php'),
    ForumThread: () => IsPageStart('https://www.torn.com/forums.php#/p=threads'),
    ForumSearch: () => IsPageStart('https://www.torn.com/forums.php#/p=search'),
    Bounty: () => IsPageStart('https://www.torn.com/bounties.php'),
    Properties: () => IsPageStart('https://www.torn.com/properties.php'),
    War: () => IsPageStart('https://www.torn.com/war.php'),
    ChainReport: () => IsPageStart('https://www.torn.com/war.php?step=chainreport'),
    RWReport: () => IsPageStart('https://www.torn.com/war.php?step=rankreport'),
    Competition: () => IsPageStart('https://www.torn.com/competition.php'),
    Elimination: () => IsPageStart('https://www.torn.com/page.php?sid=competition'),
    EliminationAttacks: () => IsPageStart('https://www.torn.com/page.php?sid=competition#/attacks'),
    EliminationRevenge: () => IsPageStart('https://www.torn.com/page.php?sid=competition#/revenge'),
    RussianRoulette: () => IsPageStart('https://www.torn.com/page.php?sid=russianRoulette'),
    Attack: () => IsPageStart('https://www.torn.com/loader.php?sid=attack') || IsPageStart('https://www.torn.com/page.php?sid=attack')
  };

  function fmt(n){
    n = Number(n || 0);
    if(n >= 1e12) return (n/1e12).toFixed(1).replace('.0','') + 't';
    if(n >= 1e9) return (n/1e9).toFixed(1).replace('.0','') + 'b';
    if(n >= 1e6) return (n/1e6).toFixed(1).replace('.0','') + 'm';
    if(n >= 1e3) return (n/1e3).toFixed(1).replace('.0','') + 'k';
    return String(Math.round(n));
  }

  function parseNum(v){
    const m = String(v ?? '').toLowerCase().replace(/,/g,'').match(/([0-9]+(?:\.[0-9]+)?)\s*([kmbt])?/);
    if(!m) return 0;
    let n = Number(m[1]);
    if(m[2] === 'k') n *= 1e3;
    if(m[2] === 'm') n *= 1e6;
    if(m[2] === 'b') n *= 1e9;
    if(m[2] === 't') n *= 1e12;
    return Math.round(n);
  }

  function extractId(blob){
    blob = String(blob || '');
    let m = blob.match(/profiles\.php\?XID=(\d{3,10})/i);
    if(m) return Number(m[1]);
    m = blob.match(/[?&]XID=(\d{3,10})/i);
    if(m) return Number(m[1]);
    m = blob.match(/[?&]user2ID=(\d{3,10})/i);
    if(m) return Number(m[1]);
    m = blob.match(/(?:XID|user2ID|userID|targetID|profileId|targetId|data-userid|data-user|data-id)[=\\"':%26 ]+(\d{3,10})/i);
    if(m) return Number(m[1]);
    return null;
  }

  function cache(){ return safeJson(GM_getValue(KEY.cache, '{}')) || {}; }
  function getIntel(id){ return id ? cache()[String(id)] || null : null; }

  function saveIntel(id, intel){
    if(!id || !intel) return;
    const c = cache();
    c[String(id)] = {...intel, confidence:riskConfidence(intel), user_id:Number(id), saved_at:Date.now()};
    GM_setValue(KEY.cache, JSON.stringify(c));
  }

  function req(method, path, data){
    return new Promise(resolve => {
      GM_xmlhttpRequest({
        method, url: BASE + path,
        headers: {'Content-Type':'application/json'},
        data: data ? JSON.stringify(data) : undefined,
        timeout: 20000,
        onload: r => { try { resolve(JSON.parse(r.responseText)); } catch { resolve({ok:false,error:'bad json'}); } },
        onerror: e => resolve({ok:false,error:String(e)}),
        ontimeout: () => resolve({ok:false,error:'timeout'})
      });
    });
  }

  function diff(total, label){
    const l = String(label || '').toLowerCase();
    if(l.includes('avoid')) return 'avoid';
    if(l.includes('difficult') || l.includes('hard')) return 'difficult';
    if(l.includes('fair') || l.includes('good')) return 'fair';
    if(l.includes('easy')) return 'easy';

    if(total && state.total){
      const r = Number(total) / Number(state.total);
      if(r <= .75) return 'easy';
      if(r <= 1.15) return 'fair';
      if(r <= 1.75) return 'difficult';
      return 'avoid';
    }
    return 'unknown';
  }

  function riskConfidence(intel){
    let conf = Number(intel?.confidence || 0);
    const total = Number(intel?.best_total || intel?.total || 0);
    if(!total || !state.total) return conf;

    const exact = /spy|manual|exact/i.test(String(intel?.source || ''));
    const ratio = total / state.total;

    if(exact){
      if(ratio >= 10) conf = Math.min(conf || 75, 75);
      else if(ratio >= 5) conf = Math.min(conf || 80, 80);
      return Math.max(1, Math.min(100, Math.round(conf)));
    }

    let cap = 78;
    if(ratio >= 20) cap = 18;
    else if(ratio >= 10) cap = 25;
    else if(ratio >= 5) cap = 35;
    else if(ratio >= 2.5) cap = 45;
    else if(ratio >= 1.75) cap = 55;
    else if(ratio >= 1.15) cap = 65;

    return Math.max(1, Math.min(100, Math.round(Math.min(conf || cap, cap))));
  }

  function confColor(c){
    c = Number(c || 0);
    if(c >= 66) return 'green';
    if(c >= 46) return 'yellow';
    if(c >= 26) return 'orange';
    return 'red';
  }

  function bspIntel(id){
    if(!id) return null;
    const keys = [
      'tdup.battleStatsPredictor.cache.prediction.' + id,
      'BSP_prediction_' + id,
      'battleStatsPredictor_' + id
    ];

    for(const k of keys){
      try{
        const raw = localStorage.getItem(k) || GM_getValue(k, '');
        if(!raw) continue;
        const p = JSON.parse(raw);
        const n = parseNum(p.TBS || p.TargetTBS || p.bs_estimate || p.estimate || p.total || p.Total);
        if(n) return {total:n,best_total:n,label:diff(n),confidence:65,source:'bsp_cache'};
      }catch {}
    }
    return null;
  }

  function visibleIntel(){
    const body = (document.body?.innerText || '').replace(/\s+/g, ' ');
    const m = body.match(/Est\.?\s*Stats:\s*([0-9.,]+\s*[kmbt]?)/i) || body.match(/Estimated\s*Stats:\s*([0-9.,]+\s*[kmbt]?)/i);
    if(!m) return null;
    const n = parseNum(m[1]);
    return n ? {total:n,best_total:n,label:diff(n),confidence:70,source:'visible_ff_bsp'} : null;
  }

  function currentProfileId(){
    if(!Page.Profile()) return null;
    return extractId(location.href) || extractId(document.body?.innerHTML || '');
  }

  function isWarHeavyPage(){
    const body = (document.body?.innerText || '').slice(0, 7000);
    return (Page.Faction() || Page.War()) && /Members\s+Score\s+Status\s+Attack|Lead Target|Chain active|No active chain/i.test(body);
  }

  function isBadContainer(el){
    if(!el) return true;

    let n = el;
    for(let i=0; i<10 && n && n !== document.body; i++, n=n.parentElement){
      const cls = String(n.className || '').toLowerCase();
      const id = String(n.id || '').toLowerCase();
      const aria = String(n.getAttribute?.('aria-label') || '').toLowerCase();
      const role = String(n.getAttribute?.('role') || '').toLowerCase();
      const t = cleanText(n);

      if(n.closest?.('#absp321-panel,.absp321-pop')) return true;

      if(/chat|message|msg|conversation|channel|compose|textarea|chatbox|chat-box|chatwindow|chat-window/.test(cls + ' ' + id + ' ' + aria + ' ' + role)) return true;
      if(/Type your message here|Last message:|New message|send message/i.test(t)) return true;

      if(/tooltip|tip|popover|dialog|modal|profile-mini|preview|hover|dropdown|context/.test(cls + ' ' + id + ' ' + aria + ' ' + role)) return true;

      if(/Cash Me if You Can|Best of the Lot|THIEF|LOOKOUT|PICKLOCK|MUSCLE|IMITATOR|CAR THIEF|JOIN|24hrs/i.test(t)) return true;

      if(/Messages|Events|Awards|Home|Items|City|Wheel|Stocks/i.test(t) && t.length < 100) return true;
    }

    return false;
  }

  function visible(el){
    const r = el?.getBoundingClientRect?.();
    if(!r) return false;
    if(r.width <= 0 || r.height <= 0) return false;
    if(r.bottom < -100 || r.top > innerHeight + 600) return false;
    return true;
  }

  function IsThereMyNodeAlready(node, urlAttack){
    if(!node) return false;
    if(node.className === "TDup_ColoredStatsInjectionDiv") return true;
    if(String(node.className || '').includes('absp321-inject')) return true;
    if(node.href !== undefined && String(node.href).startsWith(urlAttack)) return true;

    for(let i=0; i<node.childNodes.length; i++){
      if(IsThereMyNodeAlready(node.childNodes[i], urlAttack)) return true;
    }

    return false;
  }

  function ClearInjectedStatsInCell(cell){
    if(!cell) return;
    cell.querySelectorAll('.TDup_ColoredStatsInjectionDiv.absp321-inject,.TDup_ColoredStatsInjectionDivWithoutHonorBar.absp321-inject,.TDup_BSPProfileInjection.absp321-profile').forEach(el => el.remove());
  }

  function addDictTarget(dict, playerId, mount){
    if(!playerId || !mount || isBadContainer(mount) || !visible(mount)) return;
    if(!(playerId in dict)) dict[playerId] = [];
    if(!dict[playerId].includes(mount)) dict[playerId].push(mount);
  }

  function BSP_InjectInFactionStylePage(node, dict){
    if(!node) return;

    let el = node.querySelectorAll('a');

    for(let i = 0; i < el.length; ++i){
      let isDone = false;
      let iter = el[i];

      if(iter.href != null){
        let myArray = iter.href.split("?XID=");
        if(myArray.length == 2){
          let playerId = parseInt(myArray[1]);
          let isWall = iter.className == "user name ";

          if(iter.rel == "noopener noreferrer" || isWall == true){
            addDictTarget(dict, playerId, iter);
            isDone = true;
          }

          for(let j = 0; j < iter.children.length; ++j){
            if(isDone) break;

            let children = iter.children[j];
            for(let k = 0; children && k < children.children.length; ++k){
              if(children != undefined && children.tagName != undefined && children.tagName == "IMG"){
                addDictTarget(dict, playerId, children);
                isDone = true;
                break;
              } else {
                let subChildren = children.children[k];
                if(subChildren != undefined && subChildren.tagName != undefined && subChildren.tagName == "IMG"){
                  addDictTarget(dict, playerId, children);
                  isDone = true;
                  break;
                }
              }
            }

            // Extra safety for Torn honor bars that use background images instead of <img>.
            if(!isDone && children){
              const cls = String(children.className || '').toLowerCase();
              const st = String(children.getAttribute?.('style') || '').toLowerCase();
              if(cls.includes('honor') || cls.includes('name') || st.includes('background-image')){
                addDictTarget(dict, playerId, children);
                isDone = true;
                break;
              }
            }
          }
        }
      }
    }
  }

  function BSP_InjectInBountyPage(node, dict){
    let el = node.querySelectorAll('.target.left');
    for(let i = 0; i < el.length; ++i){
      let iter = el[i];
      let children = iter.children;
      if(!children || !children[0] || !children[0].href) continue;

      let myArray = children[0].href.split("?XID=");
      if(myArray.length == 2){
        let playerId = parseInt(myArray[1]);
        addDictTarget(dict, playerId, iter);
      }
    }
  }

  function BSP_InjectInGenericGridPageNewTornFormat(node, dict){
    let targetLinks = node.querySelectorAll('a[href^="/profiles.php?"]');
    targetLinks.forEach(targetLink => {
      let url = new URL(targetLink.href, window.location.origin);
      let playerId = url.searchParams.get('XID');
      if(playerId == undefined) return;

      let parentN = targetLink.parentNode;
      if(parentN == undefined || parentN.className == undefined) return;

      if(parentN.className.includes('honorWrap')){
        addDictTarget(dict, Number(playerId), parentN);
      }
    });
  }

  function BSP_InjectInEliminationPage(node, dict){
    let targetLinks = node.querySelectorAll('a[href^="/profiles.php?"]');
    targetLinks.forEach(targetLink => {
      let url = new URL(targetLink.href, window.location.origin);
      let playerId = url.searchParams.get('XID');
      if(playerId == undefined) return;

      let parentN = targetLink.parentNode;
      if(parentN == undefined || parentN.className == undefined) return;

      if(parentN.className.includes('dataGridData')){
        const prevPlayerId = parentN.dataset.absp321PlayerId;
        if(prevPlayerId === String(playerId)) return;

        if(prevPlayerId) ClearInjectedStatsInCell(parentN);
        parentN.dataset.absp321PlayerId = String(playerId);
        addDictTarget(dict, Number(playerId), parentN);
      }
    });
  }

  function BSP_InjectInGenericGridPage(node, dict){
    let el = node.querySelectorAll('.user.name');

    for(let i = 0; i < el.length; ++i){
      let iter = el[i];
      let playerId = -1;

      let myArray = iter.innerHTML.split("[");
      if(myArray.length >= 2){
        myArray = myArray[1].split("]");
        if(myArray.length >= 1) playerId = parseInt(myArray[0]);
      }

      if(playerId == -1 && iter.title != undefined){
        let myArray2 = iter.title.split("[");
        if(myArray2.length >= 2){
          myArray2 = myArray2[1].split("]");
          if(myArray2.length >= 1) playerId = parseInt(myArray2[0]);
        }
      }

      if(playerId == -1) continue;

      let parentNode = iter.parentNode;
      let style = window.getComputedStyle(parentNode);
      if(style.display == "none") continue;

      let thisStyle = window.getComputedStyle(iter);
      if(thisStyle.width == "0px") continue;

      addDictTarget(dict, playerId, iter);
    }
  }

  function BSP_InjectInAttackPage(node, dict){
    let nodeForAttackPage = Array.from(node.querySelectorAll('*')).find(element => String(element.className).includes('titleContainer'));
    if(nodeForAttackPage){
      const urlObj = new URL(window.location.href);
      const playerId = urlObj.searchParams.get('user2ID');
      if(playerId) addDictTarget(dict, Number(playerId), nodeForAttackPage);
    }
  }

  function collectTargets(root=document){
    const dict = {};

    // Profile page exactly like BSP: .buttons-wrap unless using alternate user-information.
    if(Page.Profile()){
      const profileId = currentProfileId();
      if(profileId){
        let el = root.querySelectorAll ? root.querySelectorAll('.buttons-wrap') : [];
        if(el.length == 0) el = document.querySelectorAll('.buttons-wrap');

        if(el.length > 0){
          dict[profileId] = [el[0]];
          return dict;
        }

        const alt = document.querySelectorAll('.user-information');
        if(alt.length > 0){
          dict[profileId] = [alt[0]];
          return dict;
        }
      }
    }

    if(Page.Attack()){
      BSP_InjectInAttackPage(document, dict);
      return dict;
    }

    if(Page.Bounty()) BSP_InjectInBountyPage(root, dict);
    if(Page.Elimination()) BSP_InjectInEliminationPage(root, dict);

    BSP_InjectInGenericGridPageNewTornFormat(root, dict);
    BSP_InjectInFactionStylePage(root, dict);
    BSP_InjectInGenericGridPage(root, dict);

    return dict;
  }

  function mainMarginWhenDisplayingHonorBars(){
    let margin = "-10px -9px";

    if(Page.FactionControl()){
      if(Page.FactionControlPayday()) margin = '-25px 20px';
      else if(Page.FactionControlApplications()) margin = '-10px 0px';
      else margin = '0px';
    } else if(Page.Faction()){
      margin = "-10px -9px";
    } else if(Page.HallOfFame()) {
      margin = "-10px -9px";
    } else if(Page.Search()) {
      margin = '6px -8px';
    } else if(Page.Company()) {
      margin = '0px';
    } else if(Page.RecruitCitizens()) {
      margin = '0px';
    } else if(Page.Friends() || Page.Enemies() || Page.Targets()) {
      margin = '-10px 0px';
    } else if(Page.PointMarket()) {
      margin = '5px -5px';
    } else if(Page.Market()) {
      margin = '-10px -10px';
    } else if(Page.Hospital()) {
      margin = '0px 6px';
    } else if(Page.Abroad()) {
      margin = '5px -4px';
    } else if(Page.Forum()) {
      margin = '7px 0px';
      if(Page.ForumThread() || Page.ForumSearch()) margin = '-26px 28px';
    } else if(Page.Properties()) {
      margin = '0px';
    } else if(Page.Competition()) {
      if(window.location.href.startsWith("https://www.torn.com/competition.php#/p=revenge")) margin = '0px 0px';
      else margin = '10px 0px';
    } else if(Page.Elimination()) {
      if(Page.EliminationAttacks()) margin = '-11px -100px';
      else margin = '-11px 0px';
    }

    return margin;
  }

  function marginForMount(mount){
    let margin = mainMarginWhenDisplayingHonorBars();

    const isWall = Page.Faction() && !Page.FactionControl() && mount.className == "user name ";
    if(isWall) margin = "-28px 54px";

    if(Page.Competition() && window.location.href.startsWith("https://www.torn.com/competition.php#/p=recent")){
      if(hasParentWithClass(mount, "name lost")) margin = "12px 0px";
      else if(hasParentWithClass(mount, "name right")) margin = "0px 0px";
    }

    return margin;
  }

  function hasParentWithClass(element, className){
    let parent = element.parentElement;
    while(parent){
      if(parent.classList && parent.classList.value.startsWith(className)) return true;
      parent = parent.parentElement;
    }
    return false;
  }

  function updateBadge(badge, intel){
    const total = Number(intel?.best_total || intel?.total || 0);

    if(!total){
      badge.className = 'iconStats absp321-badge absp321-unknown';
      badge.textContent = 'N/A';
      badge.title = 'No usable intel yet';
      return;
    }

    const adjusted = {...intel, confidence:riskConfidence(intel)};
    const d = diff(total, adjusted.label);
    badge.className = `iconStats absp321-badge absp321-${d}`;
    badge.textContent = fmt(total);
    badge.title = `${adjusted.source || 'intel'} • ${d} • ${adjusted.confidence}% • Tap for details`;
  }

  function intelFor(id){
    return getIntel(id) || bspIntel(id);
  }

  function buildGridInjection(targetId, mount, intel){
    const urlAttack = URL_TORN_ATTACK + targetId;

    if(IsThereMyNodeAlready(mount, urlAttack)) return null;

    const div = document.createElement("div");
    div.className = Page.Elimination() ? "TDup_ColoredStatsInjectionDivWithoutHonorBar absp321-inject" : "TDup_ColoredStatsInjectionDiv absp321-inject";
    div.dataset.targetId = String(targetId);

    if(!Page.Elimination()){
      div.style.margin = marginForMount(mount);
    }

    const a = document.createElement("a");
    a.href = urlAttack;
    a.target = "_blank";
    a.addEventListener('click', e => {
      // Let attack link open, but also remember target.
      GM_setValue('absp_last_attack_target', JSON.stringify({id:Number(targetId), ts:Date.now()}));
    }, true);

    const badge = document.createElement("div");
    badge.dataset.targetId = String(targetId);
    badge.dataset.key = "bsptrue:" + targetId + ":" + Math.random().toString(36).slice(2);
    updateBadge(badge, intel);

    a.appendChild(badge);
    div.appendChild(a);
    return div;
  }

  function buildProfileInjection(targetId, intel){
    const div = document.createElement("div");
    div.className = "TDup_BSPProfileInjection absp321-profile";
    div.dataset.targetId = String(targetId);

    const badge = document.createElement("div");
    badge.dataset.targetId = String(targetId);
    badge.dataset.key = "profile:" + targetId;
    updateBadge(badge, intel);

    div.appendChild(document.createTextNode("ABSP "));
    div.appendChild(badge);
    return div;
  }

  function fetchIntel(id, badge){
    if(!id || !state.key || !badge || badge.dataset.fetching === '1') return;

    badge.dataset.fetching = '1';
    req('GET', `/api/player/${id}/intel?your_total=${state.total || 0}`).then(r => {
      badge.dataset.fetching = '';
      if(r?.ok && r.player){
        saveIntel(id, r.player);
        updateBadge(badge, getIntel(id) || r.player);
      }
    });
  }

  async function paint(root=document){
    state.pending = false;
    state.lastPaint = Date.now();

    removeOldBadges();
    updateIcon();

    const dict = collectTargets(root);
    const liveMounts = new Set();

    for(const targetIdStr of Object.keys(dict)){
      const targetId = Number(targetIdStr);
      const mounts = dict[targetIdStr] || [];

      for(const mount of mounts){
        if(!mount || isBadContainer(mount) || !visible(mount)) continue;

        liveMounts.add(mount);

        let intel = intelFor(targetId);
        if(!intel && Page.Profile()) intel = visibleIntel();
        if(intel) saveIntel(targetId, intel);

        if(Page.Profile()){
          if(mount.querySelector('.TDup_BSPProfileInjection.absp321-profile')) continue;
          const div = buildProfileInjection(targetId, intel);
          if(mount.classList && mount.classList.contains('user-information') && mount.firstChild?.childNodes?.[1]){
            mount.firstChild.insertBefore(div, mount.firstChild.childNodes[1]);
          } else {
            mount.appendChild(div);
          }

          const badge = div.querySelector('.absp321-badge');
          if(!intel) setTimeout(() => fetchIntel(targetId, badge), 900);
          continue;
        }

        const injected = buildGridInjection(targetId, mount, intel);
        if(!injected) continue;

        const firstChild = mount.firstChild;
        mount.insertBefore(injected, firstChild);

        const badge = injected.querySelector('.absp321-badge');
        if(!intel && !isWarHeavyPage()) setTimeout(() => fetchIntel(targetId, badge), 900);
      }
    }

    document.querySelectorAll('.absp321-inject,.TDup_BSPProfileInjection.absp321-profile').forEach(el => {
      if(isBadContainer(el)) el.remove();
    });
  }

  function removeOldBadges(){
    document.querySelectorAll('.ebsf2-badge,#ebsf2-btn,#ebsf2-panel,#ebsf2-save,.ebsf2-pop,.absp-badge,.absp-hb-badge,.absp3-badge,.absp31-badge,.absp-bsp-badge,.absp320-holder,.absp320-badge').forEach(x => {
      x.style.display = 'none';
      x.style.visibility = 'hidden';
      x.style.pointerEvents = 'none';
    });

    document.querySelectorAll('.absp321-inject,.TDup_BSPProfileInjection.absp321-profile').forEach(el => {
      if(isBadContainer(el)) el.remove();
    });
  }

  function runIdle(fn, timeout=1400){
    if('requestIdleCallback' in window) requestIdleCallback(fn, {timeout});
    else setTimeout(fn, Math.min(timeout, 800));
  }

  function schedule(ms=900, root=document){
    if(state.pending) return;
    state.pending = true;
    clearTimeout(window.__absp321Timer);
    window.__absp321Timer = setTimeout(() => runIdle(() => paint(root), isWarHeavyPage() ? 2200 : 1400), isWarHeavyPage() ? Math.max(ms, 1800) : ms);
  }

  function confTag(v){
    const n = Number(v || 0);
    return `<span class="absp321-tag absp321-${confColor(n)}">${Math.max(0, Math.min(100, Math.round(n)))}%</span>`;
  }

  function tag(v){
    let color = 'grey';
    const l = String(v || 'Unknown').toLowerCase();
    if(l.includes('avoid') || l.includes('high') || l.includes('heavy')) color = 'red';
    else if(l.includes('difficult')) color = 'orange';
    else if(l.includes('fair') || l.includes('equal')) color = 'yellow';
    else if(l.includes('easy')) color = 'green';
    else if(l.includes('low') || l.includes('light')) color = 'blue';
    return `<span class="absp321-tag absp321-${color}">${esc(v || 'Unknown')}</span>`;
  }

  function popup(badge){
    document.querySelectorAll('.absp321-pop').forEach(x => x.remove());

    const id = badge.dataset.targetId ? Number(badge.dataset.targetId) : null;
    const intel = (id && getIntel(id)) || (id && bspIntel(id)) || {total:parseNum(badge.textContent), confidence:0, source:'badge'};
    const total = Number(intel?.best_total || intel?.total || 0);
    const conf = riskConfidence(intel);
    const d = diff(total, intel?.label);

    const pop = document.createElement('div');
    pop.className = 'absp321-pop';
    pop.innerHTML = `
      <div class="absp321-pop-head"><b>⚔️ Battle Intel</b><button class="close">×</button></div>
      <div class="absp321-pop-body">
        <div><b>Total:</b> ${total ? fmt(total) : 'N/A'} ${tag(total ? d : 'Unknown')}</div>
        <div><b>Source:</b> ${esc(intel?.source || 'none')}</div>
        <div><b>Confidence:</b> ${confTag(conf)}</div>
        ${total && state.total && total / state.total >= 2.5 ? `<div style="margin-top:7px;padding:6px;border-radius:8px;background:#431407;color:#fdba74;border:1px solid #f97316;font-weight:900">Confidence reduced: high stat gap</div>` : ''}
        <hr>
        <div class="absp321-grid">
          <div><b>STR</b>${tag('Unknown')}</div>
          <div><b>DEF</b>${tag('Unknown')}</div>
          <div><b>SPD</b>${tag('Unknown')}</div>
          <div><b>DEX</b>${tag('Unknown')}</div>
          <div><b>Armor</b>${tag('Unknown')}</div>
          <div><b>Temp</b>${tag('Unknown')}</div>
        </div>
      </div>`;
    document.body.appendChild(pop);

    const r = badge.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(innerWidth - 265, r.left)) + 'px';
    pop.style.top = Math.max(78, Math.min(innerHeight - 280, r.bottom + 6)) + 'px';
    pop.querySelector('.close').onclick = e => { e.stopPropagation(); pop.remove(); schedule(120); };
  }

  document.addEventListener('click', e => {
    const b = e.target.closest?.('.absp321-badge');
    if(!b) return;
    e.preventDefault();
    e.stopPropagation();
    popup(b);
  }, true);

  document.addEventListener('click', e => {
    const el = e.target.closest?.('a,button,[onclick]');
    if(!el) return;

    const blob = [el.href, el.getAttribute?.('href'), el.getAttribute?.('onclick'), el.textContent, el.getAttribute?.('title')].filter(Boolean).join(' ');
    if(!/sid=attack|user2ID|attack|fight/i.test(blob)) return;

    const id = extractId(blob);
    if(id) GM_setValue('absp_last_attack_target', JSON.stringify({id, ts:Date.now()}));
  }, true);

  function initUI(){
    if(document.getElementById('absp321-main')) return;

    const btn = document.createElement('button');
    btn.id = 'absp321-main';
    btn.textContent = '🧠';
    btn.onclick = () => { state.panelOpen = !state.panelOpen; renderPanel(); };
    document.body.appendChild(btn);

    const panel = document.createElement('div');
    panel.id = 'absp321-panel';
    document.body.appendChild(panel);

    makeDraggable(btn);
    renderPanel();
  }

  function ownProfile(){
    if(!state.user?.user_id || !Page.Profile()) return false;
    const pid = currentProfileId();
    if(pid) return Number(pid) === Number(state.user.user_id);
    return !!(state.user?.name && String(document.title || '').toLowerCase().includes(String(state.user.name).toLowerCase()));
  }

  function updateIcon(){
    const b = document.getElementById('absp321-main');
    if(b) b.style.display = ownProfile() ? 'block' : 'none';
  }

  function renderPanel(){
    const p = document.getElementById('absp321-panel');
    if(!p) return;

    p.className = state.panelOpen ? 'open' : '';
    p.innerHTML = `
      <h2>🧠⚔️ Advanced Battle Stat Predictor <button style="float:right" id="absp321-close">Close</button></h2>
      <div class="body">
        <div class="absp321-hero">
          <div class="absp321-hero-title">BSP True Mount</div>
          <div style="color:#cbd5e1;margin-top:4px;line-height:1.35">This build uses BSP’s real collection and insertion style. ABSP still handles learning, cache, backend intel, and popup details.</div>
          <span class="absp321-chip">BSP target rules</span><span class="absp321-chip">BSP insertBefore</span><span class="absp321-chip">ABSP learning kept</span>
        </div>

        <div class="absp321-card"><b>📜 Rules</b><ul><li>Use predictions as guidance, not guaranteed wins.</li><li>Do not share private spy/manual data unless you are allowed to.</li><li>Fresh intel is better. Old intel may be stale.</li><li>Respect Torn’s API rules, rate limits, and fair-use expectations.</li></ul></div>
        <div class="absp321-card"><b>⚔️ How It Works</b><p>Faction/hospital/jail/war rows are mounted using BSP’s player link and honor child logic. Profile pages use BSP’s buttons-wrap/user-information mount.</p></div>
        <div class="absp321-card"><b>✅ Terms of Service</b><p>All numbers are estimates and may be wrong. You are responsible for your own attacks, choices, losses, wins, and respect gains.</p></div>
        <div class="absp321-card"><b>🔑 API Key Use & Storage</b><p>Use a <b>limited Torn API key</b>. Your key is stored locally in PDA/userscript storage. No Torn password is ever requested.</p></div>

        <div class="absp321-card">
          <b>🍽️ Login</b>
          <input id="absp321-key" type="password" placeholder="Torn limited API key" value="${esc(state.key || '')}">
          <label style="display:block;margin:8px 0;color:#dbeafe"><input id="absp321-ff" type="checkbox" ${state.ff?'checked':''} style="width:auto"> Use FF/BSP visible/base intel when available</label>
          <button id="absp321-login">Login / Save</button>
          <button id="absp321-repaint">Repaint badges</button>
          <div class="absp321-status">Status: ${state.user?.name ? `${esc(state.user.name)} [${esc(state.user.user_id)}] • ${fmt(state.total)}` : 'Not logged in'}</div>
        </div>
      </div>`;

    p.querySelector('#absp321-close').onclick = () => { state.panelOpen = false; renderPanel(); };
    p.querySelector('#absp321-login').onclick = login;
    p.querySelector('#absp321-repaint').onclick = () => schedule(50);
    updateIcon();
  }

  async function login(){
    state.key = document.getElementById('absp321-key')?.value.trim() || '';
    state.ff = !!document.getElementById('absp321-ff')?.checked;
    GM_setValue(KEY.api, state.key);
    GM_setValue(KEY.ff, state.ff);

    const r = await req('POST', '/api/login', {api_key: state.key});
    if(r?.ok){
      state.user = r.user;
      state.total = Number(r.stats?.total || 0);
      state.stats = {
        strength: r.stats?.strength || 0,
        defense: r.stats?.defense || 0,
        speed: r.stats?.speed || 0,
        dexterity: r.stats?.dexterity || 0
      };
      GM_setValue(KEY.user, JSON.stringify(state.user));
      GM_setValue(KEY.total, state.total);
      GM_setValue(KEY.stats, JSON.stringify(state.stats));
    }
    renderPanel();
    schedule(80);
  }

  function makeDraggable(btn){
    const saved = safeJson(GM_getValue(KEY.icon, 'null'));
    if(saved && saved.left != null && saved.top != null){
      btn.style.left = saved.left + 'px';
      btn.style.top = saved.top + 'px';
      btn.style.bottom = 'auto';
    }

    let drag = false, moved = false, sx = 0, sy = 0, sl = 0, st = 0;

    const down = e => {
      const p = e.touches ? e.touches[0] : e;
      drag = true; moved = false;
      sx = p.clientX; sy = p.clientY;
      const r = btn.getBoundingClientRect();
      sl = r.left; st = r.top;
    };

    const move = e => {
      if(!drag) return;
      const p = e.touches ? e.touches[0] : e;
      const dx = p.clientX - sx, dy = p.clientY - sy;
      if(Math.abs(dx) + Math.abs(dy) > 5) moved = true;
      const left = Math.max(4, Math.min(innerWidth - btn.offsetWidth - 4, sl + dx));
      const top = Math.max(54, Math.min(innerHeight - btn.offsetHeight - 54, st + dy));
      btn.style.left = left + 'px';
      btn.style.top = top + 'px';
      btn.style.bottom = 'auto';
      e.preventDefault?.();
    };

    const up = e => {
      if(!drag) return;
      drag = false;
      GM_setValue(KEY.icon, JSON.stringify({left:parseInt(btn.style.left || '16'), top:parseInt(btn.style.top || '120')}));
      if(moved){
        e.preventDefault?.();
        e.stopPropagation?.();
        setTimeout(() => moved = false, 80);
      }
    };

    btn.addEventListener('touchstart', down, {passive:false});
    btn.addEventListener('mousedown', down, true);
    document.addEventListener('touchmove', move, {passive:false});
    document.addEventListener('mousemove', move, true);
    document.addEventListener('touchend', up, true);
    document.addEventListener('mouseup', up, true);

    const oldClick = btn.onclick;
    btn.onclick = e => { if(!moved) oldClick?.(e); };
  }

  function boot(){
    initUI();
    removeOldBadges();
    updateIcon();

    setTimeout(() => schedule(500), isWarHeavyPage() ? 4500 : 1200);
    setTimeout(() => schedule(900), isWarHeavyPage() ? 9000 : 3500);

    let lastMutation = 0;
    try{
      const obs = new MutationObserver(mutations => {
        const now = Date.now();
        const gap = isWarHeavyPage() ? 2400 : 900;
        if(now - lastMutation < gap) return;
        lastMutation = now;

        let root = document;
        for(const m of mutations){
          for(const n of m.addedNodes){
            if(n && n.nodeType === 1 && n.querySelector){
              root = n;
              break;
            }
          }
        }

        schedule(isWarHeavyPage() ? 2600 : 800, root);
      });
      obs.observe(document.body, {childList:true, subtree:true});
    }catch {}

    let scrollTimer = null;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => schedule(isWarHeavyPage() ? 900 : 300), isWarHeavyPage() ? 900 : 350);
    }, {passive:true});

    let last = location.href;
    setInterval(() => {
      if(location.href !== last){
        last = location.href;
        document.querySelectorAll('.absp321-inject,.TDup_BSPProfileInjection.absp321-profile').forEach(b => b.remove());
        schedule(isWarHeavyPage() ? 3200 : 900);
      } else {
        removeOldBadges();
        updateIcon();
        if(Date.now() - state.lastPaint > (isWarHeavyPage() ? 15000 : 7000)) {
          schedule(isWarHeavyPage() ? 2500 : 900);
        }
      }
    }, isWarHeavyPage() ? 5000 : 3000);
  }

  boot();
})();
