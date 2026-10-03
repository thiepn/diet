#!/usr/bin/env node
import fs from 'node:fs';

const args=process.argv.slice(2);
function val(flag,fallback){const i=args.indexOf(flag);return i>=0?args[i+1]:fallback;}
const sloPath=val('--slo',null);
const capacityPath=val('--capacity',null);
const outPath=val('--out','p27-autonomy-decision.json');

const slo=sloPath?JSON.parse(fs.readFileSync(sloPath,'utf8')):null;
const capacity=capacityPath?JSON.parse(fs.readFileSync(capacityPath,'utf8')):null;
const findings=[];
if(slo && slo.state!=='healthy') findings.push({domain:'slo',severity:slo.state,evidence:{burnState:slo.burnState,latencyState:slo.latencyState}});
if(capacity && capacity.qualified && capacity.daysToCapacity!==null && capacity.daysToCapacity<90) findings.push({domain:'capacity',severity:'warning',evidence:{daysToCapacity:capacity.daysToCapacity}});
if(capacity && capacity.qualified===false) findings.push({domain:'capacity',severity:'info',evidence:{qualified:false,observationDays:capacity.observationDays,sampleCount:capacity.sampleCount}});

const runbooks=[];
if(findings.some(x=>x.domain==='slo')) runbooks.push('inspect request failures, synthetic health and latency evidence');
if(findings.some(x=>x.domain==='capacity'&&x.severity==='warning')) runbooks.push('review attributed growth and provisioned capacity before any scaling decision');
if(findings.some(x=>x.domain==='capacity'&&x.severity==='info')) runbooks.push('continue collecting qualified capacity snapshots');

const out={
  schemaVersion:1,
  phase:'P27',
  autonomyLevel:'L1_detect_classify_report',
  mutationAllowed:false,
  approvalRequiredForMutation:true,
  findings,
  runbookRecommendations:runbooks,
  allowedActions:['collect evidence','classify signals','deduplicate alerts','recommend runbook'],
  prohibitedActions:['DDL','index mutation','session termination','compute/pool/disk/replica mutation','Auth/RLS/secret mutation','pause/restore','user-data deletion']
};
fs.writeFileSync(outPath,JSON.stringify(out,null,2)+'\n','utf8');
console.log(JSON.stringify(out));
