import os, time, json, sqlite3, requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

APP_NAME = "Enhanced Battle Stat Finder v2.0.6"
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

def fmt_short(n):
    n = float(n or 0)
    for unit, div in [("t",1e12),("b",1e9),("m",1e6),("k",1e3)]:
        if abs(n) >= div:
            return f"{n/div:.1f}{unit}".replace(".0", "")
    return str(int(n))

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
    "ffscouter": 70,
    "visible_ff_bsp": 68,
    "bsp_cache": 66,
    "fight_learning": 40,
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
    if r <= 1.10:
        return "Fair"
    if r <= 1.35:
        return "Good"
    if r <= 1.75:
        return "Difficult"
    return "Avoid"

def normalize(row, your_total=0):
    if not row:
        return None
    d = dict(row)
    total = d.get("total") or d.get("estimate_total") or 0
    label = d.get("label") or user_label(total, your_total)
    return {
        "user_id": int(d.get("user_id") or d.get("target_id") or 0),
        "name": d.get("name") or d.get("target_name") or "",
        "faction_id": d.get("faction_id") or d.get("target_faction_id"),
        "total": round(float(total or 0)),
        "best_total": round(float(total or 0)),
        "range_low": round(float(d.get("range_low") or (float(total or 0) * .88))),
        "range_high": round(float(d.get("range_high") or (float(total or 0) * 1.12))),
        "label": label,
        "confidence": float(d.get("confidence") or 0),
        "source": d.get("source") or "none",
        "source_detail": d.get("source_detail") or "",
        "updated_at": d.get("updated_at") or d.get("created_at") or 0,
    }

def store_enemy(user_id, name, total, your_total=0, faction_id=None, confidence=50, source="manual", detail=""):
    user_id = int(user_id or 0)
    total = clean_num(total)
    if not user_id or not total:
        return None
    label = user_label(total, your_total)
    ts = now_ts()
    low, high = total * .88, total * 1.12
    with db() as con:
        old = con.execute("SELECT confidence, source FROM enemy_stats WHERE user_id=?", (user_id,)).fetchone()
        old_conf = float(old["confidence"] or 0) if old else 0
        old_source = old["source"] if old else ""
        old_priority = SOURCE_PRIORITY.get(old_source, old_conf)
        new_priority = SOURCE_PRIORITY.get(source, confidence)
        # Stronger intel wins; single-fight estimates fill blanks only.
        if new_priority >= old_priority or old_conf < 45:
            con.execute("""
            INSERT INTO enemy_stats
            (user_id,name,faction_id,total,range_low,range_high,label,confidence,source,source_detail,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(user_id) DO UPDATE SET
              name=COALESCE(excluded.name, enemy_stats.name),
              faction_id=COALESCE(excluded.faction_id, enemy_stats.faction_id),
              total=excluded.total,
              range_low=excluded.range_low,
              range_high=excluded.range_high,
              label=excluded.label,
              confidence=excluded.confidence,
              source=excluded.source,
              source_detail=excluded.source_detail,
              updated_at=excluded.updated_at
            """, (user_id, name, faction_id, total, low, high, label, confidence, source, detail, ts))
        row = con.execute("SELECT * FROM enemy_stats WHERE user_id=?", (user_id,)).fetchone()
    return normalize(row, your_total)

def torn_get(api_key, selection):
    # Torn v1 style works broadly and is stable for limited key.
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
    p = store_enemy(
        body.get("target_id"), body.get("target_name"), body.get("estimate_total"),
        body.get("your_total"), body.get("target_faction_id"), body.get("confidence") or 70,
        body.get("source") or "manual", body.get("source_detail") or "manual/import"
    )
    return jsonify({"ok": bool(p), "player": p})

def estimate_from_fight(attacker_total, result):
    t = clean_num(attacker_total)
    result = str(result or "")
    if not t:
        return None
    if result == "easy_win":
        low, high, conf = t*.05, t*.70, 42
    elif result in ("close_win",):
        low, high, conf = t*.75, t*1.05, 48
    elif result in ("generic_win","auto_win"):
        low, high, conf = t*.55, t*1.00, 42
    elif result in ("close_loss",):
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
        player = store_enemy(target_id, target_name, total, attacker_total, None, conf, "fight_learning", f"single fight: {result}")
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
            out[tid] = {
            "total": est,
            "detail": " • ".join(str(x) for x in [
                r.get("bs_estimate_human") or r.get("estimate_human") or "FF Scouter base",
                ("FF " + str(r.get("fair_fight"))) if r.get("fair_fight") is not None else "",
                ("updated " + str(r.get("last_updated"))) if r.get("last_updated") else "",
            ] if x)
        }
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
