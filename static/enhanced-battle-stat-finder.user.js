// ==UserScript==
// @name         Advanced Battle Stat Predictor
// @namespace    Fries91.Torn.AdvancedBattleStatPredictor
// @version      3.1.0
// @description  BSP-style attach build: attaches badges only beside real Torn player links/names with XID/user2ID. No image guessing, no floating overlays.
// @author       Fries91
// @match        https://www.torn.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      enhanced-battle-stat-finder.onrender.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const BASE = 'https://enhanced-battle-stat-finder.onrender.com';

  const K = {
    api: 'absp_key',
    user: 'absp_user',
    total: 'absp_total',
    stats: 'absp_stats',
    cache: 'absp_intel_cache',
    icon: 'absp_icon_pos',
    ff: 'absp_ff_enabled'
  };

  const state = {
    key: GM_getValue(K.api, '') || GM_getValue('ebsf2_key', ''),
    user: safeJson(GM_getValue(K.user, 'null')) || safeJson(GM_getValue('ebsf2_user', 'null')),
    total: Number(GM_getValue(K.total, 0) || GM_getValue('ebsf2_total', 0) || 0),
    stats: safeJson(GM_getValue(K.stats, '{}')) || {},
    ff: !!GM_getValue(K.ff, true),
    open: false,
    pending: false,
    lastPaint: 0
  };

  GM_addStyle(`
    .ebsf2-badge,#ebsf2-btn,#ebsf2-panel,#ebsf2-save,.ebsf2-pop,.absp-badge,.absp-hb-badge,.absp3-badge,.absp31-badge{display:none!important;visibility:hidden!important;pointer-events:none!important}

    .absp-bsp-badge{
      display:inline-flex!important;
      align-items:center!important;
      justify-content:center!important;
      vertical-align:middle!important;
      min-width:34px!important;
      max-width:64px!important;
      height:15px!important;
      margin-left:4px!important;
      padding:0 5px!important;
      border-radius:6px!important;
      border:1px solid #64748b!important;
      background:#111827!important;
      color:#cbd5e1!important;
      font:900 10px/1 Arial,sans-serif!important;
      box-shadow:0 1px 4px #000b!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      cursor:pointer!important;
      pointer-events:auto!important;
      position:relative!important;
      z-index:8!important;
    }

    .absp-bsp-easy{background:#052e16!important;color:#86efac!important;border-color:#22c55e!important}
    .absp-bsp-fair{background:#422006!important;color:#fde68a!important;border-color:#facc15!important}
    .absp-bsp-difficult{background:#431407!important;color:#fdba74!important;border-color:#f97316!important}
    .absp-bsp-avoid{background:#450a0a!important;color:#fca5a5!important;border-color:#ef4444!important}
    .absp-bsp-unknown{background:#111827!important;color:#cbd5e1!important;border-color:#64748b!important}

    #absp-bsp-main{
      display:none;position:fixed;left:16px;bottom:116px;z-index:999996;
      width:42px;height:42px;border-radius:10px;border:1px solid #806500;
      background:#111827;color:#fde68a;font-size:22px;box-shadow:0 2px 10px #000c;touch-action:none
    }

    #absp-bsp-panel{
      position:fixed;left:8px;right:8px;top:74px;bottom:66px;z-index:999997;
      background:linear-gradient(145deg,#05070d,#0b1220 55%,#111827);
      color:#e5e7eb;border:1px solid rgba(250,204,21,.55);border-radius:22px;
      box-shadow:0 18px 45px #000f;overflow:hidden;font-family:Arial,sans-serif;display:none
    }
    #absp-bsp-panel.open{display:block}
    #absp-bsp-panel h2{margin:0;padding:13px 14px;color:#fde68a;background:linear-gradient(90deg,#020617,#0f172a 70%,#111827);border-bottom:1px solid rgba(250,204,21,.35);font-size:17px;text-transform:uppercase;letter-spacing:.4px}
    #absp-bsp-panel .body{max-height:calc(100vh - 165px);overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 12px 26px}
    #absp-bsp-panel button{background:linear-gradient(180deg,#2a2110,#111827);color:#fde68a;border:1px solid rgba(250,204,21,.52);border-radius:14px;padding:8px 10px;margin:4px;font-weight:900}
    #absp-bsp-panel input{box-sizing:border-box;width:100%;background:#020617;color:#f8fafc;border:1px solid rgba(250,204,21,.28);border-radius:14px;padding:10px;margin:6px 0}
    .absp-card{position:relative;padding:12px 12px 12px 14px;border-radius:18px;background:linear-gradient(145deg,rgba(15,23,42,.96),rgba(2,6,23,.96));border:1px solid rgba(148,163,184,.25);box-shadow:inset 3px 0 0 rgba(250,204,21,.55),0 6px 14px rgba(0,0,0,.35);margin-bottom:10px}
    .absp-card b{display:block;color:#fde68a;font-size:14px;margin-bottom:7px;text-transform:uppercase}
    .absp-card p,.absp-card li{color:#dbeafe;line-height:1.42}
    .absp-card ul{margin:7px 0 0 18px;padding:0}
    .absp-hero{margin:0 0 10px;padding:14px;border:1px solid rgba(250,204,21,.35);border-radius:18px;background:linear-gradient(135deg,rgba(250,204,21,.12),rgba(59,130,246,.08) 55%,rgba(15,23,42,.9))}
    .absp-hero-title{font-size:22px;font-weight:1000;color:#facc15;text-transform:uppercase}
    .absp-chip{display:inline-flex;margin:7px 4px 0 0;padding:3px 7px;border-radius:999px;background:#020617;border:1px solid rgba(250,204,21,.32);color:#fde68a;font-weight:900;font-size:11px}

    .absp-pop{position:fixed;z-index:999999;background:#0b1120;color:#e5e7eb;border:1px solid #806500;border-radius:12px;box-shadow:0 6px 22px #000d;width:255px;font:12px Arial,sans-serif;overflow:hidden}
    .absp-pop-head{display:flex;justify-content:space-between;align-items:center;background:#020617;color:#facc15;padding:8px 10px}
    .absp-pop-head button{background:#1f2937!important;color:#facc15!important;border:1px solid #806500!important;border-radius:6px!important;padding:1px 6px!important}
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

  function safeJson(s){ try { return JSON.parse(s); } catch { return null; } }
  function esc(s){ return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function txt(el){ return (el?.textContent || '').replace(/\s+/g,' ').trim(); }
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
    m = blob.match(/(?:XID|user2ID|userID|targetID|profileId|targetId|data-userid|data-user|data-id)[=\\"':%26 ]+(\d{3,10})/i);
    if(m) return Number(m[1]);
    m = blob.match(/sid=attack[^"'<>]*?(?:user2ID=|XID=)?(\d{3,10})/i);
    if(m) return Number(m[1]);
    return null;
  }

  function cache(){ return safeJson(GM_getValue(K.cache, '{}')) || {}; }
  function getIntel(id){ return id ? cache()[String(id)] || null : null; }
  function saveIntel(id, intel){
    if(!id || !intel) return;
    const c = cache();
    c[String(id)] = {...intel, confidence:riskConfidence(intel), user_id:Number(id), saved_at:Date.now()};
    GM_setValue(K.cache, JSON.stringify(c));
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

  function isBadArea(el){
    let n = el;
    for(let i=0; i<7 && n && n !== document.body; i++, n=n.parentElement){
      const cls = String(n.className || '').toLowerCase();
      const id = String(n.id || '').toLowerCase();
      const t = txt(n);

      if(n.closest?.('#absp-bsp-panel,.absp-pop')) return true;
      if(/tooltip|tip|popover|dialog|modal|profile-mini|preview/.test(cls + ' ' + id)) return true;
      if(/Type your message here/.test(t)) return true;
      if(/Cash Me if You Can|Best of the Lot|THIEF|LOOKOUT|PICKLOCK|MUSCLE|IMITATOR|CAR THIEF|JOIN|24hrs/i.test(t)) return true;
      if(/Battle Stats|Strength|Defense|Speed|Dexterity|Job Information|Property Information|Company|Income|Fees|Rating/i.test(t)) return true;
      if(/Members\s+Score\s+Status\s+Attack|Lead Target|No active chain|Chain active|Your faction is not in a war/i.test(t) && t.length < 350) return true;
      if(/Messages|Events|Awards|Home|Items|City|Wheel|Stocks/i.test(t) && t.length < 100) return true;
    }
    return false;
  }

  function isAttackOnlyLink(a){
    const blob = [a.href, a.getAttribute('href'), a.getAttribute('onclick'), a.textContent].filter(Boolean).join(' ');
    if(/sid=attack|user2ID/i.test(blob) && !/profiles\.php|XID=/i.test(blob)) return true;
    return false;
  }

  function playerIdFromLink(a){
    return extractId([a.href, a.getAttribute('href'), a.getAttribute('onclick'), a.dataset?.userid, a.dataset?.user].filter(Boolean).join(' '));
  }

  function isProfilePage(){
    const body = (document.body?.innerText || '').slice(0, 5000);
    if(/Members\s+Score|Status\s+Attack|Lead Target|Chain active|No active chain/i.test(body)) return false;
    return /profiles\.php/i.test(location.href) || /User Information|Actions|Medals|Awards/i.test(body);
  }

  function currentProfileId(){
    if(!isProfilePage()) return null;
    return extractId(location.href) || extractId(document.body?.innerHTML || '');
  }

  function hostForLink(a){
    if(!a || isBadArea(a)) return null;

    const r = a.getBoundingClientRect?.();
    if(!r || r.bottom < -80 || r.top > innerHeight + 350) return null;

    // BSP-style: attach beside the actual player profile link/name when possible.
    // Do not attach to pure attack buttons/cells.
    if(isAttackOnlyLink(a)) {
      const row = a.closest('li, tr, [class*="row"], [class*="member"], [class*="user"], [class*="enemy"]');
      if(!row || isBadArea(row)) return null;
      const profile = row.querySelector('a[href*="profiles.php"],a[href*="XID="]');
      if(profile && !isBadArea(profile)) return profile;
      return null;
    }

    const t = txt(a);
    const ar = a.getBoundingClientRect();

    // Reject tiny icons / nav links.
    if(ar.width < 26 || ar.height < 8) return null;
    if(/^(Messages|Events|Awards|Home|Items|City|Wheel|RR|Stocks)$/i.test(t)) return null;

    // Prefer the anchor itself. BSP's stable behavior is link-based, not image-guessing.
    return a;
  }

  function gatherTargets(){
    const links = [...document.querySelectorAll(
      'a[href*="profiles.php?XID="],a[href*="XID="],a[href*="user2ID="],a[href*="sid=attack"],[onclick*="profiles.php"],[onclick*="user2ID"],[data-userid],[data-user]'
    )];

    const out = [];
    const seenHost = new Set();
    const seenKey = new Set();

    const profileFallback = currentProfileId();

    for(const el of links){
      if(!(el instanceof Element)) continue;
      if(isBadArea(el)) continue;

      const id = playerIdFromLink(el) || (isProfilePage() ? profileFallback : null);
      if(!id) continue;

      const host = hostForLink(el);
      if(!host || isBadArea(host)) continue;

      const hr = host.getBoundingClientRect();
      if(!hr || hr.bottom < -80 || hr.top > innerHeight + 350) continue;

      // Skip giant profile image links; BSP-style attach is next to name/link, not the image.
      if(hr.width > 520 || hr.height > 90) continue;

      const key = 'xid:' + id + ':' + Math.round(hr.top / 12) + ':' + Math.round(hr.left / 12);
      if(seenKey.has(key) || seenHost.has(host)) continue;

      seenKey.add(key);
      seenHost.add(host);
      out.push({id, host, key});
      if(out.length >= (isWarPage() ? 30 : 70)) break;
    }

    return out;
  }

  function isWarPage(){
    const body = (document.body?.innerText || '').slice(0, 7000);
    return /factions\.php/i.test(location.href) && /Members\s+Score\s+Status\s+Attack|Lead Target|Chain active|No active chain/i.test(body);
  }

  function ensureWarLoadButton(){
    let btn = document.getElementById('absp-bsp-war-load');
    if(!isWarPage()){
      if(btn) btn.remove();
      return;
    }
    if(btn) return;
    btn = document.createElement('button');
    btn.id = 'absp-bsp-war-load';
    btn.textContent = '🧠 Load badges';
    btn.style.cssText = 'position:fixed;right:10px;bottom:122px;z-index:999995;background:#111827;color:#fde68a;border:1px solid #806500;border-radius:10px;padding:7px 9px;font:900 11px Arial;box-shadow:0 2px 10px #000b';
    btn.onclick = () => schedule(100);
    document.body.appendChild(btn);
  }

  function badgeForHost(host, key){
    if(!host || !key) return null;

    // Do not insert into the link itself; place as a sibling just like BSP-style page injection.
    let b = host.parentElement?.querySelector(`:scope > .absp-bsp-badge[data-key="${cssEscape(key)}"]`);
    if(!b){
      b = document.createElement('span');
      b.className = 'absp-bsp-badge absp-bsp-unknown';
      b.dataset.key = key;
      b.textContent = 'N/A';
      host.insertAdjacentElement('afterend', b);
    }

    // Remove duplicates next to the same host.
    host.parentElement?.querySelectorAll(':scope > .absp-bsp-badge').forEach(x => {
      if(x !== b && x.dataset.key === key) x.remove();
    });

    return b;
  }

  function cssEscape(s){
    return String(s).replace(/["\\]/g, '\\$&');
  }

  function updateBadge(b, intel){
    const total = Number(intel?.best_total || intel?.total || 0);
    if(!total){
      b.className = 'absp-bsp-badge absp-bsp-unknown';
      b.textContent = 'N/A';
      b.title = 'No usable intel yet';
      return;
    }
    const adjusted = {...intel, confidence:riskConfidence(intel)};
    const d = diff(total, adjusted.label);
    b.className = `absp-bsp-badge absp-bsp-${d}`;
    b.textContent = fmt(total);
    b.title = `${adjusted.source || 'intel'} • ${d} • ${adjusted.confidence}% • Tap for details`;
  }

  function intelFor(id){
    return getIntel(id) || bspIntel(id);
  }

  function fetchIntel(id, key){
    if(!id || !state.key) return;
    const b = document.querySelector(`.absp-bsp-badge[data-key="${cssEscape(key)}"]`);
    if(!b || b.dataset.fetching === '1') return;

    b.dataset.fetching = '1';
    req('GET', `/api/player/${id}/intel?your_total=${state.total || 0}`).then(r => {
      b.dataset.fetching = '';
      if(r?.ok && r.player){
        saveIntel(id, r.player);
        updateBadge(b, getIntel(id) || r.player);
      }
    });
  }

  function killOld(){
    document.querySelectorAll('.ebsf2-badge,#ebsf2-btn,#ebsf2-panel,#ebsf2-save,.ebsf2-pop,.absp-badge,.absp-hb-badge,.absp3-badge,.absp31-badge').forEach(x => {
      x.style.display = 'none';
      x.style.visibility = 'hidden';
      x.style.pointerEvents = 'none';
    });
  }

  async function paint(){
    state.pending = false;
    state.lastPaint = Date.now();

    killOld();
    updateIcon();
    ensureWarLoadButton();

    const targets = gatherTargets();
    const live = new Set();

    for(const t of targets){
      const b = badgeForHost(t.host, t.key);
      if(!b) continue;

      live.add(t.key);
      b.dataset.targetId = String(t.id);

      let intel = intelFor(t.id);
      if(!intel && isProfilePage()) intel = visibleIntel();
      if(intel) saveIntel(t.id, intel);

      updateBadge(b, intel);

      if(!intel && !isWarPage()) {
        setTimeout(() => fetchIntel(t.id, t.key), 900);
      }
    }

    document.querySelectorAll('.absp-bsp-badge').forEach(b => {
      if(!live.has(b.dataset.key) || isBadArea(b)) b.remove();
    });
  }

  function runIdle(fn, timeout=1400){
    if('requestIdleCallback' in window) requestIdleCallback(fn, {timeout});
    else setTimeout(fn, Math.min(timeout, 800));
  }

  function schedule(ms=900){
    if(state.pending) return;
    state.pending = true;
    clearTimeout(window.__abspBspTimer);
    window.__abspBspTimer = setTimeout(() => runIdle(paint, isWarPage() ? 2200 : 1400), isWarPage() ? Math.max(ms, 1800) : ms);
  }

  function initUI(){
    if(document.getElementById('absp-bsp-main')) return;

    const btn = document.createElement('button');
    btn.id = 'absp-bsp-main';
    btn.textContent = '🧠';
    btn.onclick = () => { state.open = !state.open; renderPanel(); };
    document.body.appendChild(btn);

    const panel = document.createElement('div');
    panel.id = 'absp-bsp-panel';
    document.body.appendChild(panel);

    makeDraggable(btn);
    renderPanel();
  }

  function ownProfile(){
    if(!state.user?.user_id || !isProfilePage()) return false;
    const pid = currentProfileId();
    if(pid) return Number(pid) === Number(state.user.user_id);
    return !!(state.user?.name && String(document.title || '').toLowerCase().includes(String(state.user.name).toLowerCase()));
  }

  function updateIcon(){
    const b = document.getElementById('absp-bsp-main');
    if(b) b.style.display = ownProfile() ? 'block' : 'none';
  }

  function renderPanel(){
    const p = document.getElementById('absp-bsp-panel');
    if(!p) return;

    p.className = state.open ? 'open' : '';
    p.innerHTML = `
      <h2>🧠⚔️ Advanced Battle Stat Predictor <button style="float:right" id="absp-bsp-close">Close</button></h2>
      <div class="body">
        <div class="absp-hero">
          <div class="absp-hero-title">BSP Attach Mode</div>
          <div style="color:#cbd5e1;margin-top:4px;line-height:1.35">Clean rebuild: it attaches beside real Torn player links/names like BSP style. No honor-image guessing and no floating overlay.</div>
          <span class="absp-chip">real XID only</span><span class="absp-chip">sibling badge</span><span class="absp-chip">stable</span>
        </div>

        <div class="absp-card"><b>📜 Rules</b><ul><li>Use predictions as guidance, not guaranteed wins.</li><li>Do not share private spy/manual data unless you are allowed to.</li><li>Fresh intel is better. Old intel may be stale.</li><li>Respect Torn’s API rules, rate limits, and fair-use expectations.</li></ul></div>
        <div class="absp-card"><b>⚔️ How It Works</b><p>The badge is attached only beside real Torn profile/player links with an XID or user2ID. If there is no player ID, nothing is shown.</p></div>
        <div class="absp-card"><b>✅ Terms of Service</b><p>All numbers are estimates and may be wrong. You are responsible for your own attacks, choices, losses, wins, and respect gains.</p></div>
        <div class="absp-card"><b>🔑 API Key Use & Storage</b><p>Use a <b>limited Torn API key</b>. Your key is stored locally in your PDA/userscript storage. No Torn password is ever requested.</p></div>

        <div class="absp-card">
          <b>🍽️ Login</b>
          <input id="absp-bsp-key" type="password" placeholder="Torn limited API key" value="${esc(state.key || '')}">
          <label style="display:block;margin:8px 0;color:#dbeafe"><input id="absp-bsp-ff" type="checkbox" ${state.ff?'checked':''} style="width:auto"> Use FF/BSP visible/base intel when available</label>
          <button id="absp-bsp-login">Login / Save</button>
          <button id="absp-bsp-repaint">Repaint badges</button>
          <div style="margin-top:8px;padding:8px;border-radius:12px;background:rgba(2,6,23,.72);border:1px solid rgba(59,130,246,.25);color:#bfdbfe">Status: ${state.user?.name ? `${esc(state.user.name)} [${esc(state.user.user_id)}] • ${fmt(state.total)}` : 'Not logged in'}</div>
        </div>
      </div>`;

    p.querySelector('#absp-bsp-close').onclick = () => { state.open = false; renderPanel(); };
    p.querySelector('#absp-bsp-login').onclick = login;
    p.querySelector('#absp-bsp-repaint').onclick = () => schedule(50);
    updateIcon();
  }

  async function login(){
    state.key = document.getElementById('absp-bsp-key')?.value.trim() || '';
    state.ff = !!document.getElementById('absp-bsp-ff')?.checked;
    GM_setValue(K.api, state.key);
    GM_setValue(K.ff, state.ff);

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
      GM_setValue(K.user, JSON.stringify(state.user));
      GM_setValue(K.total, state.total);
      GM_setValue(K.stats, JSON.stringify(state.stats));
    }
    renderPanel();
    schedule(80);
  }

  function makeDraggable(btn){
    const saved = safeJson(GM_getValue(K.icon, 'null'));
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
      GM_setValue(K.icon, JSON.stringify({left:parseInt(btn.style.left || '16'), top:parseInt(btn.style.top || '120')}));
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

  function tag(v, type='value'){
    let color = 'grey';
    if(type === 'conf'){
      const n = Number(v || 0);
      color = confColor(n);
      v = Math.max(0, Math.min(100, Math.round(n))) + '%';
    } else {
      const l = String(v || 'Unknown').toLowerCase();
      if(l.includes('avoid') || l.includes('high') || l.includes('heavy')) color = 'red';
      else if(l.includes('difficult')) color = 'orange';
      else if(l.includes('fair') || l.includes('equal')) color = 'yellow';
      else if(l.includes('easy')) color = 'green';
      else if(l.includes('low') || l.includes('light')) color = 'blue';
    }
    return `<span class="absp-tag absp-${color}">${esc(v || 'Unknown')}</span>`;
  }

  function popup(b){
    document.querySelectorAll('.absp-pop').forEach(x => x.remove());

    const id = b.dataset.targetId ? Number(b.dataset.targetId) : null;
    const intel = (id && getIntel(id)) || (id && bspIntel(id)) || {total:parseNum(b.textContent), confidence:0, source:'badge'};
    const total = Number(intel?.best_total || intel?.total || 0);
    const conf = riskConfidence(intel);
    const d = diff(total, intel?.label);

    const pop = document.createElement('div');
    pop.className = 'absp-pop';
    pop.innerHTML = `
      <div class="absp-pop-head"><b>⚔️ Battle Intel</b><button class="close">×</button></div>
      <div class="absp-pop-body">
        <div><b>Total:</b> ${total ? fmt(total) : 'N/A'} ${tag(total ? d : 'Unknown')}</div>
        <div><b>Source:</b> ${esc(intel?.source || 'none')}</div>
        <div><b>Confidence:</b> ${tag(conf, 'conf')}</div>
        ${total && state.total && total / state.total >= 2.5 ? `<div style="margin-top:7px;padding:6px;border-radius:8px;background:#431407;color:#fdba74;border:1px solid #f97316;font-weight:900">Confidence reduced: high stat gap</div>` : ''}
        <hr>
        <div class="absp-grid">
          <div><b>STR</b>${tag('Unknown')}</div>
          <div><b>DEF</b>${tag('Unknown')}</div>
          <div><b>SPD</b>${tag('Unknown')}</div>
          <div><b>DEX</b>${tag('Unknown')}</div>
          <div><b>Armor</b>${tag('Unknown')}</div>
          <div><b>Temp</b>${tag('Unknown')}</div>
        </div>
      </div>`;
    document.body.appendChild(pop);

    const r = b.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(innerWidth - 265, r.left)) + 'px';
    pop.style.top = Math.max(78, Math.min(innerHeight - 280, r.bottom + 6)) + 'px';
    pop.querySelector('.close').onclick = e => { e.stopPropagation(); pop.remove(); schedule(120); };
  }

  document.addEventListener('click', e => {
    const b = e.target.closest?.('.absp-bsp-badge');
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

  function boot(){
    initUI();
    killOld();
    updateIcon();

    setTimeout(() => schedule(700), isWarPage() ? 4500 : 1600);
    setTimeout(() => schedule(900), isWarPage() ? 9000 : 4200);

    let lastMutation = 0;
    try{
      const obs = new MutationObserver(() => {
        const now = Date.now();
        const gap = isWarPage() ? 2400 : 1000;
        if(now - lastMutation < gap) return;
        lastMutation = now;
        schedule(isWarPage() ? 2600 : 900);
      });
      obs.observe(document.body, {childList:true, subtree:true});
    }catch {}

    let scrollTimer = null;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => schedule(isWarPage() ? 900 : 300), isWarPage() ? 900 : 350);
    }, {passive:true});

    let last = location.href;
    setInterval(() => {
      ensureWarLoadButton();
      if(location.href !== last){
        last = location.href;
        document.querySelectorAll('.absp-bsp-badge').forEach(b => b.remove());
        schedule(isWarPage() ? 3200 : 900);
      } else {
        killOld();
        updateIcon();
        if(Date.now() - state.lastPaint > (isWarPage() ? 15000 : 7000)) schedule(isWarPage() ? 2500 : 900);
      }
    }, isWarPage() ? 5000 : 3000);
  }

  boot();
})();
