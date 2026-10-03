#!/usr/bin/env node
import fs from 'node:fs';
const args=process.argv.slice(2);
function val(flag,fallback){const i=args.indexOf(flag);return i>=0?args[i+1]:fallback;}
const input=val('--input',null), outPath=val('--out','p28-lifecycle-transition.json');
if(!input) throw new Error('--input is required');
const req=JSON.parse(fs.readFileSync(input,'utf8'));
const plan=JSON.parse(fs.readFileSync('platform-p28-lifecycle-governance-plan.json','utf8'));
const allowed=plan.lifecycleModel.allowedTransitions[req.current]||[];
const blockers=[];
if(!allowed.includes(req.target)) blockers.push('transition_not_allowed');
if(req.target==='retired'){
  if((req.liveDependents||0)!==0) blockers.push('live_dependents');
  if(req.dataDispositionApproved!==true) blockers.push('data_disposition_not_approved');
  if(req.backupDecisionRecorded!==true) blockers.push('backup_decision_missing');
  if(req.ownerApproval!==true) blockers.push('owner_approval_missing');
}
if(req.target==='archived' && req.normalWritesDisabled!==true) blockers.push('writes_not_disabled');
const report={
  schemaVersion:1,phase:'P28',component:req.component,current:req.current,target:req.target,
  allowed:blockers.length===0,blockers,
  automaticMutationPerformed:false,
  destructiveActionAllowed:false
};
fs.writeFileSync(outPath,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report));
if(blockers.length) process.exitCode=2;
