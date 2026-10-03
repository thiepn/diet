#!/usr/bin/env node
import fs from 'node:fs';

const args=process.argv.slice(2);
function value(flag, fallback){
  const i=args.indexOf(flag);
  return i>=0 ? args[i+1] : fallback;
}
const planPath=value('--plan','platform-p26-steady-state-plan.json');
const outPath=value('--out','p26-optimization-triage.json');
const plan=JSON.parse(fs.readFileSync(planPath,'utf8'));
const live=plan.liveProvisionalRefresh;
if(!live) throw new Error('P26 liveProvisionalRefresh is missing.');

const findings=[];
function finding(id,domain,severity,state,evidence,nextAction,allowedNow=false){
  findings.push({id,domain,severity,state,evidence,nextAction,allowedNow});
}

const db=live.database || {};
const service=live.service24h || {};
const rest=service.edgeGateway?.rest || {};
const auth=service.edgeGateway?.auth || {};
const authService=service.authService || {};

if((db.deadlocks||0)>0){
  finding('db-deadlocks','database','critical','investigate',
    {deadlocks:db.deadlocks},
    'Identify contending transactions and reproduce before changing indexes, isolation, or retry policy.');
}
if((db.waitingLocks||0)>0){
  finding('db-waiting-locks','database','warning','investigate',
    {waitingLocks:db.waitingLocks},
    'Correlate persistent waiting locks with concrete requests and blocking PIDs.');
}
if((db.deadlocks||0)===0 && (db.waitingLocks||0)===0){
  finding('db-lock-health','database','info','healthy',
    {deadlocks:0,waitingLocks:0},
    'Keep observing; no lock-oriented tuning is justified.');
}

const service5xx=(rest.http5xx||0)+(auth.http5xx||0)+(authService.http5xx||0);
finding('service-errors','service',service5xx>0?'warning':'info',service5xx>0?'investigate':'healthy',
  {rest5xx:rest.http5xx||0,authGateway5xx:auth.http5xx||0,authService5xx:authService.http5xx||0},
  service5xx>0
    ? 'Correlate each 5xx with request path, release epoch, and logs before changing capacity or database settings.'
    : 'No error-driven optimization is indicated.');

const authWarn=1422;
const restWarn=2100;
finding('service-latency','service',
  ((auth.p95OriginMs||0)>authWarn || (rest.p95OriginMs||0)>restWarn)?'warning':'info',
  ((auth.p95OriginMs||0)>authWarn || (rest.p95OriginMs||0)>restWarn)?'watch':'healthy',
  {authP95Ms:auth.p95OriginMs,authWarningMs:authWarn,restP95Ms:rest.p95OriginMs,restWarningMs:restWarn},
  'Use repeated sustained regression, not a single maximum, as the optimization trigger.');

const slow=live.repeatedSlowStatement;
if(slow){
  finding('slow-pg-timezone-introspection','query','info','watch',
    {query:slow.query,calls:slow.calls,meanMs:slow.meanExecMs,maxMs:slow.maxExecMs,dietRepositoryReferenceFound:slow.dietRepositoryReferenceFound},
    slow.dietRepositoryReferenceFound
      ? 'Trace the application call path and EXPLAIN the exact workload before changing schema.'
      : 'Treat as platform/introspection traffic unless it correlates with a user-facing workflow.');
}

const fk=live.performanceAdvisor || {};
const best=live.candidateTableEvidence?.microArcadeBestScores || {};
const reviews=live.candidateTableEvidence?.microArcadeLbReviews || {};
finding('unindexed-foreign-keys','indexes','info','measure',
  {
    advisorCount:fk.unindexedForeignKeys,
    gomokuCount:fk.gomokuForeignKeys,
    microArcadeCount:fk.microArcadeForeignKeys,
    microArcadeBestScoresBytes:best.totalBytes,
    microArcadeBestScoresRows:best.liveRows,
    microArcadeLbReviewsBytes:reviews.totalBytes,
    microArcadeLbReviewsRows:reviews.liveRows
  },
  'Measure real join/delete/update workload and query plans after P25; do not create covering indexes from advisor findings alone.');

const idx=live.indexes || {};
const observationStart=new Date(live.statsResetAt || plan.provisionalBaseline?.statsResetAt || 0);
const observedAt=new Date(live.observedAt || 0);
const observationDays=(Number.isFinite(observationStart.getTime()) && Number.isFinite(observedAt.getTime()))
  ? Math.max(0,(observedAt-observationStart)/86400000) : 0;
const unusedEligible=observationDays >= (plan.baselinePolicy?.unusedIndexMinimumObservationDays||7)
  && (idx.zeroScanIndexesAtLeast1MiB||0)>0;
finding('unused-indexes','indexes','info',unusedEligible?'review':'blocked',
  {
    advisorFindings:idx.performanceAdvisorUnusedIndexFindings,
    zeroScanIndexes:idx.zeroScanIndexes,
    zeroScanIndexesAtLeast1MiB:idx.zeroScanIndexesAtLeast1MiB,
    observationDays:Number(observationDays.toFixed(3)),
    minimumObservationDays:plan.baselinePolicy?.unusedIndexMinimumObservationDays||7
  },
  unusedEligible
    ? 'Review large zero-scan indexes one-by-one for constraints, uniqueness, authorization, cron, and rare operational paths. Never auto-drop.'
    : 'Continue observation; index-removal evidence is not mature.');

const pg=service.postgrestDiagnostics || {};
finding('postgrest-timeout-manager','postgrest',
  (pg.timeoutManagerMessages||0)>0?'info':'info',
  (pg.timeoutManagerMessages||0)>0?'watch':'healthy',
  {messages:pg.timeoutManagerMessages||0,userFacingEdge5xxObserved:pg.userFacingEdge5xxObserved||0},
  (pg.userFacingEdge5xxObserved||0)>0
    ? 'Correlate timeout messages with failing request IDs and latency before changing PostgREST or database settings.'
    : 'Watch only; no tuning is justified without correlated user-facing failure.');

finding('temp-io','database','info','attribution_required',
  {tempFiles:db.tempFiles,tempBytes:db.tempBytes},
  'Attribute temporary I/O to application vs operator/platform statements before considering query, work_mem, compute, or pool changes.');

const automaticWritesAllowed=false;
const actionableNow=findings.filter(x=>x.allowedNow);
const report={
  schemaVersion:1,
  phase:'P26',
  generatedAt:new Date().toISOString(),
  sourceObservedAt:live.observedAt,
  p26State:plan.state,
  automaticWritesAllowed,
  summary:{
    total:findings.length,
    healthy:findings.filter(x=>x.state==='healthy').length,
    watch:findings.filter(x=>x.state==='watch').length,
    measure:findings.filter(x=>x.state==='measure').length,
    blocked:findings.filter(x=>x.state==='blocked').length,
    investigate:findings.filter(x=>x.state==='investigate').length,
    actionableNow:actionableNow.length
  },
  decision:'observe_and_measure',
  findings
};

fs.writeFileSync(outPath,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report));
