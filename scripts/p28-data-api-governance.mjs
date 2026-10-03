#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args=process.argv.slice(2);
function val(flag,fallback){const i=args.indexOf(flag);return i>=0?args[i+1]:fallback;}
const dir=val('--dir','supabase/migrations');
const baseline=val('--baseline','20261003000000');
const outPath=val('--out','p28-data-api-governance.json');

const files=fs.existsSync(dir)?fs.readdirSync(dir).filter(x=>/^\d{14}.*\.sql$/.test(x)).sort():[];
const findings=[];
const checked=[];
for(const file of files){
  const stamp=file.slice(0,14);
  if(stamp<baseline) continue;
  const full=path.join(dir,file);
  const sql=fs.readFileSync(full,'utf8').toLowerCase();
  const tables=[...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/g)].map(x=>x[1]);
  const funcs=[...sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)\s*\(/g)].map(x=>x[1]);
  for(const name of tables){
    const rls=new RegExp(`alter\\s+table\\s+public\\.${name}\\s+enable\\s+row\\s+level\\s+security`).test(sql);
    const privilege=new RegExp(`(?:grant|revoke)[\\s\\S]{0,240}(?:on\\s+(?:table\\s+)?public\\.${name}|public\\.${name})`).test(sql);
    checked.push({file,type:'table',resource:`public.${name}`});
    if(!rls) findings.push({file,resource:`public.${name}`,code:'missing_rls_enable'});
    if(!privilege) findings.push({file,resource:`public.${name}`,code:'missing_explicit_table_privilege_decision'});
  }
  for(const name of funcs){
    const executeDecision=new RegExp(`(?:revoke|grant)[\\s\\S]{0,320}(?:function\\s+public\\.${name}|public\\.${name})`).test(sql);
    checked.push({file,type:'function',resource:`public.${name}`});
    if(!executeDecision) findings.push({file,resource:`public.${name}`,code:'missing_explicit_function_execute_decision'});
  }
}

const report={
  schemaVersion:1,phase:'P28',baselineMigration:baseline,
  checkedResources:checked.length,passed:findings.length===0,
  findings,
  rule:'Post-P28 public Data API resources require explicit exposure/privilege decisions; public tables also require RLS.'
};
fs.writeFileSync(outPath,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report));
if(findings.length) process.exit(1);
