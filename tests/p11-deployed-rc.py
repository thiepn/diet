"""P11: wait until the public Diet Copilot 2.0 RC matches this checkout byte-for-byte."""
import hashlib, json, os, time
from pathlib import Path
from urllib.request import Request, urlopen

BASE = "https://thiepn.dev/diet/v2/"
ROOT = Path("v2")
FILES = sorted(str(path.relative_to(ROOT)).replace("\\", "/") for path in ROOT.rglob("*") if path.is_file())
REVISION = os.environ.get("GITHUB_SHA", "manual")
DEADLINE = time.monotonic() + 360

def digest(data):
    return hashlib.sha256(data).hexdigest()

expected = {name: digest((ROOT / name).read_bytes()) for name in FILES}
last = []
while True:
    last = []
    for name in FILES:
        try:
            req = Request(BASE + name + "?verify=" + REVISION, headers={"Cache-Control": "no-cache", "User-Agent": "Diet-P11-RC-verification"})
            with urlopen(req, timeout=15) as response:
                body = response.read()
                actual = digest(body)
                last.append({"path": name, "status": response.status, "sha256": actual, "expected": expected[name], "matches": actual == expected[name]})
        except Exception as error:
            last.append({"path": name, "matches": False, "error": type(error).__name__})
    passed = bool(last) and all(item["matches"] for item in last)
    Path("p11-deployed-rc.json").write_text(json.dumps({"revision": REVISION, "rc": BASE, "passed": passed, "assetCount": len(last), "assets": last}, indent=2), encoding="utf-8")
    if passed:
        print(f"PASS: all {len(last)} public V2 RC assets match this commit byte-for-byte.")
        break
    if time.monotonic() >= DEADLINE:
        missing = [item["path"] for item in last if not item["matches"]]
        raise SystemExit("RC deployment did not converge. Mismatched assets: " + ", ".join(missing))
    time.sleep(10)
