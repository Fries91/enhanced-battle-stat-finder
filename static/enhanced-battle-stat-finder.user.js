// ==UserScript==
// @name         Torn Stat Predictor - Auto BSP Style
// @namespace    Fries91.Torn.StatPredictor.AutoBSP
// @version      2.5.0
// @description  Auto-learns visible enemy stat estimates and shows BSP-style prediction badges beside player names.
// @author       Fries91
// @match        https://www.torn.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      api.torn.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const VERSION = '2.5.0';

  const STORE = {
    myStats: 'fries_auto_sp_my_effective_stats',
    enemyStats: 'fries_auto_sp_enemy_stats',
    lastApiPull: 'fries_auto_sp_last_api_pull',
    panelOpen: 'fries_auto_sp_panel_open'
  };

  const BADGE_CLASS = 'fries-auto-sp-badge';
  const MOUNTED_ATTR = 'data-fries-auto-sp-mounted';

  GM_addStyle(`
    .${BADGE_CLASS} {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      margin-left: 5px !important;
      padding: 1px 6px !important;
      min-height: 14px !important;
      border-radius: 4px !important;
      font-size: 10px !important;
      line-height: 14px !important;
      font-weight: 900 !important;
      font-family: Arial, Helvetica, sans-serif !important;
      vertical-align: middle !important;
      border: 1px solid rgba(255,255,255,.16) !important;
      box-shadow: 0 1px 2px rgba(0,0,0,.35) !important;
      white-space: nowrap !important;
      text-decoration: none !important;
      cursor: help !important;
    }

    .${BADGE_CLASS}.easy {
      background: #064e3b !important;
      color: #d1fae5 !important;
      border-color: #10b981 !important;
    }

    .${BADGE_CLASS}.fair {
      background: #1e3a8a !important;
      color: #dbeafe !important;
      border-color: #60a5fa !important;
    }

    .${BADGE_CLASS}.good {
      background: #713f12 !important;
      color: #fef3c7 !important;
      border-color: #facc15 !important;
    }

    .${BADGE_CLASS}.hard {
      background: #7c2d12 !important;
      color: #ffedd5 !important;
      border-color: #fb923c !important;
    }

    .${BADGE_CLASS}.avoid {
      background: #7f1d1d !important;
      color: #fee2e2 !important;
      border-color: #ef4444 !important;
    }

    .${BADGE_CLASS}.unknown {
      background: #111827 !important;
      color: #e5e7eb !important;
      border-color: #6b7280 !important;
    }

    #fries-auto-sp-toggle {
      position: fixed;
      left: 10px;
      bottom: 76px;
      z-index: 999999;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: #0b0f17;
      color: #facc15;
      border: 1px solid rgba(250,204,21,.6);
      box-shadow: 0 8px 24px rgba(0,0,0,.45);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 17px;
      cursor: pointer;
      user-select: none;
    }

    #fries-auto-sp-panel {
      position: fixed;
      left: 10px;
      bottom: 116px;
      z-index: 999999;
      width: min(340px, calc(100vw - 20px));
      background: #0b0f17;
      color: #f9fafb;
      border: 1px solid rgba(250,204,21,.45);
      border-radius: 14px;
      box-shadow: 0 16px 44px rgba(0,0,0,.55);
      font-family: Arial, Helvetica, sans-serif;
      display: none;
      overflow: hidden;
    }

    #fries-auto-sp-panel.open {
      display: block;
    }

    .fries-auto-sp-head {
      padding: 11px 12px;
      background: linear-gradient(135deg, #111827, #171717);
      border-bottom: 1px solid rgba(250,204,21,.25);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .fries-auto-sp-title {
      font-size: 13px;
      font-weight: 900;
      color: #facc15;
    }

    .fries-auto-sp-sub {
      font-size: 10px;
      color: #9ca3af;
      margin-top: 2px;
    }

    .fries-auto-sp-close {
      border: 1px solid rgba(255,255,255,.14);
      background: #1f2937;
      color: #f9fafb;
      border-radius: 8px;
      padding: 4px 8px;
      cursor: pointer;
      font-weight: 900;
    }

    .fries-auto-sp-body {
      padding: 10px;
    }

    .fries-auto-sp-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 7px;
    }

    .fries-auto-sp-pill {
      background: #030712;
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 10px;
      padding: 8px 5px;
      text-align: center;
    }

    .fries-auto-sp-pill strong {
      display: block;
      color: #facc15;
      font-size: 13px;
    }

    .fries-auto-sp-pill span {
      display: block;
      color: #9ca3af;
      font-size: 9px;
      margin-top: 2px;
    }

    .fries-auto-sp-help {
      margin-top: 9px;
      background: rgba(17,24,39,.85);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 10px;
      padding: 8px;
      color: #d1d5db;
      font-size: 11px;
      line-height: 1.35;
    }

    .fries-auto-sp-btn {
      margin-top: 8px;
      width: 100%;
      border: 1px solid rgba(250,204,21,.4);
      background: #171717;
      color: #facc15;
      border-radius: 9px;
      padding: 8px;
      font-weight: 900;
      font-size: 12px;
      cursor: pointer;
    }
  `);

  function getVal(key, fallback) {
    try {
      const v = GM_getValue(key);
      return v === undefined ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function setVal(key, value) {
    try {
      GM_setValue(key, value);
    } catch (e) {}
  }

  function parseNum(value) {
    if (value === null || value === undefined) return 0;

    let text = String(value).trim().toLowerCase();

    let mult = 1;
    if (text.includes('b')) mult = 1000000000;
    else if (text.includes('m')) mult = 1000000;
    else if (text.includes('k')) mult = 1000;

    text = text.replace(/[^\d.]/g, '');
    const n = Number(text) || 0;

    return Math.round(n * mult);
  }

  function fmt(n) {
    n = Number(n || 0);
    if (!n) return '0';
    return n.toLocaleString();
  }

  function short(n) {
    n = Number(n || 0);
    if (n >= 1000000000) return `${(n / 1000000000).toFixed(1)}B`;
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n || 0);
  }

  function cleanName(text) {
    return String(text || '')
      .replace(/\[[^\]]+\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getXid(link) {
    if (!link || !link.href) return null;

    const a = link.href.match(/[?&]XID=(\d+)/i);
    if (a) return a[1];

    const b = link.href.match(/profiles\.php.*?(\d{4,})/i);
    if (b) return b[1];

    return null;
  }

  function loadEnemies() {
    const data = getVal(STORE.enemyStats, {});
    return data && typeof data === 'object' ? data : {};
  }

  function saveEnemies(data) {
    setVal(STORE.enemyStats, data || {});
  }

  function getMyStats() {
    return Number(getVal(STORE.myStats, 0)) || 0;
  }

  function saveMyStats(total) {
    total = Number(total || 0);
    if (total > 0) setVal(STORE.myStats, total);
  }

  function classify(enemyStats, myStats) {
    enemyStats = Number(enemyStats || 0);
    myStats = Number(myStats || 0);

    if (!enemyStats || !myStats) {
      return {
        tier: 'unknown',
        label: '?',
        ratio: 0
      };
    }

    const ratio = enemyStats / myStats;

    if (ratio <= 0.90) return { tier: 'easy', label: 'Easy', ratio };
    if (ratio <= 1.10) return { tier: 'fair', label: 'Fair', ratio };
    if (ratio <= 1.25) return { tier: 'good', label: 'Good', ratio };
    if (ratio <= 1.50) return { tier: 'hard', label: 'Hard', ratio };

    return { tier: 'avoid', label: 'Avoid', ratio };
  }

  function findExistingApiKey() {
    const possibleKeys = [
      'fries_api_key',
      'friesApiKey',
      'FRIES_API_KEY',
      'torn_api_key',
      'tornApiKey',
      'TornApiKey',
      'apiKey',
      'API_KEY',
      'yata_api_key',
      'bsp_api_key',
      'ffscout_api_key',
      'fries-war-hub-api-key',
      'fries_torn_key',
      'fries_limited_key'
    ];

    for (const key of possibleKeys) {
      try {
        const gm = GM_getValue(key);
        if (looksLikeApiKey(gm)) return String(gm).trim();
      } catch (e) {}

      try {
        const ls = localStorage.getItem(key);
        if (looksLikeApiKey(ls)) return String(ls).trim();
      } catch (e) {}

      try {
        const ss = sessionStorage.getItem(key);
        if (looksLikeApiKey(ss)) return String(ss).trim();
      } catch (e) {}
    }

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const v = localStorage.getItem(k);

        if (/api|key|torn/i.test(k) && looksLikeApiKey(v)) {
          return String(v).trim();
        }
      }
    } catch (e) {}

    return '';
  }

  function looksLikeApiKey(value) {
    if (!value) return false;
    const s = String(value).trim();
    return /^[A-Za-z0-9]{12,32}$/.test(s);
  }

  function autoPullMyStatsFromTornApi() {
    const last = Number(getVal(STORE.lastApiPull, 0)) || 0;
    const now = Date.now();

    if (now - last < 1000 * 60 * 20) return;

    const key = findExistingApiKey();
    if (!key) return;

    setVal(STORE.lastApiPull, now);

    GM_xmlhttpRequest({
      method: 'GET',
      url: `https://api.torn.com/user/?selections=battlestats&key=${encodeURIComponent(key)}`,
      timeout: 15000,
      onload: function (res) {
        try {
          const data = JSON.parse(res.responseText || '{}');

          if (data.error) return;

          const str = Number(data.strength || 0);
          const def = Number(data.defense || data.defence || 0);
          const spd = Number(data.speed || 0);
          const dex = Number(data.dexterity || 0);

          const total = str + def + spd + dex;

          if (total > 0) {
            saveMyStats(total);
            rescanAll();
          }
        } catch (e) {}
      }
    });
  }

  function autoReadMyStatsFromVisiblePage() {
    const body = document.body ? document.body.innerText || '' : '';
    if (!body) return;

    const strength = matchStat(body, /strength\s*[:\s]+([\d,.]+[kmb]?)/i);
    const defense = matchStat(body, /defen[cs]e\s*[:\s]+([\d,.]+[kmb]?)/i);
    const speed = matchStat(body, /speed\s*[:\s]+([\d,.]+[kmb]?)/i);
    const dexterity = matchStat(body, /dexterity\s*[:\s]+([\d,.]+[kmb]?)/i);

    const total = strength + defense + speed + dexterity;

    if (total > 0) {
      saveMyStats(total);
    }
  }

  function matchStat(text, regex) {
    const m = text.match(regex);
    if (!m || !m[1]) return 0;
    return parseNum(m[1]);
  }

  function isUsefulArea(link) {
    return !!link.closest(`
      tr,
      li,
      [class*="member"],
      [class*="Member"],
      [class*="enemy"],
      [class*="Enemy"],
      [class*="war"],
      [class*="War"],
      [class*="faction"],
      [class*="Faction"],
      [class*="user"],
      [class*="User"],
      [class*="table"],
      [class*="Table"],
      [class*="row"],
      [class*="Row"],
      [class*="profile"],
      [class*="Profile"]
    `);
  }

  function shouldSkipLink(link) {
    if (!link) return true;
    if (link.getAttribute(MOUNTED_ATTR) === '1') return true;
    if (!link.href || !link.href.includes('profiles.php')) return true;
    if (!getXid(link)) return true;

    const name = cleanName(link.textContent);
    if (!name || name.length < 2) return true;

    const bad = link.closest(`
      #top-page-links-list,
      .top_header,
      .header-wrapper,
      .menu,
      .sidebar,
      .chat-box,
      .chat-box-wrap,
      [class*="chat"],
      [class*="Chat"],
      [class*="header"],
      [class*="Header"]
    `);

    if (bad) return true;
    if (!isUsefulArea(link)) return true;

    return false;
  }

  function findRow(link) {
    return link.closest(`
      tr,
      li,
      [class*="member"],
      [class*="Member"],
      [class*="enemy"],
      [class*="Enemy"],
      [class*="war"],
      [class*="War"],
      [class*="faction"],
      [class*="Faction"],
      [class*="user"],
      [class*="User"],
      [class*="table"],
      [class*="Table"],
      [class*="row"],
      [class*="Row"]
    `);
  }

  function findVisibleEnemyEstimate(link) {
    const row = findRow(link);
    if (!row) return null;

    const text = row.innerText || row.textContent || '';
    const html = row.innerHTML || '';

    const sources = [
      { name: 'BSP', regex: /(?:bsp|battle\s*stat\s*predictor)[^\d]{0,40}([\d,.]+[kmb]?)/i },
      { name: 'FFS', regex: /(?:ffs|fair\s*fight\s*scout)[^\d]{0,40}([\d,.]+[kmb]?)/i },
      { name: 'YATA', regex: /(?:yata)[^\d]{0,40}([\d,.]+[kmb]?)/i },
      { name: 'Estimated Stats', regex: /estimated\s*stats?[^\d]{0,40}([\d,.]+[kmb]?)/i },
      { name: 'Est Stats', regex: /est\.?\s*stats?[^\d]{0,40}([\d,.]+[kmb]?)/i },
      { name: 'Battle Stats', regex: /battle\s*stats?[^\d]{0,40}([\d,.]+[kmb]?)/i },
      { name: 'Total Stats', regex: /total\s*stats?[^\d]{0,40}([\d,.]+[kmb]?)/i },
      { name: 'Stats', regex: /stats?[^\d]{0,20}([\d,.]+[kmb]?)/i }
    ];

    for (const source of sources) {
      const m = text.match(source.regex) || html.match(source.regex);
      if (m && m[1]) {
        const n = parseNum(m[1]);
        if (n >= 1000) {
          return {
            estimatedStats: n,
            source: source.name
          };
        }
      }
    }

    const dataEstimate = findDataEstimate(row);
    if (dataEstimate) return dataEstimate;

    const clean = text.replace(/\blevel\b\s*\d+/gi, '');
    const bigNumbers = clean.match(/(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?[kmb])/gi) || [];

    const candidates = bigNumbers
      .map(parseNum)
      .filter(n => n >= 100000)
      .sort((a, b) => b - a);

    if (candidates.length) {
      return {
        estimatedStats: candidates[0],
        source: 'Visible row'
      };
    }

    return null;
  }

  function findDataEstimate(root) {
    const nodes = root.querySelectorAll('*');

    for (const node of nodes) {
      for (const attr of node.attributes || []) {
        const name = attr.name || '';
        const value = attr.value || '';

        if (/stat|bsp|yata|ffs|estimate/i.test(name + ' ' + value)) {
          const n = parseNum(value);
          if (n >= 1000) {
            return {
              estimatedStats: n,
              source: 'Data attribute'
            };
          }
        }
      }
    }

    return null;
  }

  function learnEnemyFromLink(link) {
    const xid = getXid(link);
    const name = cleanName(link.textContent);

    if (!xid || !name) return null;

    const enemies = loadEnemies();

    const visible = findVisibleEnemyEstimate(link);

    if (visible && visible.estimatedStats) {
      enemies[xid] = {
        xid,
        name,
        estimatedStats: visible.estimatedStats,
        source: visible.source,
        updatedAt: new Date().toLocaleString()
      };

      saveEnemies(enemies);
      return enemies[xid];
    }

    if (enemies[xid]) {
      return enemies[xid];
    }

    return {
      xid,
      name,
      estimatedStats: 0,
      source: 'Waiting for visible BSP/FFS/YATA data',
      updatedAt: ''
    };
  }

  function makeBadge(info) {
    const myStats = getMyStats();
    const result = classify(info.estimatedStats, myStats);

    const badge = document.createElement('span');
    badge.className = `${BADGE_CLASS} ${result.tier}`;
    badge.textContent = result.label;
    badge.dataset.xid = info.xid;

    const title = [
      'Fries91 Auto Stat Predictor',
      `Player: ${info.name}`,
      `XID: ${info.xid}`,
      `Enemy estimate: ${info.estimatedStats ? fmt(info.estimatedStats) : 'unknown'}`,
      `Your stats: ${myStats ? fmt(myStats) : 'auto-detecting'}`,
      result.ratio ? `Enemy compared to you: ${(result.ratio * 100).toFixed(1)}%` : '',
      `Source: ${info.source || 'Unknown'}`,
      info.updatedAt ? `Updated: ${info.updatedAt}` : ''
    ].filter(Boolean).join('\n');

    badge.title = title;

    return badge;
  }

  function mountBadge(link) {
    if (shouldSkipLink(link)) return;

    const info = learnEnemyFromLink(link);
    if (!info) return;

    const badge = makeBadge(info);

    link.setAttribute(MOUNTED_ATTR, '1');

    const next = link.nextElementSibling;
    if (next && next.classList && next.classList.contains(BADGE_CLASS)) {
      next.remove();
    }

    link.insertAdjacentElement('afterend', badge);
  }

  function scanNames() {
    const links = document.querySelectorAll('a[href*="profiles.php"]');

    for (const link of links) {
      mountBadge(link);
    }

    updatePanel();
  }

  function clearBadges() {
    document.querySelectorAll(`[${MOUNTED_ATTR}="1"]`).forEach(link => {
      link.removeAttribute(MOUNTED_ATTR);
    });

    document.querySelectorAll(`.${BADGE_CLASS}`).forEach(badge => {
      badge.remove();
    });
  }

  function rescanAll() {
    clearBadges();
    scanNames();
  }

  let scanTimer = null;

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanNames, 180);
  }

  function createPanel() {
    if (document.querySelector('#fries-auto-sp-toggle')) return;

    const toggle = document.createElement('div');
    toggle.id = 'fries-auto-sp-toggle';
    toggle.textContent = '📊';
    toggle.title = 'Fries91 Auto Stat Predictor';

    const panel = document.createElement('div');
    panel.id = 'fries-auto-sp-panel';

    if (getVal(STORE.panelOpen, false)) {
      panel.classList.add('open');
    }

    panel.innerHTML = `
      <div class="fries-auto-sp-head">
        <div>
          <div class="fries-auto-sp-title">📊 Auto Stat Predictor</div>
          <div class="fries-auto-sp-sub">BSP-style auto badges • v${VERSION}</div>
        </div>
        <button class="fries-auto-sp-close" type="button">×</button>
      </div>

      <div class="fries-auto-sp-body">
        <div class="fries-auto-sp-grid">
          <div class="fries-auto-sp-pill">
            <strong id="fries-auto-sp-my">0</strong>
            <span>My Stats</span>
          </div>
          <div class="fries-auto-sp-pill">
            <strong id="fries-auto-sp-enemies">0</strong>
            <span>Learned</span>
          </div>
          <div class="fries-auto-sp-pill">
            <strong id="fries-auto-sp-badges">0</strong>
            <span>Badges</span>
          </div>
        </div>

        <button class="fries-auto-sp-btn" id="fries-auto-sp-rescan" type="button">Rescan Now</button>

        <div class="fries-auto-sp-help">
          Fully automatic. It reads your saved Torn API key if one already exists, pulls your battle stats from Torn, then learns enemy estimates from visible BSP / FFS / YATA-style rows. No manual imports needed.
          <br><br>
          If a badge shows <b>?</b>, it means the enemy stat estimate is not visible yet.
        </div>
      </div>
    `;

    document.body.appendChild(toggle);
    document.body.appendChild(panel);

    toggle.addEventListener('click', () => {
      panel.classList.toggle('open');
      setVal(STORE.panelOpen, panel.classList.contains('open'));
      updatePanel();
    });

    panel.querySelector('.fries-auto-sp-close').addEventListener('click', () => {
      panel.classList.remove('open');
      setVal(STORE.panelOpen, false);
    });

    panel.querySelector('#fries-auto-sp-rescan').addEventListener('click', () => {
      autoReadMyStatsFromVisiblePage();
      autoPullMyStatsFromTornApi();
      rescanAll();
    });

    updatePanel();
  }

  function updatePanel() {
    const my = document.querySelector('#fries-auto-sp-my');
    const enemies = document.querySelector('#fries-auto-sp-enemies');
    const badges = document.querySelector('#fries-auto-sp-badges');

    if (my) my.textContent = short(getMyStats());
    if (enemies) enemies.textContent = String(Object.keys(loadEnemies()).length);
    if (badges) badges.textContent = String(document.querySelectorAll(`.${BADGE_CLASS}`).length);
  }

  function startObserver() {
    const observer = new MutationObserver(() => {
      scheduleScan();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setInterval(() => {
      autoReadMyStatsFromVisiblePage();
      autoPullMyStatsFromTornApi();
      scanNames();
    }, 3500);
  }

  function start() {
    createPanel();
    autoReadMyStatsFromVisiblePage();
    autoPullMyStatsFromTornApi();
    scanNames();
    startObserver();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
