import os, time, json, sqlite3, requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

APP_NAME = "Advanced Battle Stat Predictor v3.3.2 Per-Stat Shared Learning"
DB_PATH = os.environ.get("DB_PATH", "data/enhanced_battle_stats.db")
ADMIN_USER_IDS = {x.strip() for x in os.environ.get("ADMIN_USER_IDS", "3679030").split(",") if x.strip()}
FF_SCOUTER_API_BASE = os.environ.get("FF_SCOUTER_API_BASE", "https://ffscouter.com").rstrip("/")

app = Flask(__name__, static_folder="static")
CORS(app)

def now_ts():
    return int(time.time())

def clean_num(v):
    if v is None:
        return 0
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().lower().replace(",", "")
    mult = 1
    if s.endswith("k"):
        mult, s = 1_000, s[:-1]
    elif s.endswith("m"):
        mult, s = 1_000_000, s[:-1]
    elif s.endswith("b"):
        mult, s = 1_000_000_000, s[:-1]
    elif s.endswith("t"):
        mult, s = 1_000_000_000_000, s[:-1]
    try:
        return float(s) * mult
    except Exception:
        return 0

def ensure_col(con, table, name, ddl):
    cols = {r[1] for r in con.execute(f"PRAGMA table_info({table})").fetchall()}
    if name not in cols:
        con.execute(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")

def ensure_db():
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    with sqlite3.connect(DB_PATH) as con:
        con.row_factory = sqlite3.Row
        con.execute("""
        CREATE TABLE IF NOT EXISTS users (
          user_id INTEGER PRIMARY KEY,
          name TEXT,
          faction_id INTEGER,
          faction_name TEXT,
          total REAL,
          str_stat REAL,
          def_stat REAL,
          spd_stat REAL,
          dex_stat REAL,
          updated_at INTEGER
        )""")
        con.execute("""
        CREATE TABLE IF NOT EXISTS enemy_stats (
          user_id INTEGER PRIMARY KEY,
          name TEXT,
          faction_id INTEGER,
          total REAL,
          range_low REAL,
          range_high REAL,
          label TEXT,
          confidence REAL,
          source TEXT,
          source_detail TEXT,
          updated_at INTEGER
        )""")
        for col in [
            ("str_low","REAL"),("str_high","REAL"),("def_low","REAL"),("def_high","REAL"),
            ("spd_low","REAL"),("spd_high","REAL"),("dex_low","REAL"),("dex_high","REAL"),
            ("armor_seen","TEXT"),("armor_detail","TEXT"),("temp_used_often","TEXT"),("temp_detail","TEXT"),
            ("stat_style","TEXT")
        ]:
            ensure_col(con, "enemy_stats", col[0], col[1])
        con.execute("""
        CREATE TABLE IF NOT EXISTS attack_learning (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          attacker_id INTEGER,
          attacker_name TEXT,
          attacker_total REAL,
          target_id INTEGER,
          target_name TEXT,
          result TEXT,
          fight_meta TEXT,
          created_at INTEGER
        )""")
        con.execute("""
        CREATE TABLE IF NOT EXISTS external_estimates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          target_id INTEGER,
          target_name TEXT,
          target_faction_id INTEGER,
          estimate_total REAL,
          source TEXT,
          source_detail TEXT,
          confidence REAL,
          created_at INTEGER
        )""")
ensure_db()

SOURCE_PRIORITY = {
    "manual": 95,
    "spy": 95,
    "style_feed": 76,
    "ffscouter": 70,
    "visible_ff_bsp": 68,
    "bsp_cache": 66,
    "fight_learning": 44,
}

def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con

def user_label(total, your_total):
    total = clean_num(total)
    your_total = clean_num(your_total)
    if not total or not your_total:
        return "Unknown"
    r = total / your_total
    if r <= .75:
        return "Easy"
    if r <= 1.15:
        return "Fair"
    if r <= 1.35:
        return "Good"
    if r <= 1.75:
        return "Difficult"
    return "Avoid"

def risk_adjust_confidence(total, your_total, confidence, source):
    total = float(total or 0)
    your_total = float(your_total or 0)
    confidence = float(confidence or 0)
    if not total or not your_total:
        return confidence or 0
    src = str(source or "").lower()
    exact = ("spy" in src) or ("manual" in src) or ("exact" in src)
    ratio = total / your_total
    if exact:
        if ratio >= 10:
            confidence = min(confidence or 75, 75)
        elif ratio >= 5:
            confidence = min(confidence or 80, 80)
        return max(1, min(100, round(confidence)))
    if ratio >= 20:
        cap = 18
    elif ratio >= 10:
        cap = 25
    elif ratio >= 5:
        cap = 35
    elif ratio >= 2.5:
        cap = 45
    elif ratio >= 1.75:
        cap = 55
    elif ratio >= 1.15:
        cap = 65
    else:
        cap = 78
    return max(1, min(100, round(min(confidence or cap, cap))))

def normalize(row, your_total=0):
    if not row:
        return None
    d = dict(row)
    total = d.get("total") or d.get("estimate_total") or 0
    label = d.get("label") or user_label(total, your_total)
    out = {
        "user_id": int(d.get("user_id") or d.get("target_id") or 0),
        "name": d.get("name") or d.get("target_name") or "",
        "faction_id": d.get("faction_id") or d.get("target_faction_id"),
        "total": round(float(total or 0)),
        "best_total": round(float(total or 0)),
        "range_low": round(float(d.get("range_low") or (float(total or 0) * .88))),
        "range_high": round(float(d.get("range_high") or (float(total or 0) * 1.12))),
        "label": label,
        "confidence": risk_adjust_confidence(total, your_total, d.get("confidence") or 0, d.get("source") or ""),
        "source": d.get("source") or "none",
        "source_detail": d.get("source_detail") or "",
        "updated_at": d.get("updated_at") or d.get("created_at") or 0,
        "armor_seen": d.get("armor_seen") or "",
        "armor_detail": d.get("armor_detail") or "",
        "temp_used_often": d.get("temp_used_often") or "",
        "temp_detail": d.get("temp_detail") or "",
        "stat_style": d.get("stat_style") or "",
    }
    for k in ["str","def","spd","dex"]:
        out[f"{k}_low"] = round(float(d.get(f"{k}_low") or 0))
        out[f"{k}_high"] = round(float(d.get(f"{k}_high") or 0))
    # Also expose long names for older UI code.
    out["strength_low"], out["strength_high"] = out["str_low"], out["str_high"]
    out["defense_low"], out["defense_high"] = out["def_low"], out["def_high"]
    out["speed_low"], out["speed_high"] = out["spd_low"], out["spd_high"]
    out["dexterity_low"], out["dexterity_high"] = out["dex_low"], out["dex_high"]
    return out

def style_ranges(total_low, total_high, style):
    style = str(style or "").lower()
    if style == "def_tank":
        shares = {"str":(.12,.30), "def":(.38,.66), "spd":(.08,.25), "dex":(.03,.18)}
    elif style == "dex_tank":
        shares = {"str":(.08,.28), "def":(.05,.24), "spd":(.12,.34), "dex":(.34,.62)}
    elif style == "speed_tank":
        shares = {"str":(.08,.28), "def":(.05,.24), "spd":(.34,.62), "dex":(.12,.34)}
    else:
        shares = {"str":(.15,.35), "def":(.15,.35), "spd":(.15,.35), "dex":(.15,.35)}
    out = {}
    for k,(lo,hi) in shares.items():
        out[f"{k}_low"] = total_low * lo
        out[f"{k}_high"] = total_high * hi
    return out

def ranges_from_fight(total_low, total_high, attacker_stats=None):
    # Start broad, then bias by the attacker's own stat distribution if available.
    stats = attacker_stats or {}
    vals = {
        "str": clean_num(stats.get("strength") or stats.get("str") or 0),
        "def": clean_num(stats.get("defense") or stats.get("def") or 0),
        "spd": clean_num(stats.get("speed") or stats.get("spd") or 0),
        "dex": clean_num(stats.get("dexterity") or stats.get("dex") or 0),
    }
    s = sum(vals.values())
    if s <= 0:
        return style_ranges(total_low, total_high, "balanced")
    out = {}
    for k,v in vals.items():
        share = max(.04, min(.75, v / s))
        out[f"{k}_low"] = total_low * max(.03, share * .45)
        out[f"{k}_high"] = total_high * min(.80, share * 1.85)
    return out

def merge_range(old_low, old_high, new_low, new_high, old_conf, new_conf):
    old_low, old_high, new_low, new_high = map(lambda x: float(x or 0), [old_low, old_high, new_low, new_high])
    if not new_low and not new_high:
        return old_low, old_high
    if not old_low and not old_high:
        return new_low, new_high
    # If ranges overlap, narrow by intersection. If not, weighted average.
    lo, hi = max(old_low, new_low), min(old_high, new_high)
    if lo and hi and lo < hi:
        return lo, hi
    w_old = max(1, float(old_conf or 1))
    w_new = max(1, float(new_conf or 1))
    return ((old_low*w_old + new_low*w_new)/(w_old+w_new), (old_high*w_old + new_high*w_new)/(w_old+w_new))

def store_enemy(user_id, name, total, your_total=0, faction_id=None, confidence=50, source="manual", detail="", stat_ranges=None, armor_seen=None, temp_used_often=None, stat_style=None):
    user_id = int(user_id or 0)
    total = clean_num(total)
    if not user_id or not total:
        return None
    label = user_label(total, your_total)
    ts = now_ts()
    low, high = total * .88, total * 1.12
    stat_ranges = stat_ranges or {}
    if stat_style and not any(stat_ranges.get(x) for x in ["str_low","def_low","spd_low","dex_low"]):
        stat_ranges = style_ranges(low, high, stat_style)
    with db() as con:
        old = con.execute("SELECT * FROM enemy_stats WHERE user_id=?", (user_id,)).fetchone()
        old_conf = float(old["confidence"] or 0) if old else 0
        old_source = old["source"] if old else ""
        old_priority = SOURCE_PRIORITY.get(old_source, old_conf)
        new_priority = SOURCE_PRIORITY.get(source, confidence)
        write = new_priority >= old_priority or old_conf < 45
        if old:
            # Keep useful old armor/temp/style unless new ones were provided.
            armor_seen = armor_seen or old["armor_seen"]
            temp_used_often = temp_used_often or old["temp_used_often"]
            stat_style = stat_style or old["stat_style"]
            for k in ["str","def","spd","dex"]:
                nl, nh = stat_ranges.get(f"{k}_low"), stat_ranges.get(f"{k}_high")
                ol, oh = old[f"{k}_low"], old[f"{k}_high"]
                ml, mh = merge_range(ol, oh, nl, nh, old_conf, confidence)
                stat_ranges[f"{k}_low"], stat_ranges[f"{k}_high"] = ml, mh
        if write or any(stat_ranges.get(f"{k}_low") for k in ["str","def","spd","dex"]) or armor_seen or temp_used_often or stat_style:
            con.execute("""
            INSERT INTO enemy_stats
            (user_id,name,faction_id,total,range_low,range_high,label,confidence,source,source_detail,updated_at,
             str_low,str_high,def_low,def_high,spd_low,spd_high,dex_low,dex_high,armor_seen,temp_used_often,stat_style)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(user_id) DO UPDATE SET
              name=COALESCE(excluded.name, enemy_stats.name),
              faction_id=COALESCE(excluded.faction_id, enemy_stats.faction_id),
              total=CASE WHEN excluded.confidence >= enemy_stats.confidence OR enemy_stats.confidence < 45 THEN excluded.total ELSE enemy_stats.total END,
              range_low=CASE WHEN excluded.confidence >= enemy_stats.confidence OR enemy_stats.confidence < 45 THEN excluded.range_low ELSE enemy_stats.range_low END,
              range_high=CASE WHEN excluded.confidence >= enemy_stats.confidence OR enemy_stats.confidence < 45 THEN excluded.range_high ELSE enemy_stats.range_high END,
              label=excluded.label,
              confidence=MAX(enemy_stats.confidence, excluded.confidence),
              source=CASE WHEN excluded.confidence >= enemy_stats.confidence OR enemy_stats.confidence < 45 THEN excluded.source ELSE enemy_stats.source END,
              source_detail=excluded.source_detail,
              updated_at=excluded.updated_at,
              str_low=COALESCE(excluded.str_low, enemy_stats.str_low),
              str_high=COALESCE(excluded.str_high, enemy_stats.str_high),
              def_low=COALESCE(excluded.def_low, enemy_stats.def_low),
              def_high=COALESCE(excluded.def_high, enemy_stats.def_high),
              spd_low=COALESCE(excluded.spd_low, enemy_stats.spd_low),
              spd_high=COALESCE(excluded.spd_high, enemy_stats.spd_high),
              dex_low=COALESCE(excluded.dex_low, enemy_stats.dex_low),
              dex_high=COALESCE(excluded.dex_high, enemy_stats.dex_high),
              armor_seen=COALESCE(excluded.armor_seen, enemy_stats.armor_seen),
              temp_used_often=COALESCE(excluded.temp_used_often, enemy_stats.temp_used_often),
              stat_style=COALESCE(excluded.stat_style, enemy_stats.stat_style)
            """, (
                user_id, name, faction_id, total, low, high, label, confidence, source, detail, ts,
                stat_ranges.get("str_low"), stat_ranges.get("str_high"), stat_ranges.get("def_low"), stat_ranges.get("def_high"),
                stat_ranges.get("spd_low"), stat_ranges.get("spd_high"), stat_ranges.get("dex_low"), stat_ranges.get("dex_high"),
                armor_seen, temp_used_often, stat_style
            ))
        row = con.execute("SELECT * FROM enemy_stats WHERE user_id=?", (user_id,)).fetchone()
    return normalize(row, your_total)

def torn_get(api_key, selection):
    url = f"https://api.torn.com/user/?selections={selection}&key={api_key}"
    r = requests.get(url, timeout=20, headers={"User-Agent": APP_NAME})
    data = r.json()
    if "error" in data:
        raise RuntimeError(data["error"])
    return data

@app.get("/")
def index():
    return jsonify({"ok": True, "app": APP_NAME})

@app.get("/static/<path:path>")
def static_file(path):
    return send_from_directory("static", path)

@app.post("/api/login")
def login():
    body = request.get_json(force=True)
    key = (body.get("api_key") or "").strip()
    if not key:
        return jsonify({"ok": False, "error": "Missing api_key"}), 400
    try:
        data = torn_get(key, "profile,battlestats")
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    uid = int(data.get("player_id") or data.get("user_id") or 0)
    name = data.get("name") or ""
    faction = data.get("faction") or {}
    fid = faction.get("faction_id") or faction.get("id") or data.get("faction_id")
    fname = faction.get("faction_name") or faction.get("name") or ""
    stats = {k: clean_num(data.get(k)) for k in ["strength","defense","speed","dexterity"]}
    total = sum(stats.values())
    with db() as con:
        con.execute("""
        INSERT INTO users(user_id,name,faction_id,faction_name,total,str_stat,def_stat,spd_stat,dex_stat,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(user_id) DO UPDATE SET
          name=excluded.name,faction_id=excluded.faction_id,faction_name=excluded.faction_name,total=excluded.total,
          str_stat=excluded.str_stat,def_stat=excluded.def_stat,spd_stat=excluded.spd_stat,dex_stat=excluded.dex_stat,updated_at=excluded.updated_at
        """, (uid,name,fid,fname,total,stats["strength"],stats["defense"],stats["speed"],stats["dexterity"],now_ts()))
    return jsonify({"ok": True, "user": {"user_id": uid, "name": name, "faction_id": fid, "faction_name": fname}, "stats": {"total": round(total), **{k: round(v) for k,v in stats.items()}}})

@app.get("/api/player/<int:target_id>/intel")
def player_intel(target_id):
    your_total = clean_num(request.args.get("your_total"))
    with db() as con:
        row = con.execute("SELECT * FROM enemy_stats WHERE user_id=?", (target_id,)).fetchone()
        learning = con.execute("SELECT * FROM attack_learning WHERE target_id=? ORDER BY created_at DESC LIMIT 10", (target_id,)).fetchall()
    return jsonify({"ok": True, "player": normalize(row, your_total) if row else None, "learning": [dict(x) for x in learning]})

@app.post("/api/intel/bulk")
def intel_bulk():
    body = request.get_json(force=True)
    ids = [int(x) for x in body.get("ids", []) if str(x).isdigit()]
    your_total = clean_num(body.get("your_total"))
    out = {}
    if ids:
        with db() as con:
            q = ",".join("?" for _ in ids[:200])
            for row in con.execute(f"SELECT * FROM enemy_stats WHERE user_id IN ({q})", ids[:200]).fetchall():
                out[str(row["user_id"])] = normalize(row, your_total)
    return jsonify({"ok": True, "intel": out})

@app.post("/api/estimate/manual")
def estimate_manual():
    body = request.get_json(force=True)
    stat_ranges = {k: clean_num(body.get(k)) for k in ["str_low","str_high","def_low","def_high","spd_low","spd_high","dex_low","dex_high"] if body.get(k) is not None}
    p = store_enemy(
        body.get("target_id"), body.get("target_name"), body.get("estimate_total"),
        body.get("your_total"), body.get("target_faction_id"), body.get("confidence") or 70,
        body.get("source") or "manual", body.get("source_detail") or "manual/import",
        stat_ranges=stat_ranges,
        armor_seen=body.get("armor_seen"),
        temp_used_often=body.get("temp_used_often"),
        stat_style=body.get("stat_style")
    )
    return jsonify({"ok": bool(p), "player": p})

@app.post("/api/target/flags")
def target_flags():
    body = request.get_json(force=True)
    target_id = int(body.get("target_id") or 0)
    if not target_id:
        return jsonify({"ok": False, "error": "Missing target_id"}), 400
    with db() as con:
        row = con.execute("SELECT * FROM enemy_stats WHERE user_id=?", (target_id,)).fetchone()
    total = (row["total"] if row else clean_num(body.get("estimate_total"))) or 1
    p = store_enemy(
        target_id, body.get("target_name") or (row["name"] if row else ""), total, body.get("your_total"),
        confidence=max(55, float(row["confidence"] or 0) if row else 55),
        source="style_feed" if body.get("stat_style") else (row["source"] if row else "manual"),
        detail="armor/temp/stat style feed",
        armor_seen=body.get("armor_seen"),
        temp_used_often=body.get("temp_used_often"),
        stat_style=body.get("stat_style")
    )
    return jsonify({"ok": bool(p), "player": p})

def estimate_from_fight(attacker_total, result):
    t = clean_num(attacker_total)
    result = str(result or "")
    if not t:
        return None
    if result == "easy_win":
        low, high, conf = t*.05, t*.70, 42
    elif result == "close_win":
        low, high, conf = t*.75, t*1.05, 48
    elif result in ("generic_win","auto_win"):
        low, high, conf = t*.55, t*1.00, 42
    elif result == "close_loss":
        low, high, conf = t*.95, t*1.25, 48
    elif result in ("generic_loss","auto_loss"):
        low, high, conf = t*1.00, t*1.55, 42
    elif result == "hard_loss":
        low, high, conf = t*1.35, t*2.20, 45
    else:
        low, high, conf = t*.75, t*1.25, 35
    return ((low+high)/2, low, high, conf)

@app.post("/api/attack/result")
def attack_result():
    body = request.get_json(force=True)
    attacker_id = int(body.get("attacker_id") or 0)
    target_id = int(body.get("target_id") or 0)
    result = body.get("result") or "generic_win"
    attacker_total = clean_num(body.get("attacker_total"))
    target_name = body.get("target_name") or "Enemy"
    if not attacker_id or not target_id or not attacker_total:
        return jsonify({"ok": False, "error": "Missing attacker_id, target_id, or attacker_total"}), 400
    ts = now_ts()
    with db() as con:
        con.execute("""
        INSERT INTO attack_learning(attacker_id,attacker_name,attacker_total,target_id,target_name,result,fight_meta,created_at)
        VALUES(?,?,?,?,?,?,?,?)
        """, (attacker_id, body.get("attacker_name"), attacker_total, target_id, target_name, result, json.dumps(body.get("fight_meta") or {}), ts))
    est = estimate_from_fight(attacker_total, result)
    player = None
    if est:
        total, low, high, conf = est
        stat_ranges = ranges_from_fight(low, high, body.get("attacker_stats") or {})
        player = store_enemy(target_id, target_name, total, attacker_total, None, conf, "fight_learning", f"single fight: {result}", stat_ranges=stat_ranges)
    return jsonify({"ok": True, "player": player})

def parse_ff_payload(payload):
    if isinstance(payload, dict):
        data = payload.get("data") or payload.get("stats") or payload.get("targets") or payload.get("results") or payload
        if isinstance(data, dict):
            rows = []
            for k,v in data.items():
                if isinstance(v, dict):
                    vv = dict(v); vv.setdefault("target_id", k); rows.append(vv)
        elif isinstance(data, list):
            rows = data
        else:
            rows = []
    elif isinstance(payload, list):
        rows = payload
    else:
        rows = []
    out = {}
    for r in rows:
        if not isinstance(r, dict):
            continue
        tid = r.get("target_id") or r.get("user_id") or r.get("player_id") or r.get("id") or r.get("XID")
        est = r.get("bs_estimate") or r.get("battle_stats_estimate") or r.get("estimated_stats") or r.get("estimate") or r.get("total")
        tid, est = int(clean_num(tid)), clean_num(est)
        if tid and est:
            out[tid] = {"total": est, "detail": "FF Scouter base"}
    return out

@app.post("/api/ffscouter/base-import")
def ff_import():
    body = request.get_json(force=True)
    api_key = (body.get("api_key") or "").strip()
    targets = body.get("targets") or []
    ids = []
    names = {}
    for t in targets[:120]:
        if isinstance(t, dict):
            tid = int(t.get("user_id") or t.get("target_id") or t.get("id") or 0)
            if tid:
                ids.append(tid); names[tid] = t.get("name") or t.get("target_name")
        else:
            try: ids.append(int(t))
            except Exception: pass
    if not api_key or not ids:
        return jsonify({"ok": False, "error": "Missing api_key or target ids"}), 400
    target_str = ",".join(map(str, ids))
    parsed, warning = {}, None
    for path in ["/api/v1/get-stats","/api/get-stats","/api/stats"]:
        try:
            r = requests.get(FF_SCOUTER_API_BASE + path, params={"key": api_key, "targets": target_str}, timeout=20)
            if r.status_code >= 400:
                warning = f"{path} HTTP {r.status_code}"; continue
            parsed = parse_ff_payload(r.json())
            if parsed: break
        except Exception as e:
            warning = str(e)
    preds = []
    your_total = clean_num(body.get("your_total"))
    for tid,row in parsed.items():
        p = store_enemy(tid, names.get(tid), row["total"], your_total, body.get("target_faction_id"), 58, "ffscouter", row["detail"])
        if p: preds.append(p)
    return jsonify({"ok": True, "imported": len(preds), "predictions": preds, "warning": warning})

@app.get("/api/learning/recent")
def learning_recent():
    with db() as con:
        rows = con.execute("SELECT * FROM attack_learning ORDER BY created_at DESC LIMIT 50").fetchall()
    return jsonify({"ok": True, "rows": [dict(x) for x in rows]})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
