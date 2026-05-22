// ==UserScript==
// @name         Enhanced Battle Stat Finder ⚔️
// @namespace    Fries91.EnhancedBattleStatFinder
// @version      1.3.7
// @description  Honor-bar prediction badges with safer attack remembering, persistent FF/BSP estimate bridge, backup save, and automatic learning.
// @author       Fries91
// @match        https://www.torn.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      enhanced-battle-stat-finder.onrender.com
// @run-at       document-idle
// @updateURL    https://enhanced-battle-stat-finder.onrender.com/static/enhanced-battle-stat-finder.user.js
// @downloadURL  https://enhanced-battle-stat-finder.onrender.com/static/enhanced-battle-stat-finder.user.js
// ==/UserScript==

(function () {
  'use strict';

  const API_BASE = GM_getValue('ebsf_api_base', 'https://enhanced-battle-stat-finder.onrender.com');
  const S = {
    key: 'ebsf_key',
    user: 'ebsf_user',
    total: 'ebsf_total',
    enemyFaction: 'ebsf_enemy_faction',
    tornstats: 'ebsf_tornstats_key',
    yata: 'ebsf_yata_key',
    lastAttack: 'ebsf_last_attack_id',
    lastTarget: 'ebsf_last_target_id',
    lastPrompted: 'ebsf_last_auto_learned_attack',
    lastScan: 'ebsf_last_scan_payload',
    intelCache: 'ebsf_intel_cache',
    badgeMap: 'ebsf_badge_name_map',
    ffBase: 'ebsf_ff_base_enabled'
  };

  let app = {
    key: GM_getValue(S.key, ''),
    user: safeJson(GM_getValue(S.user, null)),
    total: GM_getValue(S.total, ''),
    enemyFaction: GM_getValue(S.enemyFaction, ''),
    tornstats: GM_getValue(S.tornstats, ''),
    yata: GM_getValue(S.yata, ''),
    ffBase: GM_getValue(S.ffBase, false),
    members: [],
    selected: null,
    tab: 'targets',
    msg: ''
  };

  GM_addStyle(`
    #ebsfBtn{position:fixed;left:12px;bottom:76px;z-index:999998;width:44px;height:44px;border-radius:14px;border:1px solid #facc15;background:#111827;color:#facc15;font-size:22px;box-shadow:0 10px 25px #000a;cursor:pointer}
    #ebsfRoot{display:none;position:fixed;inset:0;z-index:999999;background:#0009;font-family:Arial,sans-serif;color:#f8fafc}
    #ebsfRoot.open{display:block}
    #ebsfPanel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(1080px,calc(100vw - 12px));height:min(760px,calc(100vh - 12px));background:#0b1120;border:1px solid #facc1566;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 25px 80px #000}
    .ebsfHead{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:linear-gradient(135deg,#111827,#020617);border-bottom:1px solid #334155}.ebsfHead b{color:#facc15}.ebsfHead small{color:#94a3b8;display:block;margin-top:2px}.ebsfClose{background:#1f2937;color:#fff;border:1px solid #475569;border-radius:10px;padding:8px 10px;font-weight:800}
    .ebsfTabs{display:flex;gap:6px;padding:10px;background:#0f172a;border-bottom:1px solid #334155;overflow-x:auto}.ebsfTab{white-space:nowrap;background:#111827;color:#cbd5e1;border:1px solid #334155;border-radius:999px;padding:8px 10px;font-weight:800}.ebsfTab.on{background:#facc15;color:#111827;border-color:#facc15}
    #ebsfBody{padding:12px;overflow:auto;flex:1}.grid{display:grid;grid-template-columns:330px 1fr;gap:12px}.card{background:#111827;border:1px solid #334155;border-radius:14px;padding:12px}.card h3{margin:0 0 10px;color:#facc15;font-size:14px}.row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}
    .keyLabel{display:block;color:#facc15;font-weight:900;font-size:12px;margin:10px 0 5px}.inp,.sel,.txt{box-sizing:border-box;width:100%;background:#020617;color:#f8fafc;border:1px solid #475569;border-radius:10px;padding:9px 10px}.txt{min-height:72px}.btn{background:#facc15;color:#111827;border:1px solid #facc15;border-radius:10px;padding:9px 10px;font-weight:900}.btn2{background:#1f2937;color:#f8fafc;border-color:#475569}.note{color:#94a3b8;font-size:12px;line-height:1.4}.msg{display:none;margin-top:8px;background:#1e3a8a55;border:1px solid #60a5fa66;color:#bfdbfe;border-radius:10px;padding:8px;font-size:12px}.msg.show{display:block}
    .groupTitle{display:flex;justify-content:space-between;align-items:center;background:#020617;border:1px solid #334155;border-radius:13px;padding:10px;margin:0 0 8px}.groupTitle b{color:#facc15}.groupTitle span{color:#94a3b8;font-size:11px}.scorePills{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.scorePill{font-size:11px;border:1px solid #334155;border-radius:999px;padding:4px 7px;background:#020617;color:#cbd5e1}.scorePill b{color:#facc15}.warn{color:#fbbf24}.topPick{border:1px solid #facc15;background:#1f2937;margin-bottom:10px}.adminTable{width:100%;border-collapse:collapse;font-size:12px}.adminTable th,.adminTable td{border-bottom:1px solid #334155;padding:7px;text-align:left}.adminTable th{color:#facc15}.smallBtn{font-size:11px;padding:6px 8px}.target{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;background:#0f172a;border:1px solid #334155;border-radius:13px;padding:10px;margin-bottom:8px}.name{font-weight:900}.meta{color:#94a3b8;font-size:11px;margin-top:4px;display:flex;gap:6px;flex-wrap:wrap}.acts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.mini{font-size:11px;padding:6px 8px}.pill{display:inline-flex;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:900;border:1px solid #475569}.easy{color:#86efac;background:#22c55e22}.fair{color:#93c5fd;background:#3b82f622}.good{color:#fde68a;background:#facc1522}.difficult{color:#fdba74;background:#f9731622}.avoid{color:#fca5a5;background:#ef444422}.unknown{color:#cbd5e1;background:#64748b22}.empty{border:1px dashed #475569;border-radius:14px;color:#94a3b8;padding:24px;text-align:center;background:#0f172a}
    .topScanBar{background:#020617;border:1px solid #facc1566;border-radius:14px;padding:10px;margin-bottom:12px}.topScanBar .btn{width:100%;font-size:15px;padding:12px}.topScanBar .row{margin-top:8px;margin-bottom:0}#ebsfAutoToast{position:fixed;left:12px;right:12px;bottom:12px;z-index:999999;background:#0b1120;border:1px solid #facc15;border-radius:14px;padding:10px;color:#f8fafc;font-family:Arial,sans-serif;box-shadow:0 20px 50px #000;font-size:13px}#ebsfAutoToast b{color:#facc15}.infoBox{background:#020617;border:1px solid #334155;border-radius:14px;padding:12px;margin-bottom:10px}.infoBox h3{margin:0 0 8px;color:#facc15;font-size:14px}.infoBox p{margin:0 0 8px}.infoBox ul{margin:8px 0 0 18px;padding:0;color:#cbd5e1;font-size:12px;line-height:1.45}.loginBottom{margin-top:14px;border-top:1px solid #334155;padding-top:12px}.statsBox{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}.statMini{background:#020617;border:1px solid #334155;border-radius:10px;padding:8px;color:#cbd5e1;font-size:12px}.statMini b{color:#facc15}
    #ebsfFightPrompt{position:fixed;left:10px;right:10px;bottom:12px;z-index:999999;background:#0b1120;border:1px solid #facc15;border-radius:14px;padding:12px;color:#f8fafc;font-family:Arial,sans-serif;box-shadow:0 20px 50px #000}
    #ebsfFightPrompt b{color:#facc15}.ebsfPromptBtns{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.ebsfPromptBtns button{background:#1f2937;color:#f8fafc;border:1px solid #475569;border-radius:10px;padding:8px;font-weight:800}.ebsfPromptBtns button:first-child{background:#facc15;color:#111827;border-color:#facc15}

.ebsfNameBadge{display:inline-flex!important;align-items:center;justify-content:center;padding:1px 5px!important;border-radius:4px!important;border:1px solid #64748b;background:#111827;color:#cbd5e1;font:900 9px Arial,sans-serif!important;line-height:1!important;text-shadow:none!important;box-shadow:0 1px 4px #0009;pointer-events:none;white-space:nowrap;max-width:48px;min-width:30px;overflow:hidden}
.ebsfHonorBadge{position:absolute!important;right:3px!important;top:2px!important;margin:0!important;z-index:70!important}
.ebsfNameBadge.easy{background:#052e16;color:#86efac;border-color:#22c55e}
.ebsfNameBadge.fair{background:#172554;color:#93c5fd;border-color:#3b82f6}
.ebsfNameBadge.good{background:#422006;color:#fde68a;border-color:#f59e0b}
.ebsfNameBadge.difficult{background:#431407;color:#fdba74;border-color:#f97316}
.ebsfNameBadge.avoid{background:#450a0a;color:#fca5a5;border-color:#ef4444}
.ebsfNameBadge.unknown{background:#111827;color:#cbd5e1;border-color:#64748b}
#ebsfProfileFixedBadge,#ebsfProfileMiniBadge{display:none!important}


#ebsfProfileMiniBadge{display:none!important}








#ebsfProfileFixedBadge{display:none!important}








#ebsfFightSaveMini{position:fixed;left:14px;top:118px;z-index:2147483647;background:#111827;color:#fde68a;border:1px solid #facc15;border-radius:10px;padding:8px 10px;font:900 12px Arial,sans-serif;box-shadow:0 2px 10px #000b;display:none}
#ebsfFightSaveMini button{margin-left:6px;background:#1f2937;color:#fde68a;border:1px solid #facc15;border-radius:7px;padding:4px 7px;font-weight:900}

    @media(max-width:760px){#ebsfPanel{width:calc(100vw - 6px);height:calc(100vh - 6px);border-radius:10px}.grid,.row,.statsBox{grid-template-columns:1fr}.target{grid-template-columns:1fr}.acts{justify-content:flex-start}}
  `);

  boot();
  bsfInstallNetworkWatch?.();
  setTimeout(()=>paintHonorBadgesOnly(), 2500);
  setupStrongAttackRemembering();
  watchAttackPage();
  startUniversalFightWatcherIfPending();
  setTimeout(()=>{startSmoothBadgeSystem();  paintHonorBadgesOnly();}, 1300);
  watchGlobalAttackClicks();

  function boot(){
    const b=document.createElement('button');
    b.id='ebsfBtn'; b.textContent='⚔️'; b.onclick=open;
    document.body.appendChild(b);

    const r=document.createElement('div');
    r.id='ebsfRoot';
    r.innerHTML=`
      <div id="ebsfPanel">
        <div class="ebsfHead">
          <div><b>⚔️ Enhanced Battle Stat Finder</b><small>prediction badges • war targets</small></div>
          <button class="ebsfClose">Close</button>
        </div>
        <div class="ebsfTabs">
          <button class="ebsfTab on" data-tab="targets">Targets</button>
          
          <button class="ebsfTab" data-tab="settings">Settings / Login</button><button class="ebsfTab" data-tab="admin">Admin / Intel</button>
        </div>
        <div id="ebsfBody"></div>
      </div>`;
    document.body.appendChild(r);
    r.querySelector('.ebsfClose').onclick=close;
    r.querySelectorAll('.ebsfTab').forEach(x=>x.onclick=()=>{
      app.tab=x.dataset.tab;
      setTabs();
      render();
    });
    render();
  }

  function open(){loadCachedScan(); document.getElementById('ebsfRoot').classList.add('open'); render(); setTimeout(()=>{scheduleBadgePaint('manual'); setTimeout(()=>paintHonorBadgesOnly?.(), 400); setTimeout(()=>paintHonorBadgesOnly?.(), 400); paintHonorBadgesOnly(); }, 700);}
  function close(){document.getElementById('ebsfRoot').classList.remove('open');}
  function loadCachedScan(){
    if(app.members && app.members.length) return;
    const cached = safeJson(GM_getValue(S.lastScan, null));
    if(cached && cached.members && Date.now() - cached.ts < 1000*60*60*3){
      app.members = cached.members;
      app.enemyFaction = cached.enemyFaction || app.enemyFaction;
    }
  }
  function setTabs(){document.querySelectorAll('.ebsfTab').forEach(t=>t.classList.toggle('on',t.dataset.tab===app.tab));}
  function render(){ if(app.tab==='targets') targets(); if(app.tab==='settings') settings(); if(app.tab==='admin') adminIntel(); }

  function userSummary(){
    if(!app.user) return `<div class="note">Go to <b>Settings / Login</b>, enter your Torn limited API key, then click Login / Save All.</div>`;
    const bs=app.user.battle_stats||{};
    return `<div class="note">Logged in as <b>${esc(app.user.name)}</b> [${app.user.user_id}]<br>Faction: ${esc(app.user.faction_name||'')} [${esc(app.user.faction_id||'')}]<br>Detected effective battle stats: <b>${fmt(app.total||bs.effective_total||bs.total)}</b></div>`;
  }


  async function quietBackgroundStart(){
    // Starts gently in the background for logged-in users so badges appear
    // without needing to open the overlay, but avoids repeated scans.
    if(!location.href.includes('factions.php')) return;
    if(!app.key || !app.user) return;

    const last = Number(GM_getValue('ebsf_last_quiet_scan_ts', 0) || 0);
    if(Date.now() - last < 1000 * 60 * 8) return;
    GM_setValue('ebsf_last_quiet_scan_ts', Date.now());

    try{
      const r = await post('/api/war/enemy-scan',{
        api_key:app.key,
        your_total:app.total,
        enemy_faction_id:app.enemyFaction || '',
        faction_id:app.user?.faction_id
      });
      if(r.ok){
        app.members = r.members || [];
        app.enemyFaction = String(r.enemy_faction_id || app.enemyFaction || '');
        GM_setValue(S.enemyFaction, app.enemyFaction);
        GM_setValue(S.lastScan, JSON.stringify({members:app.members, enemyFaction:app.enemyFaction, ts:Date.now()}));
        cacheIntelFromMembers(app.members);
      clearBadgeMarkers();
        clearBadgeMarkers();
        scheduleBadgePaint('scan'); setTimeout(()=>paintHonorBadgesOnly?.(), 400); setTimeout(()=>paintHonorBadgesOnly?.(), 400);
        setTimeout(()=>paintHonorBadgesOnly(), 500);
      }
    }catch(e){}
  }


  function targets(){
    q('#ebsfBody').innerHTML=`
      <div class="topScanBar">
        <button id="scanTop" class="btn">🔎 Scan Enemy Targets Using My Stats</button>
        <input id="enemyFaction" class="inp" placeholder="Enemy faction ID optional - leave blank to auto-detect active war" value="${esc(app.enemyFaction)}" style="margin-top:8px">
        ${(()=>{const d=bsfDebugGet?.()||{}; return `<div class="infoBox"><h3>🧪 Last fight debug</h3><p class="note">Target remembered: ${esc(d.target_remembered_id||'no')}</p><p class="note">Result detected: ${esc(String(d.last_result_scan_ended||'no'))} / ${esc(d.last_result_scan_side||'unknown')}</p><p class="note">Saved target: ${esc(d.last_fight_saved_target||'no')}</p><p class="note">Saved result: ${esc(d.last_fight_saved_result||'none')}</p></div>`})()}
        <div class="msg ${app.msg?'show':''}">${esc(app.msg)}</div>
        <div class="note" style="margin-top:8px">${app.user ? `Logged in as <b>${esc(app.user.name)}</b> • Stats: <b>${fmt(app.total)}</b>` : 'Login in Settings once; the app auto-starts after login.'}</div>
      </div>
      <div class="card"><h3>Organized Targets</h3>${listTargets()}</div>`;
    q('#scanTop').onclick=scan;
    q('#ebsfBody').querySelectorAll('[data-act]').forEach(x=>x.onclick=actTarget);
  }

  function listTargets(){
    if(!app.members.length) return '<div class="empty">No targets scanned yet. Login in Settings, then scan here.</div>';

    const rows = app.members.map(m => enrichTarget(m));

    const known = rows.filter(x => x.ratio !== null && x.conf > 0);
    const unknown = rows.filter(x => x.ratio === null || x.conf <= 0);

    const respect = known
      .filter(x => x.level >= 50 && x.ratio >= 0.95 && x.ratio <= 1.35)
      .sort((a,b) => b.respectScore - a.respectScore)
      .slice(0, 12);

    const bestTargets = known
      .filter(x => x.ratio >= 0.80 && x.ratio <= 1.15 && !respect.some(r => r.m.user_id === x.m.user_id))
      .sort((a,b) => b.reliabilityScore - a.reliabilityScore)
      .slice(0, 18);

    const chain = known
      .filter(x => x.ratio <= 0.75 && !respect.some(r => r.m.user_id === x.m.user_id) && !bestTargets.some(r => r.m.user_id === x.m.user_id))
      .sort((a,b) => b.chainScore - a.chainScore)
      .slice(0, 18);

    const used = new Set([...respect, ...bestTargets, ...chain].map(x => x.m.user_id));
    const other = [...known.filter(x => !used.has(x.m.user_id)), ...unknown]
      .sort((a,b) => (b.conf - a.conf) || (a.level - b.level))
      .slice(0, 20);

    return [
      section('🔥 Highest Respect Hits', 'High level + just a bit above/near your stats', respect, 'respectScore'),
      section('🎯 Best Target Hits', 'Closest reliable fights around your stats', bestTargets, 'reliabilityScore'),
      section('⛓️ Chain Save Hits', 'Very easy targets for safe chain saving', chain, 'chainScore'),
      section('❔ Other / Unknown', 'Needs spy, estimate, or fight data to rank better', other, 'confidenceOnly')
    ].join('');
  }

  function enrichTarget(m){
    const i = m.intel || {};
    const best = num(i.best_total || i.total);
    const your = num(app.total);
    const ratio = best && your ? best / your : null;
    const level = Number(m.level || 0);
    const conf = Number(i.confidence || 0);
    const status = String(m.status || '').toLowerCase();

    const activeBonus = /okay|online|idle/.test(status) ? 8 : 0;
    const unavailablePenalty = /hospital|travel|jail|abroad/.test(status) ? 28 : 0;
    const confBonus = Math.min(30, conf * 0.30);

    const nearRespect = ratio ? Math.max(0, 35 - Math.abs(ratio - 1.10) * 80) : 0;
    const highLevel = Math.min(30, level * 0.35);
    const respectScore = Math.max(0, Math.round(nearRespect + highLevel + confBonus + activeBonus - unavailablePenalty));

    const closeness = ratio ? Math.max(0, 45 - Math.abs(ratio - 0.95) * 100) : 0;
    const reliabilityScore = Math.max(0, Math.round(closeness + confBonus + activeBonus - unavailablePenalty));

    const safe = ratio ? Math.max(0, 55 - ratio * 60) : 0;
    const chainScore = Math.max(0, Math.round(safe + confBonus + activeBonus - unavailablePenalty));

    const warning = confidenceWarning(i, conf, ratio);

    return {m, i, best, your, ratio, level, conf, respectScore, reliabilityScore, chainScore, warning};
  }

  function confidenceWarning(i, conf, ratio){
    const source = String(i.source || 'none');
    const detail = String(i.source_detail || '');
    if(source === 'none' || conf <= 0) return 'Needs spy/fight data';
    if(conf < 45) return 'Low confidence';
    if(/1 attackers|1 fight|1 .*reports/.test(detail)) return 'One fight only';
    if(source === 'attack_learning' && conf < 70) return 'Learning still young';
    if(source === 'manual_spy' || source === 'tornstats' || source === 'yata') return 'Exact spy source';
    if(ratio && ratio > 1.35) return 'Risky target';
    return '';
  }

  function section(title, sub, items, scoreKey){
    const top = items[0] ? `<div class="target topPick">${targetCardInner(items[0].m, items[0].i, items[0].ratio, items[0], true, scoreKey)}</div>` : '';
    const rest = items.slice(top ? 1 : 0).map(x => `<div class="target">${targetCardInner(x.m, x.i, x.ratio, x, false, scoreKey)}</div>`).join('');
    return `<div class="groupTitle"><div><b>${title}</b><br><span>${sub}</span></div><span>${items.length}</span></div>` +
      (top ? `<div class="note" style="margin:0 0 6px;color:#facc15">Top pick in this box:</div>${top}` : '') +
      (rest || (!top ? '<div class="empty">No targets in this group yet.</div>' : ''));
  }

  function targetCard(m, i, ratio){
    const x = enrichTarget(m);
    return `<div class="target">${targetCardInner(m, i, ratio, x, false, 'confidenceOnly')}</div>`;
  }

  function targetCardInner(m, i, ratio, x, isTop, scoreKey){
    const label=i.label||'Unknown';
    const cls=label.toLowerCase();
    const ratioTxt = ratio ? `${Math.round(ratio*100)}% of you` : 'unknown';
    const score = scoreKey && scoreKey !== 'confidenceOnly' ? x[scoreKey] : Math.round(i.confidence||0);
    const scoreName = scoreKey === 'respectScore' ? 'Respect' : scoreKey === 'reliabilityScore' ? 'Reliable' : scoreKey === 'chainScore' ? 'Chain' : 'Conf';
    return `<div><div class="name">${isTop?'⭐ ':''}${esc(m.name)} [${m.user_id}]</div><div class="meta"><span>Lvl ${m.level||'?'}</span><span>${esc(m.status||'')}</span><span>${ratioTxt}</span><span>Total ${fmt(i.best_total||i.total)}</span><span>Range ${fmt(i.range_low)}-${fmt(i.range_high)}</span><span>Conf ${Math.round(i.confidence||0)}%</span><span>${esc(i.source||'none')}</span>${i.source_detail?`<span>Reason: ${esc(i.source_detail)}</span>`:''}${x.warning?`<span class="warn">⚠ ${esc(x.warning)}</span>`:''}</div><div class="scorePills"><span class="scorePill"><b>${scoreName}</b> ${score}</span><span class="scorePill"><b>Respect</b> ${x.respectScore}</span><span class="scorePill"><b>Safe</b> ${x.reliabilityScore}</span><span class="scorePill"><b>Chain</b> ${x.chainScore}</span></div></div><div class="acts"><span class="pill ${cls}">${label}</span><button class="btn btn2 mini" data-act="profile" data-id="${m.user_id}">Profile</button><button class="btn btn2 mini" data-act="attack" data-id="${m.user_id}" data-name="${esc(m.name)}">Attack</button><button class="btn btn2 mini" data-act="intel" data-id="${m.user_id}">Intel</button><button class="btn btn2 mini" data-act="result" data-id="${m.user_id}" data-name="${esc(m.name)}">Auto</button></div>`;
  }

  function spy(){
    const t=app.selected||{};
    q('#ebsfBody').innerHTML=`<div class="grid"><div class="card"><h3>Exact Spy</h3>
      <div class="row"><input id="sid" class="inp" placeholder="Target ID" value="${t.user_id||''}"><input id="sname" class="inp" placeholder="Name" value="${esc(t.name||'')}"></div>
      <div class="row"><input id="str" class="inp" placeholder="Strength"><input id="def" class="inp" placeholder="Defense"></div>
      <div class="row"><input id="spd" class="inp" placeholder="Speed"><input id="dex" class="inp" placeholder="Dexterity"></div>
      <button id="saveSpy" class="btn">Save Spy</button><p class="note">Use real spy reports here. Highest confidence.</p></div>
      <div class="card"><h3>BSP / FFS Estimate</h3><div class="row"><input id="eid" class="inp" placeholder="Target ID" value="${t.user_id||''}"><input id="ename" class="inp" placeholder="Name" value="${esc(t.name||'')}"></div>
      <div class="row"><select id="esource" class="sel"><option value="bsp">BSP</option><option value="fair_fight_scout">Fair Fight Scout</option><option value="ffs">FFS</option><option value="estimate">Other</option></select><input id="etotal" class="inp" placeholder="Estimated total"></div>
      <div class="row"><input id="elow" class="inp" placeholder="Range low optional"><input id="ehigh" class="inp" placeholder="Range high optional"></div><textarea id="edetail" class="txt" placeholder="Paste note/source text"></textarea><button id="saveEst" class="btn">Save Estimate</button></div></div>
      <div class="card" style="margin-top:12px"><h3>TornStats Import</h3><div class="row"><input id="iid" class="inp" placeholder="Target ID" value="${t.user_id||''}"><input id="iname" class="inp" placeholder="Name" value="${esc(t.name||'')}"></div><button id="tsImport" class="btn btn2">Import TornStats</button></div>`;
    q('#saveSpy').onclick=saveSpy;
    q('#saveEst').onclick=saveEst;
    q('#tsImport').onclick=tsImport;
  }

  function settings(){
    const bs=app.user?.battle_stats||{};
    q('#ebsfBody').innerHTML=`<div class="card">
      <div class="infoBox">
        <h3>⚔️ How This App Starts</h3>
        <p class="note"><b>Enhanced Battle Stat Finder</b> starts from one login. After you click <b>Login / Save All</b>, it detects your battle stat total, switches to the target view, scans the active enemy faction when available, caches known predictions, and paints lightweight colored stat badges beside names/honor bars.</p>
        <p class="note"><b>It needs time to learn.</b> Early scans may show <b>N/A</b>, Unknown, or low-confidence targets. As your faction attacks more players, the backend learns and the badges become more useful.</p>
        <ul>
          <li>Auto-starts after login with a BSP-style light label painter.</li>
          <li>Shows sticky colored prediction badges when intel is known.</li>
          <li>Stores known predictions locally so they stay visible on reload, then paints badges from cache without mass backend calls.</li>
          <li>Automatically learns from attack pages without users saving results.</li><li>Optional FF Scouter base intel can fill early N/A estimates.</li>
        </ul>
      </div>

      <div class="infoBox">
        <h3>📜 Rules & Fair Use</h3>
        <p class="note">Use this tool for faction war planning and target sorting only. Predictions are estimates, not guaranteed battle stats. Fights can change because of gear, temps, life, perks, build type, random fight outcomes, or recent player growth.</p>
        <p class="note">Do not enter fake intel, do not share information you are not allowed to share, and do not use this app to harass players. The app is meant to help your faction make smarter, cleaner target choices.</p>
        <p class="note">Badge colors are helper signals: green/blue is safer, gold/orange is riskier, red means avoid, and gray <b>N/A</b> means the app does not have enough intel yet.</p>
      </div>

      <div class="infoBox">
        <h3>🔑 API Key Use & Storage</h3>
        <p class="note"><b>Required:</b> Torn limited API key. It is used to confirm your Torn identity and faction, detect your battle stat total where your key allows it, and scan active war/faction data for target sorting.</p>
        <p class="note"><b>Local storage:</b> your Torn key is saved in your userscript manager/PDA storage so you do not need to type it every time.</p>
        <p class="note"><b>Backend storage:</b> the backend stores a one-way hash of your Torn key for login tracking, not the raw Torn key. Learned data can include user ID, faction ID, detected stat total, target ID, simple fight result labels, and fight-read confidence.</p>
        <p class="note"><b>Shared learning:</b> learned target intel is intended for your faction’s use so predictions improve over time. Optional TornStats/YATA/FF Scouter base intel support is not required for normal users. FF base intel only runs if enabled and is used as a starting estimate.</p>
      </div>

      <div class="loginBottom">
        <h3>Login / Keys</h3>

        <label class="keyLabel" for="key">Torn Limited API Key — Required</label>
        <input id="key" class="inp" type="password" placeholder="Required: Torn limited API key" value="${esc(app.key)}">

        <label class="keyLabel" for="tskey">TornStats Key — Optional</label>
        <input id="tskey" class="inp" type="password" placeholder="Optional: only needed for TornStats imports" value="${esc(app.tornstats)}">

        <label class="keyLabel" for="yatakey">YATA Key — Optional / Saved Only</label>
        <input id="yatakey" class="inp" type="password" placeholder="Optional: saved for later YATA support" value="${esc(app.yata)}">

        <label class="keyLabel" style="margin-top:12px">
          <input id="ffbase" type="checkbox" ${app.ffBase?'checked':''} style="width:auto;margin-right:6px">
          Use FF Scouter Base Intel — Optional
        </label>
        <p class="note">When enabled, scanned target IDs are checked for FF Scouter base estimates. This gives N/A players a starting estimate, then your fight learning can improve or override it.</p>

        <button id="login" class="btn" style="margin-top:10px">Login / Save All</button>

        ${app.user?`<div class="statsBox"><div class="statMini">Total<br><b>${fmt(app.total||bs.total)}</b></div><div class="statMini">Str<br><b>${fmt(bs.strength)}</b></div><div class="statMini">Def<br><b>${fmt(bs.defense)}</b></div><div class="statMini">Spd<br><b>${fmt(bs.speed)}</b></div><div class="statMini">Dex<br><b>${fmt(bs.dexterity)}</b></div></div>`:''}
        ${(()=>{const d=bsfDebugGet?.()||{}; return `<div class="infoBox"><h3>🧪 Last fight debug</h3><p class="note">Target remembered: ${esc(d.target_remembered_id||'no')}</p><p class="note">Result detected: ${esc(String(d.last_result_scan_ended||'no'))} / ${esc(d.last_result_scan_side||'unknown')}</p><p class="note">Saved target: ${esc(d.last_fight_saved_target||'no')}</p><p class="note">Saved result: ${esc(d.last_fight_saved_result||'none')}</p></div>`})()}
        <div class="msg ${app.msg?'show':''}">${esc(app.msg)}</div>
      </div>
    </div>`;
    q('#login').onclick=login;
  }

  function rememberAttackTarget(id, name){
    id = Number(id);
    if(!id || (app.user && String(id) === String(app.user.user_id))) return;
    const row = {id, name: name || 'Enemy', ts: Date.now(), url: location.href};
    GM_setValue(S.lastAttack, JSON.stringify(row));
    GM_setValue(S.lastTarget, JSON.stringify(row));
  }

  function readRememberedAttackTarget(){
    const a = safeJson(GM_getValue(S.lastAttack, null));
    if(a && a.id && Date.now() - (a.ts || 0) < 1000*60*25) return a;
    const b = safeJson(GM_getValue(S.lastTarget, null));
    if(b && b.id && Date.now() - (b.ts || 0) < 1000*60*45) return b;
    return null;
  }


  function bsfDebugSet(key, value){
    try{
      const row = safeJson(GM_getValue('ebsf_debug_status', '{}')) || {};
      row[key] = value;
      row.updated = new Date().toISOString();
      GM_setValue('ebsf_debug_status', JSON.stringify(row));
    }catch(e){}
  }

  function bsfDebugGet(){
    return safeJson(GM_getValue('ebsf_debug_status', '{}')) || {};
  }

  function ensureFightSaveMini(){
    let box = document.getElementById('ebsfFightSaveMini');
    if(box) return box;
    box = document.createElement('div');
    box.id = 'ebsfFightSaveMini';
    box.innerHTML = `⚔️ Save last fight
      <button data-r="easy_win">Easy Win</button>
      <button data-r="close_win">Close Win</button>
      <button data-r="generic_loss">Loss</button>`;
    document.body.appendChild(box);
    box.addEventListener('click', (e)=>{
      const btn = e.target.closest('button[data-r]');
      if(!btn) return;
      const pending = readRememberedAttackTarget?.();
      if(!pending || !pending.id){
        toast('⚔️ No remembered target to save.');
        return;
      }
      const result = btn.dataset.r;
      bsfDebugSet('manual_backup_result', result);
      autoSaveFightResult(pending.id, pending.name || 'Enemy', result, true, {quality:50, resultSide:result.includes('loss')?'loss':'win', source:'backup_button'});
      box.style.display = 'none';
    });
    return box;
  }

  function showFightSaveMini(){
    const pending = readRememberedAttackTarget?.();
    if(!pending || !pending.id) return;
    const box = ensureFightSaveMini();
    box.style.display = 'block';
    bsfDebugSet('backup_button_visible', true);
    setTimeout(()=>{ if(box) box.style.display='none'; }, 1000*60*6);
  }

  function bsfResultFromText(raw){
    const bodyText = String(raw || '').replace(/\s+/g, ' ');
    const text = bodyText.toLowerCase();
    const winStrong = ['you won','you have won','you mugged','you have mugged','you hospitalized','you hospitalised','you left','you defeated','you beat','victory','respect gained','experience gained','you gained','you receive','you received'];
    const lossStrong = ['you lost','you have lost','you were defeated','defeated by','you were hospitalized','you were hospitalised','you ran away','you failed','stalemate'];
    const won = winStrong.some(w => text.includes(w));
    const lost = lossStrong.some(w => text.includes(w));
    if(won) return {ended:true, side:'win', result:'generic_win', text:bodyText};
    if(lost) return {ended:true, side:'loss', result:'generic_loss', text:bodyText};
    if(/leave them|mug them|hospitalize|hospitalise|claim rewards|continue|fight over|result|respect gained|experience gained|you gained/i.test(bodyText)){
      return {ended:true, side:'win', result:'generic_win', text:bodyText};
    }
    return {ended:false, side:'unknown', result:'unknown', text:bodyText};
  }

  function bsfTrySaveFromResultText(raw, source){
    const pending = readRememberedAttackTarget?.();
    if(!pending || !pending.id) return false;
    const parsed = bsfResultFromText(raw);
    bsfDebugSet('last_result_scan_source', source || 'dom');
    bsfDebugSet('last_result_scan_ended', parsed.ended);
    bsfDebugSet('last_result_scan_side', parsed.side);
    if(!parsed.ended) return false;

    const key = `${pending.id}:${Math.floor((pending.ts || Date.now())/1000)}:${parsed.side}:${source || 'dom'}`;
    if(GM_getValue(S.lastPrompted, '') === key) return true;
    GM_setValue(S.lastPrompted, key);

    const detail = extractFightDetails?.(String(raw || '').toLowerCase()) || {};
    detail.resultSide = parsed.side;
    detail.source = source || 'dom_result';
    const finalResult = classifyFightResult ? classifyFightResult(String(raw || '').toLowerCase(), parsed.side === 'win', detail) : parsed.result;

    bsfDebugSet('last_fight_saved_target', pending.id);
    bsfDebugSet('last_fight_saved_result', finalResult);
    autoSaveFightResult(pending.id, pending.name || getPageProfileName?.() || 'Enemy', finalResult, false, detail);
    return true;
  }

  function bsfInstallNetworkWatch(){
    if(window.__ebsfNetworkWatchInstalled) return;
    window.__ebsfNetworkWatchInstalled = true;

    const oldFetch = window.fetch;
    if(oldFetch){
      window.fetch = async function(...args){
        const resp = await oldFetch.apply(this, args);
        try{
          const clone = resp.clone();
          clone.text().then(txt=>{
            if(/attack|fight|respect|hospital|mug|you won|you lost/i.test(txt)){
              bsfTrySaveFromResultText(txt, 'fetch');
            }
          }).catch(()=>{});
        }catch(e){}
        return resp;
      };
    }

    const OldXHR = window.XMLHttpRequest;
    if(OldXHR && !window.__ebsfXhrPatched){
      window.__ebsfXhrPatched = true;
      const oldOpen = OldXHR.prototype.open;
      const oldSend = OldXHR.prototype.send;
      OldXHR.prototype.open = function(method, url){
        this.__ebsfUrl = url;
        return oldOpen.apply(this, arguments);
      };
      OldXHR.prototype.send = function(){
        this.addEventListener('load', function(){
          try{
            const txt = this.responseText || '';
            if(/attack|fight|respect|hospital|mug|you won|you lost/i.test(txt)){
              bsfTrySaveFromResultText(txt, 'xhr');
            }
          }catch(e){}
        });
        return oldSend.apply(this, arguments);
      };
    }
  }

  function bsfStartDeepFightWatch(){
    bsfInstallNetworkWatch();
    if(window.__ebsfDeepFightInterval) clearInterval(window.__ebsfDeepFightInterval);
    window.__ebsfDeepFightInterval = setInterval(()=>bsfTrySaveFromResultText(document.body?.innerText || '', 'dom_interval'), 900);
    setTimeout(()=>{ if(window.__ebsfDeepFightInterval) clearInterval(window.__ebsfDeepFightInterval); window.__ebsfDeepFightInterval=null; }, 1000*60*7);

    try{
      if(window.__ebsfDeepFightObserver) window.__ebsfDeepFightObserver.disconnect();
      window.__ebsfDeepFightObserver = new MutationObserver(()=>bsfTrySaveFromResultText(document.body?.innerText || '', 'mutation'));
      window.__ebsfDeepFightObserver.observe(document.body, {childList:true, subtree:true, characterData:true});
      setTimeout(()=>window.__ebsfDeepFightObserver?.disconnect(), 1000*60*7);
    }catch(e){}

    setTimeout(()=>{
      const pending = readRememberedAttackTarget?.();
      if(pending && pending.id && Date.now() - (pending.ts || 0) < 1000*60*8){
        const dbg = bsfDebugGet();
        if(!dbg.last_fight_saved_target || Number(dbg.last_fight_saved_target) !== Number(pending.id)){
          showFightSaveMini();
        }
      }
    }, 18000);
  }


  function setupStrongAttackRemembering(){ bsfInstallSafeAttackRememberingV137?.(); }

  function getPageProfileName(){
    const title = (document.title || '').replace(/\s*\|\s*Torn.*$/i,'').replace(/'s Profile/i,'').trim();
    if(title && !/faction|torn/i.test(title)) return title;
    const h = document.querySelector('h1,[class*="name"],[class*="title"]');
    return (h?.textContent || '').trim().split('\n')[0] || '';
  }


  function watchGlobalAttackClicks(){
    document.addEventListener('click', (e)=>{
      const a = e.target?.closest?.('a,button,[onclick],[data-user],[data-id]');
      if(!a) return;

      const quickBlob = [a.href, a.getAttribute('href'), a.getAttribute('data-user'), a.getAttribute('data-id')].filter(Boolean).join(' ');
      let id = extractTargetIdFromText(quickBlob);

      if(!id){
        const onclick = a.getAttribute('onclick');
        if(onclick) id = extractTargetIdFromText(onclick);
      }

      if(id && String(id) !== String(app.user?.user_id || '')){
        const name = findNearbyName(a) || 'Enemy';
        GM_setValue(S.lastAttack, JSON.stringify({id:Number(id), name, ts:Date.now()}));
      }
    }, true);
  }

  function extractTargetIdFromText(txt){
    if(!txt) return null;
    txt = String(txt);
    let m = txt.match(/(?:user2ID|userID|targetID|XID|userId|targetId|profileId)[=\\":%26]+(\d{3,10})/i);
    if(m) return Number(m[1]);
    m = txt.match(/profiles\.php\?XID=(\d{3,10})/i);
    if(m) return Number(m[1]);
    m = txt.match(/loader\.php\?sid=attack[^"']*?(?:user2ID=)?(\d{3,10})/i);
    if(m) return Number(m[1]);
    m = txt.match(/\/profiles\/(\d{3,10})/i);
    return m ? Number(m[1]) : null;
  }

  function findNearbyName(el){
    const txt = (el.textContent || el.closest?.('li,div,tr')?.textContent || '').trim();
    if(!txt) return '';
    return txt.split('\\n').map(x=>x.trim()).filter(Boolean)[0]?.slice(0,40) || '';
  }






  function injectHonorBadgesFromRoster(){ scheduleBadgePaint('manual'); setTimeout(()=>paintHonorBadgesOnly?.(), 400); setTimeout(()=>paintHonorBadgesOnly?.(), 400); }

  function buildPredictionBadge(intel, playerId){
    const badge = document.createElement('span');

    if((!intel || (!intel.best_total && !intel.total && !intel.range_low && !intel.range_high)) && playerId){
      intel = getCachedIntel(playerId);
    }

    if(!intel || (!intel.best_total && !intel.total && !intel.range_low && !intel.range_high)){
      badge.className = 'ebsfNameBadge unknown';
      badge.textContent = 'N/A';
      badge.title = 'No Battle Stat Finder intel yet';
      return badge;
    }

    const label = (intel.label || 'Unknown').toLowerCase();
    badge.className = 'ebsfNameBadge ' + (['easy','fair','good','difficult','avoid'].includes(label) ? label : 'unknown');
    const val = intel.best_total || intel.total || ((intel.range_low && intel.range_high) ? ((intel.range_low + intel.range_high) / 2) : 0);
    badge.textContent = fmtShort(val);
    badge.title = `Battle Stat Finder: ${intel.label || 'Unknown'} • ${fmt(val)} • ${Math.round(intel.confidence||0)}% confidence`;
    return badge;
  }

  function findNameMountByRosterName(name){
    const target = normName(name);
    if(!target) return null;

    const selectors = [
      '[class*="honor"]',
      '[class*="member"]',
      '[class*="name"]',
      'td',
      'div',
      'span',
      'a'
    ];

    let best = null;
    let bestScore = -999;

    for(const s of selectors){
      const nodes = document.querySelectorAll(s);
      for(const el of nodes){
        if(el.dataset?.ebsfHonorBadgeDone === '1') continue;
        if(el.querySelector?.('.ebsfNameBadge')) continue;

        const text = normName(el.textContent || el.getAttribute('title') || el.getAttribute('aria-label') || '');
        if(!text || !text.includes(target)) continue;

        const r = el.getBoundingClientRect?.();
        if(!r || r.width < 25 || r.height < 8 || r.width > 360 || r.height > 75) continue;
        if(r.bottom < 0 || r.top > window.innerHeight + 400) continue;

        let score = 0;
        if(s.includes('honor')) score += 40;
        if(s.includes('name')) score += 25;
        if(s.includes('member')) score += 15;
        if(text === target) score += 35;
        score -= Math.abs(text.length - target.length) * 0.5;
        score -= Math.max(0, r.width - 230) * 0.05;

        if(score > bestScore){
          bestScore = score;
          best = el;
        }
      }
      if(best && bestScore > 40) return best;
    }
    return best;
  }

  function normName(s){
    return String(s||'')
      .replace(/\[[^\]]*\]/g,'')
      .replace(/[^a-z0-9_-]/gi,'')
      .toLowerCase()
      .trim();
  }






  let ebsfBadgePaintTimer = null;
  let ebsfBadgeObserver = null;
  let ebsfBadgeSystemStarted = false;
  let ebsfPainting = false;

  function startSmoothBadgeSystem(){
    if(ebsfBadgeSystemStarted) return;
    ebsfBadgeSystemStarted = true;

    loadCachedScan();
    buildBadgeNameMap();
    scheduleBadgePaint('start');
    quietBackgroundStart();

    // BSP-style: watch Torn ajax changes lightly, then repaint only small batches.
    try{
      ebsfBadgeObserver = new MutationObserver((mutations)=>{
        let useful = false;
        for(const m of mutations){
          if(m.addedNodes && m.addedNodes.length){
            useful = true;
            break;
          }
        }
        if(useful){ scheduleBadgePaint('mutation'); setTimeout(()=>paintHonorBadgesOnly?.(), 500); setTimeout(()=>paintHonorBadgesOnly?.(), 500); setTimeout(()=>{paintHonorBadgesOnly(); }, 600); }
      });
      ebsfBadgeObserver.observe(document.body, {childList:true, subtree:true});
    }catch(e){}
  }

  function scheduleBadgePaint(reason){
    clearTimeout(ebsfBadgePaintTimer);
    const delay = reason === 'scan' ? 300 : reason === 'mutation' ? 700 : 900;
    ebsfBadgePaintTimer = setTimeout(()=>paintBadgesSmooth(reason), delay);
  }

  function paintBadgesSmooth(reason){
    if(ebsfPainting) return;
    ebsfPainting = true;

    idle(()=> {
      try{
        buildBadgeNameMap();
        paintHonorBadgesOnly();
        
      } finally {
        ebsfPainting = false;
      }
    }, 1000);
  }

  function idle(fn, timeout){
    if('requestIdleCallback' in window) requestIdleCallback(()=>fn(), {timeout:timeout||1000});
    else setTimeout(fn, 120);
  }

  function buildBadgeNameMap(){
    const map = {};
    const cached = getIntelCache();

    // Use cached backend/player data by ID.
    for(const [id, row] of Object.entries(cached || {})){
      if(row && row.intel) map['id:'+id] = row.intel;
    }

    // Use latest scanned roster by ID and normalized name.
    if(!app.members || !app.members.length) loadCachedScan();
    for(const m of (app.members || [])){
      if(!m || !m.user_id) continue;
      const intel = m.intel || getCachedIntel(m.user_id) || null;
      if(!intel) continue;
      map['id:'+m.user_id] = intel;
      const n = normName(m.name);
      if(n) map['name:'+n] = {intel, user_id:m.user_id, name:m.name};
    }

    GM_setValue(S.badgeMap, JSON.stringify({map, ts:Date.now()}));
    return map;
  }

  function getBadgeNameMap(){
    const row = safeJson(GM_getValue(S.badgeMap, '{}')) || {};
    return row.map || {};
  }

  function paintProfileAndAttackAnchors(){ return; }

  function paintRosterNamePills(){
    const map = getBadgeNameMap();
    const names = Object.keys(map).filter(k=>k.startsWith('name:')).slice(0, 120);
    if(!names.length) return;

    const candidates = getBspLikeNameCandidates();
    if(!candidates.length) return;

    let painted = 0;
    const usedRows = new Set();

    for(const el of candidates){
      if(painted >= 45) break;
      if(el.dataset.ebsfHonorBadgeDone === '1') continue;
      if(el.querySelector?.('.ebsfNameBadge')) continue;

      const hostRow = el.closest?.('tr, li, [class*="row"], [class*="member"]') || el;
      const rowKey = getNodeKey(hostRow);
      if(usedRows.has(rowKey) || hostRow.dataset.ebsfRowBadgeDone === '1') continue;

      const text = normName(el.textContent || el.getAttribute('title') || el.getAttribute('aria-label') || '');
      if(!text) continue;

      let matchKey = '';
      for(const k of names){
        const n = k.slice(5);
        if(n && text.includes(n)){
          matchKey = k;
          break;
        }
      }
      if(!matchKey) continue;

      const row = map[matchKey];
      const intel = row && row.intel ? row.intel : null;
      const badge = makeBadge(intel);
      badge.classList.add('ebsfHonorBadge');

      el.dataset.ebsfHonorBadgeDone = '1';
      hostRow.dataset.ebsfRowBadgeDone = '1';
      usedRows.add(rowKey);
      attachInside(el, badge);
      painted++;
    }
  }

  function getNodeKey(node){
    if(!node) return Math.random().toString(36);
    if(!node.dataset) return String(Math.random());
    if(!node.dataset.ebsfNodeKey) node.dataset.ebsfNodeKey = Math.random().toString(36).slice(2);
    return node.dataset.ebsfNodeKey;
  }


  function clearBadgeMarkers(){
    document.querySelectorAll('.ebsfNameBadge,#ebsfProfileFixedBadge,#ebsfProfileMiniBadge').forEach(b=>b.remove());
    document.querySelectorAll('[data-ebsf-badge-done], [data-ebsf-honor-badge-done], [data-ebsf-atk-badge-done], [data-ebsf-row-badge-done], [data-ebsf-generic-done]').forEach(el=>{
      delete el.dataset.ebsfBadgeDone;
      delete el.dataset.ebsfHonorBadgeDone;
      delete el.dataset.ebsfAtkBadgeDone;
      delete el.dataset.ebsfRowBadgeDone;
      delete el.dataset.ebsfGenericDone;
    });
  }


  function getBspLikeNameCandidates(){
    // Small, BSP-like candidate set. No all-div/all-span page scan.
    const selectors = [
      '[class*="honor"]',
      '[class*="name"]',
      '[class*="member"]',
      'tr td:first-child'
    ];
    const out = [];
    const seen = new Set();

    for(const sel of selectors){
      for(const el of document.querySelectorAll(sel)){
        if(out.length >= 160) return out;
        if(seen.has(el)) continue;
        if(el.dataset.ebsfHonorBadgeDone === '1') continue;
        if(el.querySelector?.('.ebsfNameBadge')) continue;

        const r = el.getBoundingClientRect?.();
        if(!r || r.width < 20 || r.height < 8 || r.width > 420 || r.height > 90) continue;
        if(r.bottom < -100 || r.top > window.innerHeight + 700) continue;

        seen.add(el);
        out.push(el);
      }
    }
    return out;
  }

  function bestSmallMount(row){
    if(!row) return null;
    return row.querySelector?.('[class*="honor"], [class*="name"], a[href*="profiles.php"], td') || row;
  }

  function attachInside(el, badge){
    try{
      const cs = getComputedStyle(el);
      if(cs.position === 'static') el.style.position = 'relative';
      el.appendChild(badge);
    }catch(e){}
  }


  function paintGenericFactionNameBadges(){
    // For non-war faction member pages or other faction pages where we do not have a scanned roster.
    // Very small pass: normal profile links + likely honor/name containers only. One badge per row.
    const anchors = [...document.querySelectorAll('a[href*="profiles.php?XID="]')]
      .filter(a => a.dataset.ebsfGenericDone !== '1')
      .slice(0, 55);

    for(const a of anchors){
      const id = extractTargetIdFromText(a.href);
      if(!id || (app.user && String(id) === String(app.user.user_id))) continue;

      const row = a.closest('tr, li, [class*="row"], [class*="member"], [class*="user"], div') || a.parentElement;
      if(!row || row.dataset.ebsfRowBadgeDone === '1') {
        a.dataset.ebsfGenericDone = '1';
        continue;
      }

      const mount = row.querySelector?.('[class*="honor"], [class*="name"], a[href*="profiles.php"]') || a;
      if(!mount || mount.querySelector?.('.ebsfNameBadge')) {
        a.dataset.ebsfGenericDone = '1';
        continue;
      }

      a.dataset.ebsfGenericDone = '1';
      row.dataset.ebsfRowBadgeDone = '1';

      const intel = getCachedIntel(id);
      const badge = makeBadge(intel); // N/A if no intel
      badge.classList.add('ebsfHonorBadge');

      attachInside(mount, badge);
    }
  }



  function paintHonorBadgesOnly(){
    // One badge only, on the actual player honor/name plate. No floating profile badge.
    if(!isHonorBadgePage()) return;

    if(!app.members || !app.members.length) loadCachedScan();
    buildBadgeNameMap?.();

    const map = getBadgeNameMap ? getBadgeNameMap() : {};
    const candidates = getHonorNameCandidates();
    if(!candidates.length) return;

    const usedRows = new Set();
    let painted = 0;

    for(const el of candidates){
      if(painted >= 80) break;
      if(el.dataset.ebsfHonorBadgeDone === '1') continue;
      if(el.querySelector?.(':scope > .ebsfNameBadge')) continue;

      const row = el.closest?.('tr, li, [class*="member"], [class*="row"], [class*="table-row"]') || el;
      const rowKey = getNodeKey(row);
      if(usedRows.has(rowKey) || row.dataset.ebsfRowBadgeDone === '1') continue;

      const nameText = normName(el.textContent || el.getAttribute('title') || el.getAttribute('aria-label') || '');
      if(!nameText || nameText.length < 2) continue;

      let intel = null;

      // First try exact player id if present in the row/honor.
      const id = extractTargetIdFromText((row.innerHTML || '') + ' ' + (el.innerHTML || ''));
      if(id) intel = getCachedIntel(id);

      // Then use scanned roster/cached name map.
      if(!intel){
        for(const k of Object.keys(map || {})){
          if(!k.startsWith('name:')) continue;
          const nm = k.slice(5);
          if(nm && nameText.includes(nm)){
            const v = map[k];
            intel = v && v.intel ? v.intel : null;
            break;
          }
        }
      }

      const badge = makeBadge(intel); // N/A if no intel
      badge.classList.add('ebsfHonorBadge');

      row.dataset.ebsfRowBadgeDone = '1';
      el.dataset.ebsfHonorBadgeDone = '1';
      usedRows.add(rowKey);

      attachInsideHonor(el, badge);
      painted++;
    }
  }

  function isHonorBadgePage(){
    const u = location.href;
    const title = document.title || '';
    const body = (document.body?.innerText || '').slice(0, 2500);
    return u.includes('factions.php') || u.includes('profiles.php') || /faction|profile/i.test(title) || /Members\s+Score\s+Status|User Information|Medals|Awards|Actions/i.test(body);
  }

  function getHonorNameCandidates(){
    // Small BSP-style set only. Avoid score/status/attack columns.
    const selectors = [
      '[class*="honor"]',
      '[class*="honorWrap"]',
      '[class*="name"]',
      '[class*="user-name"]',
      'a[href*="profiles.php?XID="]'
    ];

    const out = [];
    const seen = new Set();

    for(const sel of selectors){
      for(const el of document.querySelectorAll(sel)){
        if(out.length >= 160) return out;
        if(seen.has(el)) continue;
        if(el.dataset.ebsfHonorBadgeDone === '1') continue;
        if(el.closest?.('[class*="status"], [class*="score"], [class*="attack"]')) continue;

        const txt = (el.textContent || '').trim();
        const r = el.getBoundingClientRect?.();
        if(!r || r.width < 28 || r.height < 8 || r.width > 360 || r.height > 90) continue;
        if(r.bottom < -120 || r.top > window.innerHeight + 700) continue;

        // Must look like a name/honor plate, not a table heading or random UI.
        const cls = String(el.className || '').toLowerCase();
        const href = el.href || '';
        const looksGood = cls.includes('honor') || cls.includes('name') || href.includes('profiles.php');
        if(!looksGood) continue;
        if(/members|score|status|attack|respect|rank/i.test(txt) && txt.length < 20) continue;

        seen.add(el);
        out.push(el);
      }
    }
    return out;
  }

  function attachInsideHonor(el, badge){
    try{
      const cs = getComputedStyle(el);
      if(cs.position === 'static') el.style.position = 'relative';
      el.appendChild(badge);
    }catch(e){}
  }

  // Disable old floating/profile/general badge painters.
  function paintProfileFixedBadge(){ return; }
  async function paintProfilePageBadge(){ return; }
  function paintHonorBadgesOnly(){ paintHonorBadgesOnly(); }


  function isUsefulBadgePage(){
    const u = location.href;
    const title = document.title || '';
    const body = (document.body?.innerText || '').slice(0, 3000);
    return u.includes('factions.php') || u.includes('profiles.php') || /profile/i.test(title) || /faction/i.test(title) || /User Information|Medals|Awards|Interaction history|Actions/i.test(body);
  }

  function paintHonorBadgesOnly(){
    if(!isUsefulBadgePage()) return;

    if(isProfileLikePage()){
      
    }

    if(location.href.includes('factions.php') || /faction/i.test(document.title || '') || /Members\s+Score\s+Status|Chain active|No active chain/i.test(document.body?.innerText || '')){
      paintFactionRowsAlways();
    }
  }

  function isProfileLikePage(){
    const u = location.href;
    const title = document.title || '';
    const body = (document.body?.innerText || '').slice(0, 3000);
    return u.includes('profiles.php') || /'s Profile|Profile/i.test(title) || /User Information|You have not interacted with this person|Medals|Awards/i.test(body);
  }

  async function paintProfileFixedBadge(){ return; }

  function detectProfileIdFromPage(){
    const links = [...document.querySelectorAll('a[href*="XID="], a[href*="user2ID="], a[href*="sid=attack"]')];
    for(const a of links){
      const id = extractTargetIdFromText(a.href || a.getAttribute('href') || a.outerHTML || '');
      if(id && (!app.user || String(id) !== String(app.user.user_id))) return id;
    }
    return null;
  }

  function applyFloatingBadge(badge, intel, cached){
    if(!intel || (!intel.best_total && !intel.total && !intel.range_low && !intel.range_high)){
      badge.className = 'unknown';
      badge.textContent = '⚔️ N/A';
      return;
    }
    const label = String(intel.label || 'Unknown').toLowerCase();
    badge.className = ['easy','fair','good','difficult','avoid'].includes(label) ? label : 'unknown';
    const val = intel.best_total || intel.total || ((intel.range_low && intel.range_high) ? ((intel.range_low + intel.range_high) / 2) : 0);
    badge.textContent = `⚔️ ${fmtShort(val)}`;
    badge.title = `Battle Stat Finder${cached?' cached':''}: ${intel.label || 'Unknown'} • ${fmt(val)} • ${Math.round(intel.confidence||0)}% confidence`;
  }

  function paintFactionRowsAlways(){
    // If we have no roster/intel yet, still show N/A on visible rows.
    const rows = [...document.querySelectorAll('tr, li, [class*="member"], [class*="row"]')]
      .filter(row => row.dataset.ebsfRowBadgeDone !== '1')
      .slice(0, 80);

    const map = getBadgeNameMap ? getBadgeNameMap() : {};

    for(const row of rows){
      const txt = (row.textContent || '').trim();
      if(!txt || txt.length < 3) continue;
      if(!/okay|attack|profile|member|score|status/i.test(txt) && !row.querySelector?.('a[href*="profiles.php"], a[href*="user2ID"], [class*="honor"], [class*="name"]')) continue;

      const mount = row.querySelector?.('[class*="honor"], [class*="name"], a[href*="profiles.php"], td:first-child') || row;
      if(!mount || mount.querySelector?.('.ebsfNameBadge')) {
        row.dataset.ebsfRowBadgeDone = '1';
        continue;
      }

      let intel = null;
      const id = extractTargetIdFromText(row.innerHTML || '');
      if(id) intel = getCachedIntel(id);

      if(!intel){
        const ntext = normName(txt);
        for(const k of Object.keys(map || {})){
          if(!k.startsWith('name:')) continue;
          const nm = k.slice(5);
          if(nm && ntext.includes(nm)){
            const v = map[k];
            intel = v && v.intel ? v.intel : null;
            break;
          }
        }
      }

      const badge = makeBadge(intel); // N/A if missing
      badge.classList.add('ebsfHonorBadge');

      row.dataset.ebsfRowBadgeDone = '1';
      attachInside(mount, badge);
    }
  }


  async function paintProfilePageBadge(){
    if(!location.href.includes('profiles.php')) return;
    if(document.getElementById('ebsfProfileMiniBadge')) return;

    const pid = getProfilePageId();
    if(!pid || (app.user && String(pid) === String(app.user.user_id))) return;

    const mount = findProfileBadgeMount();
    if(!mount) return;

    const badge = document.createElement('span');
    badge.id = 'ebsfProfileMiniBadge';
    badge.className = 'unknown';
    badge.textContent = 'N/A';
    badge.title = 'No Battle Stat Finder intel yet';

    try{ mount.appendChild(badge); }catch(e){ return; }

    const cached = getCachedIntel(pid);
    if(cached) applyProfileBadge(badge, cached, true);

    // One backend call max on profile page to refresh this one player.
    try{
      const yourTotal = app.total || GM_getValue(S.total, '');
      const r = await get('/api/player/'+encodeURIComponent(pid)+'/intel?your_total='+encodeURIComponent(yourTotal));
      const p = r.player || r.enemy || null;
      if(p){
        saveCachedIntel(pid, p);
        applyProfileBadge(badge, p, false);
      }else if(!cached){
        badge.className = 'unknown';
        badge.textContent = 'N/A';
      }
    }catch(e){}
  }

  function applyProfileBadge(badge, intel, cached){
    if(!intel || (!intel.best_total && !intel.total && !intel.range_low && !intel.range_high)){
      badge.className = 'unknown';
      badge.textContent = 'N/A';
      return;
    }
    const label = String(intel.label || 'Unknown').toLowerCase();
    badge.className = ['easy','fair','good','difficult','avoid'].includes(label) ? label : 'unknown';
    const val = intel.best_total || intel.total || ((intel.range_low && intel.range_high) ? ((intel.range_low + intel.range_high) / 2) : 0);
    badge.textContent = fmtShort(val);
    badge.title = `Battle Stat Finder${cached?' cached':''}: ${intel.label || 'Unknown'} • ${fmt(val)} • ${Math.round(intel.confidence||0)}% confidence`;
  }

  function getProfilePageId(){
    const id = new URL(location.href).searchParams.get('XID') || extractTargetIdFromText(location.href);
    return id ? Number(id) : null;
  }

  function findProfileBadgeMount(){
    // PDA top title is not directly inside the webpage, so mount inside first useful profile content.
    const choices = [
      document.querySelector('[class*="profile"] [class*="name"]'),
      document.querySelector('[class*="basic"] [class*="name"]'),
      document.querySelector('[class*="title"]'),
      document.querySelector('h1'),
      document.querySelector('#profile-container'),
      document.querySelector('[class*="profile"]'),
      document.body
    ].filter(Boolean);

    for(const el of choices){
      const r = el.getBoundingClientRect?.();
      if(!r || r.height === 0) continue;
      if(el === document.body) {
        const box = document.createElement('div');
        box.style.cssText = 'margin:8px 10px;padding:8px;border:1px solid #334155;border-radius:10px;background:#0b1120;color:#f8fafc;font-family:Arial,sans-serif;';
        box.innerHTML = '<b style="color:#facc15">⚔️ Battle Stat Finder</b> ';
        document.body.prepend(box);
        return box;
      }
      return el;
    }
    return null;
  }


  function makeBadge(intel){
    return makeHonorBadge(intel);
  }

  // Wrappers keep old calls safe.
  async function injectNameBadges(){ scheduleBadgePaint('manual'); setTimeout(()=>paintHonorBadgesOnly?.(), 400); setTimeout(()=>paintHonorBadgesOnly?.(), 400); }
  function injectHonorBadgesFromRoster(){ scheduleBadgePaint('manual'); setTimeout(()=>paintHonorBadgesOnly?.(), 400); setTimeout(()=>paintHonorBadgesOnly?.(), 400); }
  function collectBadgeTargets(){ return []; }





  function nodeKey(node){
    if(!node.dataset) node.dataset = {};
    if(!node.dataset.ebsfNodeKey) node.dataset.ebsfNodeKey = Math.random().toString(36).slice(2);
    return node.dataset.ebsfNodeKey;
  }

  function fmtShort(n){
    n=Number(String(n||'').replace(/,/g,''));
    if(!n)return'?';
    if(n>=1e12)return(n/1e12).toFixed(1)+'t';
    if(n>=1e9)return(n/1e9).toFixed(1)+'b';
    if(n>=1e6)return(n/1e6).toFixed(n>=1e8?0:1)+'m';
    if(n>=1e3)return(n/1e3).toFixed(0)+'k';
    return String(Math.round(n));
  }




  async function adminIntel(){
    const adminId = app.user?.user_id || safeJson(GM_getValue(S.user, null))?.user_id;
    q('#ebsfBody').innerHTML=`<div class="card"><h3>Admin / Intel</h3><p class="note">Loading intel summary...</p></div>`;
    if(!adminId){
      q('#ebsfBody').innerHTML=`<div class="card"><h3>Admin / Intel</h3><p class="note">Login first in Settings.</p></div>`;
      return;
    }
    const r = await get('/api/admin/intel-summary?admin_id='+encodeURIComponent(adminId));
    if(!r.ok){
      q('#ebsfBody').innerHTML=`<div class="card"><h3>Admin / Intel</h3><p class="note">Admin only or failed to load: ${esc(JSON.stringify(r.error||r))}</p></div>`;
      return;
    }
    const c = r.counts || {};
    const rows = (r.top || []).map(x=>`<tr><td>${esc(x.name||'Unknown')} [${x.user_id}]</td><td>${fmt(x.total)}</td><td>${fmt(x.range_low)}-${fmt(x.range_high)}</td><td>${Math.round(x.confidence||0)}%</td><td>${esc(x.source||'')}</td><td>${esc(x.source_detail||'')}</td></tr>`).join('');
    q('#ebsfBody').innerHTML=`<div class="grid"><div class="card"><h3>Intel Stats</h3>
      <div class="statsBox"><div class="statMini">Users<br><b>${c.users||0}</b></div><div class="statMini">Enemies<br><b>${c.enemies||0}</b></div><div class="statMini">Spies<br><b>${c.spies||0}</b></div><div class="statMini">Fight Results<br><b>${c.attacks||0}</b></div></div>
      <button id="adminRefresh" class="btn btn2" style="margin-top:10px">Refresh Intel</button>
      <p class="note">Use this to see if the app is learning. More fight results and spy entries means stronger predictions.</p>
      </div><div class="card"><h3>Top Confident Predictions</h3><table class="adminTable"><thead><tr><th>Enemy</th><th>Total</th><th>Range</th><th>Conf</th><th>Source</th><th>Reason</th></tr></thead><tbody>${rows||'<tr><td colspan="6">No data yet.</td></tr>'}</tbody></table></div></div>`;
    q('#adminRefresh').onclick=()=>adminIntel();
  }


  function actTarget(e){
    const id=Number(e.currentTarget.dataset.id);
    const name=e.currentTarget.dataset.name || 'Unknown';
    const m=app.members.find(x=>Number(x.user_id)===id)||{user_id:id,name};
    app.selected=m;
    const a=e.currentTarget.dataset.act;
    if(a==='profile') location.href=`https://www.torn.com/profiles.php?XID=${id}`;
    if(a==='attack'){
      rememberAttackTarget(id, m.name || name);
      location.href=`https://www.torn.com/loader.php?sid=attack&user2ID=${id}`;
    }
    if(a==='intel') toast('⚔️ Intel is learned automatically from attacks. Admin tools can review learned data.');
    if(a==='result') toast('⚔️ Learning is automatic. Attack this target and the script will save the result from the fight page.');
  }

  async function login(){
    app.key=q('#key').value.trim();
    app.tornstats=(q('#tskey')?.value||'').trim();
    app.yata=(q('#yatakey')?.value||'').trim();
    app.ffBase=!!q('#ffbase')?.checked;

    GM_setValue(S.key,app.key);
    GM_setValue(S.tornstats,app.tornstats);
    GM_setValue(S.yata,app.yata);
    GM_setValue(S.ffBase,app.ffBase);

    const r=await post('/api/login',{api_key:app.key});
    if(r.ok){
      app.user=r.user;
      const bs=app.user.battle_stats||{};
      app.total=String(bs.effective_total||bs.total||app.total||'');
      GM_setValue(S.user,JSON.stringify(app.user));
      GM_setValue(S.total,app.total);
      await post('/api/settings/integrations',{user_id:app.user.user_id,tornstats_key:app.tornstats,yata_key:app.yata,share_attack_learning:true,share_spies:true});
      msg(app.total ? `Logged in. Auto detected total battle stats: ${fmt(app.total)}. Starting scan...` : 'Logged in, but battle stats were not returned by API. Starting scan anyway.');
      await autoStartAfterLogin();
    } else msg('Login failed: '+JSON.stringify(r.error||r));
  }


  async function autoStartAfterLogin(){
    app.tab = 'targets';
    setTabs();
    render();

    // Always start badges immediately after login.
    setTimeout(()=>{ paintHonorBadgesOnly?.(); scheduleBadgePaint?.('manual'); }, 500);

    // Only auto-scan on faction pages. On profile pages it should not show a scary failed scan.
    const onFactionPage = location.href.includes('factions.php') || /faction/i.test(document.title || '');
    if(!onFactionPage && !app.enemyFaction){
      msg('Logged in. Badges are active. Go to a faction war page or enter enemy faction ID to scan.');
      return;
    }

    try{
      const r=await post('/api/war/enemy-scan',{
        api_key:app.key,
        your_total:app.total,
        enemy_faction_id:app.enemyFaction || '',
        faction_id:app.user?.faction_id
      });
      if(r.ok){
        app.members=r.members||[];
        app.enemyFaction=String(r.enemy_faction_id||app.enemyFaction||'');
        GM_setValue(S.enemyFaction,app.enemyFaction);
        GM_setValue(S.lastScan, JSON.stringify({members:app.members, enemyFaction:app.enemyFaction, ts:Date.now()}));
        cacheIntelFromMembers(app.members);
        const ffAdded = await importFFBaseForMembers();
        clearBadgeMarkers?.();
        buildBadgeNameMap?.();
        msg('Logged in and auto-scanned: '+app.members.length+' targets'+(ffAdded?` • FF base added ${ffAdded}`:'')+'.');
        render();
        setTimeout(()=>{ scheduleBadgePaint?.('scan');
          setTimeout(()=>paintHonorBadgesOnly?.(), 600); paintHonorBadgesOnly?.(); }, 600);
      } else {
        msg('Logged in. Badges are active. Press Scan on a faction war page if targets do not load.');
      }
    }catch(e){
      msg('Logged in. Badges are active. Press Scan manually on a faction war page.');
    }
  }


  async function importFFBaseForMembers(){
    if(!app.ffBase || !app.key || !app.members || !app.members.length) return 0;

    const targets = app.members
      .filter(m => m && m.user_id)
      .slice(0, 120)
      .map(m => ({user_id:m.user_id, name:m.name, faction_id:m.faction_id || app.enemyFaction}));

    if(!targets.length) return 0;

    const r = await post('/api/ffscouter/base-import', {
      api_key: app.key,
      targets,
      your_total: app.total,
      target_faction_id: app.enemyFaction,
      submitted_by: app.user?.user_id
    });

    if(!r.ok){
      msg('Scan complete. FF base intel failed: '+JSON.stringify(r.error||r.warning||r));
      return 0;
    }

    const preds = r.predictions || [];
    const byId = new Map(preds.map(p => [Number(p.user_id), p]));
    let changed = 0;

    for(const m of app.members){
      const p = byId.get(Number(m.user_id));
      if(!p) continue;
      const curConf = Number(m.intel?.confidence || 0);
      const newConf = Number(p.confidence || 0);
      if(!m.intel || m.intel.source === 'none' || curConf < 60 || newConf >= curConf){
        m.intel = p;
        saveCachedIntel(m.user_id, p);
        changed++;
      }
    }

    if(changed){
      GM_setValue(S.lastScan, JSON.stringify({members:app.members, enemyFaction:app.enemyFaction, ts:Date.now()}));
      cacheIntelFromMembers(app.members);
      buildBadgeNameMap?.();
      clearBadgeMarkers?.();
      scheduleBadgePaint?.('scan');
      setTimeout(()=>paintHonorBadgesOnly?.(), 600);
    }

    return changed;
  }


  async function scan(){
    if(!app.user || !app.key){
      app.tab='settings'; setTabs(); render(); msg('Login in Settings first.');
      return;
    }
    app.enemyFaction=q('#enemyFaction').value.trim();
    GM_setValue(S.enemyFaction,app.enemyFaction);

    const r=await post('/api/war/enemy-scan',{api_key:app.key,your_total:app.total,enemy_faction_id:app.enemyFaction,faction_id:app.user?.faction_id});
    if(r.ok){
      app.members=r.members||[];
      app.enemyFaction=String(r.enemy_faction_id||app.enemyFaction);
      GM_setValue(S.enemyFaction,app.enemyFaction);
      GM_setValue(S.lastScan, JSON.stringify({members:app.members, enemyFaction:app.enemyFaction, ts:Date.now()}));
      cacheIntelFromMembers(app.members);
      const ffAdded = await importFFBaseForMembers();
      msg('Scan complete: '+app.members.length+' enemies'+(ffAdded?` • FF base added ${ffAdded}`:'')+'. Badges refreshing...');
      setTimeout(()=>scheduleBadgePaint('scan'), 600);
    } else msg('Scan failed: '+JSON.stringify(r.error||r));
  }

  async function saveSpy(){
    const r=await post('/api/spy/manual',{target_id:q('#sid').value,target_name:q('#sname').value,strength:q('#str').value,defense:q('#def').value,speed:q('#spd').value,dexterity:q('#dex').value,source:'manual_spy',submitted_by:app.user?.user_id});
    msg(r.ok?'Spy saved. Re-scan to update labels.':'Spy failed: '+JSON.stringify(r.error||r));
  }

  async function saveEst(){
    const r=await post('/api/estimate/manual',{target_id:q('#eid').value,target_name:q('#ename').value,estimate_total:q('#etotal').value,range_low:q('#elow').value,range_high:q('#ehigh').value,source:q('#esource').value,source_detail:q('#edetail').value,submitted_by:app.user?.user_id});
    msg(r.ok?'Estimate saved. Re-scan to update labels.':'Estimate failed: '+JSON.stringify(r.error||r));
  }

  async function tsImport(){
    const r=await post('/api/integrations/tornstats/import-user',{tornstats_key:app.tornstats,target_id:q('#iid').value,target_name:q('#iname').value,submitted_by:app.user?.user_id});
    msg(r.ok?'TornStats imported. Re-scan to update labels.':'TornStats failed: '+JSON.stringify(r.error||r));
  }



  let ebsfUniversalFightTimer = null;
  let ebsfUniversalFightObs = null;

  function startUniversalFightWatcher(){
    if(ebsfUniversalFightTimer) clearInterval(ebsfUniversalFightTimer);
    ebsfUniversalFightTimer = setInterval(()=>detectFightEndAndAutoSave(), 1200);
    setTimeout(()=>{ clearInterval(ebsfUniversalFightTimer); ebsfUniversalFightTimer=null; }, 1000*60*6);

    try{
      if(ebsfUniversalFightObs) ebsfUniversalFightObs.disconnect();
      ebsfUniversalFightObs = new MutationObserver(()=>detectFightEndAndAutoSave());
      ebsfUniversalFightObs.observe(document.body, {childList:true, subtree:true, characterData:true});
      setTimeout(()=>ebsfUniversalFightObs?.disconnect(), 1000*60*6);
    }catch(e){}
  }

  function startUniversalFightWatcherIfPending(){
    const pending = readRememberedAttackTarget?.();
    if(!pending) return;
    const clicked = Number(GM_getValue('ebsf_attack_click_ts', 0) || 0);
    if(clicked && Date.now() - clicked < 1000*60*15){
      startUniversalFightWatcher();
      bsfStartDeepFightWatch?.();
    }
  }


  function watchAttackPage(){
    const attackish = location.href.includes('sid=attack') || /attack|fight/i.test(location.href) || /fight|attack|mug|hospital/i.test((document.body?.innerText || '').slice(0, 1500));
    if(!attackish && !readRememberedAttackTarget?.()) return;

    const urlId = new URL(location.href).searchParams.get('user2ID') || new URL(location.href).searchParams.get('userID') || new URL(location.href).searchParams.get('targetID');
    if(urlId){
      rememberAttackTarget(Number(urlId), 'Enemy');
    }

    startUniversalFightWatcher();
      bsfStartDeepFightWatch?.();
  }

  function detectFightEndAndAutoSave(){
    if(bsfTrySaveFromResultText?.(document.body?.innerText || '', 'detectFightEnd')) return;
    let saved = readRememberedAttackTarget?.();
    if(!saved || !saved.id){
      const found = detectTargetFromPage?.();
      if(found){
        saved = {id:found.id, name:found.name||'Enemy', ts:Date.now()};
        rememberAttackTarget(saved.id, saved.name);
      } else {
        return;
      }
    }

    const bodyTextRaw = (document.body?.innerText || '');
    const bodyText = bodyTextRaw.replace(/\s+/g, ' ');
    const text = bodyText.toLowerCase();

    const winWords = [
      'you won',
      'you have won',
      'you mugged',
      'you hospitalize',
      'you hospitalized',
      'you left',
      'you defeated',
      'you beat',
      'victory',
      'you gained',
      'respect gained',
      'experience gained',
      'you leave',
      'you have mugged'
    ];
    const lossWords = [
      'you lost',
      'you have lost',
      'you were defeated',
      'defeated by',
      'you were hospitalized',
      'you ran away',
      'stalemate',
      'you failed'
    ];

    const won = winWords.some(w=>text.includes(w));
    const lost = lossWords.some(w=>text.includes(w));
    const ended = won || lost || /fight over|result|continue|leave them|mug|hospital|respect gained|experience gained|you gained/i.test(bodyText);
    if(!ended) return;

    const resultSide = won ? 'win' : lost ? 'loss' : 'unknown';
    if(resultSide === 'unknown') return;

    const key = `${saved.id}:${Math.floor((saved.ts||Date.now())/1000)}:${resultSide}`;
    if(GM_getValue(S.lastPrompted, '') === key) return;
    GM_setValue(S.lastPrompted, key);

    const detail = extractFightDetails(text);
    detail.resultSide = resultSide;
    const result = classifyFightResult(text, won, detail);

    autoSaveFightResult(saved.id, saved.name || getPageProfileName?.() || 'Enemy', result, false, detail);
  }

  function detectTargetFromPage(){
    const href = location.href;
    let id = extractTargetIdFromText(href);
    if(id) return {id:Number(id), name:getPageProfileName() || 'Enemy'};

    const remembered = readRememberedAttackTarget();
    if(remembered) return remembered;

    const links = [...document.querySelectorAll('a[href*="profiles.php?XID="], a[href*="user2ID="], a[href*="sid=attack"]')];
    for(const a of links){
      const found = extractTargetIdFromText(a.href || a.outerHTML);
      if(found && app.user && String(found) !== String(app.user.user_id)){
        return {id:Number(found), name:(a.textContent||getPageProfileName()||'Enemy').trim() || 'Enemy'};
      }
    }

    return null;
  }

  function classifyFightResult(text, won, detail){
    detail = detail || extractFightDetails(text);

    // Best automatic classes:
    // easy_win: you won with strong signs it was not close
    // close_win: you won but the fight looked close
    // close_loss: you lost/stalemated but signs say it was close
    // hard_loss: you lost with signs it was not close

    if(detail.stalemate) return 'close_loss';

    if(won){
      if(detail.yourLifePct !== null){
        if(detail.yourLifePct <= 28) return 'close_win';
        if(detail.yourLifePct >= 70 && detail.turns <= 8) return 'easy_win';
      }
      if(detail.turns >= 18) return 'close_win';
      if(detail.closeWords) return 'close_win';
      if(detail.turns > 0 && detail.turns <= 6) return 'easy_win';
      return 'auto_win';
    }

    if(!won){
      if(detail.enemyLifePct !== null){
        if(detail.enemyLifePct <= 35) return 'close_loss';
        if(detail.enemyLifePct >= 70 && detail.turns <= 8) return 'hard_loss';
      }
      if(detail.turns >= 18) return 'close_loss';
      if(detail.closeWords) return 'close_loss';
      if(detail.turns > 0 && detail.turns <= 6) return 'hard_loss';
      return 'auto_loss';
    }

    return won ? 'auto_win' : 'auto_loss';
  }

  function extractFightDetails(text){
    const detail = {
      turns: 0,
      yourLifePct: null,
      enemyLifePct: null,
      closeWords: false,
      stalemate: false,
      hitCount: 0,
      missCount: 0,
      critCount: 0,
      quality: 45
    };

    detail.stalemate = text.includes('stalemate');

    const closeHints = [
      'barely',
      'close fight',
      'almost lost',
      'low life',
      'low health',
      'you are low',
      'could not finish',
      'struggle',
      'withstand'
    ];
    detail.closeWords = closeHints.some(w => text.includes(w));

    detail.hitCount = countWords(text, [' hit ', ' hits ', ' struck ', ' attacked ', ' fired ']);
    detail.missCount = countWords(text, [' missed ', ' dodged ', ' evaded ']);
    detail.critCount = countWords(text, [' critical ', ' critically ', ' crit ']);

    const verbs = [' hit ', ' hits ', ' missed ', ' fired ', ' attacked ', ' struck ', ' critically ', ' dodged ', ' blocked ', ' evaded '];
    let count = 0;
    for(const v of verbs){
      count += (text.match(new RegExp(escapeReg(v), 'g')) || []).length;
    }
    detail.turns = Math.min(80, count);

    const lifePairs = [...text.matchAll(/(?:life|health|hp)[^\d]{0,20}([\d,]+)\s*\/\s*([\d,]+)/gi)];
    if(lifePairs.length){
      const first = pct(lifePairs[0][1], lifePairs[0][2]);
      if(first !== null) detail.yourLifePct = first;
      if(lifePairs[1]){
        const second = pct(lifePairs[1][1], lifePairs[1][2]);
        if(second !== null) detail.enemyLifePct = second;
      }
    }

    const youPct = text.match(/(?:you|your)[^\n]{0,45}?(\d{1,3})\s*%\s*(?:life|health|hp)/i);
    if(youPct) detail.yourLifePct = clampPct(Number(youPct[1]));

    const enemyPct = text.match(/(?:enemy|opponent|target|their)[^\n]{0,45}?(\d{1,3})\s*%\s*(?:life|health|hp)/i);
    if(enemyPct) detail.enemyLifePct = clampPct(Number(enemyPct[1]));

    let q = 45;
    if(detail.turns > 0) q += 15;
    if(detail.yourLifePct !== null) q += 18;
    if(detail.enemyLifePct !== null) q += 18;
    if(detail.stalemate || detail.closeWords) q += 8;
    if(detail.hitCount || detail.missCount || detail.critCount) q += 6;
    detail.quality = Math.max(35, Math.min(96, q));

    return detail;
  }

  function countWords(text, words){
    let n = 0;
    for(const w of words){
      n += (text.match(new RegExp(escapeReg(w), 'g')) || []).length;
    }
    return n;
  }

  function pct(a,b){
    const x=Number(String(a||'').replace(/,/g,''));
    const y=Number(String(b||'').replace(/,/g,''));
    if(!x || !y) return null;
    return clampPct((x/y)*100);
  }

  function clampPct(n){
    if(!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(100, n));
  }

  function escapeReg(s){
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }


  function normalizeFightResultForEstimate(result, detail){
    if(['easy_win','close_win','generic_win','auto_win','close_loss','generic_loss','auto_loss','hard_loss'].includes(result)) return result;
    const side = detail && detail.resultSide;
    if(side === 'win') return 'generic_win';
    if(side === 'loss') return 'generic_loss';
    if(String(result||'').includes('win')) return 'generic_win';
    if(String(result||'').includes('loss')) return 'generic_loss';
    return result || 'generic_win';
  }

  function makeImmediateFightIntel(result, targetId){
    const t = Number(String(app.total || GM_getValue(S.total, '') || '').replace(/,/g,''));
    if(!t) return null;

    let low, high, label;
    if(result === 'easy_win'){
      low = t * 0.05; high = t * 0.70; label = 'Easy';
    } else if(result === 'close_win'){
      low = t * 0.75; high = t * 1.05; label = 'Fair';
    } else if(result === 'generic_win' || result === 'auto_win'){
      low = t * 0.55; high = t * 1.00; label = 'Fair';
    } else if(result === 'close_loss'){
      low = t * 0.95; high = t * 1.25; label = 'Difficult';
    } else if(result === 'generic_loss' || result === 'auto_loss'){
      low = t * 1.00; high = t * 1.55; label = 'Difficult';
    } else if(result === 'hard_loss'){
      low = t * 1.35; high = t * 2.20; label = 'Avoid';
    } else {
      low = t * 0.75; high = t * 1.25; label = 'Unknown';
    }

    const total = Math.round((low + high) / 2);
    return {
      user_id: Number(targetId),
      total,
      best_total: total,
      range_low: Math.round(low),
      range_high: Math.round(high),
      label,
      confidence: 42,
      source: 'instant_fight_learning',
      source_detail: 'instant estimate from latest fight'
    };
  }

  function updateBadgeForTargetNow(targetId, intel){
    if(!targetId || !intel) return;
    saveCachedIntel(targetId, intel);
    buildBadgeNameMap?.();

    document.querySelectorAll('.ebsfNameBadge').forEach(b=>{
      const host = b.closest?.('tr, li, [class*="row"], [class*="member"], [class*="honor"], [class*="name"], a[href*="profiles.php"]') || b.parentElement;
      const blob = (host?.innerHTML || '') + ' ' + (host?.textContent || '');
      const id = extractTargetIdFromText(blob);
      if(id && Number(id) === Number(targetId)){
        updateHonorBadge?.(b, intel);
      }
    });

    buildBadgeNameMap?.();
    scheduleBadgePaint?.('scan');
    setTimeout(()=>paintHonorBadgesOnly?.(), 250);
    setTimeout(()=>paintHonorBadgesOnly?.(), 900);
  }


  async function autoSaveFightResult(targetId, targetName, result, manualButton, detail){
    if(!app.user || !app.user.user_id){
      app.user = safeJson(GM_getValue(S.user, null));
    }
    app.total = app.total || GM_getValue(S.total, '');

    if(!app.user?.user_id || !app.total){
      toast('⚔️ Auto learning skipped: login in Settings first so I know your stats.');
      return false;
    }

    result = normalizeFightResultForEstimate(result, detail);
    const instant = makeImmediateFightIntel(result, targetId);

    if(instant){
      updateBadgeForTargetNow(targetId, instant);
      toast(`⚔️ Fight learned for ${targetName}. Showing estimate now...`);
    }

    const r=await post('/api/attack/result',{
      attacker_id:app.user.user_id,
      attacker_name:app.user.name,
      attacker_total:app.total,
      target_id:targetId,
      target_name:targetName,
      result,
      fight_meta: detail || {},
      detected_confidence: (detail && detail.quality) || 55,
      result_source: manualButton ? 'manual' : 'auto'
    });

    if(r.ok){
      const p = await refreshSingleIntel(targetId, false);
      if(p){
        updateBadgeForTargetNow(targetId, p);
        toast(`⚔️ Backend prediction updated for ${targetName}.`);
      }else if(instant){
        updateBadgeForTargetNow(targetId, instant);
      }
      setTimeout(()=>{ if(app.key && app.user && app.enemyFaction) scan(); }, 1800);
      return true;
    }

    if(instant){
      updateBadgeForTargetNow(targetId, instant);
      toast('⚔️ Backend save failed, but local estimate was kept.');
      return false;
    }

    toast('⚔️ Auto learning failed: '+JSON.stringify(r.error||r));
    return false;
  }


  function toast(message){
    document.getElementById('ebsfAutoToast')?.remove();
    const d=document.createElement('div');
    d.id='ebsfAutoToast';
    d.innerHTML=`<b>${esc(message)}</b>`;
    document.body.appendChild(d);
    setTimeout(()=>d.remove(), 4200);
  }


  function prettyResult(r){
    return ({
      easy_win:'Easy Win',
      close_win:'Close Win',
      close_loss:'Close Loss',
      hard_loss:'Hard Loss',
      auto_win:'Auto Win',
      auto_loss:'Auto Loss',
      generic_win:'Win',
      generic_loss:'Loss'
    })[r] || r;
  }

  function get(path){
    return new Promise(resolve=>{
      GM_xmlhttpRequest({
        method:'GET',
        url:API_BASE+path,
        timeout:30000,
        onload:r=>{try{resolve(JSON.parse(r.responseText));}catch(e){resolve({ok:false,error:r.responseText});}},
        onerror:e=>resolve({ok:false,error:e}),
        ontimeout:()=>resolve({ok:false,error:'timeout'})
      });
    });
  }


  async function refreshSingleIntel(targetId, repaint){
    try{
      const yourTotal = app.total || GM_getValue(S.total, '');
      const r = await get('/api/player/'+encodeURIComponent(targetId)+'/intel?your_total='+encodeURIComponent(yourTotal));
      const p = r.player || r.enemy || null;
      if(p){
        saveCachedIntel(targetId, p);
        if(repaint) updateBadgeForTargetNow(targetId, p);
      }
      return p || null;
    }catch(e){ return null; }
  }


  function post(path,data){
    return new Promise(resolve=>{
      GM_xmlhttpRequest({
        method:'POST',
        url:API_BASE+path,
        headers:{'Content-Type':'application/json'},
        data:JSON.stringify(data),
        timeout:30000,
        onload:r=>{try{resolve(JSON.parse(r.responseText));}catch(e){resolve({ok:false,error:r.responseText});}},
        onerror:e=>resolve({ok:false,error:e}),
        ontimeout:()=>resolve({ok:false,error:'timeout'})
      });
    });
  }

  function msg(t){app.msg=t; render();}
  function q(s){return document.querySelector(s);}
  function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function safeJson(v){try{return v?JSON.parse(v):null}catch(e){return null;}}
  function num(n){n=Number(String(n||'').replace(/,/g,'')); return Number.isFinite(n)&&n>0?n:null;}
  function fmt(n){n=Number(String(n||'').replace(/,/g,'')); if(!n)return'?'; if(n>=1e12)return(n/1e12).toFixed(2)+'t'; if(n>=1e9)return(n/1e9).toFixed(2)+'b'; if(n>=1e6)return(n/1e6).toFixed(1)+'m'; if(n>=1e3)return(n/1e3).toFixed(1)+'k'; return String(Math.round(n));}

/* ===== v1.3.1 BSP-inspired hard override: one honor/name badge only ===== */
GM_addStyle(`
.ebsfNameBadge{display:inline-flex!important;align-items:center;justify-content:center;padding:1px 5px!important;border-radius:4px!important;border:1px solid #64748b;background:#111827;color:#cbd5e1;font:900 9px Arial,sans-serif!important;line-height:1!important;text-shadow:none!important;box-shadow:0 1px 4px #0009;pointer-events:none;white-space:nowrap;max-width:48px;min-width:30px;overflow:hidden}
.ebsfHonorBadge{position:absolute!important;right:3px!important;top:2px!important;margin:0!important;z-index:70!important}
.ebsfNameBadge.easy{background:#052e16;color:#86efac;border-color:#22c55e}
.ebsfNameBadge.fair{background:#172554;color:#93c5fd;border-color:#3b82f6}
.ebsfNameBadge.good{background:#422006;color:#fde68a;border-color:#f59e0b}
.ebsfNameBadge.difficult{background:#431407;color:#fdba74;border-color:#f97316}
.ebsfNameBadge.avoid{background:#450a0a;color:#fca5a5;border-color:#ef4444}
.ebsfNameBadge.unknown{background:#111827;color:#cbd5e1;border-color:#64748b}
#ebsfProfileFixedBadge,#ebsfProfileMiniBadge{display:none!important}
`);

function ebsfUser(){
  return safeJson(GM_getValue(S.user, null)) || app.user || null;
}
function ebsfTotal(){
  return GM_getValue(S.total, '') || app.total || '';
}
function ebsfCache(){
  return safeJson(GM_getValue(S.intelCache || 'ebsf_intel_cache', '{}')) || {};
}
function ebsfSaveCache(c){
  GM_setValue(S.intelCache || 'ebsf_intel_cache', JSON.stringify(c || {}));
}
function ebsfGetCached(id){
  const row = ebsfCache()[String(id)];
  if(!row || !row.intel) return null;
  return row.intel;
}
function ebsfSaveCached(id,intel){
  if(!id || !intel) return;
  const c=ebsfCache();
  c[String(id)]={intel,ts:Date.now()};
  ebsfSaveCache(c);
}
function ebsfLastScanMembers(){
  const x=safeJson(GM_getValue(S.lastScan || 'ebsf_last_scan_payload', null));
  return (x && Array.isArray(x.members)) ? x.members : [];
}
function ebsfRosterMap(){
  const map={};
  for(const m of ebsfLastScanMembers()){
    if(!m) continue;
    const id=m.user_id || m.id;
    const intel=m.intel || (id ? ebsfGetCached(id) : null);
    if(id && intel) map['id:'+id]=intel;
    const n=normName(m.name || '');
    if(n) map['name:'+n]={id,intel};
  }
  return map;
}
function ebsfBadge(intel){
  const b=document.createElement('span');
  ebsfUpdateBadge(b,intel);
  return b;
}
function ebsfUpdateBadge(b,intel){
  if(!intel || (!intel.best_total && !intel.total && !intel.range_low && !intel.range_high)){
    b.className='ebsfNameBadge ebsfHonorBadge unknown';
    b.textContent='N/A';
    b.title='No Battle Stat Finder intel yet';
    return;
  }
  const label=String(intel.label||'Unknown').toLowerCase();
  const cls=['easy','fair','good','difficult','avoid'].includes(label)?label:'unknown';
  const val=intel.best_total || intel.total || ((intel.range_low && intel.range_high)?((Number(intel.range_low)+Number(intel.range_high))/2):0);
  b.className='ebsfNameBadge ebsfHonorBadge '+cls;
  b.textContent=fmtShort(val);
  b.title=`Battle Stat Finder: ${intel.label||'Unknown'} • ${fmt(val)} • ${Math.round(intel.confidence||0)}% confidence`;
}
function ebsfAttach(mount,badge){
  if(!mount) return false;
  try{
    if(mount.querySelector(':scope > .ebsfNameBadge')) return false;
    const cs=getComputedStyle(mount);
    if(cs.position==='static') mount.style.position='relative';
    mount.appendChild(badge);
    return true;
  }catch(e){return false;}
}
function ebsfCleanupBad(){
  document.querySelectorAll('#ebsfProfileFixedBadge,#ebsfProfileMiniBadge').forEach(x=>x.remove());
  document.querySelectorAll('.ebsfNameBadge').forEach(b=>{
    if(b.closest('[class*="score"],[class*="status"],[class*="attack"]')) b.remove();
  });
}
function ebsfFindRows(){
  const rows=[...document.querySelectorAll('tr,li,[class*="row"],[class*="member"]')];
  return rows.filter(row=>{
    if(row.dataset.ebsfRowBadgeDone==='1') return false;
    const txt=(row.textContent||'').trim();
    if(txt.length<3) return false;
    const cells=row.querySelectorAll?.('td,[class*="cell"],[class*="column"]') || [];
    const hasTable=cells.length>=3;
    const warWords=/okay|attack|hospital|travel|jail/i.test(txt);
    const hasVisual=!!row.querySelector?.('img,[style*="background-image"],[class*="honor"],[class*="name"],a[href*="profiles.php"]');
    const r=row.getBoundingClientRect?.();
    return r && r.width>160 && r.height>12 && r.top<window.innerHeight+900 && r.bottom>-150 && ((hasTable&&(warWords||hasVisual))||(warWords&&hasVisual));
  }).slice(0,120);
}
function ebsfMemberCell(row){
  const cells=[...(row.querySelectorAll?.('td,[class*="cell"],[class*="column"]')||[])];
  for(const c of cells.slice(0,2)){
    const txt=(c.textContent||'').trim();
    if(/score|status|attack|okay|hospital|travel|jail/i.test(txt) && txt.length<50) continue;
    const r=c.getBoundingClientRect?.();
    if(r && r.width>50 && r.height>10) return c;
  }
  // div row fallback: first child with image/name-ish content
  for(const c of [...row.children].slice(0,4)){
    const r=c.getBoundingClientRect?.();
    if(!r || r.width<50 || r.height<10) continue;
    if(c.querySelector?.('img,[style*="background-image"],[class*="honor"],[class*="name"],a[href*="profiles.php"]')) return c;
  }
  return null;
}
function ebsfMountInCell(cell){
  if(!cell) return null;
  const cand=[...(cell.querySelectorAll?.('[class*="honor"],[class*="name"],[style*="background-image"],img,a[href*="profiles.php"]')||[])];
  let best=null, score=-999;
  for(const el of cand){
    if(el.closest?.('[class*="score"],[class*="status"],[class*="attack"]')) continue;
    const r=el.getBoundingClientRect?.();
    if(!r || r.width<30 || r.height<8 || r.width>360 || r.height>95) continue;
    const cls=String(el.className||'').toLowerCase();
    const st=String(el.getAttribute('style')||'').toLowerCase();
    let s=0;
    if(cls.includes('honor')) s+=50;
    if(cls.includes('name')) s+=30;
    if(st.includes('background-image')) s+=25;
    if(el.tagName==='IMG') s+=22;
    if(el.href && el.href.includes('profiles.php')) s+=20;
    s+=Math.min(35,r.width/8);
    if(s>score){score=s; best=el;}
  }
  if(best && best.parentElement){
    const pr=best.parentElement.getBoundingClientRect?.(), br=best.getBoundingClientRect?.();
    if(pr && br && pr.width>=br.width && pr.width<380 && pr.height<110) return best.parentElement;
  }
  return best || cell;
}
function ebsfIntelFrom(row,cell,mount,map){
  const blob=[row.innerHTML,cell?.innerHTML,mount?.innerHTML].filter(Boolean).join(' ');
  const id=extractTargetIdFromText(blob);
  if(id){
    const cached=ebsfGetCached(id);
    if(cached) return cached;
  }
  const t=normName((mount?.textContent||cell?.textContent||row.textContent||'').trim());
  if(t){
    for(const k of Object.keys(map)){
      if(!k.startsWith('name:')) continue;
      const nm=k.slice(5);
      if(nm && t.includes(nm)){
        const v=map[k];
        if(v && v.intel) return v.intel;
      }
    }
  }
  return null;
}
function ebsfPaintWarRows(){
  const map=ebsfRosterMap();
  for(const row of ebsfFindRows()){
    const cell=ebsfMemberCell(row);
    const mount=ebsfMountInCell(cell);
    if(!mount || mount.querySelector?.(':scope > .ebsfNameBadge')){
      row.dataset.ebsfRowBadgeDone='1';
      continue;
    }
    const intel=ebsfIntelFrom(row,cell,mount,map);
    if(ebsfAttach(mount, ebsfBadge(intel))) row.dataset.ebsfRowBadgeDone='1';
  }
}
function ebsfProfileLike(){
  const body=(document.body?.innerText||'').slice(0,4000);
  return location.href.includes('profiles.php') || /'s Profile|Profile/i.test(document.title||'') || /User Information|Medals|Awards|Actions/i.test(body);
}
function ebsfProfileMount(){
  const all=[...document.querySelectorAll('img,[style*="background-image"],[class*="honor"],[class*="name"]')];
  let best=null,score=-999;
  for(const el of all){
    if(el.closest?.('#ebsfRoot,[class*="status"],[class*="score"],[class*="attack"]')) continue;
    const r=el.getBoundingClientRect?.();
    if(!r || r.width<90 || r.height<10 || r.width>600 || r.height>120) continue;
    if(r.top<150 || r.top>window.innerHeight+900) continue;
    const cls=String(el.className||'').toLowerCase(), st=String(el.getAttribute('style')||'').toLowerCase();
    let s=0;
    if(cls.includes('honor')) s+=50;
    if(cls.includes('name')) s+=25;
    if(st.includes('background-image')) s+=25;
    if(el.tagName==='IMG') s+=22;
    s+=Math.min(45,r.width/10);
    if(s>score){score=s;best=el;}
  }
  if(best && best.parentElement){
    const pr=best.parentElement.getBoundingClientRect?.(), br=best.getBoundingClientRect?.();
    if(pr && br && pr.width>=br.width && pr.width<650 && pr.height<150) return best.parentElement;
  }
  return best;
}
function ebsfProfileId(){
  const urlId=new URL(location.href).searchParams.get('XID');
  if(urlId) return Number(urlId);
  for(const a of document.querySelectorAll('a[href*="XID="],a[href*="user2ID="],a[href*="sid=attack"]')){
    const id=extractTargetIdFromText(a.href || a.getAttribute('href') || a.outerHTML || '');
    if(id && (!ebsfUser() || String(id)!==String(ebsfUser().user_id))) return id;
  }
  return null;
}
function ebsfPaintProfile(){
  if(!ebsfProfileLike()) return;
  if(document.querySelector('.ebsfProfileHonorDone')) return;
  const mount=ebsfProfileMount();
  if(!mount || mount.querySelector?.(':scope > .ebsfNameBadge')) return;
  const pid=ebsfProfileId();
  const badge=ebsfBadge(pid ? ebsfGetCached(pid) : null);
  badge.classList.add('ebsfProfileHonorDone');
  if(ebsfAttach(mount,badge) && pid){
    setTimeout(async()=>{
      try{
        const r=await get('/api/player/'+encodeURIComponent(pid)+'/intel?your_total='+encodeURIComponent(ebsfTotal()));
        const p=r.player||r.enemy||null;
        if(p){ ebsfSaveCached(pid,p); ebsfUpdateBadge(badge,p); }
      }catch(e){}
    },700);
  }
}
function paintHonorBadgesOnly(){
  ebsfCleanupBad();
  ebsfPaintWarRows();
  ebsfPaintProfile();
}
function paintAlwaysVisibleBadges(){paintHonorBadgesOnly();}
function paintProfileFixedBadge(){return;}
async function paintProfilePageBadge(){ebsfPaintProfile();}
function paintFactionRowsAlways(){paintHonorBadgesOnly();}
function paintGenericFactionNameBadges(){return;}
function paintProfileAndAttackAnchors(){return;}
function makeBadge(intel){return ebsfBadge(intel);}

// Stronger fight tracker override.
function ebsfRememberTarget(id,name){
  id=Number(id);
  if(!id || (ebsfUser() && String(id)===String(ebsfUser().user_id))) return;
  const row={id,name:name||'Enemy',ts:Date.now(),url:location.href};
  GM_setValue(S.lastAttack || 'ebsf_last_attack_id', JSON.stringify(row));
  GM_setValue(S.lastTarget || 'ebsf_last_target_id', JSON.stringify(row));
}
function ebsfReadTarget(){
  for(const key of [S.lastAttack||'ebsf_last_attack_id',S.lastTarget||'ebsf_last_target_id']){
    const x=safeJson(GM_getValue(key,null));
    if(x&&x.id&&Date.now()-(x.ts||0)<1000*60*45) return x;
  }
  return null;
}
document.addEventListener('click',e=>{
  const el=e.target?.closest?.('a,button,[onclick],[data-user],[data-id],[data-xid]');
  if(!el) return;
  const blob=[el.href,el.getAttribute('href'),el.getAttribute('onclick'),el.getAttribute('data-user'),el.getAttribute('data-id'),el.getAttribute('data-xid'),el.outerHTML].filter(Boolean).join(' ');
  let id=extractTargetIdFromText(blob);
  if(!id && ebsfProfileLike()) id=ebsfProfileId();
  if(id && /attack|user2ID|sid=attack|target/i.test(blob + ' ' + location.href)) ebsfRememberTarget(id, (el.textContent||document.title||'Enemy').trim().slice(0,40));
},true);
async function ebsfSaveFightResult(){
  if(!location.href.includes('sid=attack')) return;
  const saved=ebsfReadTarget();
  const text=(document.body?.innerText||'').toLowerCase();
  if(!saved || !saved.id || !text) return;
  const won=/you won|you have won|mugged|hospitalized|left them|you defeated|victory/.test(text);
  const lost=/you lost|you were defeated|defeated by|you have lost|stalemate|you ran away|you were hospitalized/.test(text);
  if(!won && !lost) return;
  const key='ebsf_learn_'+saved.id+'_'+(won?'w':'l')+'_'+Math.floor((saved.ts||Date.now())/1000);
  if(GM_getValue(key,'')) return;
  GM_setValue(key,'1');
  const user=ebsfUser();
  if(!user || !user.user_id) return;
  const result=won?'generic_win':'generic_loss';
  const payload={
    attacker_id:user.user_id,
    attacker_name:user.name,
    attacker_total:ebsfTotal(),
    target_id:saved.id,
    target_name:saved.name,
    result,
    confidence_weight:1,
    detected_confidence:65,
    result_source:'auto_v131',
    fight_meta:{url:location.href, result:won?'win':'loss'}
  };
  try{
    const r=await post('/api/attack/result',payload);
    if(r.ok){
      const intel=await get('/api/player/'+encodeURIComponent(saved.id)+'/intel?your_total='+encodeURIComponent(ebsfTotal()));
      const p=intel.player||intel.enemy||null;
      if(p) ebsfSaveCached(saved.id,p);
      document.querySelectorAll('.ebsfNameBadge').forEach(x=>x.remove());
      document.querySelectorAll('[data-ebsf-row-badge-done],[data-ebsf-honor-badge-done]').forEach(el=>{delete el.dataset.ebsfRowBadgeDone;delete el.dataset.ebsfHonorBadgeDone;});
      setTimeout(paintHonorBadgesOnly,500);
    }
  }catch(e){}
}
setTimeout(paintHonorBadgesOnly,1800);
setTimeout(paintHonorBadgesOnly,3600);
setInterval(()=>{paintHonorBadgesOnly(); ebsfSaveFightResult();},4500);
try{
  new MutationObserver(()=>{clearTimeout(window.ebsfBspishTimer); window.ebsfBspishTimer=setTimeout(paintHonorBadgesOnly,700);}).observe(document.body,{childList:true,subtree:true});
}catch(e){}



  // v1.3.5 bridge: read estimates already visible/cached from BSP/FF style scripts.
  // This does not copy their look. It only uses the visible/cached number as base intel for our badge.
  function bsfParseStatTextToNumber(input){
    if(input == null) return 0;
    let s = String(input).trim().toLowerCase().replace(/,/g,'');
    const m = s.match(/([0-9]+(?:\.[0-9]+)?)\s*([kmbt])?/i);
    if(!m) return 0;
    let n = Number(m[1]);
    const unit = (m[2] || '').toLowerCase();
    if(unit === 'k') n *= 1e3;
    if(unit === 'm') n *= 1e6;
    if(unit === 'b') n *= 1e9;
    if(unit === 't') n *= 1e12;
    return Math.round(n);
  }

  function bsfLabelForTotal(total){
    const mine = Number(String(app.total || GM_getValue(S.total, '') || '').replace(/,/g,''));
    if(!mine || !total) return 'Unknown';
    const r = total / mine;
    if(r <= 0.75) return 'Easy';
    if(r <= 1.10) return 'Fair';
    if(r <= 1.35) return 'Good';
    if(r <= 1.75) return 'Difficult';
    return 'Avoid';
  }

  function bsfIntelFromTotal(total, source, detail, confidence){
    total = Number(total || 0);
    if(!total) return null;
    return {
      total,
      best_total: total,
      range_low: Math.round(total * 0.88),
      range_high: Math.round(total * 1.12),
      label: bsfLabelForTotal(total),
      confidence: confidence || 62,
      source: source || 'third_party_visible',
      source_detail: detail || 'visible/cached third-party estimate'
    };
  }

  function bsfGetBspCacheIntel(targetId){
    if(!targetId) return null;
    try{
      const raw = localStorage.getItem('tdup.battleStatsPredictor.cache.prediction.' + targetId);
      if(!raw) return null;
      const p = JSON.parse(raw);
      const total = bsfParseStatTextToNumber(p.TBS || p.TargetTBS || p.total || p.Total || p.bs_estimate || p.estimate);
      if(!total) return null;
      return bsfIntelFromTotal(total, 'bsp_cache', 'BSP local cached prediction', 64);
    }catch(e){
      return null;
    }
  }

  function bsfGetVisibleEstimateIntel(){
    const txt = (document.body?.innerText || '').replace(/\s+/g,' ');
    // Handles: "Est. Stats: 246m", "Est. Stats: 3.6m", and similar visible FF/BSP text.
    const patterns = [
      /Est\.?\s*Stats:\s*([0-9.,]+\s*[kmbt]?)/i,
      /Estimated\s*Stats:\s*([0-9.,]+\s*[kmbt]?)/i,
      /Stats:\s*([0-9.,]+\s*[kmbt]?)/i
    ];
    for(const p of patterns){
      const m = txt.match(p);
      if(m){
        const total = bsfParseStatTextToNumber(m[1]);
        if(total) return bsfIntelFromTotal(total, 'visible_ff_bsp', 'visible FF/BSP estimate on page', 62);
      }
    }
    return null;
  }

  function bsfFindIdFromContext(row, mount){
    const blob = [
      location.href,
      row?.innerHTML,
      mount?.innerHTML,
      row?.textContent,
      mount?.textContent
    ].filter(Boolean).join(' ');
    return extractTargetIdFromText(blob) || getProfilePageId?.() || detectProfileIdFromPage?.() || findProfileIdFromPageLinks?.();
  }

  // Override row intel lookup so our badge can use BSP local cache too.
  function findIntelForMemberRow(row, cell, mount, map){
    const id = bsfFindIdFromContext(row, mount);
    if(id){
      const own = getCachedIntel(id);
      if(own) return own;
      const bsp = bsfGetBspCacheIntel(id);
      if(bsp){
        saveCachedIntel(id, bsp);
        return bsp;
      }
    }

    const text = normName((mount?.textContent || cell?.textContent || row?.textContent || '').trim());
    if(text && map){
      for(const k of Object.keys(map || {})){
        if(!k.startsWith('name:')) continue;
        const name = k.slice(5);
        if(name && text.includes(name)){
          const v = map[k];
          if(v && v.intel) return v.intel;
        }
      }
    }
    return null;
  }

  // Override profile badge pass: use our cache, BSP cache, then visible FF/BSP text.
  function paintProfileHonorImageBadge(){
    if(!isProfileLikeForBadge?.()) return;
    if(document.querySelector('.ebsfProfileHonorDone')) {
      bsfBridgeVisibleEstimateToExistingBadge();
      return;
    }

    const mount = findProfileHonorImageMount?.();
    if(!mount || mount.querySelector?.(':scope > .ebsfNameBadge')) return;

    const pid = bsfFindIdFromContext(document.body, mount);
    let intel = pid ? (getCachedIntel(pid) || bsfGetBspCacheIntel(pid)) : null;
    if(!intel) intel = bsfGetVisibleEstimateIntel();

    const badge = makeHonorBadge(intel);
    badge.classList.add('ebsfProfileHonorDone');
    attachBadgeToHonor(mount, badge);

    if(pid && intel) saveCachedIntel(pid, intel);

    if(pid){
      setTimeout(async ()=>{
        try{
          const yourTotal = app.total || GM_getValue(S.total, '');
          const r = await get('/api/player/'+encodeURIComponent(pid)+'/intel?your_total='+encodeURIComponent(yourTotal));
          const p = r.player || r.enemy || null;
          if(p){
            saveCachedIntel(pid, p);
            updateHonorBadge(badge, p);
          }else{
            const bsp = bsfGetBspCacheIntel(pid) || bsfGetVisibleEstimateIntel();
            if(bsp){
              saveCachedIntel(pid, bsp);
              updateHonorBadge(badge, bsp);
            }
          }
        }catch(e){
          const bsp = bsfGetBspCacheIntel(pid) || bsfGetVisibleEstimateIntel();
          if(bsp){
            saveCachedIntel(pid, bsp);
            updateHonorBadge(badge, bsp);
          }
        }
      }, 700);
    }
  }

  function bsfBridgeVisibleEstimateToExistingBadge(){
    const badge = document.querySelector('.ebsfProfileHonorDone');
    if(!badge) return;
    const pid = bsfFindIdFromContext(document.body, badge);
    const intel = (pid ? (getCachedIntel(pid) || bsfGetBspCacheIntel(pid)) : null) || bsfGetVisibleEstimateIntel();
    if(intel){
      if(pid) saveCachedIntel(pid, intel);
      updateHonorBadge(badge, intel);
    }
  }

  setTimeout(()=>{ bsfBridgeVisibleEstimateToExistingBadge(); paintHonorBadgesOnly?.(); }, 1200);
  setTimeout(()=>{ bsfBridgeVisibleEstimateToExistingBadge(); paintHonorBadgesOnly?.(); }, 3000);



  /* v1.3.7 safer attack watcher + persistent FF/BSP bridge */
  function bsfIsRealAttackClickV137(el){
    if(!el) return false;
    const href = el.href || el.getAttribute?.('href') || '';
    const onclick = el.getAttribute?.('onclick') || '';
    const title = el.getAttribute?.('title') || el.getAttribute?.('aria-label') || '';
    const txt = (el.textContent || '').trim();
    if(/sid=attack|user2ID=|attack/i.test(href)) return true;
    if(/sid=attack|user2ID|attack/i.test(onclick)) return true;
    if(/^attack$/i.test(txt)) return true;
    if((el.tagName === 'A' || el.tagName === 'BUTTON') && /attack|fight/i.test([href,onclick,title,txt,String(el.className||'')].join(' '))) return true;
    return false;
  }

  function bsfInstallSafeAttackRememberingV137(){
    if(window.__ebsfSafeAttackRememberingV137) return;
    window.__ebsfSafeAttackRememberingV137 = true;

    document.addEventListener('click', (e)=>{
      const el = e.target?.closest?.('a,button,[onclick]');
      if(!el || !bsfIsRealAttackClickV137(el)) return;

      const row = el.closest?.('tr, li, [class*="row"], [class*="member"]');
      const blob = [
        el.href,
        el.getAttribute?.('href'),
        el.getAttribute?.('onclick'),
        el.getAttribute?.('data-user'),
        el.getAttribute?.('data-id'),
        el.getAttribute?.('data-xid'),
        row?.innerHTML,
        location.href
      ].filter(Boolean).join(' ');

      const id = extractTargetIdFromText(blob) || getProfilePageId?.() || detectProfileIdFromPage?.() || findProfileIdFromPageLinks?.();
      if(!id) return;

      rememberAttackTarget(id, findNearbyName(el) || getPageProfileName?.() || 'Enemy');
      GM_setValue('ebsf_attack_click_ts', Date.now());
      bsfDebugSet?.('target_remembered_id', id);
      bsfDebugSet?.('target_remembered_reason', 'real_attack_click');
      bsfStartDeepFightWatch?.();
      startUniversalFightWatcher?.();
      toast?.('⚔️ Target remembered for learning.');
    }, true);
  }

  function bsfRefreshVisibleEstimateBridgeV137(){
    const profileIntel = bsfGetVisibleEstimateIntel?.();
    if(profileIntel){
      const pid = bsfFindIdFromContext?.(document.body, document.body) || getProfilePageId?.() || detectProfileIdFromPage?.();
      if(pid) saveCachedIntel(pid, profileIntel);

      document.querySelectorAll('.ebsfNameBadge').forEach(b=>{
        if(b.textContent.trim() === 'N/A' || b.classList.contains('unknown')){
          updateHonorBadge?.(b, profileIntel);
        }
      });
    }

    document.querySelectorAll('.ebsfNameBadge').forEach(b=>{
      const host = b.closest?.('tr, li, [class*="row"], [class*="member"], [class*="honor"], [class*="name"]') || b.parentElement;
      const id = extractTargetIdFromText((host?.innerHTML || '') + ' ' + location.href);
      if(!id) return;
      const intel = getCachedIntel(id) || bsfGetBspCacheIntel?.(id);
      if(intel){
        saveCachedIntel(id, intel);
        updateHonorBadge?.(b, intel);
      }
    });
  }

  function bsfStartPersistentEstimateBridgeV137(){
    if(window.__ebsfEstimateBridgeV137Started) return;
    window.__ebsfEstimateBridgeV137Started = true;

    [800,1800,3500,6000,10000,15000,22000,30000].forEach(t=>{
      setTimeout(()=>{ bsfRefreshVisibleEstimateBridgeV137(); paintHonorBadgesOnly?.(); }, t);
    });

    try{
      const obs = new MutationObserver(()=>{
        clearTimeout(window.__ebsfBridgeDebounceV137);
        window.__ebsfBridgeDebounceV137 = setTimeout(()=>bsfRefreshVisibleEstimateBridgeV137(), 700);
      });
      obs.observe(document.body, {childList:true, subtree:true, characterData:true});
      setTimeout(()=>obs.disconnect(), 180000);
    }catch(e){}
  }

  // Override broad old watcher: only install strict watcher.
  if(typeof setupStrongAttackRemembering === 'function'){
    setupStrongAttackRemembering = function(){ bsfInstallSafeAttackRememberingV137(); };
  }

  bsfInstallSafeAttackRememberingV137();
  bsfStartPersistentEstimateBridgeV137();

})();
