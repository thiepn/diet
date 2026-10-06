"""P21 live-browser failure/reconnect certification."""
import argparse, json, re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

PROD="https://thiepn.dev/diet/"
ALIAS="https://thiepn.dev/diet/v2/"
LEGACY="https://thiepn.dev/diet/legacy-v1.html"
SOURCE_SW=Path("sw.js").read_text(encoding="utf-8")
CACHE_MATCH=re.search(r"const CACHE='([^']+)'",SOURCE_SW)
EXPECTED_CACHE=CACHE_MATCH.group(1) if CACHE_MATCH else None

parser=argparse.ArgumentParser()
parser.add_argument("--browser",choices=["chromium","firefox","webkit"],required=True)
parser.add_argument("--out",required=True)
args=parser.parse_args()
out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
evidence={"browser":args.browser,"checks":[],"pageErrors":[]}

def save():
    (out/"results.json").write_text(json.dumps(evidence,indent=2,default=str),encoding="utf-8")

def check(name,condition,detail=None):
    evidence["checks"].append({"name":name,"passed":bool(condition),"detail":detail})
    save()
    assert condition,f"{name}: {detail or 'failed'}"

with sync_playwright() as p:
    browser=getattr(p,args.browser).launch()
    context=browser.new_context(viewport={"width":1280,"height":900})
    page=context.new_page()
    page.on("pageerror",lambda error:evidence["pageErrors"].append(str(error)))
    page.goto(PROD+"?p21="+args.browser+"#more",wait_until="networkidle")
    check("stable shell","Diet Copilot 2.0" in page.title(),page.title())
    check("stable badge",page.locator(".dc-version-badge").inner_text().strip()=="2.0")
    check("health UI available",page.locator("#moreHealthButton").count()==1)

    page.locator("#moreHealthButton").click()
    expect(page.locator("#systemHealthDialog")).to_be_visible()
    diag=page.evaluate("() => window.DietV2Settings?.healthDiagnostics?.() ?? null")
    check("health diagnostics available",isinstance(diag,dict),diag)
    page.locator('[data-p9-close="systemHealthDialog"]').click()

    context.set_offline(True)
    check("browser sees offline",page.evaluate("() => navigator.onLine") is False)
    context.set_offline(False)
    page.wait_for_timeout(300)
    check("browser reconnects",page.evaluate("() => navigator.onLine") is True)

    alias=context.new_page()
    alias.goto(ALIAS+"?p21="+args.browser,wait_until="domcontentloaded")
    check("compatibility alias survives",alias.locator(".dc-version-badge").inner_text().strip()=="2.0")
    alias.close()

    legacy=context.new_page()
    legacy.goto(LEGACY+"?p21="+args.browser,wait_until="domcontentloaded")
    check("legacy rollback route survives","legacy-v1-app.js" in legacy.content())
    legacy.close()

    if args.browser=="chromium":
        mobile=browser.new_context(viewport={"width":390,"height":844})
        mp=mobile.new_page()
        mp.goto(PROD+"?p21=offline#today",wait_until="networkidle")
        scope=mp.evaluate("async()=> (await navigator.serviceWorker.ready).scope")
        check("service worker owns Diet scope",scope.endswith("/diet/"),scope)
        keys=mp.evaluate("async()=>await caches.keys()")
        check("current production cache declared",bool(EXPECTED_CACHE),EXPECTED_CACHE)
        check("current production cache installed",EXPECTED_CACHE in keys,keys)
        mobile.set_offline(True)
        mp.reload(wait_until="domcontentloaded")
        check("offline cached shell loads",mp.locator(".dc-version-badge").inner_text().strip()=="2.0")
        check("offline health UI remains",mp.locator("#moreHealthButton").count()==1)
        mobile.set_offline(False)
        mp.reload(wait_until="domcontentloaded")
        check("reconnected shell loads",mp.locator(".dc-version-badge").inner_text().strip()=="2.0")
        mobile.close()

    check("no page errors",not evidence["pageErrors"],evidence["pageErrors"])
    browser.close()

save()
print("PASS:",args.browser,"P21 live failure/reconnect checks")
