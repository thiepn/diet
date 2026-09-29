"""P13 live-browser reliability certification for canonical production."""
import argparse, json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

PROD="https://thiepn.dev/diet/"
ALIAS="https://thiepn.dev/diet/v2/"
LEGACY="https://thiepn.dev/diet/legacy-v1.html"

parser=argparse.ArgumentParser()
parser.add_argument("--browser",choices=["chromium","firefox","webkit"],required=True)
parser.add_argument("--out",required=True)
args=parser.parse_args()
out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
evidence={"browser":args.browser,"checks":[],"pageErrors":[],"consoleErrors":[]}

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
    page.on("console",lambda msg:evidence["consoleErrors"].append(msg.text) if msg.type=="error" else None)

    page.goto(PROD+"?p13="+args.browser+"#more",wait_until="networkidle")
    check("canonical stable title","Diet Copilot 2.0" in page.title(),page.title())
    check("stable 2.0 marker",page.locator(".dc-version-badge").inner_text().strip()=="2.0")
    check("System Health card present",page.locator("#moreHealthButton").count()==1)

    page.locator("#moreHealthButton").click()
    expect(page.locator("#systemHealthDialog")).to_be_visible()
    check("health privacy copy","operational metadata only" in page.locator("#systemHealthDialog").inner_text())
    check("health diagnostics actions",page.locator("#healthCopyDiagnostics").is_visible() and page.locator("#healthClearDiagnostics").is_visible())
    diag=page.evaluate("() => window.DietV2Settings?.healthDiagnostics?.() ?? null")
    check("health diagnostics available",isinstance(diag,dict),diag)
    diag_text=json.dumps(diag)
    for forbidden in ["access_token","refresh_token","requestId","oauth_code","user_email"]:
        check("diagnostics exclude "+forbidden,forbidden not in diag_text,diag_text[:500])
    check("diagnostics local telemetry policy",diag.get("telemetryPolicy","").startswith("local operational metadata only"),diag.get("telemetryPolicy"))
    check("telemetry recorded events",diag.get("telemetry",{}).get("eventCount",0)>=1,diag.get("telemetry"))
    page.locator('[data-p9-close="systemHealthDialog"]').click()

    alias=context.new_page()
    alias.goto(ALIAS+"#more",wait_until="networkidle")
    check("V2 compatibility health UI",alias.locator("#moreHealthButton").count()==1)
    alias.close()

    legacy=context.new_page()
    legacy.goto(LEGACY,wait_until="domcontentloaded")
    check("V1 rollback remains available","legacy-v1-app.js" in legacy.content())
    legacy.close()

    mobile=browser.new_context(viewport={"width":390,"height":844})
    mp=mobile.new_page()
    mp.goto(PROD+"#more",wait_until="networkidle")
    width=mp.evaluate("() => ({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})")
    check("mobile no page overflow",width["scroll"]<=width["client"]+2,width)
    mp.locator("#moreHealthButton").click()
    expect(mp.locator("#systemHealthDialog")).to_be_visible()
    health_box=mp.locator("#systemHealthDialog .dc-modal-card").bounding_box()
    check("mobile health sheet fits viewport",health_box is not None and health_box["width"]<=392,health_box)
    mobile.close()

    if args.browser=="chromium":
        pwa=browser.new_context(viewport={"width":390,"height":844})
        pw=pwa.new_page()
        pw.goto(PROD+"#today",wait_until="networkidle")
        scope=pw.evaluate("async()=> (await navigator.serviceWorker.ready).scope")
        check("P13 production SW scope",scope.endswith("/diet/"),scope)
        keys=pw.evaluate("async()=>await caches.keys()")
        check("P13 production cache installed",any("diet-copilot-prod-v2-p13-1" in key for key in keys),keys)
        pwa.set_offline(True)
        pw.reload(wait_until="domcontentloaded")
        check("P13 offline reload remains V2",pw.locator(".dc-version-badge").inner_text().strip()=="2.0")
        check("offline System Health remains available",pw.locator("#moreHealthButton").count()==1)
        pwa.set_offline(False)
        pwa.close()

    check("no runtime page errors",not evidence["pageErrors"],evidence["pageErrors"])
    browser.close()

save()
print("PASS:",args.browser,"P13 reliability checks")
