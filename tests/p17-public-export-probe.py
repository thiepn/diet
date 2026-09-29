#!/usr/bin/env python3
import json
import re
import urllib.error
import urllib.request
from pathlib import Path

URL = "https://hycegznamzjhwinegaai.supabase.co/rest/v1/rpc/diet_app_export_owner_data"

source = Path("v2/data.js").read_text(encoding="utf-8")
match = re.search(r"DIET_V2_SUPABASE_KEY='(sb_publishable_[A-Za-z0-9_-]+)'", source)
if not match:
    raise SystemExit("P17 probe could not find the publishable key")
key = match.group(1)

request = urllib.request.Request(
    URL,
    data=b"{}",
    method="POST",
    headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Diet-Copilot-P17-Probe/1",
    },
)
status = None
body = ""
try:
    with urllib.request.urlopen(request, timeout=20) as response:
        status = response.status
        body = response.read(2048).decode("utf-8", "replace")
except urllib.error.HTTPError as exc:
    status = exc.code
    body = exc.read(2048).decode("utf-8", "replace")

evidence = {
    "ok": status in (401, 403),
    "status": status,
    "returnedOwnerExport": status == 200,
}
Path("p17-public-export.json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
if status not in (401, 403):
    raise SystemExit(f"P17 public export boundary failed: HTTP {status}; body={body[:300]!r}")
print(json.dumps(evidence, separators=(",", ":")))
