// ==UserScript==
// @name         Advanced Battle Stat Predictor
// @namespace    Fries91.Torn.AdvancedBattleStatPredictor
// @version      2.2.2
// @description  Honor-bar-only PDA build: one stable badge per player honor/name bar, no attack-column badges, no duplicates, colored popup, own-profile icon.
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

  const KEY = {
    api: 'absp_key',
    user: 'absp_user',
    total: 'absp_total',
    stats: 'absp_stats',
    cache: 'absp_intel_cache',
    icon: 'absp_icon_pos',
    ff: 'absp_ff_enabled'
  };

  const app = {
    key: GM_getValue(KEY.api, '') || GM_getValue('ebsf2_key', ''),
    user: json(GM_getValue(KEY.user, 'null')) || json(GM_getValue('ebsf2_user', 'null')),
    total: Number(GM_getValue(KEY.total, 0) || GM_getValue('ebsf2_total', 0) || 0),
    stats: json(GM_getValue(KEY.stats, '{}')) || {},
    ff: !!GM_getValue(KEY.ff, true),
    open: false
  };

  GM_addStyle(`
    /* Kill old stacked badge systems from earlier versions. */
    .ebsf2-badge,#ebsf2-btn,#ebsf2-panel,#ebsf2-save,.ebsf2-pop{display:none!important;visibility:hidden!important;pointer-events:none!important}

    .absp-hb-badge{position:absolute!important;right:3px!important;top:2px!important;z-index:50!important;display:inline-flex!important;align-items:center;justify-content:center;min-width:32px;max-width:58px;padding:1px 5px!important;border-radius:5px!important;border:1px solid #64748b;background:#111827;color:#cbd5e1;font:900 9px Arial,sans-serif!important;line-height:1!important;box-shadow:0 1px 4px #0009;pointer-events:auto;cursor:pointer;white-space:nowrap;overflow:hidden}
    .absp-easy{background:#052e16!important;color:#86efac!important;border-color:#22c55e!important}
    .absp-fair{background:#422006!important;color:#fde68a!important;border-color:#facc15!important}
    .absp-difficult{background:#431407!important;color:#fdba74!important;border-color:#f97316!important}
    .absp-avoid{background:#450a0a!important;color:#fca5a5!important;border-color:#ef4444!important}
    .absp-unknown{background:#111827!important;color:#cbd5e1!important;border-color:#64748b!important}

    #absp-main{display:none;position:fixed;left:16px;bottom:116px;z-index:999996;width:42px;height:42px;border-radius:9px;border:1px solid #806500;background:#111827;color:#fde68a;font-size:22px;box-shadow:0 2px 10px #000c;touch-action:none}
    #absp-panel{position:fixed;left:8px;right:8px;top:74px;bottom:66px;z-index:999997;background:linear-gradient(145deg,#05070d,#0b1220 55%,#111827);color:#e5e7eb;border:1px solid rgba(250,204,21,.55);border-radius:22px;box-shadow:0 18px 45px #000f;overflow:hidden;font-family:Arial,sans-serif;display:none}
    #absp-panel.open{display:block}
    #absp-panel h2{margin:0;padding:13px 14px;color:#fde68a;background:linear-gradient(90deg,#020617,#0f172a 70%,#111827);border-bottom:1px solid rgba(250,204,21,.35);font-size:17px;text-transform:uppercase;letter-spacing:.4px}
    #absp-panel .body{max-height:calc(100vh - 165px);overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 12px 26px}
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

  function json(s){ try { return JSON.parse(s); } catch { return null; } }
  function esc(s){ return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function text(el){ return (el?.textContent || '').replace(/\s+/g, ' ').trim(); }
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
    m = blob.match(/sid=attack[^"'<>]*?(\d{3,10})/i);
    if(m) return Number(m[1]);
    return null;
  }

  function cache(){ return json(GM_getValue(KEY.cache, '{}')) || {}; }
  function getIntel(id){ return cache()[String(id)] || null; }
  function rank(i){
    const s = String(i?.source || '').toLowerCase();
    if(s.includes('manual') || s.includes('spy') || s.includes('exact')) return 95;
    if(s.includes('ff') || s.includes('visible')) return 70;
    if(s.includes('bsp')) return 66;
    if(s.includes('fight')) return 40;
    return Number(i?.confidence || 0);
  }
  function saveIntel(id, intel){
    if(!id || !intel) return;
    const c = cache();
    const adjusted = {...intel, confidence:riskConfidence(intel)};
    const old = c[String(id)];
    if(old && rank(old) > rank(adjusted)) return;
    c[String(id)] = {...adjusted, user_id:Number(id), saved_at:Date.now()};
    GM_setValue(KEY.cache, JSON.stringify(c));
  }

  function req(method, path, data){
    return new Promise(resolve => {
      GM_xmlhttpRequest({
        method, url: BASE + path,
        headers: {'Content-Type':'application/json'},
        data: data ? JSON.stringify(data) : undefined,
        timeout: 22000,
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
    if(total && app.total){
      const r = Number(total) / Number(app.total);
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
    if(!total || !app.total) return conf;
    const exact = /spy|manual|exact/i.test(String(intel?.source || ''));
    const ratio = total / app.total;

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
    const keys = ['tdup.battleStatsPredictor.cache.prediction.' + id, 'BSP_prediction_' + id, 'battleStatsPredictor_' + id];
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

  function intelFor(id){ return id ? (getIntel(id) || bspIntel(id)) : null; }

  function fetchIntel(id, mount){
    if(!id || !app.key || !mount || mount.dataset.abspFetching === '1') return;
    mount.dataset.abspFetching = '1';
    req('GET', `/api/player/${id}/intel?your_total=${app.total || 0}`).then(r => {
      mount.dataset.abspFetching = '';
      if(r?.ok && r.player){
        saveIntel(id, r.player);
        updateMount(mount, getIntel(id) || r.player, id);
      }
    });
  }

  function initUI(){
    if(document.getElementById('absp-main')) return;

    const btn = document.createElement('button');
    btn.id = 'absp-main';
    btn.textContent = '🧠';
    btn.onclick = () => { app.open = !app.open; renderPanel(); };
    document.body.appendChild(btn);

    const panel = document.createElement('div');
    panel.id = 'absp-panel';
    document.body.appendChild(panel);

    makeDraggable(btn);
    renderPanel();
  }

  function renderPanel(){
    const p = document.getElementById('absp-panel');
    if(!p) return;

    p.className = app.open ? 'open' : '';
    p.innerHTML = `
      <h2>🧠⚔️ Advanced Battle Stat Predictor <button style="float:right" id="absp-close">Close</button></h2>
      <div class="body">
        <div class="absp-hero">
          <div class="absp-hero-title">Feed the Finder</div>
          <div style="color:#cbd5e1;margin-top:4px;line-height:1.35">Honor bars only now — no more random crime/chat/job boxes. It eats cleaner.</div>
          <span class="absp-chip">honor badges</span><span class="absp-chip">tap for intel</span><span class="absp-chip">stable</span>
        </div>

        <div class="absp-card"><b>📜 Rules</b><ul><li>Use predictions as guidance, not guaranteed wins.</li><li>Do not share private spy/manual data unless you are allowed to.</li><li>Fresh intel is tastier. Old intel may be stale.</li><li>Respect Torn’s API rules, rate limits, and fair-use expectations.</li></ul></div>
        <div class="absp-card"><b>⚔️ How It Works</b><p>The predictor places small stat badges on player honor/name bars only. Tap a badge to open the mini intel popup. It can use visible FF/BSP estimates, saved backend intel, and fight-learning signals.</p><p>New targets may show <b>N/A</b>. Feed it more info through visible estimates and fights so it can grow teeth.</p></div>
        <div class="absp-card"><b>✅ Terms of Service</b><p>All numbers are estimates and may be wrong. You are responsible for your own attacks, choices, losses, wins, and respect gains.</p><p>This tool organizes information visible to you, provided by you, or gathered through allowed limited-key use.</p></div>
        <div class="absp-card"><b>🔑 API Key Use & Storage</b><p>Use a <b>limited Torn API key</b>. Your key is stored locally in your browser/PDA userscript storage so the script can log you in and compare targets against your own battle stats.</p><p>No Torn password is ever requested. The backend uses the key only for login/stat detection or optional estimate support. The script avoids unnecessary API access and is built around limited-key use.</p></div>

        <div class="absp-card">
          <b>🍽️ Login — Feed the Beast</b>
          <input id="absp-key" type="password" placeholder="Torn limited API key" value="${esc(app.key || '')}">
          <label style="display:block;margin:8px 0;color:#dbeafe"><input id="absp-ff" type="checkbox" ${app.ff?'checked':''} style="width:auto"> Use FF/BSP visible/base intel when available</label>
          <button id="absp-login">Login / Save</button>
          <button id="absp-repaint">Repaint badges</button>
          <div class="absp-status">Status: ${app.user?.name ? `${esc(app.user.name)} [${esc(app.user.user_id)}] • ${fmt(app.total)}` : 'Not logged in'}</div>
        </div>
      </div>`;

    p.querySelector('#absp-close').onclick = () => { app.open = false; renderPanel(); };
    p.querySelector('#absp-login').onclick = login;
    p.querySelector('#absp-repaint').onclick = () => schedulePaint(50);
    updateIcon();
  }

  async function login(){
    app.key = document.getElementById('absp-key')?.value.trim() || '';
    app.ff = !!document.getElementById('absp-ff')?.checked;
    GM_setValue(KEY.api, app.key);
    GM_setValue(KEY.ff, app.ff);

    const r = await req('POST', '/api/login', {api_key: app.key});
    if(r?.ok){
      app.user = r.user;
      app.total = Number(r.stats?.total || 0);
      app.stats = {
        strength: r.stats?.strength || 0,
        defense: r.stats?.defense || 0,
        speed: r.stats?.speed || 0,
        dexterity: r.stats?.dexterity || 0
      };
      GM_setValue(KEY.user, JSON.stringify(app.user));
      GM_setValue(KEY.total, app.total);
      GM_setValue(KEY.stats, JSON.stringify(app.stats));
    }
    renderPanel();
    schedulePaint(100);
  }

  function isProfilePage(){
    const body = (document.body?.innerText || '').slice(0, 5000);
    if(/Members\s+Score|Status\s+Attack|Lead Target|Chain active|No active chain/i.test(body)) return false;
    return /profiles\.php/i.test(location.href) || /User Information|Actions|Medals|Awards/i.test(body);
  }

  function ownProfile(){
    if(!app.user?.user_id || !isProfilePage()) return false;
    const pid = extractId(location.href) || extractId(document.body?.innerHTML || '');
    if(pid) return Number(pid) === Number(app.user.user_id);
    return !!(app.user?.name && String(document.title || '').toLowerCase().includes(String(app.user.name).toLowerCase()));
  }

  function updateIcon(){
    const b = document.getElementById('absp-main');
    if(b) b.style.display = ownProfile() ? 'block' : 'none';
  }

  function makeDraggable(btn){
    const saved = json(GM_getValue(KEY.icon, 'null'));
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

  function badContext(el){
    const t = text(el) + ' ' + text(el?.parentElement) + ' ' + text(el?.parentElement?.parentElement);
    return /Members\s+Score\s+Status\s+Attack|Cosa-?Nostra\s+vs|7DS\*:|Lead Target|No active chain|Chain active|Your faction is not in a war|Rank:|Respect:/i.test(t) ||
           /Battle Stats|Strength|Defense|Speed|Dexterity|Job Information|Property Information|Company|Income|Fees|Rating|Cash Me if You Can|Best of the Lot|THIEF|LOOKOUT|PICKLOCK|MUSCLE|IMITATOR|JOIN|24hrs/i.test(t) ||
           /Type your message here|Faction\s*$/i.test(t);
  }

  function isChatOrCrime(el){
    let node = el;
    for(let i=0; i<7 && node && node !== document.body; i++, node = node.parentElement){
      const ident = String((node.id || '') + ' ' + (node.className || '')).toLowerCase();
      const t = text(node);
      if(/chat|message|msg|conversation/.test(ident)) return true;
      if(/Type your message here/.test(t)) return true;
      if(/Cash Me if You Can|Best of the Lot|THIEF|LOOKOUT|PICKLOCK|MUSCLE|IMITATOR|CAR THIEF|JOIN|24hrs/i.test(t)) return true;
    }
    return false;
  }

  function idNear(el){
    if(!el) return null;

    const links = [
      ...(el.querySelectorAll?.('a[href*="profiles.php"],a[href*="XID="],a[href*="user2ID"],a[href*="sid=attack"]') || []),
      ...(el.parentElement?.querySelectorAll?.('a[href*="profiles.php"],a[href*="XID="],a[href*="user2ID"],a[href*="sid=attack"]') || []),
      ...(el.closest?.('div,li,tr')?.querySelectorAll?.('a[href*="profiles.php"],a[href*="XID="],a[href*="user2ID"],a[href*="sid=attack"]') || [])
    ];

    for(const a of links){
      const id = extractId([a.href, a.getAttribute('href'), a.getAttribute('onclick')].filter(Boolean).join(' '));
      if(id) return Number(id);
    }

    let node = el;
    for(let i=0; i<7 && node && node !== document.body; i++, node=node.parentElement){
      const blob = [
        node.getAttribute?.('href'),
        node.getAttribute?.('onclick'),
        node.getAttribute?.('data-user'),
        node.getAttribute?.('data-userid'),
        node.getAttribute?.('data-id'),
        node.innerHTML
      ].filter(Boolean).join(' ');
      const id = extractId(blob);
      if(id) return Number(id);
    }

    return null;
  }

  function honorMount(raw){
    if(!raw || raw.closest?.('#absp-panel,.absp-pop')) return null;
    if(isChatOrCrime(raw)) return null;

    const id = idNear(raw);
    if(!id && !isProfilePage()) return null;

    let best = raw;
    let node = raw.parentElement;

    for(let i=0; i<3 && node && node !== document.body; i++, node=node.parentElement){
      if(isChatOrCrime(node)) return null;
      const r = node.getBoundingClientRect?.();
      if(!r || r.width < 70 || r.width > 390 || r.height < 10 || r.height > 115) continue;
      if(badContext(node)) continue;

      const hasHonor =
        node.matches?.('[class*="honor"],[class*="name"],[style*="background-image"],a[href*="profiles.php"],a[href*="XID="]') ||
        node.querySelector?.('[class*="honor"],[class*="name"],[style*="background-image"],img,a[href*="profiles.php"],a[href*="XID="]');

      if(hasHonor) best = node;
    }

    const r = best.getBoundingClientRect?.();
    if(!r || r.width < 70 || r.width > 390 || r.height < 10 || r.height > 115) return null;
    if(r.bottom < -120 || r.top > innerHeight + 800) return null;
    if(badContext(best)) return null;

    return best;
  }

  function rowFor(el){
    let node = el;
    for(let i=0; i<7 && node && node !== document.body; i++, node = node.parentElement){
      if(isChatOrCrime(node)) return null;
      const r = node.getBoundingClientRect?.();
      if(!r || r.width < 180 || r.height < 18) continue;
      if(!idNear(node)) continue;
      if(badContext(node)) continue;
      return node;
    }
    return null;
  }

  function leftSide(mount, row){
    if(!row) return true;
    const mr = mount?.getBoundingClientRect?.();
    const rr = row?.getBoundingClientRect?.();
    if(!mr || !rr) return true;
    return mr.left <= rr.left + rr.width * 0.62;
  }

  function updateMount(mount, intel, id){
    if(!mount || !id) return;

    let b = mount.querySelector(':scope > .absp-hb-badge');
    if(!b){
      b = document.createElement('span');
      b.className = 'absp-hb-badge';
      const cs = getComputedStyle(mount);
      if(cs.position === 'static') mount.style.position = 'relative';
      mount.appendChild(b);
    }

    [...mount.querySelectorAll(':scope > .absp-hb-badge')].slice(1).forEach(x => x.remove());

    const total = Number(intel?.best_total || intel?.total || 0);
    if(!total){
      b.className = 'absp-hb-badge absp-unknown';
      b.textContent = 'N/A';
      b.title = 'No usable intel yet';
    } else {
      const adjusted = {...intel, confidence:riskConfidence(intel)};
      const d = diff(total, adjusted.label);
      b.className = `absp-hb-badge absp-${d}`;
      b.textContent = fmt(total);
      b.title = `${adjusted.source || 'intel'} • ${d} • ${adjusted.confidence}% • Tap for details`;
    }

    b.dataset.targetId = String(id);
  }

  async function paintHonors(){
    const body = (document.body?.innerText || '').slice(0, 9000);
    const allowed = /profiles\.php|factions\.php|hospital|jail|loader\.php|page\.php|competition|userlist|friends|blacklist/i.test(location.href) ||
      /User Information|Actions|Hospital|Jail|Travel|Members|Status|Attack|Profile/i.test(body);

    if(!allowed) return;

    const candidates = [...document.querySelectorAll(
      '[class*="honor"],[class*="name"],[style*="background-image"],a[href*="profiles.php"],a[href*="XID="],a[href*="user2ID"],a[href*="sid=attack"]'
    )];

    const seen = new Set();
    let painted = 0;

    for(const raw of candidates){
      if(painted >= 90) break;
      if(isChatOrCrime(raw)) continue;

      const mount = honorMount(raw);
      if(!mount) continue;

      let id = idNear(mount) || idNear(raw);
      if(!id && isProfilePage()) id = extractId(location.href) || extractId(document.body?.innerHTML || '');
      if(!id) continue;

      const row = rowFor(mount);
      if(row && !leftSide(mount, row)) continue;

      const rect = mount.getBoundingClientRect();
      const key = id + ':' + Math.round(rect.top) + ':' + Math.round(rect.left);
      if(seen.has(key)) continue;
      seen.add(key);

      let intel = intelFor(id);
      if(!intel && isProfilePage()) intel = visibleIntel();
      if(intel) saveIntel(id, intel);

      updateMount(mount, intel, id);
      painted++;

      if(!intel) fetchIntel(id, mount);
    }
  }

  function clean(){
    document.querySelectorAll('.ebsf2-badge,#ebsf2-btn,#ebsf2-panel,#ebsf2-save,.ebsf2-pop,.absp-badge').forEach(x => {
      x.style.display = 'none';
      x.style.visibility = 'hidden';
      x.style.pointerEvents = 'none';
    });

    document.querySelectorAll('.absp-hb-badge').forEach(b => {
      if(b.closest?.('.absp-pop')) return;
      const mount = b.parentElement;
      if(!mount || !b.dataset.targetId){
        b.remove();
        return;
      }
      if(isChatOrCrime(mount) || badContext(mount)){
        b.remove();
        return;
      }
      const row = rowFor(mount);
      if(row && !leftSide(mount, row)){
        b.remove();
      }
    });

    updateIcon();
  }

  async function paint(){
    updateIcon();
    await paintHonors();
    clean();
  }

  function schedulePaint(ms = 800){
    clearTimeout(window.__abspHonorOnlyTimer);
    window.__abspHonorOnlyTimer = setTimeout(paint, ms);
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
    const id = b.dataset.targetId;
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
        ${total && app.total && total / app.total >= 2.5 ? `<div style="margin-top:7px;padding:6px;border-radius:8px;background:#431407;color:#fdba74;border:1px solid #f97316;font-weight:900">Confidence reduced: high stat gap</div>` : ''}
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
    pop.querySelector('.close').onclick = e => { e.stopPropagation(); pop.remove(); schedulePaint(150); };
  }

  document.addEventListener('click', e => {
    const b = e.target.closest?.('.absp-hb-badge');
    if(!b) return;
    e.preventDefault();
    e.stopPropagation();
    popup(b);
  }, true);

  function isAttackClick(el){
    if(!el) return false;
    const blob = [el.href, el.getAttribute?.('href'), el.getAttribute?.('onclick'), el.textContent, el.getAttribute?.('title')].filter(Boolean).join(' ');
    return /sid=attack|user2ID|attack|fight/i.test(blob);
  }

  document.addEventListener('click', e => {
    const el = e.target.closest?.('a,button,[onclick]');
    if(!isAttackClick(el)) return;
    const id = idNear(el);
    if(id) GM_setValue('absp_last_attack_target', JSON.stringify({id, ts:Date.now()}));
  }, true);

  function boot(){
    initUI();
    updateIcon();
    clean();

    [600, 1600, 3500, 6500].forEach(t => setTimeout(() => schedulePaint(50), t));

    try{
      const obs = new MutationObserver(() => schedulePaint(1100));
      obs.observe(document.body, {childList:true, subtree:true});
    }catch {}

    let last = location.href;
    setInterval(() => {
      if(location.href !== last){
        last = location.href;
        schedulePaint(800);
      } else {
        clean();
      }
    }, 3000);
  }

  boot();


  /* v2.2.2 strict honor mount override
     Fixes:
     - Attack column badges.
     - Double/stacked badges on honor bars.
     - Uses attack links only to find target ID, never as a badge mount.
     - One chosen badge mount per player row.
  */

  function absp222IsAttackColumn(el){
    if(!el) return false;
    const blob = [
      el.textContent,
      el.getAttribute?.('href'),
      el.getAttribute?.('onclick'),
      el.getAttribute?.('title'),
      el.className
    ].filter(Boolean).join(' ');
    if(/\bAttack\b/i.test(blob) || /sid=attack|user2ID/i.test(blob)) return true;

    let node = el;
    for(let i=0; i<5 && node && node !== document.body; i++, node=node.parentElement){
      const t = (node.textContent || '').replace(/\s+/g,' ').trim();
      const r = node.getBoundingClientRect?.();
      if(r && r.width < 120 && /\bAttack\b/i.test(t)) return true;
    }
    return false;
  }

  function absp222RowForElement(el){
    let node = el;
    for(let i=0; i<9 && node && node !== document.body; i++, node=node.parentElement){
      const r = node.getBoundingClientRect?.();
      if(!r || r.width < 220 || r.height < 20) continue;
      const t = (node.textContent || '').replace(/\s+/g,' ').trim();
      if(/Members\s+Score\s+Status\s+Attack|Lead Target|No active chain|Chain active|Your faction is not in a war/i.test(t)) continue;
      if(/used 25 energy attacking|initiated an attack|lost to|won against|fired .* rounds/i.test(t)) continue;

      const id = idNear(node);
      const hasStatus = /\bOkay\b|\bHospital\b|\bJail\b|\bTravel\b|\bAbroad\b|\bAttack\b/i.test(t);
      const hasVisual = !!node.querySelector?.('[class*="honor"],[class*="name"],[style*="background-image"],img,a[href*="profiles.php"],a[href*="XID="]');
      if(id && hasVisual && hasStatus) return node;
    }
    return null;
  }

  function absp222VisualHonorCandidate(el, row){
    if(!el || !row) return false;
    if(el.closest?.('#absp-panel,.absp-pop')) return false;
    if(isChatOrCrime(el)) return false;
    if(absp222IsAttackColumn(el)) return false;

    const er = el.getBoundingClientRect?.();
    const rr = row.getBoundingClientRect?.();
    if(!er || !rr) return false;

    // Must be on the left member/name side, never score/status/attack side.
    if(er.left > rr.left + rr.width * 0.58) return false;

    if(er.width < 55 || er.width > 320 || er.height < 10 || er.height > 95) return false;
    if(er.bottom < -120 || er.top > innerHeight + 800) return false;

    const t = (el.textContent || el.parentElement?.textContent || '').replace(/\s+/g,' ').trim();
    if(/Score|Status|Attack|Okay|Members/i.test(t) && t.length < 60) return false;

    const cls = String(el.className || '').toLowerCase();
    const st = String(el.getAttribute?.('style') || '').toLowerCase();

    if(cls.includes('honor') || cls.includes('name')) return true;
    if(st.includes('background-image')) return true;
    if(el.tagName === 'IMG') return true;
    if(el.matches?.('a[href*="profiles.php"],a[href*="XID="]')) return true;
    if(el.querySelector?.('[class*="honor"],[class*="name"],[style*="background-image"],img,a[href*="profiles.php"],a[href*="XID="]')) return true;

    return false;
  }

  function absp222BestMountForRow(row){
    if(!row) return null;
    const rr = row.getBoundingClientRect?.();
    if(!rr) return null;

    const candidates = [...row.querySelectorAll('[class*="honor"],[class*="name"],[style*="background-image"],img,a[href*="profiles.php"],a[href*="XID="]')];

    let best = null;
    let bestScore = -999;

    for(const raw of candidates){
      let el = raw;

      // Prefer compact parent plate if it is still left-side and visual.
      for(let i=0; i<3 && el.parentElement && el.parentElement !== document.body; i++){
        const p = el.parentElement;
        if(absp222VisualHonorCandidate(p, row)){
          el = p;
        } else {
          break;
        }
      }

      if(!absp222VisualHonorCandidate(el, row)) continue;

      const r = el.getBoundingClientRect();
      const cls = String(el.className || '').toLowerCase();
      const st = String(el.getAttribute?.('style') || '').toLowerCase();

      let score = 0;
      if(cls.includes('honor')) score += 60;
      if(cls.includes('name')) score += 35;
      if(st.includes('background-image')) score += 35;
      if(el.querySelector?.('[style*="background-image"],img')) score += 25;
      if(el.matches?.('a[href*="profiles.php"],a[href*="XID="]')) score += 20;
      score += Math.min(40, r.width / 7);

      // Prefer the visible name/honor strip, not tiny icons.
      if(r.width >= 100) score += 15;
      if(r.left < rr.left + rr.width * 0.45) score += 10;

      if(score > bestScore){
        bestScore = score;
        best = el;
      }
    }

    return best;
  }

  function absp222RemoveRowDuplicates(row, keepMount){
    if(!row) return;
    row.querySelectorAll('.absp-hb-badge').forEach(b=>{
      if(b.parentElement !== keepMount) b.remove();
    });
    if(keepMount){
      [...keepMount.querySelectorAll(':scope > .absp-hb-badge')].slice(1).forEach(x=>x.remove());
    }
  }

  async function absp222PaintHonors(){
    const body = (document.body?.innerText || '').slice(0, 9000);
    const allowed = /profiles\.php|factions\.php|hospital|jail|loader\.php|page\.php|competition|userlist|friends|blacklist/i.test(location.href) ||
      /User Information|Actions|Hospital|Jail|Travel|Members|Status|Attack|Profile/i.test(body);

    if(!allowed) return;

    const possibleRows = new Set();

    document.querySelectorAll('[class*="honor"],[class*="name"],[style*="background-image"],img,a[href*="profiles.php"],a[href*="XID="],a[href*="user2ID"],a[href*="sid=attack"]').forEach(el=>{
      const row = absp222RowForElement(el);
      if(row) possibleRows.add(row);
    });

    // Profile page fallback: use profile honor image/name even if no faction-style row.
    if(isProfilePage()){
      const pid = extractId(location.href) || extractId(document.body?.innerHTML || '');
      if(pid){
        const profileCandidates = [...document.querySelectorAll('[class*="honor"],[class*="name"],[style*="background-image"],img,a[href*="profiles.php"],a[href*="XID="]')];
        let best = null, score = -999;
        for(const el of profileCandidates){
          if(isChatOrCrime(el) || badContext(el) || absp222IsAttackColumn(el)) continue;
          const r = el.getBoundingClientRect?.();
          if(!r || r.width < 70 || r.width > 450 || r.height < 10 || r.height > 120 || r.top < 120) continue;
          let s = Math.min(60, r.width / 6);
          if(String(el.getAttribute?.('style') || '').includes('background-image')) s += 40;
          if(el.tagName === 'IMG') s += 20;
          if(s > score){ score = s; best = el.parentElement || el; }
        }
        if(best){
          let intel = intelFor(pid) || visibleIntel();
          if(intel) saveIntel(pid, intel);
          updateMount(best, intel, pid);
        }
      }
    }

    let painted = 0;
    for(const row of possibleRows){
      if(painted >= 90) break;

      const id = idNear(row);
      if(!id) continue;

      const mount = absp222BestMountForRow(row);
      if(!mount) continue;

      absp222RemoveRowDuplicates(row, mount);

      let intel = intelFor(id);
      if(intel) saveIntel(id, intel);

      updateMount(mount, intel, id);
      painted++;

      if(!intel) fetchIntel(id, mount);
    }

    absp222Clean();
  }

  function absp222Clean(){
    // Hide older/other badge systems.
    document.querySelectorAll('.ebsf2-badge,#ebsf2-btn,#ebsf2-panel,#ebsf2-save,.ebsf2-pop,.absp-badge').forEach(x => {
      x.style.display = 'none';
      x.style.visibility = 'hidden';
      x.style.pointerEvents = 'none';
    });

    document.querySelectorAll('.absp-hb-badge').forEach(b=>{
      if(b.closest?.('.absp-pop')) return;
      const mount = b.parentElement;
      if(!mount || !b.dataset.targetId){
        b.remove();
        return;
      }

      if(isChatOrCrime(mount) || badContext(mount) || absp222IsAttackColumn(mount)){
        b.remove();
        return;
      }

      const row = absp222RowForElement(mount);
      if(row){
        const best = absp222BestMountForRow(row);
        if(best !== mount){
          b.remove();
          return;
        }
      } else if(!isProfilePage()){
        b.remove();
      }
    });

    updateIcon();
  }

  // Override the old honor painter with this stricter one.
  paintHonors = absp222PaintHonors;
  clean = absp222Clean;

  function absp222Schedule(ms=800){
    clearTimeout(window.__absp222Timer);
    window.__absp222Timer = setTimeout(async ()=>{
      await absp222PaintHonors();
      absp222Clean();
    }, ms);
  }

  [300, 1200, 2600, 5200].forEach(t=>setTimeout(()=>absp222Schedule(50), t));

  try{
    const obs222 = new MutationObserver(()=>absp222Schedule(1100));
    obs222.observe(document.body, {childList:true, subtree:true});
  }catch(e){}

  setInterval(()=>absp222Clean(), 3000);
  absp222Schedule(100);

})();
