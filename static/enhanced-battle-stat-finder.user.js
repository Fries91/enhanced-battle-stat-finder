// ==UserScript==
// @name         Enhanced Battle Stat Finder ⚔️
// @namespace    Fries91.EnhancedBattleStatFinder
// @version      1.1.6
// @description  War target finder with colored prediction badges, gray N/A for no intel, clean settings, admin intel, and automatic learning.
// @author       Fries91
// @match        https://www.torn.com/factions.php*
// @match        https://www.torn.com/loader.php?sid=attack*
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
    lastPrompted: 'ebsf_last_auto_learned_attack',
    lastScan: 'ebsf_last_scan_payload'
  };

  let app = {
    key: GM_getValue(S.key, ''),
    user: safeJson(GM_getValue(S.user, null)),
    total: GM_getValue(S.total, ''),
    enemyFaction: GM_getValue(S.enemyFaction, ''),
    tornstats: GM_getValue(S.tornstats, ''),
    yata: GM_getValue(S.yata, ''),
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

.ebsfNameBadge{display:inline-flex!important;align-items:center;justify-content:center;margin-left:4px;padding:2px 6px;border-radius:999px;border:1px solid #475569;font-size:10px;font-weight:900;line-height:1;background:#111827;color:#cbd5e1;vertical-align:middle;box-shadow:0 1px 4px #0008;position:relative;z-index:20;min-width:28px}
.ebsfNameBadge.easy{background:#052e16;color:#86efac;border-color:#22c55e}
.ebsfNameBadge.fair{background:#172554;color:#93c5fd;border-color:#3b82f6}
.ebsfNameBadge.good{background:#422006;color:#fde68a;border-color:#f59e0b}
.ebsfNameBadge.difficult{background:#431407;color:#fdba74;border-color:#f97316}
.ebsfNameBadge.avoid{background:#450a0a;color:#fca5a5;border-color:#ef4444}
.ebsfNameBadge.unknown{background:#111827;color:#cbd5e1;border-color:#64748b}

    @media(max-width:760px){#ebsfPanel{width:calc(100vw - 6px);height:calc(100vh - 6px);border-radius:10px}.grid,.row,.statsBox{grid-template-columns:1fr}.target{grid-template-columns:1fr}.acts{justify-content:flex-start}}
  `);

  boot();
  watchAttackPage();
  injectNameBadges();
  setInterval(injectNameBadges, 7000);
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

  function open(){loadCachedScan(); document.getElementById('ebsfRoot').classList.add('open'); render();}
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

  function targets(){
    q('#ebsfBody').innerHTML=`
      <div class="topScanBar">
        <button id="scanTop" class="btn">🔎 Scan Enemy Targets Using My Stats</button>
        <input id="enemyFaction" class="inp" placeholder="Enemy faction ID optional - leave blank to auto-detect active war" value="${esc(app.enemyFaction)}" style="margin-top:8px">
        <div class="msg ${app.msg?'show':''}">${esc(app.msg)}</div>
        <div class="note" style="margin-top:8px">${app.user ? `Logged in as <b>${esc(app.user.name)}</b> • Stats: <b>${fmt(app.total)}</b>` : 'Login first in Settings / Login.'}</div>
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
        <h3>⚔️ What This App Does</h3>
        <p class="note"><b>Enhanced Battle Stat Finder</b> helps your faction sort war targets faster. It uses your detected battle stat total, learned fight results, saved intel, and confidence scoring to show smarter target groups.</p>
        <p class="note"><b>Important:</b> it needs time to learn. Early scans may show Unknown or low-confidence targets. The more your faction fights, the sharper the estimates get.</p>
        <ul>
          <li>Ranks enemies into respect hits, best target hits, and chain-save hits.</li>
          <li>Shows simple colored prediction badges beside player names when intel exists.</li>
          <li>Automatically learns from attack pages without asking users to save results.</li>
          <li>Shows warnings when data is weak, old, or based on too few fights.</li>
        </ul>
      </div>

      <div class="infoBox">
        <h3>📜 Rules & Fair Use</h3>
        <p class="note">Use this tool for faction war planning and target sorting only. Predictions are estimates, not guarantees. Torn fights can change because of gear, temps, life, perks, build type, RNG, or recent player growth.</p>
        <p class="note">Do not add fake intel, do not share information you are not allowed to share, and do not use this to harass players. This app does not ask for your Torn password.</p>
        <p class="note">Colored badges and target groups are only helper signals. Players should still use judgment before attacking.</p>
      </div>

      <div class="infoBox">
        <h3>🔑 API Key Use & Storage</h3>
        <p class="note"><b>Required:</b> Torn limited API key. It is used to confirm your Torn identity, faction, and battle stat total where your key allows it. It also lets the app scan active war/faction data needed for target sorting.</p>
        <p class="note"><b>Storage:</b> your Torn key is saved locally in your userscript manager/PDA storage so you do not need to type it every time. The backend stores a one-way hash for login tracking, not the raw Torn key.</p>
        <p class="note"><b>Shared learning data:</b> user ID, faction ID, detected stat total, target ID, simple fight result labels, and basic fight-read confidence may be stored so your faction’s predictions improve over time.</p>
        <p class="note"><b>Optional keys:</b> TornStats/YATA fields are optional and only saved if entered. Normal users only need the Torn limited key.</p>
      </div>

      <div class="loginBottom">
        <h3>Login / Keys</h3>

        <label class="keyLabel" for="key">Torn Limited API Key — Required</label>
        <input id="key" class="inp" type="password" placeholder="Required: Torn limited API key" value="${esc(app.key)}">

        <label class="keyLabel" for="tskey">TornStats Key — Optional</label>
        <input id="tskey" class="inp" type="password" placeholder="Optional: only needed for TornStats imports" value="${esc(app.tornstats)}">

        <label class="keyLabel" for="yatakey">YATA Key — Optional / Saved Only</label>
        <input id="yatakey" class="inp" type="password" placeholder="Optional: saved for later YATA support" value="${esc(app.yata)}">

        <button id="login" class="btn" style="margin-top:10px">Login / Save All</button>

        ${app.user?`<div class="statsBox"><div class="statMini">Total<br><b>${fmt(app.total||bs.total)}</b></div><div class="statMini">Str<br><b>${fmt(bs.strength)}</b></div><div class="statMini">Def<br><b>${fmt(bs.defense)}</b></div><div class="statMini">Spd<br><b>${fmt(bs.speed)}</b></div><div class="statMini">Dex<br><b>${fmt(bs.dexterity)}</b></div></div>`:''}
        <div class="msg ${app.msg?'show':''}">${esc(app.msg)}</div>
      </div>
    </div>`;
    q('#login').onclick=login;
  }
  function watchGlobalAttackClicks(){
    document.addEventListener('click', (e)=>{
      const a = e.target?.closest?.('a,button');
      if(!a) return;
      const href = a.href || a.getAttribute('href') || '';
      const id = extractTargetIdFromText(href) || extractTargetIdFromText(a.outerHTML || '');
      if(id && String(id) !== String(app.user?.user_id || '')){
        const name = findNearbyName(a) || 'Enemy';
        GM_setValue(S.lastAttack, JSON.stringify({id:Number(id), name, ts:Date.now()}));
      }
    }, true);
  }

  function extractTargetIdFromText(txt){
    if(!txt) return null;
    const m = String(txt).match(/(?:user2ID|userID|targetID|XID)[=\\":%26]+(\\d{3,10})/i);
    return m ? Number(m[1]) : null;
  }

  function findNearbyName(el){
    const txt = (el.textContent || el.closest?.('li,div,tr')?.textContent || '').trim();
    if(!txt) return '';
    return txt.split('\\n').map(x=>x.trim()).filter(Boolean)[0]?.slice(0,40) || '';
  }





  async function injectNameBadges(){
    // Handles normal profile links AND Torn faction war tables where the honor bar/name
    // is often not a normal profile link.
    const targets = collectBadgeTargets().slice(0, 140);
    if(!targets.length) return;

    const yourTotal = app.total || GM_getValue(S.total, '');
    for(const t of targets){
      if(!t.id || !t.mount || t.mount.dataset.ebsfBadgeDone === '1') continue;
      if(app.user && String(t.id) === String(app.user.user_id)) continue;

      t.mount.dataset.ebsfBadgeDone = '1';

      const badge = document.createElement('span');
      badge.className = 'ebsfNameBadge unknown';
      badge.textContent = '...';
      badge.title = 'Battle Stat Finder loading prediction';

      // For honor bars, append after the honor/name block; for links, insert after link.
      try {
        if(t.mode === 'after') t.mount.insertAdjacentElement('afterend', badge);
        else t.mount.appendChild(badge);
      } catch(e) {
        continue;
      }

      try{
        const r = await get('/api/player/'+encodeURIComponent(t.id)+'/intel?your_total='+encodeURIComponent(yourTotal));
        const p = r.player || r.enemy || null;
        if(!p){
          badge.textContent = 'N/A';
          badge.className = 'ebsfNameBadge unknown';
          badge.title = 'No Battle Stat Finder intel yet';
          continue;
        }

        const label = (p.label || 'Unknown').toLowerCase();
        badge.className = 'ebsfNameBadge ' + label;
        badge.textContent = fmtShort(p.best_total || p.total || ((p.range_low && p.range_high) ? ((p.range_low+p.range_high)/2) : 0));
        badge.title = `Battle Stat Finder: ${p.label || 'Unknown'} • ${fmt(p.best_total||p.total)} • ${Math.round(p.confidence||0)}% confidence`;
      }catch(e){
        badge.textContent = 'N/A';
        badge.className = 'ebsfNameBadge unknown';
      }
    }
  }

  function collectBadgeTargets(){
    const out = [];
    const seen = new Set();

    function add(id, mount, mode){
      id = Number(id);
      if(!id || !mount || seen.has(id + ':' + nodeKey(mount))) return;
      seen.add(id + ':' + nodeKey(mount));
      out.push({id, mount, mode: mode || 'inside'});
    }

    // 1) Normal profile links.
    [...document.querySelectorAll('a[href*="profiles.php?XID="]')].forEach(a=>{
      const id = extractTargetIdFromText(a.href);
      if(id) add(id, a, 'after');
    });

    // 2) Attack links/buttons often contain user2ID even when the honor bar is not linked.
    [...document.querySelectorAll('a[href*="user2ID="], a[href*="sid=attack"], button, [onclick], [data-user], [data-id]')].forEach(el=>{
      const blob = [el.href, el.getAttribute('href'), el.getAttribute('onclick'), el.getAttribute('data-user'), el.getAttribute('data-id'), el.outerHTML].filter(Boolean).join(' ');
      const id = extractTargetIdFromText(blob);
      if(!id) return;

      const row = el.closest('tr, li, [class*="row"], [class*="member"], [class*="table"], div') || el.parentElement;
      const mount = findHonorMount(row) || row || el;
      add(id, mount, 'inside');
    });

    // 3) Torn sometimes stores profile IDs in generic data attrs.
    [...document.querySelectorAll('[data-xid], [data-userid], [data-user-id], [data-player], [data-playerid]')].forEach(el=>{
      const id = el.getAttribute('data-xid') || el.getAttribute('data-userid') || el.getAttribute('data-user-id') || el.getAttribute('data-player') || el.getAttribute('data-playerid');
      const mount = findHonorMount(el.closest('tr, li, div')) || el;
      add(id, mount, 'inside');
    });

    return out;
  }

  function findHonorMount(row){
    if(!row) return null;

    // Prefer honor bar/name-looking elements.
    const selectors = [
      '[class*="honor"]',
      '[class*="user"]',
      '[class*="name"]',
      '[class*="member"]',
      'a[href*="profiles.php"]'
    ];
    for(const s of selectors){
      const found = row.querySelector?.(s);
      if(found && !found.classList?.contains('ebsfNameBadge')) return found;
    }

    // Faction war table: first large content cell usually holds icons + honor bar.
    const cells = row.querySelectorAll?.('td, [class*="cell"], [class*="column"]') || [];
    if(cells.length) return cells[0];

    return row;
  }

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
      GM_setValue(S.lastAttack, JSON.stringify({id, name:m.name || name, ts:Date.now()}));
      location.href=`https://www.torn.com/loader.php?sid=attack&user2ID=${id}`;
    }
    if(a==='intel') toast('⚔️ Intel is learned automatically from attacks. Admin tools can review learned data.');
    if(a==='result') toast('⚔️ Learning is automatic. Attack this target and the script will save the result from the fight page.');
  }

  async function login(){
    app.key=q('#key').value.trim();
    app.tornstats=(q('#tskey')?.value||'').trim();
    app.yata=(q('#yatakey')?.value||'').trim();

    GM_setValue(S.key,app.key);
    GM_setValue(S.tornstats,app.tornstats);
    GM_setValue(S.yata,app.yata);

    const r=await post('/api/login',{api_key:app.key});
    if(r.ok){
      app.user=r.user;
      const bs=app.user.battle_stats||{};
      app.total=String(bs.effective_total||bs.total||app.total||'');
      GM_setValue(S.user,JSON.stringify(app.user));
      GM_setValue(S.total,app.total);
      await post('/api/settings/integrations',{user_id:app.user.user_id,tornstats_key:app.tornstats,yata_key:app.yata,share_attack_learning:true,share_spies:true});
      msg(app.total ? `Logged in. Auto detected total battle stats: ${fmt(app.total)}.` : 'Logged in, but battle stats were not returned by API. You may need a key with battle stats access.');
    } else msg('Login failed: '+JSON.stringify(r.error||r));
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
      msg('Scan complete: '+app.members.length+' enemies.');
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


  function watchAttackPage(){
    if(!location.href.includes('loader.php') || !location.href.includes('sid=attack')) return;

    const urlId = new URL(location.href).searchParams.get('user2ID') || new URL(location.href).searchParams.get('userID') || new URL(location.href).searchParams.get('targetID');
    if(urlId){
      const saved = safeJson(GM_getValue(S.lastAttack, null));
      if(!saved || String(saved.id)!==String(urlId)){
        GM_setValue(S.lastAttack, JSON.stringify({id:Number(urlId), name:'Enemy', ts:Date.now()}));
      }
    }

    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      detectFightEndAndAutoSave();
      if(tries>120) clearInterval(timer);
    }, 1250);

    const obs = new MutationObserver(()=>detectFightEndAndAutoSave());
    obs.observe(document.body, {childList:true, subtree:true, characterData:true});
    setTimeout(()=>obs.disconnect(), 180000);
  }

  function detectFightEndAndAutoSave(){
    let saved = safeJson(GM_getValue(S.lastAttack, null));
    if(!saved || !saved.id){
      const found = detectTargetFromPage();
      if(found){
        saved = {id:found.id, name:found.name||'Enemy', ts:Date.now()};
        GM_setValue(S.lastAttack, JSON.stringify(saved));
      } else {
        return;
      }
    }
    if(Date.now() - saved.ts > 1000 * 60 * 20) return;

    const text = (document.body?.innerText || '').toLowerCase();

    const winWords = [
      'you won',
      'you have won',
      'mugged',
      'hospitalized',
      'left them',
      'you beat',
      'you defeated'
    ];
    const lossWords = [
      'you lost',
      'you were defeated',
      'defeated by',
      'you have lost',
      'stalemate'
    ];

    const won = winWords.some(w=>text.includes(w));
    const lost = lossWords.some(w=>text.includes(w));
    if(!won && !lost) return;

    const key = `${saved.id}:${Math.floor(saved.ts/1000)}:${won?'win':'loss'}`;
    if(GM_getValue(S.lastPrompted, '') === key) return;
    GM_setValue(S.lastPrompted, key);

    const detail = extractFightDetails(text);
    const result = classifyFightResult(text, won, detail);
    autoSaveFightResult(saved.id, saved.name || 'Enemy', result, false, detail);
  }

  function detectTargetFromPage(){
    const href = location.href;
    let id = extractTargetIdFromText(href);
    if(id) return {id:Number(id), name:'Enemy'};

    const links = [...document.querySelectorAll('a[href*="profiles.php?XID="]')];
    for(const a of links){
      const found = extractTargetIdFromText(a.href);
      if(found && app.user && String(found) !== String(app.user.user_id)){
        return {id:Number(found), name:(a.textContent||'Enemy').trim() || 'Enemy'};
      }
    }

    const saved = safeJson(GM_getValue(S.lastAttack, null));
    if(saved && saved.id && Date.now() - saved.ts < 1000*60*20) return saved;
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

  async function autoSaveFightResult(targetId, targetName, result, manualButton, detail){
    if(!app.user || !app.user.user_id){
      app.user = safeJson(GM_getValue(S.user, null));
    }
    app.total = app.total || GM_getValue(S.total, '');

    if(!app.user?.user_id || !app.total){
      toast('⚔️ Auto learning skipped: login in Settings first so I know your stats.');
      return false;
    }

    const r=await post('/api/attack/result',{
      attacker_id:app.user.user_id,
      attacker_name:app.user.name,
      attacker_total:app.total,
      target_id:targetId,
      target_name:targetName,
      result
    });

    if(r.ok){
      toast(`⚔️ Auto learned ${targetName} [${targetId}] as ${prettyResult(result)} (${Math.round((detail&&detail.quality)||55)}% read). Predictions will refresh.`);
      setTimeout(()=>{ if(app.key && app.user && app.enemyFaction) scan(); }, 1200);
      return true;
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
})();
