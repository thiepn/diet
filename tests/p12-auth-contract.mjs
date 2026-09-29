import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root=fs.readFileSync('index.html','utf8');
const alias=fs.readFileSync('v2/index.html','utf8');
const data=fs.readFileSync('v2/data.js','utf8');
const auth=fs.readFileSync('v2/auth-storage.mjs','utf8');
const writeApi=fs.readFileSync('v2/write-api.mjs','utf8');
const rootSw=fs.readFileSync('sw.js','utf8');
const aliasSw=fs.readFileSync('v2/sw.js','utf8');
const legacy=fs.readFileSync('legacy-v1.html','utf8');
const legacyApp=fs.readFileSync('legacy-v1-app.js','utf8');
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
const app=JSON.parse(fs.readFileSync('.well-known/thiepn-app.json','utf8'));
const backend=JSON.parse(fs.readFileSync('supabase/backend.json','utf8'));

assert.match(root,/dc-version-badge">2\.0</);
assert.doesNotMatch(root,/2\.0 RC/);
assert.match(root,/src="\.\/v2\/data\.js"/);
assert.match(root,/href="\.\/v2\/shell\.css"/);
assert.match(alias,/Stable compatibility route\./);
assert.doesNotMatch(alias,/2\.0 RC/);
assert.match(legacy,/legacy-v1-app\.js\?v=1\.0\.3-p12-rollback/);
assert.match(legacyApp,/dietSetBrowserOAuthRelayState\('web-v1-legacy'/);

for(const id of ['v2AccountSignIn','v2AccountSignOut','v2AccountRefresh','v2AccountProduction']){
  assert.match(root,new RegExp('id="'+id+'"'),'Missing P12 account control '+id);
}
assert.match(data,/DIET_V2_AUTH_RELAY='https:\/\/thiepn\.dev\/wordstrike\/'/);
assert.match(data,/sessionStorage\.setItem\(DIET_V2_OAUTH_TARGET_KEY,'web-v2'\)/);
assert.match(data,/provider:'google'/);
assert.match(data,/redirectTo:DIET_V2_AUTH_RELAY/);
assert.match(data,/skipBrowserRedirect:true/);
assert.match(data,/auth\.exchangeCodeForSession\(/);
assert.match(data,/auth\.signOut\(\{scope:'local'\}\)/);
assert.match(data,/version:'2\.0\.0-p12'/);
assert.doesNotMatch(data,/service_role|sb_secret_|SUPABASE_DB_URL/);

assert.match(writeApi,/p_request_id/);
assert.match(writeApi,/diet_app_log_meal/);
assert.match(writeApi,/diet_app_update_meal/);
assert.match(writeApi,/diet_app_resolve_strategy_review/);
assert.match(rootSw,/diet-copilot-prod-v2-p12-1/);
assert.match(rootSw,/scopePath\+'v2\/'/);
assert.match(rootSw,/legacy-v1-app\.js\?v=1\.0\.3-p12-rollback/);
assert.match(aliasSw,/diet-copilot-v2-alias-p12-1/);
for(const source of [rootSw,aliasSw])assert.match(source,/\['code','sb_flow_id','error','error_code','error_description'\]/);

assert.equal(manifest.name,'Diet Copilot 2.0');
assert.equal(manifest.start_url,'./#today');
assert.equal(app.webRelease,'2.0.0');
assert.equal(app.operationsVersion,'P12.1');
assert.equal(app.integrationMode,'certified-legacy');
assert.equal(app.runtimeMode,'adaptive-v2-production');
assert.equal(app.health?.writesPerformedByDashboard,true);
assert.equal(app.health?.writesRequireExplicitConfirmation,true);
assert.equal(backend.product_boundary?.dashboard_manual_logging,true);
assert.equal(backend.product_boundary?.dashboard_quick_capture,true);
assert.equal(backend.product_boundary?.writes_require_explicit_confirmation,true);
assert.equal(backend.product_boundary?.activity_calorie_eat_back,false);

const source=auth.replaceAll('export const ','const ');
const session=new Map();
const cookies=new Map();
const localStorage={
  getItem(){throw Object.assign(new Error('blocked'),{name:'SecurityError'});},
  setItem(){throw Object.assign(new Error('blocked'),{name:'SecurityError'});},
  removeItem(){}
};
const sessionStorage={
  getItem:key=>session.get(key)??null,
  setItem:(key,value)=>session.set(key,String(value)),
  removeItem:key=>session.delete(key)
};
const document={};
Object.defineProperty(document,'cookie',{
  get:()=>[...cookies].map(pair=>pair[0]+'='+pair[1]).join('; '),
  set:s=>{
    const parts=s.split(';'),entry=parts[0],pos=entry.indexOf('=');
    const name=entry.slice(0,pos),value=entry.slice(pos+1);
    if(parts.some(a=>a.trim()==='Max-Age=0'))cookies.delete(name);
    else cookies.set(name,value);
  }
});
const context=vm.createContext({document,location:{protocol:'https:'},localStorage,sessionStorage,Date,Math,console});
vm.runInContext(source,context);

const verifierKey='sb-hycegznamzjhwinegaai-auth-token-code-verifier';
context.__key=verifierKey;
vm.runInContext("dietV2AuthStorage.setItem(__key,'pkce-verifier-value')",context);
assert.equal(vm.runInContext('dietV2AuthStorage.getItem(__key)',context),'pkce-verifier-value');
assert.ok([...session.keys()].some(k=>k.includes(verifierKey)));
vm.runInContext('dietV2AuthStorage.removeItem(__key)',context);
assert.equal(vm.runInContext('dietV2AuthStorage.getItem(__key)',context),null);

const authKey='sb-hycegznamzjhwinegaai-auth-token';
context.__authKey=authKey;
context.__sessionJson=JSON.stringify({access_token:'a',refresh_token:'r',expires_at:2000000000,user:{id:'u'}});
vm.runInContext('dietV2AuthStorage.setItem(__authKey,__sessionJson)',context);
assert.equal(vm.runInContext('dietV2AuthStorage.getItem(__authKey)',context),context.__sessionJson);
assert.ok(cookies.size>0);
assert.equal([...session.keys()].some(k=>k.includes(authKey)&&!k.includes('code-verifier')),false);

console.log('Diet Copilot 2.0 P12 auth, production and rollback contract passed.');
