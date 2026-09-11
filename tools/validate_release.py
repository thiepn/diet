#!/usr/bin/env python3
from pathlib import Path
import json, re, subprocess, sys

ROOT = Path(__file__).resolve().parents[1]
passes = []
failures = []

def check(name, condition, detail=''):
    (passes if condition else failures).append((name, detail))

index = (ROOT / 'index.html').read_text(encoding='utf-8')
sw = (ROOT / 'sw.js').read_text(encoding='utf-8')
readme = (ROOT / 'README.md').read_text(encoding='utf-8')
js_files = sorted(ROOT.glob('app-v1-*.js'))
css_files = sorted(ROOT.glob('styles-v1-*.css'))

check('V1 runtime count', len(js_files) == 12, f'{len(js_files)} JS files')
check('V1 CSS count', len(css_files) == 2, f'{len(css_files)} CSS files')
check('V1 marker', 'V1.0' in index and 'Diet Copilot — V1.0' in readme)
check('stable storage key', any("diet-copilot-state" in p.read_text(encoding='utf-8') for p in js_files))
check('V0.5 migration path', any("diet-copilot-v0.5" in p.read_text(encoding='utf-8') for p in js_files))
check('schema stays v5', any('DB_SCHEMA_VERSION = 5' in p.read_text(encoding='utf-8') for p in js_files))
check('bulk upload Number fix', not any('Numer(t.protein)' in p.read_text(encoding='utf-8') for p in js_files))

for path in js_files + [ROOT / 'sw.js']:
    result = subprocess.run(['node', '--check', str(path)], capture_output=True, text=True)
    check(f'node --check {path.name}', result.returncode == 0, result.stderr.strip())

try:
    manifest = json.loads((ROOT / 'manifest.webmanifest').read_text(encoding='utf-8'))
    check('manifest JSON', manifest.get('name') == 'Diet Copilot')
except Exception as exc:
    check('manifest JSON', False, str(exc))

for path in js_files + css_files:
    check(f'index references {path.name}', path.name in index)
    check(f'service worker caches {path.name}', f'./{path.name}' in sw)

ids = re.findall(r'\bid=["\']([^"\']+)', index)
check('no duplicate static IDs', len(ids) == len(set(ids)))

frontend = '\n'.join([index, sw] + [p.read_text(encoding='utf-8') for p in js_files])
check('no sb_secret key', 'sb_secret_' not in frontend)
check('no service-role literal key', not re.search(r'eyJ[^\s"\']{20,}\.eyJ[^\s"\']{20,}[^\n]{0,200}service_role', frontend, re.I))
check('Supabase SDK pinned', '@supabase/supabase-js@2.116.0' in index)

required = ['index.html','sw.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','README.md','QA.md','CHANGELOG.md']
for name in required:
    check(f'exists {name}', (ROOT / name).exists())

for name, detail in passes:
    print(f'PASS  {name}' + (f' — {detail}' if detail else ''))
for name, detail in failures:
    print(f'FAIL  {name}' + (f' — {detail}' if detail else ''))

print(f'\nPASS {len(passes)}')
print(f'FAIL {len(failures)}')
sys.exit(1 if failures else 0)
