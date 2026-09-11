#!/usr/bin/env python3
from pathlib import Path
from html.parser import HTMLParser
import gzip, json, re, subprocess, sys

ROOT = Path(__file__).resolve().parents[1]
errors=[]; warnings=[]; passes=[]

def ok(name): passes.append(name)
def fail(name,msg): errors.append(f'{name}: {msg}')
def warn(name,msg): warnings.append(f'{name}: {msg}')

class Parser(HTMLParser):
    def __init__(self): super().__init__(); self.ids=[]
    def handle_starttag(self, tag, attrs):
        for k,v in attrs:
            if k=='id' and v: self.ids.append(v)

apps=[f'app-{i:02d}.js' for i in range(1,22)]
styles=[f'styles-{i:02d}.css' for i in range(1,5)]
required=['index.html',*apps,*styles,'sw.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','supabase/schema.sql.gz','supabase/upgrade-v0.4-to-v0.5.sql','README.md','QA.md']
for f in required:
    if (ROOT/f).exists(): ok(f'exists {f}')
    else: fail('package',f'missing {f}')

for f in [*apps,'sw.js']:
    if not (ROOT/f).exists(): continue
    r=subprocess.run(['node','--check',str(ROOT/f)],capture_output=True,text=True)
    if r.returncode==0: ok(f'{f} syntax')
    else: fail(f'{f} syntax',r.stderr.strip())

try:
    parser=Parser(); parser.feed((ROOT/'index.html').read_text())
    dupes=sorted({x for x in parser.ids if parser.ids.count(x)>1})
    if dupes: fail('index.html IDs',f'duplicates: {dupes}')
    else: ok('index.html IDs unique')
except Exception as e: fail('index.html parse',str(e))

try:
    manifest=json.loads((ROOT/'manifest.webmanifest').read_text())
    assert manifest.get('name')=='Diet Copilot'
    ok('manifest JSON')
except Exception as e: fail('manifest JSON',str(e))

sw=(ROOT/'sw.js').read_text() if (ROOT/'sw.js').exists() else ''
match=re.search(r"const CORE = \[(.*?)\];",sw,re.S)
if match:
    refs=re.findall(r"['\"](\.\/[^'\"]+)['\"]",match.group(1))
    missing=[ref for ref in refs if ref != './' and not (ROOT/ref[2:]).exists()]
    if missing: fail('service worker CORE',f'missing {missing}')
    else: ok('service worker CORE assets')
else: fail('service worker CORE','CORE list not found')

app='\n'.join((ROOT/f).read_text(errors='ignore') for f in apps if (ROOT/f).exists())
html=(ROOT/'index.html').read_text(errors='ignore') if (ROOT/'index.html').exists() else ''
readme=(ROOT/'README.md').read_text(errors='ignore') if (ROOT/'README.md').exists() else ''
if 'const APP_VERSION = 5;' in app and 'V0.5' in html and 'V0.5' in readme: ok('V0.5 version consistency')
else: fail('version consistency','expected V0.5 markers missing')
if "'diet-copilot-v0.4'" in app: ok('V0.4 local migration source included')
else: fail('migration','V0.4 not included in LEGACY_KEYS')
if 'isUnsafeSupabaseKey' in app and 'sb_secret_' in app: ok('secret-key client guard')
else: fail('secret-key guard','missing')

blob='\n'.join([html,app,'\n'.join((ROOT/f).read_text(errors='ignore') for f in styles if (ROOT/f).exists()),sw])
found=[]
for pat in [r'sb_secret_[A-Za-z0-9_-]{20,}',r'eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+']:
    found.extend(re.findall(pat,blob))
if found: fail('secret scan',f'possible embedded credential(s): {len(found)}')
else: ok('no embedded Supabase credentials in frontend')

try:
    with gzip.open(ROOT/'supabase/schema.sql.gz','rt') as fh: sql=fh.read()
    ok('schema gzip readable')
except Exception as e:
    sql=''; fail('schema gzip',str(e))
for needle in ['alter table public.meals enable row level security','diet_copilot_healthcheck','diet_copilot_enforce_relation_owner','updated_at timestamptz not null default now()',"'schema_version', 5"]:
    if needle.lower() in sql.lower(): ok(f'SQL contains {needle[:38]}')
    else: fail('SQL structure',f'missing {needle}')
for table in ['profiles','daily_logs','meals','meal_items','saved_foods','saved_meals','saved_meal_items','weight_entries','ai_actions']:
    if f'public.{table}'.lower() in sql.lower() and 'authenticated' in sql.lower(): ok(f'grant/RLS signal {table}')
    else: fail('SQL grants',f'authenticated signal missing for {table}')
if 'flushQueue(true, true)' in app: ok('explicit local-wins conflict path')
else: fail('conflict path','local-wins overwrite path missing')
if 'expectedUpdatedAt' in app and 'fetchRemoteUpdatedAt' in app: ok('offline optimistic conflict guard')
else: fail('conflict guard','server baseline check missing')
if 'HISTORY_PAGE_SIZE = 30' in app: ok('history pagination')
else: warn('history','pagination marker missing')

print(f'PASS {len(passes)}  WARN {len(warnings)}  FAIL {len(errors)}')
for x in warnings: print('WARN',x)
for x in errors: print('FAIL',x)
if errors: sys.exit(1)
