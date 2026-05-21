// ==UserScript==
// @name         Enhanced Battle Stat Finder ⚔️
// @namespace    Fries91.EnhancedBattleStatFinder
// @version      1.0.9
// @description  War enemy stat finder organized into respect hits, best targets, and chain save hits with automatic learning.
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
    lastPrompted: 'ebsf_last_auto_learned_attack'
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
    .inp,.sel,.txt{box-sizing:border-box;width:100%;background:#020617;color:#f8fafc;border:1px solid #475569;border-radius:10px;padding:9px 10px}.txt{min-height:72px}.btn{background:#facc15;color:#111827;border:1px solid #facc15;border-radius:10px;padding:9px 10px;font-weight:900}.btn2{background:#1f2937;color:#f8fafc;border-color:#475569}.note{color:#94a3b8;font-size:12px;line-height:1.4}.msg{display:none;margin-top:8px;background:#1e3a8a55;border:1px solid #60a5fa66;color:#bfdbfe;border-radius:10px;padding:8px;font-size:12px}.msg.show{display:block}
    .groupTitle{display:flex;justify-content:space-between;align-items:center;background:#020617;border:1px solid #334155;border-radius:13px;padding:10px;margin:0 0 8px}.groupTitle b{color:#facc15}.groupTitle span{color:#94a3b8;font-size:11px}.target{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;background:#0f172a;border:1px solid #334155;border-radius:13px;padding:10px;margin-bottom:8px}.name{font-weight:900}.meta{color:#94a3b8;font-size:11px;margin-top:4px;display:flex;gap:6px;flex-wrap:wrap}.acts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.mini{font-size:11px;padding:6px 8px}.pill{display:inline-flex;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:900;border:1px solid #475569}.easy{color:#86efac;background:#22c55e22}.fair{color:#93c5fd;background:#3b82f622}.good{color:#fde68a;background:#facc1522}.difficult{color:#fdba74;background:#f9731622}.avoid{color:#fca5a5;background:#ef444422}.unknown{color:#cbd5e1;background:#64748b22}.empty{border:1px dashed #475569;border-radius:14px;color:#94a3b8;padding:24px;text-align:center;background:#0f172a}
    .topScanBar{background:#020617;border:1px solid #facc1566;border-radius:14px;padding:10px;margin-bottom:12px}.topScanBar .btn{width:100%;font-size:15px;padding:12px}.topScanBar .row{margin-top:8px;margin-bottom:0}#ebsfAutoToast{position:fixed;left:12px;right:12px;bottom:12px;z-index:999999;background:#0b1120;border:1px solid #facc15;border-radius:14px;padding:10px;color:#f8fafc;font-family:Arial,sans-serif;box-shadow:0 20px 50px #000;font-size:13px}#ebsfAutoToast b{color:#facc15}.infoBox{background:#020617;border:1px solid #334155;border-radius:14px;padding:12px;margin-bottom:10px}.infoBox h3{margin:0 0 8px;color:#facc15;font-size:14px}.infoBox p{margin:0 0 8px}.infoBox ul{margin:8px 0 0 18px;padding:0;color:#cbd5e1;font-size:12px;line-height:1.45}.loginBottom{margin-top:14px;border-top:1px solid #334155;padding-top:12px}.statsBox{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}.statMini{background:#020617;border:1px solid #334155;border-radius:10px;padding:8px;color:#cbd5e1;font-size:12px}.statMini b{color:#facc15}
    #ebsfFightPrompt{position:fixed;left:10px;right:10px;bottom:12px;z-index:999999;background:#0b1120;border:1px solid #facc15;border-radius:14px;padding:12px;color:#f8fafc;font-family:Arial,sans-serif;box-shadow:0 20px 50px #000}
    #ebsfFightPrompt b{color:#facc15}.ebsfPromptBtns{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.ebsfPromptBtns button{background:#1f2937;color:#f8fafc;border:1px solid #475569;border-radius:10px;padding:8px;font-weight:800}.ebsfPromptBtns button:first-child{background:#facc15;color:#111827;border-color:#facc15}
    @media(max-width:760px){#ebsfPanel{width:calc(100vw - 6px);height:calc(100vh - 6px);border-radius:10px}.grid,.row,.statsBox{grid-template-columns:1fr}.target{grid-template-columns:1fr}.acts{justify-content:flex-start}}
  `);

  boot();
  watchAttackPage();

  function boot(){
    const b=document.createElement('button');
    b.id='ebsfBtn'; b.textContent='⚔️'; b.onclick=open;
    document.body.appendChild(b);

    const r=document.createElement('div');
    r.id='ebsfRoot';
    r.innerHTML=`
      <div id="ebsfPanel">
        <div class="ebsfHead">
          <div><b>⚔️ Enhanced Battle Stat Finder</b><small>confidence • reasons • auto learning</small></div>
          <button class="ebsfClose">Close</button>
        </div>
        <div class="ebsfTabs">
          <button class="ebsfTab on" data-tab="targets">Targets</button>
          <button class="ebsfTab" data-tab="spy">Spy / Estimate</button>
          <button class="ebsfTab" data-tab="settings">Settings / Login</button>
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

  function open(){document.getElementById('ebsfRoot').classList.add('open'); render();}
  function close(){document.getElementById('ebsfRoot').classList.remove('open');}
  function setTabs(){document.querySelectorAll('.ebsfTab').forEach(t=>t.classList.toggle('on',t.dataset.tab===app.tab));}
  function render(){ if(app.tab==='targets') targets(); if(app.tab==='spy') spy(); if(app.tab==='settings') settings(); }

  function userSummary(){
    if(!app.user) return `<div class="note">Go to <b>Settings / Login</b>, enter your Torn limited API key, then click Login / Save All.</div>`;
    const bs=app.user.battle_stats||{};
    return `<div class="note">Logged in as <b>${esc(app.user.name)}</b> [${app.user.user_id}]<br>Faction: ${esc(app.user.faction_name||'')} [${esc(app.user.faction_id||'')}]<br>Detected effective battle stats: <b>${fmt(app.total||bs.effective_total||bs.total)}</b></div>`;
  }

  function targets(){
    q('#ebsfBody').innerHTML=`
      <div class="topScanBar">
        <button id="scanTop" class="btn">🔎 Scan Enemy Targets Using My Stats</button>
        <div class="row">
          <input id="enemyFaction" class="inp" placeholder="Enemy faction ID optional" value="${esc(app.enemyFaction)}">
          <button id="clearEnemyFaction" class="btn btn2">Auto Detect</button>
        </div>
        <div class="msg ${app.msg?'show':''}">${esc(app.msg)}</div>
      </div>
      <div class="grid"><div class="card"><h3>Your Setup</h3>
      ${userSummary()}
      <p class="note">Fight learning is fully automatic now. After an attack, the script reads visible fight details and saves Easy/Close/Hard results without asking.</p>
      </div><div class="card"><h3>Organized Targets</h3>${listTargets()}</div></div>`;
    q('#scanTop').onclick=scan;
    q('#clearEnemyFaction').onclick=()=>{ q('#enemyFaction').value=''; app.enemyFaction=''; GM_setValue(S.enemyFaction,''); msg('Enemy faction cleared. Next scan will try auto-detect.'); };
    q('#ebsfBody').querySelectorAll('[data-act]').forEach(x=>x.onclick=actTarget);
  }

  function listTargets(){
    if(!app.members.length) return '<div class="empty">No targets scanned yet. Login in Settings, then scan here.</div>';

    const rows = app.members.map(m => {
      const i = m.intel || {};
      const best = num(i.best_total || i.total);
      const your = num(app.total);
      const ratio = best && your ? best / your : null;
      const level = Number(m.level || 0);
      const conf = Number(i.confidence || 0);
      return {m, i, best, your, ratio, level, conf};
    });

    const known = rows.filter(x => x.ratio !== null && x.conf > 0);
    const unknown = rows.filter(x => x.ratio === null || x.conf <= 0);

    // Highest Respect Hits:
    // Higher level targets with stats just above/near you. More risk, but better respect potential.
    const respect = known
      .filter(x => x.level >= 50 && x.ratio >= 0.95 && x.ratio <= 1.35)
      .sort((a,b) => (b.level - a.level) || (Math.abs(a.ratio - 1.10) - Math.abs(b.ratio - 1.10)) || (b.conf - a.conf))
      .slice(0, 12);

    // Best Target Hits:
    // Around the same stats, most reliable war hits.
    const bestTargets = known
      .filter(x => x.ratio >= 0.80 && x.ratio <= 1.15 && !respect.some(r => r.m.user_id === x.m.user_id))
      .sort((a,b) => Math.abs(a.ratio - 0.95) - Math.abs(b.ratio - 0.95) || b.conf - a.conf)
      .slice(0, 18);

    // Chain Save Hits:
    // Really easy targets. Great for chain saving and safe hits.
    const chain = known
      .filter(x => x.ratio <= 0.75 && !respect.some(r => r.m.user_id === x.m.user_id) && !bestTargets.some(r => r.m.user_id === x.m.user_id))
      .sort((a,b) => a.ratio - b.ratio || b.conf - a.conf)
      .slice(0, 18);

    const used = new Set([...respect, ...bestTargets, ...chain].map(x => x.m.user_id));
    const other = [...known.filter(x => !used.has(x.m.user_id)), ...unknown]
      .sort((a,b) => (b.conf - a.conf) || (a.level - b.level))
      .slice(0, 20);

    return [
      section('🔥 Highest Respect Hits', 'High level + just a bit above/near your stats', respect),
      section('🎯 Best Target Hits', 'Closest reliable fights around your stats', bestTargets),
      section('⛓️ Chain Save Hits', 'Very easy targets for safe chain saving', chain),
      section('❔ Other / Unknown', 'Needs spy, estimate, or fight data to rank better', other)
    ].join('');
  }

  function section(title, sub, items){
    return `<div class="groupTitle"><div><b>${title}</b><br><span>${sub}</span></div><span>${items.length}</span></div>` +
      (items.length ? items.map(x => targetCard(x.m, x.i, x.ratio)).join('') : '<div class="empty">No targets in this group yet.</div>');
  }

  function targetCard(m, i, ratio){
    const label=i.label||'Unknown';
    const cls=label.toLowerCase();
    const ratioTxt = ratio ? `${Math.round(ratio*100)}% of you` : 'unknown';
    return `<div class="target"><div><div class="name">${esc(m.name)} [${m.user_id}]</div><div class="meta"><span>Lvl ${m.level||'?'}</span><span>${esc(m.status||'')}</span><span>${ratioTxt}</span><span>Total ${fmt(i.best_total||i.total)}</span><span>Range ${fmt(i.range_low)}-${fmt(i.range_high)}</span><span>Conf ${Math.round(i.confidence||0)}%</span><span>${esc(i.source||'none')}</span>${i.source_detail?`<span>Reason: ${esc(i.source_detail)}</span>`:''}</div></div><div class="acts"><span class="pill ${cls}">${label}</span><button class="btn btn2 mini" data-act="profile" data-id="${m.user_id}">Profile</button><button class="btn btn2 mini" data-act="attack" data-id="${m.user_id}" data-name="${esc(m.name)}">Attack</button><button class="btn btn2 mini" data-act="spy" data-id="${m.user_id}">Spy</button><button class="btn btn2 mini" data-act="result" data-id="${m.user_id}" data-name="${esc(m.name)}">Learn</button></div></div>`;
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
        <h3>⚔️ How This Works</h3>
        <p class="note"><b>Battle Stat Finder</b> helps your faction find smarter war targets. It compares your detected battle stats against saved spy data, safe estimates, and automatic fight learning from faction members.</p>
        <p class="note">The first scans may look basic. The app gets sharper as your faction adds spies, imports trusted estimates, and fights more enemies. Give it time to learn.</p>
        <ul>
          <li>Scans the enemy faction roster during war.</li>
          <li>Ranks enemies as Easy, Fair, Good, Difficult, Avoid, or Unknown.</li>
          <li>Improves predictions after real fights without giving away the full method.</li>
          <li>Shows a simple reason when enough data exists.</li>
        </ul>
      </div>

      <div class="infoBox">
        <h3>📜 Terms of Use</h3>
        <p class="note">Use this tool responsibly and only with information you are allowed to share with your faction. Do not submit fake spy reports or enemy estimates. Predictions are estimates, not guarantees, and fights can still be affected by weapons, builds, life, perks, temporary items, and RNG.</p>
        <p class="note">This app is for faction war planning and target sorting. It does not ask for your Torn password and should never be used to collect another player’s private information without permission.</p>
      </div>

      <div class="infoBox">
        <h3>🔑 API Key Use & Storage</h3>
        <p class="note">Use a <b>Torn limited API key</b>. Your key is used to log you into this app, confirm your Torn identity/faction, detect your battle stat total where your key allows it, and scan war/faction data needed for target sorting.</p>
        <p class="note">Your Torn API key is saved locally in your userscript storage so you do not have to type it every time. The backend stores a one-way hash of your Torn key for login tracking, not the raw Torn key.</p>
        <p class="note">Optional TornStats/YATA keys are only for optional spy imports and are saved only if you enter them. Shared app data may include your user ID, faction ID, detected stat total, submitted spy/estimate data, and automatic fight-learning labels.</p>
        <p class="note"><b>Data sharing:</b> enemy intel and learning data are intended for your faction’s use only. Do not enter data you are not allowed to share.</p>
      </div>

      <div class="loginBottom">
        <h3>Login / Keys</h3>
        <input id="key" class="inp" type="password" placeholder="Torn limited API key" value="${esc(app.key)}" style="margin-bottom:8px">
        <input id="tskey" class="inp" type="password" placeholder="TornStats key optional" value="${esc(app.tornstats)}" style="margin-bottom:8px">
        <input id="yatakey" class="inp" type="password" placeholder="YATA key optional / saved only" value="${esc(app.yata)}" style="margin-bottom:8px">
        <button id="login" class="btn">Login / Save All</button>
        ${app.user?`<div class="statsBox"><div class="statMini">Total<br><b>${fmt(app.total||bs.total)}</b></div><div class="statMini">Str<br><b>${fmt(bs.strength)}</b></div><div class="statMini">Def<br><b>${fmt(bs.defense)}</b></div><div class="statMini">Spd<br><b>${fmt(bs.speed)}</b></div><div class="statMini">Dex<br><b>${fmt(bs.dexterity)}</b></div></div>`:''}
        <div class="msg ${app.msg?'show':''}">${esc(app.msg)}</div>
      </div>
    </div>`;
    q('#login').onclick=login;
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
    if(a==='spy'){app.tab='spy';setTabs();render();}
    if(a==='result') toast('⚔️ Results are automatic now. Use Attack so the script can learn from the fight page.');
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

    const urlId = new URL(location.href).searchParams.get('user2ID');
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
    const saved = safeJson(GM_getValue(S.lastAttack, null));
    if(!saved || !saved.id) return;
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
      toast(`⚔️ Auto learned ${targetName} [${targetId}] as ${prettyResult(result)} (${Math.round((detail&&detail.quality)||55)}% read). Re-scan for updated predictions.`);
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
