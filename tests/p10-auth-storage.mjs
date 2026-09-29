import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const raw=fs.readFileSync('v2/auth-storage.mjs','utf8');
const source=raw.replaceAll('export const ','const ');

const key='sb-hycegznamzjhwinegaai-auth-token';
const sample=n=>JSON.stringify({
  access_token:'fixture-access-'+n,
  refresh_token:'fixture-refresh-'+n,
  expires_at:2000000000,
  user:{id:'fixture-'+n}
});

function environment({local=new Map(),cookies=new Map(),mode='normal',cookieBlocked=false}={}){
  const storage={
    getItem:k=>{
      if(mode==='blocked')throw Object.assign(new Error('blocked'),{name:'SecurityError'});
      return local.get(k)??null;
    },
    setItem:(k,v)=>{
      if(mode==='blocked')throw Object.assign(new Error('blocked'),{name:'SecurityError'});
      if(mode==='quota')throw Object.assign(new Error('quota'),{name:'QuotaExceededError'});
      if(mode!=='silent')local.set(k,String(v));
    },
    removeItem:k=>local.delete(k)
  };
  const document={};
  Object.defineProperty(document,'cookie',{
    get:()=>[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),
    set:s=>{
      if(cookieBlocked)return;
      const [entry,...attrs]=s.split(';');
      const pos=entry.indexOf('=');
      const name=entry.slice(0,pos),value=entry.slice(pos+1);
      if(attrs.some(a=>a.trim()==='Max-Age=0'))cookies.delete(name);
      else cookies.set(name,value);
    }
  });
  const context=vm.createContext({
    document,
    location:{protocol:'https:'},
    localStorage:storage,
    Date,Math,console
  });
  vm.runInContext(source,context);
  return {run:s=>vm.runInContext(s,context),local,cookies};
}

{
  const e=environment();
  e.run(`dietV2AuthStorage.setItem('${key}',${JSON.stringify(sample(1))})`);
  assert.equal(e.run(`dietV2AuthStorage.getItem('${key}')`),sample(1));
  assert.equal(e.cookies.size,0,'Normal browsers should keep the session in localStorage.');
}

for(const mode of ['blocked','quota','silent']){
  const e=environment({mode});
  e.run(`dietV2AuthStorage.setItem('${key}',${JSON.stringify(sample(2))})`);
  assert.equal(e.run(`dietV2AuthStorage.getItem('${key}')`),sample(2),mode+' fallback must round-trip.');
  assert.ok(e.cookies.size>=2,mode+' should use chunked cookie fallback.');
}

{
  const local=new Map([[key,sample(1)]]);
  const e=environment({mode:'quota',local});
  e.run(`dietV2AuthStorage.setItem('${key}',${JSON.stringify(sample(2))})`);
  assert.equal(e.run(`dietV2AuthStorage.getItem('${key}')`),sample(2),'Cookie fallback must outrank stale local state.');
}

{
  const base='diet-auth-v2-'+encodeURIComponent(key);
  const cookies=new Map([[base+'.n','v3-badrev-2'],[base+'.badrev.0',encodeURIComponent(sample(2))]]);
  const local=new Map([[key,sample(1)]]);
  const e=environment({cookies,local});
  assert.equal(e.run(`dietV2AuthStorage.getItem('${key}')`),null,'Corrupted authoritative cookie must fail closed.');
  assert.equal(local.has(key),false,'Fail-closed cookie corruption must remove stale local auth state.');
}

{
  const e=environment({mode:'blocked'});
  e.run(`dietV2AuthStorage.setItem('${key}',${JSON.stringify(sample(3))})`);
  e.run(`dietV2AuthStorage.removeItem('${key}')`);
  assert.equal(e.run(`dietV2AuthStorage.getItem('${key}')`),null);
  assert.equal(e.cookies.size,0);
}

{
  const huge=sample(4).replace('fixture-4','한글🧪'.repeat(500));
  const e=environment({mode:'blocked'});
  e.run(`dietV2AuthStorage.setItem('${key}',${JSON.stringify(huge)})`);
  assert.equal(e.run(`dietV2AuthStorage.getItem('${key}')`),huge);
}

console.log('Diet Copilot 2.0 P10 V2 auth-storage adversarial tests passed.');
