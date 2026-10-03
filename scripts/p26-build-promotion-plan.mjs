#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const args=process.argv.slice(2);
function argValue(flag, fallback){
  const i=args.indexOf(flag);
  return i>=0 ? args[i+1] : fallback;
}

const p25Path=argValue('--p25','platform-p25-burn-in-plan.json');
const p26Path=argValue('--p26','platform-p26-steady-state-plan.json');
const atRaw=argValue('--at');
const outPath=argValue('--out','p26-promotion-plan.json');
const checkedAt=atRaw ? new Date(atRaw) : new Date();
if(Number.isNaN(checkedAt.getTime())) throw new Error('Invalid --at timestamp.');

const readinessPath=outPath+'.readiness.tmp.json';
let readiness;
try {
  execFileSync(process.execPath,[
    'scripts/p26-activation-readiness.mjs',
    '--require-ready',
    '--p25',p25Path,
    '--p26',p26Path,
    '--at',checkedAt.toISOString(),
    '--out',readinessPath
  ],{stdio:'pipe'});
  readiness=JSON.parse(fs.readFileSync(readinessPath,'utf8'));
} catch (error) {
  if(fs.existsSync(readinessPath)){
    readiness=JSON.parse(fs.readFileSync(readinessPath,'utf8'));
  }
  const report={
    schemaVersion:1,
    phase:'P26',
    checkedAt:checkedAt.toISOString(),
    readyForPromotion:false,
    readiness:readiness || null,
    mutationsAllowed:false,
    reason:'Activation readiness gate is not satisfied.'
  };
  fs.writeFileSync(outPath,JSON.stringify(report,null,2)+'\n','utf8');
  console.log(JSON.stringify(report));
  process.exit(2);
} finally {
  fs.rmSync(readinessPath,{force:true});
}

const p25=JSON.parse(fs.readFileSync(p25Path,'utf8'));
const p26=JSON.parse(fs.readFileSync(p26Path,'utf8'));
const observationHours=p26.baselinePolicy?.authoritativeObservationHours || 72;
const activeAt=checkedAt.toISOString();
const earliestAuthoritativeBaselineCompleteAt=new Date(checkedAt.getTime()+observationHours*3600000).toISOString();

const promotion={
  schemaVersion:1,
  phase:'P26',
  checkedAt:activeAt,
  readyForPromotion:true,
  mutationsAllowed:false,
  readiness,
  proposedMetadata:{
    state:'active_observation',
    activeOperationsRelease:'P26.0',
    activatedAt:activeAt,
    authoritativeWindowStart:activeAt,
    earliestAuthoritativeBaselineCompleteAt,
    authoritativeObservationHours:observationHours,
    minimumPublicSamples:p26.baselinePolicy?.publicSampling?.minimumScheduledSamples || 19,
    publicSampleCadenceHours:p26.baselinePolicy?.publicSampling?.cadenceHours || 4,
    sourceP25Generation:p25.generation,
    sourceP25Certified:true
  },
  requiredRepositoryChanges:[
    'Mark platform-p25-burn-in-plan.json completionState.complete=true with final closure evidence already certified.',
    'Set platform-p26-steady-state-plan.json state=active_observation and activeOperationsRelease=P26.0.',
    'Record P26 activatedAt, authoritativeWindowStart, and earliestAuthoritativeBaselineCompleteAt.',
    'Update release metadata/contracts from P25.0 to P26.0 without changing application release semantics.',
    'Keep optimizationTriage.automaticWritesAllowed=false during the 72-hour authoritative observation window.'
  ],
  prohibitedDuringPromotion:[
    'Database DDL',
    'Index creation or removal',
    'VACUUM FULL',
    'REINDEX',
    'Compute resize',
    'Pool or work_mem tuning',
    'Automatic advisor remediation'
  ]
};

fs.writeFileSync(outPath,JSON.stringify(promotion,null,2)+'\n','utf8');
console.log(JSON.stringify(promotion));
