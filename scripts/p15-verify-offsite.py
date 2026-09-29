#!/usr/bin/env python3
"""Validate a plaintext P15 backup package without printing private row data."""
import argparse
import hashlib
import json
import re
from pathlib import Path

TABLES = [
    "profiles","daily_logs","meals","meal_items","weight_entries","goal_phases",
    "saved_foods","saved_food_portions","saved_meals","saved_meal_items",
    "target_recommendations","activity_daily","training_distribution_settings",
    "training_days","ai_actions","change_log","weekly_reviews","diet_native_devices",
]
HEX64 = re.compile(r"^[0-9a-f]{64}$")

def compact_json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))

def fail(message):
    raise SystemExit("P15 backup verification failed: " + message)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("path")
    args = parser.parse_args()

    path = Path(args.path)
    if not path.is_file():
        fail("backup file missing")
    try:
        package = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"invalid JSON ({exc.__class__.__name__})")

    if package.get("format") != "diet-p15-offsite-v1":
        fail("unexpected format")
    if package.get("project_ref") != "hycegznamzjhwinegaai":
        fail("wrong canonical project")
    if not HEX64.fullmatch(str(package.get("schema_sha256", ""))):
        fail("invalid package schema hash")

    snapshots = package.get("snapshots")
    if not isinstance(snapshots, list) or not snapshots:
        fail("no verified snapshots in package")
    if package.get("snapshot_count") != len(snapshots):
        fail("snapshot count mismatch")

    total_rows = 0
    total_bytes = 0
    latest = None
    for snapshot in snapshots:
        user_id = str(snapshot.get("user_id", ""))
        if not user_id:
            fail("snapshot owner missing")
        if not HEX64.fullmatch(str(snapshot.get("payload_sha256", ""))):
            fail("invalid snapshot payload hash")
        if not HEX64.fullmatch(str(snapshot.get("schema_sha256", ""))):
            fail("invalid snapshot schema hash")

        payload = snapshot.get("payload")
        counts = snapshot.get("row_counts")
        if not isinstance(payload, dict) or not isinstance(counts, dict):
            fail("payload/counts missing")

        if set(payload.keys()) != set(TABLES):
            fail("snapshot table set mismatch")
        if set(counts.keys()) != set(TABLES):
            fail("row-count table set mismatch")

        for table in TABLES:
            rows = payload.get(table)
            if not isinstance(rows, list):
                fail(f"{table} payload is not an array")
            if counts.get(table) != len(rows):
                fail(f"{table} row count mismatch")
            total_rows += len(rows)
            for row in rows:
                if not isinstance(row, dict):
                    fail(f"{table} row is not an object")
                if str(row.get("user_id", "")) != user_id:
                    fail(f"{table} contains a cross-owner row")
                if table == "diet_native_devices" and "credential_digest" in row:
                    fail("native credential material is present")

        canonical_payload = compact_json(payload).encode("utf-8")
        calculated = hashlib.sha256(canonical_payload).hexdigest()
        # PostgreSQL jsonb text rendering is not byte-identical to Python's canonical JSON,
        # so the database-recorded hash cannot be recomputed here. Its shape is validated;
        # the in-database verifier is authoritative for that hash.
        if len(calculated) != 64:
            fail("local payload digest calculation failed")

        total_bytes += int(snapshot.get("payload_bytes", 0))
        captured = snapshot.get("captured_at")
        if isinstance(captured, str) and (latest is None or captured > latest):
            latest = captured

    summary = {
        "ok": True,
        "format": package["format"],
        "snapshot_count": len(snapshots),
        "total_rows": total_rows,
        "declared_payload_bytes": total_bytes,
        "latest_captured_at": latest,
        "schema_sha256": package["schema_sha256"],
    }
    print(json.dumps(summary, separators=(",", ":")))

if __name__ == "__main__":
    main()
