"""P38 live-browser product release-candidate certification."""
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
    page.goto(PROD+"?p38="+args.browser+"#today",wait_until="networkidle")

    check("stable title","Diet Copilot 2.0" in page.title(),page.title())
    check("stable production badge",page.locator(".dc-version-badge").inner_text().strip()=="2.0")
    check("no prerelease marker","2.0 RC" not in page.content())
    check("production label","Production." in page.locator(".dc-sidebar-foot").inner_text())
    check("five primary routes",page.locator(".dc-bottom-nav [data-route]").count()==5)
    check("desktop V1 sidebar visible",page.locator(".dc-sidebar").is_visible())
    check("desktop topbar hidden",not page.locator(".dc-topbar").is_visible())
    check("no unfinished coming controls",page.locator("[data-coming]").count()==0)
    check("P37 hardening loaded",page.evaluate("() => window.DietV2Hardening?.version")=="1.0.0-p37")
    snapshot=page.evaluate("() => window.DietV2Data?.snapshot?.() ?? null")
    check("data runtime available",isinstance(snapshot,dict),snapshot)
    check("clean write guard",snapshot.get("writeGuardKind")=="clear",snapshot)
    check("owner model invariant",snapshot.get("ownerMatched") is True,snapshot)

    for route in ["today","food","progress","strategy","more"]:
        page.evaluate("(route)=>{location.hash='#'+route}",route)
        expect(page.locator(f'[data-view="{route}"]')).to_be_visible()
        check("route "+route+" renders",page.locator(f'[data-view="{route}"]').count()==1)

    page.locator(".dc-v1-account:visible").click()
    expect(page.locator("#v2AccountDialog")).to_be_visible()
    check("Google sign-in CTA","Continue with Google" in page.locator("#v2AccountSignIn").inner_text())
    check("THIEPN Account handoff",page.locator('#v2AccountDialog a[href="https://account.thiepn.dev/"]').count()==1)
    check("Hub return handoff",page.locator('#v2AccountDialog a[href="/home/"]').count()==1)
    check("legacy v1 absent from normal account UI",page.locator("#v2AccountProduction").count()==0)
    page.locator("#closeV2AccountDialog").click()

    page.goto(PROD+"#food",wait_until="networkidle")
    page.locator("#foodShortcutQuick").click()
    draft=page.locator('#foodQuickAddForm [name="name"]')
    draft.fill("P38 unsaved draft")
    check("unsaved edit detected",page.evaluate("() => window.DietV2Hardening?.hasUnsavedInput?.()") is True)
    check("update reload blocked by draft",page.evaluate("() => window.DietV2Hardening?.reloadForUpdate?.()") is False)
    page.locator("#foodQuickAddForm").evaluate("(form)=>form.reset()")
    page.wait_for_timeout(50)
    check("reset clears draft guard",page.evaluate("() => window.DietV2Hardening?.hasUnsavedInput?.()") is False)

    alias=context.new_page()
    alias.goto(ALIAS+"?p38="+args.browser+"#today",wait_until="networkidle")
    check("compatibility alias remains stable",alias.locator(".dc-version-badge").inner_text().strip()=="2.0")
    check("alias P37 hardening loaded",alias.evaluate("() => window.DietV2Hardening?.version")=="1.0.0-p37")
    alias.close()

    legacy=context.new_page()
    legacy.goto(LEGACY+"?p38="+args.browser,wait_until="domcontentloaded")
    check("rollback bundle retained","legacy-v1-app.js" in legacy.content())
    check("rollback route is not V2",legacy.locator(".dc-version-badge").count()==0)
    legacy.close()

    mobile=browser.new_context(viewport={"width":390,"height":844})
    mp=mobile.new_page()
    mp.goto(PROD+"?p38=mobile-"+args.browser+"#food",wait_until="networkidle")
    boxes=mp.locator(".dc-bottom-nav [data-route]").evaluate_all("(els)=>els.map(e=>e.getBoundingClientRect()).map(r=>({top:r.top,height:r.height,left:r.left,right:r.right}))")
    check("mobile navigation has five items",len(boxes)==5,boxes)
    check("mobile navigation stays one row",max(x["top"] for x in boxes)-min(x["top"] for x in boxes)<4,boxes)
    check("mobile nav touch targets",all(x["height"]>=44 for x in boxes),boxes)
    width=mp.evaluate("() => ({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})")
    check("no mobile page overflow",width["scroll"]<=width["client"]+2,width)

    if args.browser=="chromium":
        check("production cache declared",bool(EXPECTED_CACHE),EXPECTED_CACHE)
        scope=mp.evaluate("async()=> (await navigator.serviceWorker.ready).scope")
        check("service worker owns Diet scope",scope.endswith("/diet/"),scope)
        keys=mp.evaluate("async()=>await caches.keys()")
        check("current production cache installed",EXPECTED_CACHE in keys,keys)
        mobile.set_offline(True)
        mp.reload(wait_until="domcontentloaded")
        check("offline stable shell loads",mp.locator(".dc-version-badge").inner_text().strip()=="2.0")
        check("offline hardening runtime loads",mp.evaluate("() => window.DietV2Hardening?.version")=="1.0.0-p37")
        mobile.set_offline(False)
        mp.reload(wait_until="domcontentloaded")
        check("reconnected stable shell loads",mp.locator(".dc-version-badge").inner_text().strip()=="2.0")

    mobile.close()

    tablet=browser.new_context(viewport={"width":820,"height":1180})
    tp=tablet.new_page()
    tp.goto(PROD+"?p38=tablet-"+args.browser+"#today",wait_until="networkidle")
    check("tablet navigation remains available",tp.locator(".dc-sidebar").is_visible())
    tablet_width=tp.evaluate("() => ({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})")
    check("no tablet page overflow",tablet_width["scroll"]<=tablet_width["client"]+2,tablet_width)
    tablet.close()

    dark=browser.new_context(viewport={"width":390,"height":844},color_scheme="dark")
    dp=dark.new_page()
    dp.goto(PROD+"?p38=dark-"+args.browser+"#today",wait_until="networkidle")
    dark_colors=dp.evaluate("""() => ({
      body:getComputedStyle(document.body).backgroundColor,
      panel:getComputedStyle(document.querySelector('.dc-panel')).backgroundColor,
      primary:getComputedStyle(document.querySelector('.dc-primary-action')).backgroundColor
    })""")
    check("dark canvas is neutral charcoal",dark_colors["body"] in ["rgb(15, 15, 17)","rgb(16, 16, 18)"],dark_colors)
    check("dark panels are neutral gray",dark_colors["panel"]=="rgb(23, 23, 25)",dark_colors)
    check("dark primary action keeps coral accent",dark_colors["primary"]=="rgb(255, 123, 102)",dark_colors)
    dark.close()

    light=browser.new_context(viewport={"width":390,"height":844},color_scheme="dark")
    light.add_init_script("""localStorage.setItem('diet-copilot-v2-ui-preferences-v1',JSON.stringify({theme:'light',density:'comfortable',motion:'system'}));""")
    lp=light.new_page()
    lp.goto(PROD+"?p38=light-"+args.browser+"#today",wait_until="networkidle")
    light_colors=lp.evaluate("""() => {
      const cards=[...document.querySelectorAll('.dc-metric-grid>.dc-metric-card')];
      return {
        theme:document.documentElement.dataset.theme,
        body:getComputedStyle(document.body).backgroundColor,
        primary:getComputedStyle(cards[0]).backgroundColor,
        protein:getComputedStyle(cards[1]).backgroundColor,
        weight:getComputedStyle(cards[2]).backgroundColor,
        success:getComputedStyle(cards[3]).backgroundColor,
        action:getComputedStyle(document.querySelector('.dc-primary-action')).backgroundColor
      };
    }""")
    check("explicit Light preference active",light_colors["theme"]=="light",light_colors)
    check("light canvas keeps V1 neutral gray",light_colors["body"]=="rgb(247, 248, 250)",light_colors)
    check("light calorie card keeps coral tint",light_colors["primary"]=="rgb(255, 241, 236)",light_colors)
    check("light protein card keeps blue tint",light_colors["protein"]=="rgb(237, 243, 255)",light_colors)
    check("light weight card keeps violet tint",light_colors["weight"]=="rgb(242, 237, 255)",light_colors)
    check("light success card keeps green tint",light_colors["success"]=="rgb(234, 249, 241)",light_colors)
    check("light primary action keeps coral",light_colors["action"]=="rgb(255, 107, 85)",light_colors)
    light.close()

    check("no page runtime errors",not evidence["pageErrors"],evidence["pageErrors"])
    browser.close()

save()
print("PASS:",args.browser,"P38 product release-candidate checks")
