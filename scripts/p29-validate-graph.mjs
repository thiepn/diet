#!/usr/bin/env node
import fs from 'node:fs';

const graph=JSON.parse(fs.readFileSync('platform-p29-dependency-graph.json','utf8'));
const ownership=JSON.parse(fs.readFileSync('platform-p28-resource-ownership.json','utf8'));
const ids=new Set(graph.nodes.map(x=>x.id));
const failures=[];
const seen=new Set();
for(const e of graph.edges){
  if(!ids.has(e.provider)) failures.push('unknown_provider:'+e.provider);
  if(!ids.has(e.consumer)) failures.push('unknown_consumer:'+e.consumer);
  if(e.provider===e.consumer) failures.push('self_edge:'+e.provider);
  const key=e.provider+'>'+e.consumer+'>'+e.contract;
  if(seen.has(key)) failures.push('duplicate_edge:'+key);
  seen.add(key);
}
const direct=new Map([...ids].map(x=>[x,[]]));
for(const e of graph.edges) direct.get(e.provider)?.push(e.consumer);
const state=new Map(), stack=[];
function visit(n){
  if(state.get(n)===1){failures.push('cycle:'+stack.concat(n).join('>'));return;}
  if(state.get(n)===2)return;
  state.set(n,1);stack.push(n);
  for(const c of direct.get(n)||[])visit(c);
  stack.pop();state.set(n,2);
}
for(const n of ids)visit(n);

for(const app of ownership.registeredApps) if(!ids.has(app.id)) failures.push('missing_registered_app:'+app.id);
for(const svc of ownership.sharedServices){
  const mapped=svc.id==='platform'?'platform_control':svc.id;
  if(!ids.has(mapped)) failures.push('missing_shared_service:'+svc.id);
}
for(const x of ownership.edgeFunctions){
  if(graph.resourceOwners.edgeFunctions[x.slug]!==x.owner && !(x.owner==='platform'&&graph.resourceOwners.edgeFunctions[x.slug]==='platform_control')){
    failures.push('edge_owner_mismatch:'+x.slug);
  }
}
for(const x of ownership.cronJobs){
  if(graph.resourceOwners.cronJobs[x.jobname]!==x.owner) failures.push('cron_owner_mismatch:'+x.jobname);
}
const report={
  schemaVersion:1,phase:'P29',graphVersion:graph.graphVersion,
  nodeCount:graph.nodes.length,edgeCount:graph.edges.length,
  passed:failures.length===0,failures,
  ownershipAligned:failures.filter(x=>x.includes('owner_mismatch')).length===0
};
fs.writeFileSync(process.argv[2]||'p29-graph-validation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
if(failures.length)process.exit(1);
