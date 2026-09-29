"""P12 live-browser certification for canonical Diet Copilot 2.0 production."""
import argparse, json
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

PROD="https://thiepn.dev/diet/"
ALIAS="https://thiepn.dev/diet/v2/"
LEGACY="https://thiepn.dev/diet/legacy-v1.html"
RELAY="https://thiepn.dev/wordstrike/"
SUPABASE="https://hycegznamzjhwinegaai.supabase.co"

parser=argparse.ArgumentParser()
parser.add_argument("--browser",choices=["chromium","firefox","webkit"],required=True)
parser.add_argument("--out",required=True)
args=parser.parse_args()
out=Path(args.out); out.mkdir(parents=True,exist_ok=True)
evidence={"browser":args.browser,"checks":[],"consoleErrors":[],"pageErrors":[]}

def save():
    (out/"results.json").write_text(json.dumps(evidence,indent=2,default=str),encoding="utf-8")

def check(name,condition,detail=None):
    evidence["checks"].append({"name":name,"passed":bool(condition),"detail":detail})
    save()
    assert condition,f"{name}: {detail or 'failed'}"

with sync_playwright() as p:
    browser_type=getattr(p,args.browser)
    browser=browser_type.launch()
    context=browser.new_context(viewport={"width":1280,"height":900})
    page=context.new_page()
    page.on("console",lambda msg:evidence["consoleErrors"].append(msg.text) if msg.type=="error" else None)
    page.on("pageerror",lambda error:evidence["pageErrors"].append(str(error)))

    page.goto(PROD+"?p12="+args.browser+"#today",wait_until="networkidle")
    check("canonical title","Diet Copilot 2.0" in page.title(),page.title())
    check("stable marker",page.locator(".dc-version-badge").inner_text().strip()=="2.0")
    check("no RC marker","2.0 RC" not in page.content())
    check("five primary routes",page.locator(".dc-bottom-nav [data-route]").count()==5)
    check("canonical URL",urlparse(page.url).path.rstrip("/")=="/diet",page.url)

    page.locator("[data-account-button]").click()
    expect(page.locator("#v2AccountDialog")).to_be_visible()
    check("clean browser sign-in CTA","Continue with Google" in page.locator("#v2AccountSignIn").inner_text())
    check("legacy fallback control","Open legacy v1" in page.locator("#v2AccountProduction").inner_text())
    page.locator("#closeV2AccountDialog").click()

    relay=context.new_page()
    nav_urls=[]
    relay.on("framenavigated",lambda frame:nav_urls.append(frame.url) if frame==relay.main_frame else None)
    relay.route(SUPABASE+"/auth/v1/token**",lambda route:route.fulfill(status=400,content_type="application/json",body='{"error":"invalid_grant"}'))
    relay.goto(RELAY,wait_until="domcontentloaded")
    relay.evaluate("""() => {
      sessionStorage.setItem('diet-copilot:oauth-target-v2','web-v2');
      sessionStorage.setItem('diet-copilot:oauth-flow-v2','p12-flow');
    }""")
    relay.goto(RELAY+"?code=p12-fake-code&sb_flow_id=p12-flow",wait_until="domcontentloaded")
    relay.wait_for_timeout(800)
    relay_paths=[urlparse(url).path for url in nav_urls]
    check("OAuth relay targets canonical production","/diet/" in relay_paths and "/diet/v2/" not in relay_paths,nav_urls[-8:])
    relay.close()

    legacy_relay=context.new_page()
    legacy_urls=[]
    legacy_relay.on("framenavigated",lambda frame:legacy_urls.append(frame.url) if frame==legacy_relay.main_frame else None)
    legacy_relay.route(SUPABASE+"/auth/v1/token**",lambda route:route.fulfill(status=400,content_type="application/json",body='{"error":"invalid_grant"}'))
    legacy_relay.goto(RELAY,wait_until="domcontentloaded")
    legacy_relay.evaluate("""() => {
      sessionStorage.setItem('diet-copilot:oauth-target-v2','web-v1-legacy');
      sessionStorage.setItem('diet-copilot:oauth-flow-v2','p12-legacy-flow');
    }""")
    legacy_relay.goto(RELAY+"?code=p12-legacy-code&sb_flow_id=p12-legacy-flow",wait_until="domcontentloaded")
    legacy_relay.wait_for_timeout(800)
    legacy_paths=[urlparse(url).path for url in legacy_urls]
    check("legacy OAuth relay preserves rollback route","/diet/legacy-v1.html" in legacy_paths,legacy_urls[-8:])
    legacy_relay.close()

    signin=context.new_page()
    signin.goto(PROD+"#today",wait_until="networkidle")
    signin.locator("[data-account-button]").click()
    auth_requests=[]
    def capture(route):
        auth_requests.append(route.request.url); route.abort()
    signin.route(SUPABASE+"/auth/v1/authorize**",capture)
    signin.locator("#v2AccountSignIn").click()
    signin.wait_for_timeout(1200)
    check("Google sign-in targets canonical Supabase authorize",any(url.startswith(SUPABASE+"/auth/v1/authorize") for url in auth_requests),auth_requests)
    signin.close()

    alias=context.new_page()
    alias.goto(ALIAS+"#today",wait_until="networkidle")
    check("compatibility alias is stable 2.0",alias.locator(".dc-version-badge").inner_text().strip()=="2.0")
    check("compatibility alias has no RC marker","2.0 RC" not in alias.content())
    alias.close()

    legacy=context.new_page()
    legacy.goto(LEGACY,wait_until="domcontentloaded")
    check("legacy fallback retained","legacy-v1-app.js" in legacy.content())
    check("legacy fallback is not V2","dc-version-badge" not in legacy.content())
    legacy.close()

    mobile=browser.new_context(viewport={"width":390,"height":844})
    mp=mobile.new_page()
    mp.goto(PROD+"#food",wait_until="networkidle")
    nav_boxes=mp.locator(".dc-bottom-nav [data-route]").evaluate_all("(els)=>els.map(e=>e.getBoundingClientRect()).map(r=>({top:r.top,bottom:r.bottom,left:r.left,right:r.right}))")
    check("mobile nav has five items",len(nav_boxes)==5)
    check("mobile nav one row",max(x["top"] for x in nav_boxes)-min(x["top"] for x in nav_boxes)<4,nav_boxes)
    quick_boxes=mp.locator(".dc-quick-actions--food button").evaluate_all("(els)=>els.map(e=>e.getBoundingClientRect()).map(r=>({top:r.top,bottom:r.bottom,left:r.left,right:r.right}))")
    check("Food shortcuts present",len(quick_boxes)>=5)
    check("Food shortcuts one row",max(x["top"] for x in quick_boxes)-min(x["top"] for x in quick_boxes)<4,quick_boxes)
    width=mp.evaluate("() => ({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})")
    check("no page-level horizontal overflow",width["scroll"]<=width["client"]+2,width)
    mobile.close()

    if args.browser=="chromium":
        pwa=browser.new_context(viewport={"width":390,"height":844})
        pw=pwa.new_page()
        pw.goto(PROD+"#today",wait_until="networkidle")
        scope=pw.evaluate("async()=> (await navigator.serviceWorker.ready).scope")
        check("production SW scope",scope.endswith("/diet/"),scope)
        keys=pw.evaluate("async()=>await caches.keys()")
        check("P12 production cache installed",any("diet-copilot-prod-v2-p12-1" in key for key in keys),keys)
        pwa.set_offline(True)
        pw.reload(wait_until="domcontentloaded")
        check("offline reload remains V2","Diet Copilot 2.0" in pw.title(),pw.title())
        check("offline stable marker",pw.locator(".dc-version-badge").inner_text().strip()=="2.0")
        pwa.set_offline(False)
        pwa.close()

    check("no page runtime errors",not evidence["pageErrors"],evidence["pageErrors"])
    browser.close()

save()
print("PASS:",args.browser,"P12 production checks")
