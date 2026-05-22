// ==UserScript==
// @name         Advanced Battle Stat Predictor
// @namespace    Fries91.Torn.AdvancedBattleStatPredictor
// @version      3.0.1
// @description  Exact honor-bar overlay build: badges only on real wide/short player honor bars, no icons/header/pagination/profile-picture false hits.
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
  const VERSION = '3.0.1';

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

  GM_addStyle(`
    .ebsf2-badge,#ebsf2-btn,#ebsf2-panel,#ebsf2-save,.ebsf2-pop,.absp-badge,.absp-hb-badge,.absp3-badge{display:none!important;visibility:hidden!important;pointer-events:none!important}

    .absp31-badge{
      position:fixed!important;
      z-index:999994!important;
      display:inline-flex!important;
      align-items:center!important;
      justify-content:center!important;
      min-width:34px!important;
      max-width:64px!important;
      height:15px!important;
      padding:0 5px!important;
      border-radius:6px!important;
      border:1px solid #64748b!important;
      background:#111827!important;
      color:#cbd5e1!important;
      font:900 10px/1 Arial,sans-serif!important;
      box-shadow:0 2px 5px #000b!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      pointer-events:auto!important;
      cursor:pointer!important;
      transform:translateZ(0)!important;
    }
    .absp31-easy{background:#052e16!important;color:#86efac!important;border-color:#22c55e!important}
    .absp31-fair{background:#422006!important;color:#fde68a!important;border-color:#facc15!important}
    .absp31-difficult{background:#431407!important;color:#fdba74!important;border-color:#f97316!important}
    .absp31-avoid{background:#450a0a!important;color:#fca5a5!important;border-color:#ef4444!important}
    .absp31-unknown{background:#111827!important;color:#cbd5e1!important;border-color:#64748b!important}

    #absp31-main{
      display:none;position:fixed;left:16px;bottom:116px;z-index:999996;
      width:42px;height:42px;border-radius:10px;border:1px solid #806500;
      background:#111827;color:#fde68a;font-size:22px;box-shadow:0 2px 10px #000c;touch-action:none
    }

    #absp31-panel{
      position:fixed;left:8px;right:8px;top:74px;bottom:66px;z-index:999997;
      background:linear-gradient(145deg,#05070d,#0b1220 55%,#111827);
      color:#e5e7eb;border:1px solid rgba(250,204,21,.55);border-radius:22px;
      box-shadow:0 18px 45px #000f;overflow:hidden;font-family:Arial,sans-serif;display:none
    }
    #absp31-panel.open{display:block}
    #absp31-panel h2{margin:0;padding:13px 14px;color:#fde68a;background:linear-gradient(90deg,#020617,#0f172a 70%,#111827);border-bottom:1px solid rgba(250,204,21,.35);font-size:17px;text-transform:uppercase;letter-spacing:.4px}
    #absp31-panel .body{max-height:calc(100vh - 165px);overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 12px 26px}
    #absp31-panel button{background:linear-gradient(180deg,#2a2110,#111827);color:#fde68a;border:1px solid rgba(250,204,21,.52);border-radius:14px;padding:8px 10px;margin:4px;font-weight:900}
    #absp31-panel input{box-sizing:border-box;width:100%;background:#020617;color:#f8fafc;border:1px solid rgba(250,204,21,.28);border-radius:14px;padding:10px;margin:6px 0}

    .absp31-hero{margin:0 0 10px;padding:14px;border:1px solid rgba(250,204,21,.35);border-radius:18px;background:linear-gradient(135deg,rgba(250,204,21,.12),rgba(59,130,246,.08) 55%,rgba(15,23,42,.9))}
    .absp31-hero-title{font-size:22px;font-weight:1000;color:#facc15;text-transform:uppercase}
    .absp31-chip{display:inline-flex;margin:7px 4px 0 0;padding:3px 7px;border-radius:999px;background:#020617;border:1px solid rgba(250,204,21,.32);color:#fde68a;font-weight:900;font-size:11px}
    .absp31-card{position:relative;padding:12px 12px 12px 14px;border-radius:18px;background:linear-gradient(145deg,rgba(15,23,42,.96),rgba(2,6,23,.96));border:1px solid rgba(148,163,184,.25);box-shadow:inset 3px 0 0 rgba(250,204,21,.55),0 6px 14px rgba(0,0,0,.35);margin-bottom:10px}
    .absp31-card b{display:block;color:#fde68a;font-size:14px;margin-bottom:7px;text-transform:uppercase}
    .absp31-card p,.absp31-card li{color:#dbeafe;line-height:1.42}
    .absp31-card ul{margin:7px 0 0 18px;padding:0}
    .absp31-status{margin-top:8px;padding:8px;border-radius:12px;background:rgba(2,6,23,.72);border:1px solid rgba(59,130,246,.25);color:#bfdbfe}

    .absp31-pop{position:fixed;z-index:999999;background:#0b1120;color:#e5e7eb;border:1px solid #806500;border-radius:12px;box-shadow:0 6px 22px #000d;width:255px;font:12px Arial,sans-serif;overflow:hidden}
    .absp31-pop-head{display:flex;justify-content:space-between;align-items:center;background:#020617;color:#facc15;padding:8px 10px}
    .absp31-pop-head button{background:#1f2937!important;color:#facc15!important;border:1px solid #806500!important;border-radius:6px!important;padding:1px 6px!important}
    .absp31-pop-body{padding:10px;line-height:1.45}
    .absp31-tag{display:inline-flex;align-items:center;justify-content:center;min-width:54px;padding:2px 6px;border-radius:999px;font-weight:900;border:1px solid #64748b;background:#111827;color:#cbd5e1}
    .absp31-red{background:#450a0a!important;color:#fca5a5!important;border-color:#ef4444!important}
    .absp31-orange{background:#431407!important;color:#fdba74!important;border-color:#f97316!important}
    .absp31-yellow{background:#422006!important;color:#fde68a!important;border-color:#facc15!important}
    .absp31-green{background:#052e16!important;color:#86efac!important;border-color:#22c55e!important}
    .absp31-blue{background:#172554!important;color:#93c5fd!important;border-color:#3b82f6!important}
    .absp31-grey{background:#111827!important;color:#cbd5e1!important;border-color:#64748b!important}
    .absp31-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:7px}
    .absp31-grid div{background:#111827;border:1px solid #334155;border-radius:8px;padding:5px;display:flex;justify-content:space-between}
  `);

  function safeJson(s){ try { return JSON.parse(s); } catch { return null; } }
  function esc(s){ return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function cleanText(el){ return (el?.textContent || '').replace(/\s+/g,' ').trim(); }
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
  function simpleHash(s){
    s = String(s || '');
    let h = 0;
    for(let i=0;i<s.length;i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h).toString(36);
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
    for(let i=0; i<6 && node && node !== document.body; i++, node=node.parentElement){
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

  function currentProfileId(){
    if(!isProfilePage()) return null;
    return extractId(location.href) || extractId(document.body?.innerHTML || '');
  }

  function pageCanHaveHonors(){
    const body = (document.body?.innerText || '').slice(0, 9000);
    return /profiles\.php|factions\.php|hospital|jail|loader\.php|page\.php|competition|userlist|friends|blacklist/i.test(location.href) ||
      /User Information|Actions|Hospital|Jail|Travel|Members|Status|Attack|Profile/i.test(body);
  }

  function badContainer(el){
    let node = el;
    for(let i=0; i<7 && node && node !== document.body; i++, node=node.parentElement){
      const ident = String((node.id || '') + ' ' + (node.className || '')).toLowerCase();
      const t = cleanText(node);

      if(node.id === 'absp31-panel' || node.classList?.contains('absp31-pop')) return true;
      if(/chat|message|msg|conversation/.test(ident)) return true;
      if(/Type your message here/.test(t)) return true;

      // Crime / home / property / job / nav / pagination false positives
      if(/Cash Me if You Can|Best of the Lot|THIEF|LOOKOUT|PICKLOCK|MUSCLE|IMITATOR|CAR THIEF|JOIN|24hrs/i.test(t)) return true;
      if(/Battle Stats|Strength|Defense|Speed|Dexterity|Job Information|Property Information|Company|Income|Fees|Rating/i.test(t)) return true;
      if(/Messages|Events|Awards|Home|Items|City|Wheel|Stocks/i.test(t) && t.length < 100) return true;
      if(/^\s*(1|2|3|4|5|…|\.\.\.|108|Page)\s*$/i.test(t)) return true;

      // Headers / war panels, but only if this compact ancestor is header-like.
      if(/Members\s+Score\s+Status\s+Attack|Lead Target|No active chain|Chain active|Your faction is not in a war/i.test(t) && t.length < 350) return true;
    }
    return false;
  }

  function isAttackCell(el){
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
      const r = node.getBoundingClientRect?.();
      const t = cleanText(node);
      if(r && r.width < 140 && /\bAttack\b/i.test(t)) return true;
    }
    return false;
  }

  function honorShape(el){
    if(!el || badContainer(el) || isAttackCell(el)) return false;
    if(el.closest?.('#absp31-panel,.absp31-pop')) return false;

    const r = el.getBoundingClientRect?.();
    if(!r) return false;

    // Main fix: actual honor bars are wide and short. Reject square icons and big profile pictures.
    const ratio = r.width / Math.max(1, r.height);
    if(r.width < 85 || r.width > 470) return false;
    if(r.height < 12 || r.height > 64) return false;
    if(ratio < 2.35) return false;

    // Avoid top Torn nav/resource area and bottom PDA buttons.
    if(r.top < 300 && !/profiles\.php|factions\.php|hospital|jail/i.test(location.href)) return false;
    if(r.bottom > innerHeight - 58) return false;
    if(r.bottom < -80 || r.top > innerHeight + 800) return false;

    const t = cleanText(el);
    if(/Score|Status|Attack|Okay|Members|Join|24hrs|Level|Rank/i.test(t) && t.length < 80) return false;

    const cls = String(el.className || '').toLowerCase();
    const st = String(el.getAttribute?.('style') || '').toLowerCase();

    if(cls.includes('honor') || cls.includes('name')) return true;
    if(st.includes('background-image')) return true;
    if(el.matches?.('a[href*="profiles.php"],a[href*="XID="]')) return true;

    // Allow parent wrappers around a real honor image/background.
    if(el.querySelector?.('[class*="honor"],[class*="name"],[style*="background-image"],a[href*="profiles.php"],a[href*="XID="]')) return true;
    if(el.querySelector?.('img')){
      const imgs = [...el.querySelectorAll('img')];
      return imgs.some(img => {
        const ir = img.getBoundingClientRect?.();
        if(!ir) return false;
        return ir.width >= 70 && ir.height <= 60;
      });
    }

    return false;
  }

  function rowFor(el){
    let node = el;
    for(let i=0; i<8 && node && node !== document.body; i++, node=node.parentElement){
      if(badContainer(node)) return null;
      const r = node.getBoundingClientRect?.();
      if(!r || r.width < 190 || r.height < 18) continue;
      const t = cleanText(node);
      const hasSignals = /\bOkay\b|\bHospital\b|\bJail\b|\bTravel\b|\bAbroad\b|\bAttack\b|Level:\s*\d+|Reason:/i.test(t);
      const hasHonor = !!node.querySelector?.('[class*="honor"],[class*="name"],[style*="background-image"],a[href*="profiles.php"],a[href*="XID="]');
      if(hasHonor && (hasSignals || idNear(node))) return node;
    }
    return null;
  }

  function bestFrom(raw){
    if(!raw || badContainer(raw) || isAttackCell(raw)) return null;

    const row = rowFor(raw);
    const rowRect = row?.getBoundingClientRect?.();

    const opts = [];
    let node = raw;

    for(let i=0; i<4 && node && node !== document.body; i++, node=node.parentElement){
      if(honorShape(node)) opts.push(node);
    }

    raw.querySelectorAll?.('[class*="honor"],[class*="name"],[style*="background-image"],a[href*="profiles.php"],a[href*="XID="]').forEach(d => {
      if(honorShape(d)) opts.push(d);
    });

    if(honorShape(raw)) opts.push(raw);

    let best = null;
    let score = -999;

    for(const el of opts){
      const r = el.getBoundingClientRect();
      if(rowRect && r.left > rowRect.left + rowRect.width * 0.62) continue;

      const cls = String(el.className || '').toLowerCase();
      const st = String(el.getAttribute?.('style') || '').toLowerCase();

      let s = 0;
      if(cls.includes('honor')) s += 65;
      if(cls.includes('name')) s += 35;
      if(st.includes('background-image')) s += 45;
      if(el.matches?.('a[href*="profiles.php"],a[href*="XID="]')) s += 20;
      if(r.width >= 120) s += 18;
      if(r.height <= 45) s += 15;
      s += Math.min(45, r.width / 7);

      if(rowRect && r.left < rowRect.left + rowRect.width * 0.48) s += 15;

      // prefer the actual strip over its big parent
      if(r.height > 54) s -= 25;

      if(s > score){
        score = s;
        best = el;
      }
    }

    return best;
  }

  function visibleProfileHonor(el){
    if(!isProfilePage()) return false;
    if(!honorShape(el)) return false;
    const r = el.getBoundingClientRect();
    return r.top > 300 && r.top < innerHeight + 500;
  }

  function overlap(a, b){
    const x = Math.max(0, Math.min(a.right,b.right) - Math.max(a.left,b.left));
    const y = Math.max(0, Math.min(a.bottom,b.bottom) - Math.max(a.top,b.top));
    const area = x * y;
    const minArea = Math.min(a.width*a.height, b.width*b.height);
    return minArea ? area / minArea : 0;
  }

  function honorKey(el, id){
    const r = el.getBoundingClientRect();
    if(id) return 'id:' + id + ':' + Math.round(r.top / 5);
    return 'fallback:' + simpleHash(cleanText(el).slice(0, 60) + ':' + Math.round(r.left/10) + ':' + Math.round(r.top/10));
  }

  function candidates(){
    if(!pageCanHaveHonors()) return [];

    const raw = [...document.querySelectorAll(
      '[class*="honor"],[class*="name"],[style*="background-image"],a[href*="profiles.php"],a[href*="XID="],a[href*="user2ID"],a[href*="sid=attack"]'
    )];

    const picks = [];
    const seen = new Set();
    const profileId = currentProfileId();

    for(const item of raw){
      const mount = bestFrom(item);
      if(!mount || seen.has(mount)) continue;
      seen.add(mount);

      const r = mount.getBoundingClientRect();

      let id = idNear(mount) || idNear(item);

      // On a profile page, only allow ID fallback for a true honor bar shape, not profile pic/icons.
      if(!id && profileId && visibleProfileHonor(mount)) id = profileId;

      // Exact rule: skip if no real player ID. This prevents random N/A on headers/icons.
      if(!id) continue;

      const key = honorKey(mount, id);

      let dup = false;
      for(let i=0; i<picks.length; i++){
        const p = picks[i];
        if(overlap(r, p.rect) > 0.70 || (id && p.id === id && Math.abs(r.top - p.rect.top) < 22)){
          // Keep the shorter/wider actual strip.
          const currentQuality = (r.width / Math.max(1, r.height)) + (r.height <= 45 ? 5 : 0);
          const oldQuality = (p.rect.width / Math.max(1, p.rect.height)) + (p.rect.height <= 45 ? 5 : 0);
          if(currentQuality > oldQuality) picks[i] = {mount, rect:r, id, key};
          dup = true;
          break;
        }
      }

      if(!dup) picks.push({mount, rect:r, id, key});
    }

    return picks.slice(0, 100);
  }

  function intelFor(id){
    if(!id) return null;
    return getIntel(id) || bspIntel(id);
  }

  function cssEscape(s){
    return String(s).replace(/["\\]/g, '\\$&');
  }

  function makeBadge(key){
    let b = document.querySelector(`.absp31-badge[data-key="${cssEscape(key)}"]`);
    if(!b){
      b = document.createElement('span');
      b.className = 'absp31-badge absp31-unknown';
      b.dataset.key = key;
      b.textContent = 'N/A';
      document.body.appendChild(b);
    }
    return b;
  }

  function updateBadge(b, intel){
    const total = Number(intel?.best_total || intel?.total || 0);
    if(!total){
      b.className = 'absp31-badge absp31-unknown';
      b.textContent = 'N/A';
      b.title = 'No usable intel yet';
      return;
    }

    const adjusted = {...intel, confidence:riskConfidence(intel)};
    const d = diff(total, adjusted.label);
    b.className = `absp31-badge absp31-${d}`;
    b.textContent = fmt(total);
    b.title = `${adjusted.source || 'intel'} • ${d} • ${adjusted.confidence}% • Tap for details`;
  }

  function positionBadge(b, rect){
    const w = 50;
    const x = Math.max(2, Math.min(innerWidth - w - 2, rect.right - w - 4));
    const y = Math.max(56, Math.min(innerHeight - 20, rect.top + Math.max(1, Math.min(5, rect.height * 0.10))));
    b.style.left = x + 'px';
    b.style.top = y + 'px';
    b.style.display = 'inline-flex';
    b.style.visibility = 'visible';
  }

  function fetchIntel(id, key){
    if(!id || !state.key) return;
    const b = document.querySelector(`.absp31-badge[data-key="${cssEscape(key)}"]`);
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

  async function paint(){
    state.pending = false;
    state.lastPaint = Date.now();

    killOld();
    updateIcon();

    const found = candidates();
    const live = new Set();

    for(const h of found){
      const b = makeBadge(h.key);
      live.add(h.key);
      b.dataset.targetId = String(h.id);

      let intel = intelFor(h.id);
      if(!intel && isProfilePage()) intel = visibleIntel();
      if(intel) saveIntel(h.id, intel);

      updateBadge(b, intel);
      positionBadge(b, h.rect);

      if(!intel) fetchIntel(h.id, h.key);
    }

    document.querySelectorAll('.absp31-badge').forEach(b => {
      if(!live.has(b.dataset.key)) b.remove();
    });
  }

  function schedule(ms=450){
    if(state.pending) return;
    state.pending = true;
    clearTimeout(window.__absp31Timer);
    window.__absp31Timer = setTimeout(paint, ms);
  }

  function killOld(){
    document.querySelectorAll('.ebsf2-badge,#ebsf2-btn,#ebsf2-panel,#ebsf2-save,.ebsf2-pop,.absp-badge,.absp-hb-badge,.absp3-badge').forEach(x=>{
      x.style.display = 'none';
      x.style.visibility = 'hidden';
      x.style.pointerEvents = 'none';
    });
  }

  function isProfilePage(){
    const body = (document.body?.innerText || '').slice(0, 5000);
    if(/Members\s+Score|Status\s+Attack|Lead Target|Chain active|No active chain/i.test(body)) return false;
    return /profiles\.php/i.test(location.href) || /User Information|Actions|Medals|Awards/i.test(body);
  }

  function ownProfile(){
    if(!state.user?.user_id || !isProfilePage()) return false;
    const pid = currentProfileId();
    if(pid) return Number(pid) === Number(state.user.user_id);
    return !!(state.user?.name && String(document.title || '').toLowerCase().includes(String(state.user.name).toLowerCase()));
  }

  function initUI(){
    if(document.getElementById('absp31-main')) return;

    const btn = document.createElement('button');
    btn.id = 'absp31-main';
    btn.textContent = '🧠';
    btn.onclick = () => { state.panelOpen = !state.panelOpen; renderPanel(); };
    document.body.appendChild(btn);

    const panel = document.createElement('div');
    panel.id = 'absp31-panel';
    document.body.appendChild(panel);

    makeDraggable(btn);
    renderPanel();
  }

  function renderPanel(){
    const p = document.getElementById('absp31-panel');
    if(!p) return;

    p.className = state.panelOpen ? 'open' : '';
    p.innerHTML = `
      <h2>🧠⚔️ Advanced Battle Stat Predictor <button style="float:right" id="absp31-close">Close</button></h2>
      <div class="body">
        <div class="absp31-hero">
          <div class="absp31-hero-title">Feed the Finder</div>
          <div style="color:#cbd5e1;margin-top:4px;line-height:1.35">Exact honor-bar mode: wide, short player honor strips only. No more icons, pictures, headers, or page buttons.</div>
          <span class="absp31-chip">honor bars only</span><span class="absp31-chip">XID required</span><span class="absp31-chip">stable overlay</span>
        </div>

        <div class="absp31-card"><b>📜 Rules</b><ul><li>Use predictions as guidance, not guaranteed wins.</li><li>Do not share private spy/manual data unless you are allowed to.</li><li>Fresh intel is better. Old intel may be stale.</li><li>Respect Torn’s API rules, rate limits, and fair-use expectations.</li></ul></div>
        <div class="absp31-card"><b>⚔️ How It Works</b><p>The predictor looks for actual player honor/name bars and overlays one small badge on the bar. It skips anything without a real player/profile ID, except the current profile page’s honor strip.</p></div>
        <div class="absp31-card"><b>✅ Terms of Service</b><p>All numbers are estimates and may be wrong. You are responsible for your own attacks, choices, losses, wins, and respect gains.</p></div>
        <div class="absp31-card"><b>🔑 API Key Use & Storage</b><p>Use a <b>limited Torn API key</b>. Your key is stored locally in your browser/PDA userscript storage. No Torn password is ever requested.</p></div>

        <div class="absp31-card">
          <b>🍽️ Login</b>
          <input id="absp31-key" type="password" placeholder="Torn limited API key" value="${esc(state.key || '')}">
          <label style="display:block;margin:8px 0;color:#dbeafe"><input id="absp31-ff" type="checkbox" ${state.ff?'checked':''} style="width:auto"> Use FF/BSP visible/base intel when available</label>
          <button id="absp31-login">Login / Save</button>
          <button id="absp31-repaint">Repaint badges</button>
          <div class="absp31-status">Status: ${state.user?.name ? `${esc(state.user.name)} [${esc(state.user.user_id)}] • ${fmt(state.total)}` : 'Not logged in'}</div>
        </div>
      </div>`;

    p.querySelector('#absp31-close').onclick = () => { state.panelOpen = false; renderPanel(); };
    p.querySelector('#absp31-login').onclick = login;
    p.querySelector('#absp31-repaint').onclick = () => schedule(50);
    updateIcon();
  }

  async function login(){
    state.key = document.getElementById('absp31-key')?.value.trim() || '';
    state.ff = !!document.getElementById('absp31-ff')?.checked;
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

  function updateIcon(){
    const b = document.getElementById('absp31-main');
    if(b) b.style.display = ownProfile() ? 'block' : 'none';
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
    return `<span class="absp31-tag absp31-${color}">${esc(v || 'Unknown')}</span>`;
  }

  function popup(b){
    document.querySelectorAll('.absp31-pop').forEach(x => x.remove());

    const id = b.dataset.targetId ? Number(b.dataset.targetId) : null;
    const intel = (id && getIntel(id)) || (id && bspIntel(id)) || {total:parseNum(b.textContent), confidence:0, source:'badge'};
    const total = Number(intel?.best_total || intel?.total || 0);
    const conf = riskConfidence(intel);
    const d = diff(total, intel?.label);

    const pop = document.createElement('div');
    pop.className = 'absp31-pop';
    pop.innerHTML = `
      <div class="absp31-pop-head"><b>⚔️ Battle Intel</b><button class="close">×</button></div>
      <div class="absp31-pop-body">
        <div><b>Total:</b> ${total ? fmt(total) : 'N/A'} ${tag(total ? d : 'Unknown')}</div>
        <div><b>Source:</b> ${esc(intel?.source || 'none')}</div>
        <div><b>Confidence:</b> ${tag(conf, 'conf')}</div>
        ${total && state.total && total / state.total >= 2.5 ? `<div style="margin-top:7px;padding:6px;border-radius:8px;background:#431407;color:#fdba74;border:1px solid #f97316;font-weight:900">Confidence reduced: high stat gap</div>` : ''}
        <hr>
        <div class="absp31-grid">
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
    const b = e.target.closest?.('.absp31-badge');
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
    const id = idNear(el);
    if(id) GM_setValue('absp_last_attack_target', JSON.stringify({id, ts:Date.now()}));
  }, true);

  function boot(){
    initUI();
    killOld();
    updateIcon();

    [300, 900, 1800, 3500, 6500].forEach(t => setTimeout(() => schedule(50), t));

    try{
      const obs = new MutationObserver(() => schedule(700));
      obs.observe(document.body, {childList:true, subtree:true});
    }catch {}

    window.addEventListener('scroll', () => schedule(80), {passive:true});
    window.addEventListener('resize', () => schedule(120), {passive:true});

    let last = location.href;
    setInterval(() => {
      if(location.href !== last){
        last = location.href;
        schedule(400);
      } else {
        killOld();
        updateIcon();
        if(Date.now() - state.lastPaint > 2600) schedule(80);
      }
    }, 2400);
  }

  boot();
})();
