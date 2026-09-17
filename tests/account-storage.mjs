import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('src/auth/dashboard-auth-persist.js','utf8');
const key='sb-hycegznamzjhwinegaai-auth-token';
const sample=n=>JSON.stringify({access_token:'fixture-access-'+n,refresh_token:'fixture-refresh-'+n,expires_at:2000000000,user:{id:'fixture-'+n}});
let count=0;
function environment({local=new Map(),cookies=new Map(),mode='normal',cookieBlocked=false,transient=new Map()}={}){
 const storage={getItem:k=>{if(mode==='blocked')throw Object.assign(new Error(),{name:'SecurityError'});return local.get(k)??null;},setItem:(k,v)=>{if(['blocked','quota'].includes(mode))throw Object.assign(new Error(),{name:mode==='quota'?'QuotaExceededError':'SecurityError'});if(mode!=='silent')local.set(k,String(v));},removeItem:k=>{if(mode!=='quota-stale')local.delete(k);}};
 if(mode==='quota-stale')storage.setItem=()=>{throw Object.assign(new Error(),{name:'QuotaExceededError'})};
 const ss={getItem:k=>transient.get(k)??null,setItem:(k,v)=>transient.set(k,String(v)),removeItem:k=>transient.delete(k)};
 const document={};Object.defineProperty(document,'cookie',{get:()=>[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),set:s=>{if(cookieBlocked)return;const [entry,...attrs]=s.split(';');const pos=entry.indexOf('=');const n=entry.slice(0,pos),v=entry.slice(pos+1);if(attrs.some(a=>a.trim()==='Max-Age=0'))cookies.delete(n);else cookies.set(n,v);}});
 const context=vm.createContext({document,location:{protocol:'https:'},localStorage:storage,sessionStorage:ss,window:{localStorage:storage,sessionStorage:ss},Date,Math,console});
 vm.runInContext(source,context);
 return {run:s=>vm.runInContext(s,context),local,cookies,transient};
}
function test(name,fn){fn();count++;console.log('PASS',name)}
for(const mode of ['normal','blocked','quota','silent'])test(`${mode}: write, read, fresh-tab recovery`,()=>{
 const e=environment({mode});e.run(`dietAuthStorage.setItem('${key}',${JSON.stringify(sample(1))})`);
 assert.equal(e.run(`dietAuthStorage.getItem('${key}')`),sample(1));
 const next=environment({mode,local:e.local,cookies:e.cookies});assert.equal(next.run(`dietAuthStorage.getItem('${key}')`),sample(1));
 assert.equal(next.transient.has(key),false);
});
test('new cookie wins over readable stale local token',()=>{
 const e=environment({mode:'quota-stale',local:new Map([[key,sample(1)]])});e.run(`dietAuthStorage.setItem('${key}',${JSON.stringify(sample(2))})`);
 assert.equal(e.local.get(key),sample(1));assert.equal(e.run(`dietAuthStorage.getItem('${key}')`),sample(2));
});
test('corrupted newer cookie never resurrects stale local token',()=>{
 const cookies=new Map([[`diet-auth-v2-${key}.n`,'2']]);const e=environment({cookies,local:new Map([[key,sample(1)]])});
 assert.equal(e.run(`dietAuthStorage.getItem('${key}')`),null);assert.equal(e.local.has(key),false);
});
test('legacy cookie format migrates on next write',()=>{
 const e=environment({mode:'blocked',cookies:new Map([[`diet-auth-v2-${key}.n`,'1'],[`diet-auth-v2-${key}.0`,encodeURIComponent(sample(1))]])});
 assert.equal(e.run(`dietAuthStorage.getItem('${key}')`),sample(1));e.run(`dietAuthStorage.setItem('${key}',${JSON.stringify(sample(2))})`);
 assert.match(e.cookies.get(`diet-auth-v2-${key}.n`),/^v3-/);assert.equal(e.run(`dietAuthStorage.getItem('${key}')`),sample(2));
});
test('both persistent backends blocked fail before OAuth',()=>{const e=environment({mode:'blocked',cookieBlocked:true});assert.throws(()=>e.run('dietAssertPersistentStorage()'),/blocked/);assert.equal(e.transient.size,0)});
test('malformed session is rejected without touching unrelated data',()=>{const e=environment({local:new Map([[key,'{broken'],['unrelated','keep']])});assert.equal(e.run(`dietAuthStorage.getItem('${key}')`),null);assert.equal(e.local.get('unrelated'),'keep')});
test('PKCE fallback is transient and expires',()=>{const e=environment({mode:'blocked'});e.run(`dietAuthStorage.setItem('${key}-flow-abcdefgh-code-verifier','"secret-fixture"')`);assert.equal(e.run(`dietAuthStorage.getItem('${key}-flow-abcdefgh-code-verifier')`),'"secret-fixture"');assert.equal(e.cookies.size,0);e.run(`sessionStorage.setItem(DIET_PKCE_BACKUP_KEY,JSON.stringify({createdAt:Date.now()-16*60000,entries:{}}))`);assert.equal(e.run('dietReadBrowserPkceBackup()'),null)});
test('tab-only session migrates once into a persistent backend',()=>{const e=environment({mode:'blocked',transient:new Map([['diet-copilot:auth-fallback:'+key,sample(1)]])});e.run('dietMigrateTransientSession()');assert.equal(e.run(`dietAuthStorage.getItem('${key}')`),sample(1));assert.equal(e.transient.size,0)});
test('logout removes both storage backends without broad deletion',()=>{const e=environment({mode:'quota-stale',local:new Map([[key,sample(1)],['unrelated','keep']])});e.run(`dietAuthStorage.setItem('${key}',${JSON.stringify(sample(2))})`);const n=environment({local:e.local,cookies:e.cookies});n.run(`dietAuthStorage.removeItem('${key}')`);assert.equal(n.run(`dietAuthStorage.getItem('${key}')`),null);assert.equal(n.local.get('unrelated'),'keep')});
test('multi-chunk Unicode cookie round trip',()=>{const raw=sample(1).replace('fixture-1','한글🧪'.repeat(400));const e=environment({mode:'blocked'});e.run(`dietAuthStorage.setItem('${key}',${JSON.stringify(raw)})`);assert.equal(e.run(`dietAuthStorage.getItem('${key}')`),raw)});
console.log(`${count} account storage tests passed.`);
