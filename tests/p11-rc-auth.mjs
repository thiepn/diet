import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('v2/index.html','utf8');
const data=fs.readFileSync('v2/data.js','utf8');
const auth=fs.readFileSync('v2/auth-storage.mjs','utf8');
const sw=fs.readFileSync('v2/sw.js','utf8');

for(const id of ['v2AccountSignIn','v2AccountSignOut','v2AccountRefresh','v2AccountProduction']){
  assert.match(html,new RegExp('id="'+id+'"'),'Missing P11 account control '+id);
}
assert.match(html,/Continue with Google/);
assert.match(html,/Open production v1/);

assert.match(data,/DIET_V2_AUTH_RELAY='https:\/\/thiepn\.dev\/wordstrike\/'/);
assert.match(data,/DIET_V2_OAUTH_TARGET_KEY='diet-copilot:oauth-target-v2'/);
assert.match(data,/sessionStorage\.setItem\(DIET_V2_OAUTH_TARGET_KEY,'web-v2'\)/);
assert.match(data,/auth\.signInWithOAuth\(\{\s*provider:'google'/s);
assert.match(data,/redirectTo:DIET_V2_AUTH_RELAY/);
assert.match(data,/skipBrowserRedirect:true/);
assert.match(data,/queryParams:\{prompt:'select_account'\}/);
assert.match(data,/target\.origin!==new URL\(SUPABASE_URL\)\.origin\|\|target\.pathname!=='\/auth\/v1\/authorize'/);
assert.match(data,/auth\.exchangeCodeForSession\(/);
assert.match(data,/DIET_V2_OAUTH_QUERY_KEYS/);
assert.match(data,/history\.replaceState\(null,''/);
assert.match(data,/auth\.signOut\(\{scope:'local'\}\)/);
assert.match(data,/version:'2\.0\.0-p11-rc'/);
assert.doesNotMatch(data,/\\n/,'V2 browser modules must not contain accidental literal \\n source artifacts.');
assert.doesNotMatch(data,/service_role|sb_secret_|SUPABASE_DB_URL/);

assert.match(sw,/diet-copilot-v2-rc-p11-auth-1/);
assert.match(sw,/\['code','sb_flow_id','error','error_code','error_description'\]/);

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
    const parts=s.split(';');
    const entry=parts[0];
    const pos=entry.indexOf('=');
    const name=entry.slice(0,pos);
    const value=entry.slice(pos+1);
    if(parts.some(a=>a.trim()==='Max-Age=0'))cookies.delete(name);
    else cookies.set(name,value);
  }
});
const context=vm.createContext({
  document,location:{protocol:'https:'},localStorage,sessionStorage,Date,Math,console
});
vm.runInContext(source,context);

const verifierKey='sb-hycegznamzjhwinegaai-auth-token-code-verifier';
context.__key=verifierKey;
vm.runInContext("dietV2AuthStorage.setItem(__key,'pkce-verifier-value')",context);
assert.equal(vm.runInContext('dietV2AuthStorage.getItem(__key)',context),'pkce-verifier-value');
assert.ok([...session.keys()].some(k=>k.includes(verifierKey)),'PKCE verifier must fall back to sessionStorage when localStorage is blocked.');
vm.runInContext('dietV2AuthStorage.removeItem(__key)',context);
assert.equal(vm.runInContext('dietV2AuthStorage.getItem(__key)',context),null);

const authKey='sb-hycegznamzjhwinegaai-auth-token';
context.__authKey=authKey;
const sessionJson=JSON.stringify({access_token:'a',refresh_token:'r',expires_at:2000000000,user:{id:'u'}});
context.__sessionJson=sessionJson;
vm.runInContext('dietV2AuthStorage.setItem(__authKey,__sessionJson)',context);
assert.equal(vm.runInContext('dietV2AuthStorage.getItem(__authKey)',context),sessionJson);
assert.ok(cookies.size>0,'Long-lived auth session must still use resilient cookie storage rather than sessionStorage.');
assert.equal([...session.keys()].some(k=>k.includes(authKey)&&!k.includes('code-verifier')),false);

console.log('Diet Copilot 2.0 P11 standalone auth/PWA contract passed.');
