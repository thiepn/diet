#!/usr/bin/env node
import fs from 'node:fs';

const args=process.argv.slice(2);
function argValue(flag){
  const i=args.indexOf(flag);
  return i>=0 ? args[i+1] : undefined;
}
const requireReady=args.includes('--require-ready');
const atRaw=argValue('--at');
const outPath=argValue('--out') || 'p26-activation-readiness.json';
const p25Path=argValue('--p25') || 'platform-p25-burn-in-plan.json';
const p26Path=argValue('--p26') || 'platform-p26-steady-state-plan.json';
const checkedAt=atRaw ? new Date(atRaw) : new Date();
if(Number.isNaN(checkedAt.getTime())) throw new Error('Invalid --at timestamp.');

const p25=JSON.parse(fs.readFileSync(p25Path,'utf8'));
const p26=JSON.parse(fs.readFileSync(p26Path,'utf8'));
const req=p26.activationRequires || {};
const freeze=p25.currentEpochFreezeEvidence || {};
const latest=p25.latestObservedEpoch || {};
const backup=p25.latestPostUpgradeOffsiteBackup || {};
const hosted=p25.historicalHostedUpgradeAttestation || {};
const blockers=[];

function block(condition,code,detail){
  if(condition) blockers.push({code,detail});
}

const minimumCompleteAfter=new Date(p25.minimumCompleteAfter);
block(Number.isNaN(minimumCompleteAfter.getTime()),'invalid_minimum_complete_after','P25 minimumCompleteAfter is missing or invalid.');
block(p25.completionState?.complete!==true,'p25_not_certified','P25 completionState.complete is not true.');
block(p25.generation!==req.p25Generation,'wrong_generation',`Expected P25 generation ${req.p25Generation}; found ${p25.generation}.`);
block(p25.currentGenerationEligible!==true,'generation_not_eligible','P25 current generation is not eligible.');
block(checkedAt < minimumCompleteAfter,'minimum_window_open',`P25 cannot certify before ${p25.minimumCompleteAfter}.`);
block(hosted.status!==req.historicalHostedUpgradeAttestation,'hosted_upgrade_attestation','Historical hosted-upgrade attestation is not pass.');
block(backup.conclusion!==req.postFinalSharedChangeEncryptedBackup,'backup_not_green','Latest post-final-shared-change encrypted backup is not successful.');
block(backup.afterLatestDatabaseMigration!==true || backup.afterLatestEdgeDeployment!==true,'backup_not_after_final_change','Backup does not attest both latest database migration and Edge deployment.');
block(freeze.p18Integrity!==req.p18Integrity,'p18_not_clean','P18 integrity is not clean.');
block(freeze.p20SchemaDrift!==req.p20SchemaDrift,'p20_drift','P20 schema drift is not false.');
block(freeze.p21Readiness!==req.p21Readiness,'p21_not_ready','P21 readiness is not pass.');
block(freeze.p22Maintenance!==req.p22Maintenance,'p22_not_green','P22 maintenance is not pass.');
block(freeze.securityAdvisorReviewed!==true,'security_advisor_not_reviewed','Security Advisor has not been reviewed for the frozen epoch.');
block(freeze.performanceAdvisorReviewed!==true,'performance_advisor_not_reviewed','Performance Advisor has not been reviewed for the frozen epoch.');

for(const [key,label] of [
  ['migrationVersion','migration version'],
  ['semanticSchemaSha256','semantic schema fingerprint'],
  ['gomokuRoomVersion','gomoku-room version'],
  ['gomokuRoomSha256','gomoku-room SHA']
]){
  if(freeze[key]!==undefined && latest[key]!==undefined && freeze[key]!==latest[key]){
    blockers.push({code:'frozen_epoch_changed',detail:`Frozen ${label} no longer matches latest observed epoch.`});
  }
}

const ready=blockers.length===0;
const report={
  schemaVersion:1,
  phase:'P26',
  checkedAt:checkedAt.toISOString(),
  ready,
  state:ready ? 'activation_gate_satisfied' : 'staged_pending_p25',
  p25:{
    state:p25.state,
    generation:p25.generation,
    generationState:p25.generationState,
    generationEligible:p25.currentGenerationEligible,
    activatedAt:p25.activatedAt,
    minimumCompleteAfter:p25.minimumCompleteAfter,
    certified:p25.completionState?.complete===true
  },
  requirements:{
    minimumBurnInHours:req.p25MinimumBurnInHours,
    minimumSuccessfulSamples:req.p25MinimumSuccessfulSamples,
    allSixFourHourCoverageBuckets:req.p25AllSixFourHourCoverageBuckets,
    terminalSampleRequired:req.p25TerminalSampleAtOrAfterMinimumCompleteAfter,
    frozenEpochRequired:req.p25FrozenEpochUnchanged
  },
  blockers
};

fs.writeFileSync(outPath,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report));
if(requireReady && !ready) process.exit(2);
