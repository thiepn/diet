"""Real browser + production Supabase SDK tests. All account/API traffic is mocked.
No real Google login, access token, user nutrition record, or production write is used.
"""
import argparse, asyncio, base64, json, mimetypes, tempfile, time, traceback
from datetime import datetime, timezone
from pathlib import Path
from playwright.async_api import async_playwright

parser=argparse.ArgumentParser()
parser.add_argument('--browser',default='chromium')
parser.add_argument('--root',default='.')
parser.add_argument('--out',default='account-test-results')
args=parser.parse_args()
ROOT=Path(args.root).resolve(); OUT=Path(args.out); OUT.mkdir(parents=True,exist_ok=True)
ORIGIN='https://thiepn.dev'; URL=ORIGIN+'/diet/'
KEY='sb-hycegznamzjhwinegaai-auth-token'
A='11111111-1111-4111-8111-111111111111'; B='22222222-2222-4222-8222-222222222222'
def user(uid=A):return {'id':uid,'email':('fixture-a' if uid==A else 'fixture-b')+'@example.test','aud':'authenticated','role':'authenticated','app_metadata':{'provider':'google'},'user_metadata':{},'created_at':'2026-01-01T00:00:00Z'}
def enc(x):return base64.urlsafe_b64encode(json.dumps(x).encode()).decode().rstrip('=')
def session(uid=A,expired=False,refresh='fixture-refresh'):
    expiry=int(time.time())+(-3600 if expired else 3600)
    token=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'sub':uid,'aud':'authenticated','role':'authenticated','iat':int(time.time())-10,'exp':expiry})+'.'+base64.urlsafe_b64encode(b'fixture-signature-not-a-real-key').decode().rstrip('=')
    return {'access_token':token,'refresh_token':refresh,'expires_in':3600,'expires_at':expiry,'token_type':'bearer','user':user(uid)}
def owner(req):
    try:
        part=req.headers.get('authorization','').split('.')[1]
        return json.loads(base64.urlsafe_b64decode(part+'='*((4-len(part)%4)%4)))['sub']
    except Exception:return A

def data(table,uid):
    date=datetime.now(timezone.utc).strftime('%Y-%m-%d')
    if table=='profiles':return {'calorie_target':2300,'protein_target':160,'fiber_target':30}
    if table=='daily_logs':return [{'id':'day-'+uid,'log_date':date,'calorie_target':2300,'protein_target':160,'status':'complete'}]
    if table=='meals':return [{'id':'meal-'+uid,'daily_log_id':'day-'+uid,'title':('Account A PRIVATE meal' if uid==A else 'Account B PRIVATE meal'),'meal_type':'Lunch','calories':600,'protein':40,'fiber':12,'eaten_at':date+'T12:00:00Z','source':'manual_exact','confidence':'high'}]
    return []

class Fixture:
    def __init__(self):
        self.token_calls=0; self.oauth_calls=0; self.logout_calls=0; self.rest_calls=0
        self.token_error=False; self.logout_error=False; self.rest_error=False
        self.slow=None; self.uid=A; self.errors=[]; self.logs=[]
    async def route(self,route):
        req=route.request; url=req.url
        try:
            if '/auth/v1/authorize' in url:
                self.oauth_calls+=1
                return await route.fulfill(status=302,headers={'location':ORIGIN+'/WORDSTRIKE/?code=fixture-code'})
            if '/auth/v1/token' in url:
                self.token_calls+=1
                if self.token_error:return await route.fulfill(status=400,json={'code':'refresh_token_not_found','msg':'Fixture session revoked'})
                return await route.fulfill(json=session(self.uid,refresh='fixture-rotated-refresh'))
            if '/auth/v1/user' in url:return await route.fulfill(json=user(owner(req)))
            if '/auth/v1/logout' in url:
                self.logout_calls+=1
                return await route.fulfill(status=503 if self.logout_error else 204,body=json.dumps({'msg':'fixture server unavailable'}) if self.logout_error else '')
            if '.supabase.co/rest/v1/' in url:
                self.rest_calls+=1
                uid=owner(req);table=url.split('/rest/v1/',1)[1].split('?')[0]
                if self.slow:await self.slow.wait()
                if self.rest_error:return await route.fulfill(status=503,json={'message':'fixture temporarily unavailable'})
                return await route.fulfill(json={'capabilities':{},'schema_version':'fixture'} if table.startswith('rpc/') else data(table,uid))
            if url.startswith(ORIGIN+'/WORDSTRIKE/'):
                # Equivalent to the production relay: forward the one-time code;
                # never construct another client or exchange the code here.
                return await route.fulfill(content_type='text/html',body="""<script>const source=new URL(location.href);const target=new URL('/diet/',source.origin);for(const key of ['code','error','error_code','error_description']){const value=source.searchParams.get(key);if(value!==null)target.searchParams.set(key,value);}const flow=source.searchParams.get('sb_flow_id')||sessionStorage.getItem('diet-copilot:oauth-flow-v2');if(flow)target.searchParams.set('sb_flow_id',flow);sessionStorage.removeItem('diet-copilot:oauth-target-v2');sessionStorage.removeItem('diet-copilot:oauth-flow-v2');history.replaceState(null,'',source.pathname);location.replace(target.href);</script>""")
            if url.startswith(URL):
                path=url[len(URL):].split('?',1)[0] or 'index.html';file=(ROOT/path).resolve()
                if not file.is_relative_to(ROOT) or not file.is_file():return await route.fulfill(status=404,body='not found')
                mime=mimetypes.guess_type(str(file))[0] or 'application/octet-stream'
                return await route.fulfill(body=file.read_bytes(),content_type=mime)
            await route.abort()
        except Exception:
            # A deliberately aborted account-scoped read may finish after the page closed.
            if not req.is_navigation_request():return
            raise
    async def setup(self,context):
        await context.route('**/*',self.route)
        # A mocked socket is never connected to the real Supabase server.
        await context.route_web_socket('**/*',lambda ws:None)
        def watch(page):
            page.on('pageerror',lambda error:self.errors.append(str(error)))
            page.on('console',lambda msg:self.logs.append(msg.text) if msg.type=='warning' else None)
        context.on('page',watch)

async def ready(page):
    await page.wait_for_function("typeof DietAccount !== 'undefined' && !DietAccount.diagnostics().initializing && DietAccount.diagnostics().phase !== 'initializing'",timeout=15000)
async def page_for(context):
    page=await context.new_page();await page.goto(URL);await ready(page);return page
async def sign_in(page,uid=A):
    result=await page.evaluate("async s=>{const r=await cloud.client.auth.setSession(s);return r.error?.message||null}",session(uid))
    assert result is None,result
    await page.wait_for_function('(uid)=>cloud.user?.id===uid',arg=uid,timeout=10000)
    await page.wait_for_function("dashboard.source==='cloud'",timeout=10000)
async def seed(page,value):
    await page.evaluate("({key,value})=>dietAuthStorage.setItem(key,JSON.stringify(value))",{'key':KEY,'value':value})
async def signed(page,uid=A):
    await ready(page);assert await page.evaluate('cloud.user?.id||null')==uid
async def no_private(page):
    assert 'PRIVATE meal' not in await page.locator('body').inner_text()
    assert await page.evaluate('dashboard.meals.length')==0

async def test_clean(context,f):
    page=await page_for(context);assert await page.evaluate('DietAccount.diagnostics().phase')=='signed-out';await no_private(page)
async def test_oauth(context,f):
    page=await page_for(context);await page.evaluate('openConnection()');await page.locator('#googleSignInBtn').click()
    # The pre-redirect page is already /diet/: wait for an authenticated return,
    # not a URL predicate that can succeed before the navigation even starts.
    await page.wait_for_function("typeof cloud!=='undefined' && cloud.user?.id==="+json.dumps(A),timeout=15000)
    await page.wait_for_url(lambda url:str(url).startswith(URL));await signed(page)
    assert '?' not in page.url
    assert f.oauth_calls==1 and f.token_calls==1
    assert await page.evaluate('DietAccount.diagnostics().clientCount')==1
async def test_reopen(context,f):
    page=await page_for(context);await sign_in(page);await page.close();page=await page_for(context);await signed(page)
async def test_reload(context,f):
    page=await page_for(context);await sign_in(page);await page.reload();await signed(page)
async def blocked(context):
    await context.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new DOMException('fixture blocked','SecurityError')}})")
async def test_cookie(context,f):
    await blocked(context);page=await page_for(context);await sign_in(page)
    assert await page.evaluate('DietAccount.diagnostics().backend')=='cookie'
    await page.close();page=await page_for(context);await signed(page)
async def test_cookie_oauth(context,f):
    await blocked(context);await test_oauth(context,f)
async def test_quota(context,f):
    await context.add_init_script("const ls=window.localStorage;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===ls)throw new DOMException('fixture full','QuotaExceededError');return original.call(this,k,v);}")
    page=await page_for(context);await sign_in(page);await page.close();page=await page_for(context);await signed(page)
async def test_denied(context,f):
    await blocked(context);await context.add_init_script("Object.defineProperty(document,'cookie',{get(){return ''},set(v){}})")
    page=await page_for(context);await page.evaluate('openConnection()');await page.locator('#googleSignInBtn').click()
    await page.wait_for_function("Boolean(cloud.error)");assert f.oauth_calls==0;assert 'storage' in (await page.locator('#connectionContent').inner_text()).lower()
async def test_invalid(context,f):
    page=await page_for(context);await page.evaluate('(key)=>localStorage.setItem(key,"{broken")',KEY);await page.reload();await ready(page)
    assert await page.evaluate('(key)=>localStorage.getItem(key)',KEY) is None;await no_private(page)
async def test_refresh(context,f):
    page=await page_for(context);await seed(page,session(expired=True));await page.reload();await signed(page)
    assert f.token_calls>=1
    assert await page.evaluate('(key)=>JSON.parse(dietAuthStorage.getItem(key)).refresh_token',KEY)=='fixture-rotated-refresh'
async def test_revoked(context,f):
    page=await page_for(context);await seed(page,session(expired=True));f.token_error=True;await page.reload();await ready(page)
    assert await page.evaluate('cloud.user') is None;await no_private(page)
async def test_data_failure(context,f):
    page=await page_for(context);await sign_in(page);f.rest_error=True;await page.evaluate('refreshData({silent:true})')
    assert await page.evaluate('cloud.user.id')==A;assert await page.evaluate('DietAccount.diagnostics().storedSession')
async def test_offline(context,f):
    page=await page_for(context);await sign_in(page)
    await page.evaluate("Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false})")
    await page.evaluate('refreshData({silent:true})');assert await page.evaluate('cloud.user.id')==A
    assert 'Account A PRIVATE meal' in await page.locator('body').inner_text()
async def test_duplicate_init(context,f):
    page=await page_for(context);await sign_in(page);await page.evaluate('Promise.all(Array.from({length:12},()=>initCloud(false)))')
    assert await page.evaluate('DietAccount.diagnostics().clientCount')==1
    assert await page.evaluate('cloud.client.getChannels().length')<=1
async def test_switch(context,f):
    page=await page_for(context);await sign_in(page);await sign_in(page,B)
    await page.wait_for_function("dashboard.meals[0]?.title==='Account B PRIVATE meal'")
    assert 'Account A PRIVATE meal' not in await page.locator('body').inner_text()
    assert await page.evaluate("JSON.parse(localStorage.getItem(CACHE_KEY)).ownerId")==B
async def test_other_cache(context,f):
    page=await page_for(context);await sign_in(page,B)
    await seed(page,session(A));await context.add_init_script("Object.defineProperty(navigator,'onLine',{get:()=>false})")
    await page.reload();await signed(page,A);assert 'Account B PRIVATE meal' not in await page.locator('body').inner_text()
async def test_logout(context,f):
    page=await page_for(context);await sign_in(page);await page.evaluate('openConnection()');await page.locator('#signOutBtn').click()
    await page.wait_for_function("DietAccount.diagnostics().phase==='signed-out'");await no_private(page)
    await page.close();page=await page_for(context);assert not await page.evaluate('DietAccount.diagnostics().storedSession')
async def test_logout_failed(context,f):
    page=await page_for(context);await sign_in(page);f.logout_error=True;await page.evaluate('dietSignOut()');await no_private(page)
    assert not await page.evaluate('DietAccount.diagnostics().storedSession');assert 'revocation' in await page.evaluate('cloud.error')
    await page.reload();await ready(page);assert await page.evaluate('cloud.user') is None
async def test_pending_logout(context,f):
    page=await page_for(context);await sign_in(page);f.slow=asyncio.Event()
    await page.evaluate('void refreshData({silent:true})');await asyncio.sleep(.15)
    await page.evaluate('dietSignOut()');f.slow.set();await asyncio.sleep(.2);await no_private(page)
    assert await page.evaluate('localStorage.getItem(CACHE_KEY)') is None
async def test_tabs(context,f):
    page=await page_for(context);await sign_in(page);other=await page_for(context);await signed(other)
    await page.evaluate('dietSignOut()');await other.wait_for_function('cloud.user===null');await no_private(other)
async def test_cookie_tabs(context,f):
    await blocked(context);await test_tabs(context,f)
async def test_cancel(context,f):
    page=await context.new_page();await page.goto(URL+'?error=access_denied&error_description=cancelled');await ready(page)
    assert '?' not in page.url;assert 'cancelled' in await page.evaluate('cloud.error');assert f.token_calls==0
async def test_missing_pkce(context,f):
    page=await context.new_page();await page.goto(URL+'?code=expired-fixture&sb_flow_id=abcdefgh');await ready(page)
    assert '?' not in page.url;assert await page.evaluate('cloud.user') is None;assert await page.evaluate('Boolean(cloud.error)')
async def test_diagnostics(context,f):
    page=await page_for(context);await sign_in(page);await page.evaluate('openConnection()');await page.locator('.diet-account-diagnostics summary').click()
    report=await page.locator('.diet-account-diagnostics pre').inner_text()
    for secret in ['access_token','refresh_token','fixture-a@example.test',A,'PRIVATE meal']:assert secret not in report
    await page.screenshot(path=str(OUT/'account-desktop.png'))
    await page.set_viewport_size({'width':390,'height':844});await page.screenshot(path=str(OUT/'account-mobile.png'))
    assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
async def test_views(context,f):
    page=await page_for(context);await sign_in(page)
    for view in ['today','history','trends','insights']:
        await page.evaluate('(v)=>setView(v)',view)
        assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        await page.screenshot(path=str(OUT/(view+'.png')))
async def test_unrelated(context,f):
    page=await page_for(context);await page.evaluate("localStorage.setItem('other-app-record','keep')");await sign_in(page);await page.evaluate('dietSignOut()')
    assert await page.evaluate("localStorage.getItem('other-app-record')")=='keep'
async def test_resume(context,f):
    page=await page_for(context);await sign_in(page)
    await page.evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})); window.dispatchEvent(new Event('online'))")
    await signed(page);assert await page.evaluate('DietAccount.diagnostics().clientCount')==1

async def test_blocked_preferences(context,f):
    await blocked(context)
    page=await page_for(context);await sign_in(page)
    await page.evaluate("setView('history')")
    await page.locator('[data-v66-history-filter="exact"]').click()
    await page.locator('[data-v66-history-filter="estimated"]').click()
    await page.locator('[data-v66-history-filter="all"]').click()
    await page.evaluate("setView('trends')")
    await page.locator('[data-trend-metric="calories"]').click()
    await page.locator('[data-trend-range="90"]').click()
    await page.evaluate("setView('insights')")
    assert await page.evaluate('cloud.user.id')==A
async def test_copy_diagnostics(context,f):
    await context.add_init_script("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{await new Promise(r=>setTimeout(r,10));window.fixtureCopied=text;}}})")
    page=await page_for(context);await page.evaluate('openConnection()');await page.locator('.diet-account-diagnostics summary').click()
    await page.locator('#accountCopyDiagnosticsBtn').click()
    await page.wait_for_function("document.getElementById('accountCopyDiagnosticsBtn').textContent==='Copied'")
    assert json.loads(await page.evaluate('window.fixtureCopied'))['release']=='1.0.3'
    await page.evaluate("navigator.clipboard.writeText=async()=>{throw new Error('fixture denied')}")
    await page.locator('#accountCopyDiagnosticsBtn').click()
    await page.wait_for_function("document.getElementById('accountCopyDiagnosticsBtn').textContent.startsWith('Select')")
async def test_refresh_immediate_logout(context,f):
    page=await page_for(context);await sign_in(page)
    await page.evaluate('async()=>{const read=refreshData({silent:true});const signout=dietSignOut();await Promise.all([read,signout]);}')
    assert await page.evaluate('cloud.status')=='configured';await no_private(page)
async def test_pending_realtime_switch(context,f):
    page=await page_for(context);await sign_in(page)
    await page.evaluate("""()=>{
      cloud.channel.__dietEpoch=-1;
      const original=cloud.client.removeChannel.bind(cloud.client);
      cloud.client.removeChannel=async channel=>{await new Promise(r=>setTimeout(r,150));return original(channel)};
      void subscribeRealtime();
    }""")
    await sign_in(page,B)
    await page.wait_for_function('(uid)=>cloud.channel?.__dietOwner===uid',arg=B)
    await asyncio.sleep(.25)
    assert await page.evaluate('cloud.channel.__dietOwner')==B
    assert await page.evaluate('cloud.client.getChannels().length')==1
async def test_native_flow_guards(context,f):
    page=await page_for(context)
    assert await page.evaluate("dietNativeHandleAuthUrl('https://other.test/?code=ignored')") is False
    for record in ['invalid',{'flowId':'abcdefgh','createdAt':1},{'flowId':'abcdefgh','createdAt':int(time.time()*1000)+120000}]:
        await page.evaluate('(value)=>localStorage.setItem(DIET_NATIVE_PENDING_FLOW_KEY,JSON.stringify(value))',record)
        assert await page.evaluate('dietNativePendingFlowId()') is None
    await page.evaluate("dietNativeRememberFlowId('abcdefgh')")
    await page.evaluate("dietNativeHandleAuthUrl('dev.thiepn.diet://auth-callback?code=fixture&sb_flow_id=wrongflow')")
    assert f.token_calls==0
    assert await page.evaluate('cloud.user') is None
    assert 'expired' in await page.evaluate('cloud.error')
async def test_native_retry(context,f):
    page=await page_for(context)
    await page.evaluate("dietIsNativeAndroid=()=>true;window.DietNative={startGoogleOAuth:async()=>{window.fixtureStarts=(window.fixtureStarts||0)+1}}")
    await page.evaluate('dietSignInWithGoogle()');await page.evaluate('dietSignInWithGoogle()')
    assert await page.evaluate('window.fixtureStarts')==2

CASES=[test_clean,test_oauth,test_reopen,test_reload,test_cookie,test_quota,test_denied,test_invalid,test_refresh,test_revoked,test_data_failure,test_offline,test_duplicate_init,test_switch,test_other_cache,test_logout,test_logout_failed,test_pending_logout,test_tabs,test_cookie_tabs,test_cancel,test_missing_pkce,test_diagnostics,test_views,test_unrelated,test_resume,test_blocked_preferences,test_copy_diagnostics,test_refresh_immediate_logout,test_pending_realtime_switch,test_native_flow_guards,test_native_retry,test_cookie_oauth]
async def main():
    results=[]
    async with async_playwright() as pw:
        engine=getattr(pw,args.browser);browser=await engine.launch()
        for case in CASES:
            context=await browser.new_context(service_workers='block',viewport={'width':1440,'height':1000},timezone_id='UTC')
            f=Fixture();await f.setup(context)
            try:
                await asyncio.wait_for(case(context,f),timeout=40)
                assert not f.errors, f.errors
                assert not any('Multiple GoTrueClient' in x for x in f.logs), f.logs
                results.append({'test':case.__name__,'passed':True});print('PASS',case.__name__,flush=True)
            except Exception as error:
                results.append({'test':case.__name__,'passed':False,'error':str(error),'trace':traceback.format_exc(),'pageErrors':f.errors});print('FAIL',case.__name__,str(error),flush=True)
            finally:await context.close()
        await browser.close()
        # Real disk-backed profile restart, not a copied storageState snapshot.
        for mode in ['localStorage','cookie']:
            name='browser_restart_'+mode
            with tempfile.TemporaryDirectory() as profile:
                try:
                    context=await engine.launch_persistent_context(profile,service_workers='block',timezone_id='UTC')
                    f=Fixture();await f.setup(context)
                    if mode=='cookie':await blocked(context)
                    page=await page_for(context);await sign_in(page);await context.close()
                    context=await engine.launch_persistent_context(profile,service_workers='block',timezone_id='UTC')
                    f=Fixture();await f.setup(context)
                    if mode=='cookie':await blocked(context)
                    page=await page_for(context);await signed(page);assert not f.errors,f.errors
                    results.append({'test':name,'passed':True});print('PASS',name,flush=True)
                except Exception as error:
                    results.append({'test':name,'passed':False,'error':str(error),'trace':traceback.format_exc()});print('FAIL',name,str(error),flush=True)
                finally:
                    try:await context.close()
                    except Exception:pass
    (OUT/'results.json').write_text(json.dumps({'browser':args.browser,'tests':results},indent=2))
    failed=sum(not x['passed'] for x in results)
    print(f"{len(results)-failed}/{len(results)} {args.browser} account browser tests passed.")
    raise SystemExit(bool(failed))
if __name__ == '__main__':
    asyncio.run(main())
