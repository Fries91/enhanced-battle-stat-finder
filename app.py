pp faction_id = faction.get("faction_id") or faction.get("id") or 0
    faction_name = faction.get("faction_name") or faction.get("name") or ""

    battle_stats = extract_battle_stats(data)

    with db() as con:
        con.execute(
            """
            INSERT INTO users (user_id, name, faction_id, faction_name, api_key_hash, created_at, last_seen)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              name=excluded.name,
              faction_id=excluded.faction_id,
              faction_name=excluded.faction_name,
              api_key_hash=excluded.api_key_hash,
              last_seen=excluded.last_seen
            """,
            (user_id, name, faction_id, faction_name, hash_key(api_key), now_ts(), now_ts()),
        )

    return jsonify({
        "ok": True,
        "user": {
            "user_id": user_id,
            "name": name,
            "faction_id": faction_id,
            "faction_name": faction_name,
            "is_admin": user_id in ADMIN_USER_IDS,
            "battle_stats": battle_stats,
        }
    })


@app.post("/api/settings/integrations")
@require_json
def save_integrations():
    body = request.get_json(force=True)
    user_id = int(body.get("user_id") or 0)
    if not user_id:
        return jsonify({"ok": False, "error": "Missing user_id"}), 400

    with db() as con:
        con.execute(
            """
            UPDATE users SET tornstats_key=?, yata_key=?, share_attack_learning=?, share_spies=?, last_seen=?
            WHERE user_id=?
            """,
            (
                body.get("tornstats_key") or None,
                body.get("yata_key") or None,
                1 if body.get("share_attack_learning", True) else 0,
                1 if body.get("share_spies", True) else 0,
                now_ts(),
                user_id,
            ),
        )
    return jsonify({"ok": True})


def find_active_enemy_faction(api_key):
    data = torn_request(api_key, "faction", "basic,rankedwars")
    if data.get("error"):
        return None, data.get("error")

    own_id = int(data.get("ID") or data.get("faction_id") or 0)
    ranked = data.get("rankedwars") or data.get("ranked_wars") or {}
    enemy_id = None

    if isinstance(ranked, dict):
        for _, war in ranked.items():
            factions = war.get("factions") or {}
            for fid in factions.keys():
                try:
                    fid_int = int(fid)
                except Exception:
                    continue
                if fid_int != own_id:
                    enemy_id = fid_int
                    break
            if enemy_id:
                break

    return enemy_id, None


def fetch_faction_members(api_key, faction_id):
    data = torn_request(api_key, f"faction/{faction_id}", "basic")
    if data.get("error"):
        return [], data.get("error")

    members = data.get("members") or {}
    rows = []
    for uid, m in members.items():
        rows.append({
            "user_id": int(uid),
            "name": m.get("name", "Unknown"),
            "level": m.get("level"),
            "status": m.get("status", {}).get("description") if isinstance(m.get("status"), dict) else m.get("status"),
            "last_action": m.get("last_action", {}).get("relative") if isinstance(m.get("last_action"), dict) else None,
            "faction_id": faction_id,
        })
    return rows, None


@app.post("/api/war/enemy-scan")
@require_json
def enemy_scan():
    body = request.get_json(force=True)
    api_key = body.get("api_key", "").strip()
    your_total = clean_num(body.get("your_total"))
    enemy_faction_id = body.get("enemy_faction_id")

    if not api_key:
        return jsonify({"ok": False, "error": "Missing api_key"}), 400

    if not enemy_faction_id:
        enemy_faction_id, err = find_active_enemy_faction(api_key)
        if err:
            return jsonify({"ok": False, "error": err}), 400
    if not enemy_faction_id:
        return jsonify({"ok": False, "error": "No active enemy faction detected. Enter enemy faction ID manually."}), 404

    members, err = fetch_faction_members(api_key, int(enemy_faction_id))
    if err:
        return jsonify({"ok": False, "error": err}), 400

    ids = [m["user_id"] for m in members]
    known = {}
    with db() as con:
        if ids:
            placeholders = ",".join("?" for _ in ids)
            rows = con.execute(f"SELECT * FROM enemy_stats WHERE user_id IN ({placeholders})", ids).fetchall()
            known = {int(r["user_id"]): normalize_enemy_row(r, your_total) for r in rows}

    final = []
    for m in members:
        intel = known.get(m["user_id"])
        m["intel"] = intel if intel else {"label": "Unknown", "confidence": 0, "source": "none"}
        final.append(m)

    order = {"Easy": 1, "Fair": 2, "Good": 3, "Unknown": 4, "Difficult": 5, "Avoid": 6}
    final.sort(key=lambda x: (order.get(x.get("intel", {}).get("label"), 9), -(x.get("intel", {}).get("confidence") or 0)))

    with db() as con:
        con.execute(
            "INSERT INTO scan_cache (faction_id, enemy_faction_id, payload, created_at) VALUES (?, ?, ?, ?)",
            (body.get("faction_id"), int(enemy_faction_id), json.dumps(final), now_ts()),
        )

    return jsonify({"ok": True, "enemy_faction_id": int(enemy_faction_id), "members": final})


def upsert_enemy_from_source(target_id, name, faction_id, strength, defense, speed, dexterity, source, source_detail, confidence, submitted_by=None):
    strength = clean_num(strength)
    defense = clean_num(defense)
    speed = clean_num(speed)
    dexterity = clean_num(dexterity)
    total = total_stats(strength, defense, speed, dexterity)
    if not total:
        return False, "Need all four battle stats"

    build_shape = detect_build_shape(strength, defense, speed, dexterity)
    range_low = total * 0.95
    range_high = total * 1.05
    ts = now_ts()

    with db() as con:
        con.execute(
            """
            INSERT INTO spy_reports
            (target_id, target_name, target_faction_id, strength, defense, speed, dexterity, total, source, source_detail, submitted_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (target_id, name, faction_id, strength, defense, speed, dexterity, total, source, source_detail, submitted_by, ts),
        )
        old = con.execute("SELECT confidence FROM enemy_stats WHERE user_id=?", (target_id,)).fetchone()
        old_conf = old["confidence"] if old else 0
        if confidence >= old_conf:
            con.execute(
                """
                INSERT INTO enemy_stats
                (user_id, name, faction_id, strength, defense, speed, dexterity, total, range_low, range_high, build_shape, confidence, source, source_detail, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                  name=excluded.name,
                  faction_id=excluded.faction_id,
                  strength=excluded.strength,
                  defense=excluded.defense,
                  speed=excluded.speed,
                  dexterity=excluded.dexterity,
                  total=excluded.total,
                  range_low=excluded.range_low,
                  range_high=excluded.range_high,
                  build_shape=excluded.build_shape,
                  confidence=excluded.confidence,
                  source=excluded.source,
                  source_detail=excluded.source_detail,
                  updated_at=excluded.updated_at
                """,
                (target_id, name, faction_id, strength, defense, speed, dexterity, total, range_low, range_high, build_shape, confidence, source, source_detail, ts),
            )
    return True, None


@app.post("/api/spy/manual")
@require_json
def manual_spy():
    body = request.get_json(force=True)
    target_id = int(body.get("target_id") or 0)
    if not target_id:
        return jsonify({"ok": False, "error": "Missing target_id"}), 400

    ok, err = upsert_enemy_from_source(
        target_id=target_id,
        name=body.get("target_name") or "Unknown",
        faction_id=int(body.get("target_faction_id") or 0),
        strength=body.get("strength"),
        defense=body.get("defense"),
        speed=body.get("speed"),
        dexterity=body.get("dexterity"),
        source=body.get("source") or "manual_spy",
        source_detail=body.get("source_detail") or "Manual spy entry",
        confidence=source_weight(body.get("source") or "manual_spy"),
        submitted_by=body.get("submitted_by"),
    )
    if not ok:
        return jsonify({"ok": False, "error": err}), 400
    return jsonify({"ok": True})


@app.post("/api/estimate/manual")
@require_json
def manual_estimate():
    body = request.get_json(force=True)
    target_id = int(body.get("target_id") or 0)
    if not target_id:
        return jsonify({"ok": False, "error": "Missing target_id"}), 400

    source = body.get("source") or "bsp"
    est = clean_num(body.get("estimate_total"))
    low = clean_num(body.get("range_low")) or (est * 0.85 if est else None)
    high = clean_num(body.get("range_high")) or (est * 1.15 if est else None)
    if not est and not (low and high):
        return jsonify({"ok": False, "error": "Need estimate_total or range_low/range_high"}), 400

    conf = float(body.get("confidence") or source_weight(source))
    with db() as con:
        con.execute(
            """
            INSERT INTO external_estimates
            (target_id, target_name, target_faction_id, estimate_total, range_low, range_high, source, source_detail, confidence, submitted_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (target_id, body.get("target_name"), body.get("target_faction_id"), est, low, high, source, body.get("source_detail"), conf, body.get("submitted_by"), now_ts()),
        )
        old = con.execute("SELECT confidence FROM enemy_stats WHERE user_id=?", (target_id,)).fetchone()
        old_conf = old["confidence"] if old else 0
        if conf >= old_conf:
            con.execute(
                """
                INSERT INTO enemy_stats
                (user_id, name, faction_id, total, range_low, range_high, build_shape, confidence, source, source_detail, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                  name=COALESCE(excluded.name, enemy_stats.name),
                  faction_id=COALESCE(excluded.faction_id, enemy_stats.faction_id),
                  total=excluded.total,
                  range_low=excluded.range_low,
                  range_high=excluded.range_high,
                  build_shape='unknown',
                  confidence=excluded.confidence,
                  source=excluded.source,
                  source_detail=excluded.source_detail,
                  updated_at=excluded.updated_at
                """,
                (target_id, body.get("target_name"), body.get("target_faction_id"), est or ((low + high) / 2), low, high, "unknown", conf, source, body.get("source_detail"), now_ts()),
            )
    return jsonify({"ok": True})


def normalize_spy_payload(payload):
    data = payload.get("spy") or payload.get("spy_data") or payload.get("data") or payload
    if isinstance(data, list) and data:
        data = data[0]
    if not isinstance(data, dict):
        return None
    return {
        "strength": data.get("strength") or data.get("str"),
        "defense": data.get("defense") or data.get("def"),
        "speed": data.get("speed") or data.get("spd"),
        "dexterity": data.get("dexterity") or data.get("dex"),
        "target_name": data.get("name") or data.get("target_name"),
        "target_faction_id": data.get("faction_id"),
        "timestamp": data.get("timestamp") or data.get("updated") or data.get("updated_at"),
    }


@app.post("/api/integrations/tornstats/import-user")
@require_json
def tornstats_import_user():
    body = request.get_json(force=True)
    key = body.get("tornstats_key") or ""
    target_id = int(body.get("target_id") or 0)
    if not key or not target_id:
        return jsonify({"ok": False, "error": "Missing TornStats key or target_id"}), 400

    url = f"{TORNSTATS_API_BASE}/{key}/spy/user/{target_id}"
    data = requests.get(url, timeout=25).json()
    spy = normalize_spy_payload(data)
    if not spy:
        return jsonify({"ok": False, "error": "No spy data returned", "raw": data}), 404

    ok, err = upsert_enemy_from_source(
        target_id=target_id,
        name=spy.get("target_name") or body.get("target_name") or "Unknown",
        faction_id=int(spy.get("target_faction_id") or body.get("target_faction_id") or 0),
        strength=spy.get("strength"),
        defense=spy.get("defense"),
        speed=spy.get("speed"),
        dexterity=spy.get("dexterity"),
        source="tornstats",
        source_detail="TornStats user spy import",
        confidence=source_weight("tornstats"),
        submitted_by=body.get("submitted_by"),
    )
    if not ok:
        return jsonify({"ok": False, "error": err, "raw": data}), 400
    return jsonify({"ok": True, "spy": spy})


@app.post("/api/integrations/yata/import-user")
@require_json
def yata_import_user():
    body = request.get_json(force=True)
    key = body.get("yata_key") or ""
    target_id = int(body.get("target_id") or 0)

    if not YATA_API_BASE:
        return jsonify({"ok": False, "error": "YATA_API_BASE is not configured yet"}), 400
    if not key or not target_id:
        return jsonify({"ok": False, "error": "Missing YATA key or target_id"}), 400

    url = YATA_API_BASE.replace("{key}", key).replace("{target_id}", str(target_id))
    data = requests.get(url, timeout=25).json()
    spy = normalize_spy_payload(data)
    if not spy:
        return jsonify({"ok": False, "error": "No YATA spy data recognized", "raw": data}), 404

    ok, err = upsert_enemy_from_source(
        target_id=target_id,
        name=spy.get("target_name") or body.get("target_name") or "Unknown",
        faction_id=int(spy.get("target_faction_id") or body.get("target_faction_id") or 0),
        strength=spy.get("strength"),
        defense=spy.get("defense"),
        speed=spy.get("speed"),
        dexterity=spy.get("dexterity"),
        source="yata",
        source_detail="YATA user spy import",
        confidence=source_weight("yata"),
        submitted_by=body.get("submitted_by"),
    )
    if not ok:
        return jsonify({"ok": False, "error": err, "raw": data}), 400
    return jsonify({"ok": True, "spy": spy})


@app.post("/api/attack/result")
@require_json
def attack_result():
    body = request.get_json(force=True)
    attacker_id = int(body.get("attacker_id") or 0)
    target_id = int(body.get("target_id") or 0)
    result = body.get("result")

    if not attacker_id or not target_id or result not in {"easy_win", "close_win", "close_loss", "hard_loss", "could_not_hit", "auto_win", "auto_loss", "generic_win", "generic_loss"}:
        return jsonify({"ok": False, "error": "Missing attacker_id, target_id, or valid result"}), 400

    with db() as con:
        con.execute(
            """
            INSERT INTO attack_learning
            (attacker_id, attacker_name, attacker_total, target_id, target_name, result, confidence_weight, note, fight_meta, detected_confidence, result_source, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                attacker_id,
                body.get("attacker_name"),
                clean_num(body.get("attacker_total")),
                target_id,
                body.get("target_name"),
                result,
                float(body.get("confidence_weight") or 1),
                body.get("note"),
                json.dumps(body.get("fight_meta") or {}, separators=(",", ":")),
                float(body.get("detected_confidence") or 50),
                body.get("result_source") or "auto",
                now_ts(),
            ),
        )

    recalc_learning(target_id)
    return jsonify({"ok": True})


def recalc_learning(target_id):
    with db() as con:
        rows = con.execute(
            "SELECT * FROM attack_learning WHERE target_id=? AND attacker_total IS NOT NULL ORDER BY created_at DESC LIMIT 50",
            (target_id,),
        ).fetchall()
        if not rows:
            return

        lows = []
        highs = []
        for r in rows:
            t = clean_num(r["attacker_total"])
            if not t:
                continue

            if r["result"] == "easy_win":
                highs.append(t * 0.85)
            elif r["result"] in ("close_win", "generic_win", "auto_win"):
                lows.append(t * 0.75)
                highs.append(t * 1.08)
            elif r["result"] in ("close_loss", "generic_loss", "auto_loss"):
                lows.append(t * 0.95)
                highs.append(t * 1.35)
            elif r["result"] == "hard_loss":
                lows.append(t * 1.20)

        if not lows and not highs:
            return

        old = con.execute("SELECT * FROM enemy_stats WHERE user_id=?", (target_id,)).fetchone()
        old_conf = old["confidence"] if old else 0

        learned_low = max(lows) if lows else (old["range_low"] if old and old["range_low"] else None)
        learned_high = min(highs) if highs else (old["range_high"] if old and old["range_high"] else None)

        if learned_low and learned_high and learned_low > learned_high:
            learned_high = learned_low * 1.25
        if not learned_low and learned_high:
            learned_low = learned_high * 0.55
        if learned_low and not learned_high:
            learned_high = learned_low * 1.60

        if not learned_low or not learned_high:
            return

        total = (learned_low + learned_high) / 2
        conf = min(88, 45 + len(rows) * 6)

        if conf >= old_conf or (old and old["source"] in ("estimate", "attack_learning", None)):
            con.execute(
                """
                INSERT INTO enemy_stats
                (user_id, name, total, range_low, range_high, build_shape, confidence, source, source_detail, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                  total=excluded.total,
                  range_low=excluded.range_low,
                  range_high=excluded.range_high,
                  confidence=excluded.confidence,
                  source=excluded.source,
                  source_detail=excluded.source_detail,
                  updated_at=excluded.updated_at
                """,
                (target_id, rows[0]["target_name"], total, learned_low, learned_high, "unknown", conf, "attack_learning", f"{len(rows)} attack reports", now_ts()),
            )


@app.get("/api/enemy/<int:target_id>/intel")
def enemy_intel(target_id):
    your_total = clean_num(request.args.get("your_total"))
    with db() as con:
        stat = con.execute("SELECT * FROM enemy_stats WHERE user_id=?", (target_id,)).fetchone()
        spies = con.execute("SELECT * FROM spy_reports WHERE target_id=? ORDER BY created_at DESC LIMIT 10", (target_id,)).fetchall()
        estimates = con.execute("SELECT * FROM external_estimates WHERE target_id=? ORDER BY created_at DESC LIMIT 10", (target_id,)).fetchall()
        learning = con.execute("SELECT * FROM attack_learning WHERE target_id=? ORDER BY created_at DESC LIMIT 20", (target_id,)).fetchall()

    return jsonify({
        "ok": True,
        "enemy": normalize_enemy_row(stat, your_total) if stat else None,
        "spies": [dict(x) for x in spies],
        "estimates": [dict(x) for x in estimates],
        "learning": [dict(x) for x in learning],
    })


@app.get("/api/learning/recent")
def recent_learning():
    user_id = int(request.args.get("user_id") or 0)
    if not user_id:
        return jsonify({"ok": False, "error": "Missing user_id"}), 400

    with db() as con:
        rows = con.execute(
            """
            SELECT target_id, target_name, result, created_at
            FROM attack_learning
            WHERE attacker_id=?
            ORDER BY created_at DESC
            LIMIT 12
            """,
            (user_id,),
        ).fetchall()

    return jsonify({"ok": True, "recent": [dict(x) for x in rows]})

@app.get("/api/player/<int:target_id>/intel")
def player_intel(target_id):
    your_total = clean_num(request.args.get("your_total"))
    with db() as con:
        stat = con.execute("SELECT * FROM enemy_stats WHERE user_id=?", (target_id,)).fetchone()
        spies = con.execute("SELECT * FROM spy_reports WHERE target_id=? ORDER BY created_at DESC LIMIT 10", (target_id,)).fetchall()
        estimates = con.execute("SELECT * FROM external_estimates WHERE target_id=? ORDER BY created_at DESC LIMIT 10", (target_id,)).fetchall()
        learning = con.execute("SELECT * FROM attack_learning WHERE target_id=? ORDER BY created_at DESC LIMIT 20", (target_id,)).fetchall()

    return jsonify({
        "ok": True,
        "player": normalize_enemy_row(stat, your_total) if stat else None,
        "spies": [dict(x) for x in spies],
        "estimates": [dict(x) for x in estimates],
        "learning": [dict(x) for x in learning],
    })

@app.get("/api/admin/intel-summary")
def intel_summary():
    admin_id = int(request.args.get("admin_id") or 0)
    if admin_id not in ADMIN_USER_IDS:
        return jsonify({"ok": False, "error": "Admin only"}), 403

    with db() as con:
        users = con.execute("SELECT COUNT(*) c FROM users").fetchone()["c"]
        enemies = con.execute("SELECT COUNT(*) c FROM enemy_stats").fetchone()["c"]
        spies = con.execute("SELECT COUNT(*) c FROM spy_reports").fetchone()["c"]
        attacks = con.execute("SELECT COUNT(*) c FROM attack_learning").fetchone()["c"]
        top = con.execute("SELECT * FROM enemy_stats ORDER BY confidence DESC, updated_at DESC LIMIT 30").fetchall()

    return jsonify({
        "ok": True,
        "counts": {"users": users, "enemies": enemies, "spies": spies, "attacks": attacks},
        "top": [dict(x) for x in top],
    })


@app.get("/")
def home():
    script = f"{PUBLIC_BASE_URL}/static/enhanced-battle-stat-finder.user.js" if PUBLIC_BASE_URL else "/static/enhanced-battle-stat-finder.user.js"
    return jsonify({"ok": True, "app": APP_NAME, "status": "running", "script": script})


@app.get("/health")
def health():
    return jsonify({"ok": True, "time": now_ts()})


@app.get("/static/<path:filename>")
def static_files(filename):
    return send_from_directory("static", filename)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)
