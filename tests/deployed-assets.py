"""Read-only, post-push verification of public production assets. No account is used."""
import hashlib, json, os, time
from pathlib import Path
from urllib.request import Request, urlopen

BASE = 'https://thiepn.dev/diet/'
FILES = ['index.html', 'diet-app.js', 'diet.css', 'sw.js', 'manifest.webmanifest',
         'vendor/supabase-2.116.0.js', '.well-known/thiepn-app.json', '.well-known/thiepn-account-release.json']
expected = {name: hashlib.sha256(Path(name).read_bytes()).hexdigest() for name in FILES}
revision = os.environ.get('GITHUB_SHA', 'manual')
deadline = time.monotonic() + 360
last = []
while True:
    last = []
    for name in FILES:
        try:
            req = Request(BASE + name + '?verify=' + revision, headers={'Cache-Control': 'no-cache', 'User-Agent': 'Diet-release-verification'})
            with urlopen(req, timeout=12) as response:
                body = response.read()
                actual = hashlib.sha256(body).hexdigest()
                last.append({'path': name, 'status': response.status, 'sha256': actual, 'matches': actual == expected[name]})
        except Exception as error:
            last.append({'path': name, 'matches': False, 'error': type(error).__name__})
    passed = all(item['matches'] for item in last)
    Path('deployed-assets.json').write_text(json.dumps({'revision': revision, 'production': BASE, 'passed': passed, 'assets': last}, indent=2))
    if passed:
        print('PASS: all eight public production assets match this commit byte-for-byte.')
        break
    if time.monotonic() >= deadline:
        raise SystemExit('Production has not served the expected release within the bounded deployment window. See deployed-assets.json.')
    time.sleep(10)
