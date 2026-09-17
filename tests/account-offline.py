"""Service-worker integration on a real local HTTP server, with no real account.
Unlike the routed browser suite, this serves the actual generated Pages files and
allows the real service worker to install, precache and handle offline navigations.
"""
import asyncio, importlib.util, json, threading, traceback
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote
from playwright.async_api import async_playwright

spec=importlib.util.spec_from_file_location('fixtures',Path(__file__).with_name('account-browser.py'))
fixtures=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixtures)
ROOT=fixtures.ROOT;OUT=fixtures.OUT;OUT.mkdir(parents=True,exist_ok=True)

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self,path):
        path=unquote(urlsplit(path).path)
        if not path.startswith('/diet/'):return str(ROOT/'__not_found__')
        resolved=(ROOT/path[len('/diet/'):]).resolve()
        return str(resolved if resolved.is_relative_to(ROOT) else ROOT/'__not_found__')
    def log_message(self,*_):pass

async def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    origin=f'http://127.0.0.1:{server.server_address[1]}'
    url=origin+'/diet/';results=[];errors=[]
    try:
        async with async_playwright() as pw:
            browser=await pw.chromium.launch()
            context=await browser.new_context(service_workers='allow',timezone_id='UTC')
            f=fixtures.Fixture()
            async def route(r):
                if r.request.url.startswith(origin+'/'):return await r.continue_()
                return await f.route(r)
            await context.route('**/*',route)
            await context.route_web_socket('**/*',lambda ws:None)
            context.on('page',lambda p:p.on('pageerror',lambda e:errors.append(str(e))))
            page=await context.new_page()
            # Pre-existing unrelated app cache must not be removed on activation.
            await page.goto(url);await fixtures.ready(page)
            await page.evaluate("caches.open('unrelated-app-cache').then(c=>c.put('/other-data',new Response('keep')))")
            await page.evaluate('navigator.serviceWorker.ready')
            await page.wait_for_function('Boolean(navigator.serviceWorker.controller)',timeout=15000)
            keys=await page.evaluate("caches.open('diet-copilot-web-v1.0.3-account1').then(async c=>(await c.keys()).map(r=>r.url))")
            assert any('/vendor/supabase-2.116.0.js' in k for k in keys)
            assert any('/.well-known/thiepn-app.json' in k for k in keys)
            results.append({'test':'service_worker_installs_with_complete_precache','passed':True})
            assert await page.evaluate("caches.has('unrelated-app-cache')")
            results.append({'test':'unrelated_app_cache_preserved','passed':True})
            await fixtures.sign_in(page)
            await page.wait_for_function("JSON.parse(localStorage.getItem(CACHE_KEY)||'null')?.ownerId===cloud.user?.id")
            await context.set_offline(True)
            await page.reload();await fixtures.signed(page)
            assert 'Account A PRIVATE meal' in await page.locator('body').inner_text()
            results.append({'test':'offline_reload_restores_account_and_owned_cache','passed':True})
            await page.close();page=await context.new_page();await page.goto(url);await fixtures.signed(page)
            assert 'Account A PRIVATE meal' in await page.locator('body').inner_text()
            results.append({'test':'offline_new_tab_restores_account_and_owned_cache','passed':True})
            await page.screenshot(path=str(OUT/'offline-reopened.png'))
            await context.set_offline(False)
            await page.goto(url+'?error_code=access_denied&error_description=fixture')
            await fixtures.ready(page)
            all_keys=await page.evaluate("caches.keys().then(async names=>(await Promise.all(names.map(n=>caches.open(n).then(async c=>(await c.keys()).map(r=>r.url))))).flat())")
            assert not any('error_code=' in k or 'code=' in k for k in all_keys)
            results.append({'test':'oauth_result_query_not_cached','passed':True})
            assert not errors,errors
            results.append({'test':'no_browser_runtime_errors','passed':True})
            await context.close();await browser.close()
    except Exception as error:
        results.append({'test':'offline_integration','passed':False,'error':str(error),'trace':traceback.format_exc(),'pageErrors':errors})
    finally:server.shutdown();server.server_close()
    (OUT/'offline-results.json').write_text(json.dumps({'tests':results},indent=2))
    for r in results:print('PASS' if r['passed'] else 'FAIL',r['test'],r.get('error',''),flush=True)
    raise SystemExit(any(not r['passed'] for r in results))

if __name__=='__main__':asyncio.run(main())
