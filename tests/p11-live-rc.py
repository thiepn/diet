"""P11 live-browser smoke against https://thiepn.dev/diet/v2/."""
import argparse, json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

RC = "https://thiepn.dev/diet/v2/"
ROOT = "https://thiepn.dev/diet/"
RELAY = "https://thiepn.dev/WORDSTRIKE/"
SUPABASE = "https://hycegznamzjhwinegaai.supabase.co"

parser = argparse.ArgumentParser()
parser.add_argument("--browser", choices=["chromium", "firefox", "webkit"], required=True)
parser.add_argument("--out", required=True)
args = parser.parse_args()
out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)
evidence = {"browser": args.browser, "checks": [], "consoleErrors": [], "pageErrors": []}

def check(name, condition, detail=None):
    evidence["checks"].append({"name": name, "passed": bool(condition), "detail": detail})
    assert condition, f"{name}: {detail or 'failed'}"

with sync_playwright() as p:
    browser_type = getattr(p, args.browser)
    browser = browser_type.launch()
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    page = context.new_page()
    page.on("console", lambda msg: evidence["consoleErrors"].append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda error: evidence["pageErrors"].append(str(error)))

    page.goto(RC + "?p11=" + args.browser + "#today", wait_until="networkidle")
    check("RC title", "Diet Copilot 2.0" in page.title(), page.title())
    check("RC marker", page.locator(".dc-version-badge").inner_text().strip() == "2.0 RC")
    check("five primary routes", page.locator(".dc-bottom-nav [data-route]").count() == 5)

    page.locator("[data-account-button]").click()
    expect(page.locator("#v2AccountDialog")).to_be_visible()
    expect(page.locator("#v2AccountSignIn")).to_be_visible()
    check("clean browser sign-in CTA", "Continue with Google" in page.locator("#v2AccountSignIn").inner_text())
    page.locator("#closeV2AccountDialog").click()

    page.goto(ROOT, wait_until="domcontentloaded")
    check("v1 root remains v1", "Diet Copilot 2.0 RC" not in page.content())
    check("v1 root bundle retained", "diet-app.js" in page.content())

    relay = context.new_page()
    nav_urls = []
    relay.on("framenavigated", lambda frame: nav_urls.append(frame.url) if frame == relay.main_frame else None)
    relay.route(SUPABASE + "/auth/v1/token**", lambda route: route.fulfill(status=400, content_type="application/json", body='{"error":"invalid_grant"}'))
    relay.goto(RELAY, wait_until="domcontentloaded")
    relay.evaluate("""() => {
      sessionStorage.setItem('diet-copilot:oauth-target-v2','web-v2');
      sessionStorage.setItem('diet-copilot:oauth-flow-v2','p11-flow');
    }""")
    relay.goto(RELAY + "?code=p11-fake-code&sb_flow_id=p11-flow", wait_until="domcontentloaded")
    relay.wait_for_timeout(800)
    check("OAuth relay targets V2", any("/diet/v2/" in url for url in nav_urls), nav_urls[-6:])
    relay.close()

    signin = context.new_page()
    signin.goto(RC + "#today", wait_until="networkidle")
    signin.locator("[data-account-button]").click()
    auth_requests = []
    def capture(route):
        auth_requests.append(route.request.url)
        route.abort()
    signin.route(SUPABASE + "/auth/v1/authorize**", capture)
    signin.locator("#v2AccountSignIn").click()
    signin.wait_for_timeout(1200)
    check("Google sign-in targets canonical Supabase authorize", any(url.startswith(SUPABASE + "/auth/v1/authorize") for url in auth_requests), auth_requests)
    signin.close()

    mobile = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)
    mp = mobile.new_page()
    mp.goto(RC + "#food", wait_until="networkidle")
    nav_boxes = mp.locator(".dc-bottom-nav [data-route]").evaluate_all("(els) => els.map(e => e.getBoundingClientRect()).map(r => ({top:r.top,bottom:r.bottom,left:r.left,right:r.right}))")
    check("mobile bottom nav has five items", len(nav_boxes) == 5)
    check("mobile bottom nav one row", max(x["top"] for x in nav_boxes) - min(x["top"] for x in nav_boxes) < 4, nav_boxes)
    quick_boxes = mp.locator(".dc-quick-actions--food button").evaluate_all("(els) => els.map(e => e.getBoundingClientRect()).map(r => ({top:r.top,bottom:r.bottom,left:r.left,right:r.right}))")
    check("Food shortcuts present", len(quick_boxes) >= 5)
    check("Food shortcuts one horizontal row", max(x["top"] for x in quick_boxes) - min(x["top"] for x in quick_boxes) < 4, quick_boxes)
    body_width = mp.evaluate("() => ({scroll:document.documentElement.scrollWidth, client:document.documentElement.clientWidth})")
    check("no page-level horizontal overflow", body_width["scroll"] <= body_width["client"] + 2, body_width)

    mp.goto(RC + "#more", wait_until="networkidle")
    mp.locator("#moreAppearanceButton").click()
    mp.locator('[data-theme-choice="dark"]').click()
    check("dark theme applies", mp.evaluate("() => document.documentElement.dataset.theme") == "dark")
    mp.reload(wait_until="networkidle")
    check("dark theme persists reload", mp.evaluate("() => document.documentElement.dataset.theme") == "dark")
    mp.screenshot(path=str(out / "mobile-more-dark.png"), full_page=True)
    mobile.close()

    if args.browser == "chromium":
        pwa = browser.new_context(viewport={"width": 390, "height": 844})
        pw = pwa.new_page()
        pw.goto(RC + "#today", wait_until="networkidle")
        scope = pw.evaluate("async () => (await navigator.serviceWorker.ready).scope")
        check("V2 SW scope", scope.endswith("/diet/v2/"), scope)
        cache_keys = pw.evaluate("async () => await caches.keys()")
        check("P11 cache installed", any("diet-copilot-v2-rc-p11-auth-1" in key for key in cache_keys), cache_keys)
        pwa.set_offline(True)
        pw.reload(wait_until="domcontentloaded")
        check("offline reload remains V2", "Diet Copilot 2.0" in pw.title(), pw.title())
        check("offline reload never v1", "2.0 RC" in pw.locator(".dc-version-badge").inner_text())
        pwa.set_offline(False)
        pwa.close()

    check("no page runtime errors", not evidence["pageErrors"], evidence["pageErrors"])
    browser.close()

(out / "results.json").write_text(json.dumps(evidence, indent=2), encoding="utf-8")
print("PASS:", args.browser, "live RC checks")
