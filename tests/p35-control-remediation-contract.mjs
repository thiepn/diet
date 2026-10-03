import assert from 'node:assert/strict';
import fs from 'node:fs';

const rem=JSON.parse(fs.readFileSync('platform-p35-remediation-plan.json','utf8'));
const oe=JSON.parse(fs.readFileSync('platform-p35-operating-effectiveness-plan.json','utf8'));
const dry=JSON.parse(fs.readFileSync('platform-p35-audit-dry-run-plan.json','utf8'));
const p34=JSON.parse(fs.readFileSync('platform-p34-assurance-snapshot.json','utf8'));
const defs=JSON.parse(fs.readFileSync('platform-p34-deficiency-register.json','utf8'));
const startSchema=JSON.parse(fs.readFileSync('contracts/p35-start-gate.schema.json','utf8'));
const periodSchema=JSON.parse(fs.readFileSync('contracts/p35-evidence-period.schema.json','utf8'));
const recordSchema=JSON.parse(fs.readFileSync('contracts/p35-evidence-record.schema.json','utf8'));
const drySchema=JSON.parse(fs.readFileSync('contracts/p35-audit-dry-run-manifest.schema.json','utf8'));
const doc=fs.readFileSync('docs/P35-CONTROL-REMEDIATION-OE-DRYRUN.md','utf8');
const workflow=fs.readFileSync('.github/workflows/p35-operating-effectiveness-staging.yml','utf8');

assert.equal(rem.phase,'P35');
assert.equal(rem.schemaVersion,2);
assert.equal(rem.state,'implementation_active_no_production_remediation_applied');
assert.equal(rem.sourceMainSha,'f50363813bddd86c6f2163f13254352685904afd');
assert.equal(rem.operatorOverride.doesNotAuthorizeProductionMutation,true);
assert.equal(rem.operatorOverride.doesNotAuthorizeRiskAcceptance,true);
assert.equal(rem.operatorOverride.doesNotAuthorizeDeficiencyClosure,true);
assert.equal(rem.liveBaseline.projectStatus,'ACTIVE_HEALTHY');
assert.equal(rem.liveBaseline.migrationHead,'20261003221217');
assert.equal(rem.liveBaseline.migrationName,'hub_h15_tms60_projection');
assert.equal(rem.liveBaseline.semanticSchemaSha256,'5b7b1caddef09b97f59c85d79d04eabfbe55120fe1754340a7367c1b14d39375');
assert.equal(rem.liveBaseline.cronJobs,14);
assert.equal(rem.liveBaseline.registeredApps,7);
assert.equal(rem.liveBaseline.p34MigrationHead,'20261003202015');

assert.equal(rem.advisorBaseline.security.rlsEnabledNoPolicy.count,73);
assert.equal(rem.advisorBaseline.security.authenticatedSecurityDefinerExecutable.count,47);
assert.equal(rem.advisorBaseline.security.leakedPasswordProtection.count,1);
assert.equal(rem.advisorBaseline.performance.authRlsInitplan.count,38);
assert.equal(rem.advisorBaseline.performance.unindexedForeignKeys.count,61);
assert.equal(rem.advisorBaseline.performance.unusedIndex.count,123);

assert.equal(rem.technicalTriage.rlsNoPolicy.advisorTables,73);
assert.equal(rem.technicalTriage.rlsNoPolicy.withAnonEffectiveDmlPrivilege,0);
assert.equal(rem.technicalTriage.rlsNoPolicy.withAuthenticatedEffectiveDmlPrivilege,0);
assert.equal(rem.technicalTriage.securityDefiner.functions,47);
assert.equal(rem.technicalTriage.securityDefiner.anonExecutable,0);
assert.equal(rem.technicalTriage.securityDefiner.referencesAuthUid,47);
assert.equal(rem.technicalTriage.securityDefiner.controlledSearchPath,47);
assert.equal(rem.technicalTriage.securityDefiner.emptySearchPath,47);
assert.equal(rem.technicalTriage.securityDefiner.referencesAuthJwt,28);
assert.equal(rem.technicalTriage.securityDefiner.explicitStaticRejectSignal,41);
assert.equal(rem.technicalTriage.securityDefiner.withoutStaticRejectSignal.length,6);
assert.equal(rem.technicalTriage.leakedPasswordProtection.currentPlan,'free');
assert.ok(rem.technicalTriage.leakedPasswordProtection.currentSupabaseDocsRequirement.includes('Pro Plan and above'));
assert.equal(rem.technicalTriage.authRlsInitplan.warnings,38);
assert.equal(rem.deficiencies.length,8);
assert.deepEqual(rem.deficiencies.map(x=>x.id),defs.items.map(x=>x.id));
assert.ok(rem.deficiencies.every(x=>x.productionChangePrepared===false&&x.automaticClosure===false));

assert.equal(oe.phase,'P35');
assert.equal(oe.schemaVersion,2);
assert.equal(oe.state,'not_started_start_gate_blocked');
assert.equal(oe.evidencePeriod.internalDryRunMinimumCalendarDays,30);
assert.equal(oe.evidencePeriod.externalReadinessPlanningTargetDays,90);
assert.equal(oe.evidencePeriod.startsAutomatically,false);
assert.equal(oe.evidencePeriod.backfillAllowed,false);
assert.equal(oe.evidencePeriod.syntheticEvidenceAllowedForOperatingPeriod,false);
assert.equal(oe.baselineBinding.p34CatalogVersion,'2026-10-03.1');
assert.equal(oe.startGate.minimumScopedEpochStableMinutes,60);
assert.deepEqual(oe.startGate.highDeficienciesChecked,['P34-D001','P34-D002','P34-D005']);
assert.equal(oe.currentStartGateSnapshot.canStart,false);
assert.equal(oe.currentStartGateSnapshot.periodClockStarted,false);
assert.equal(oe.currentStartGateSnapshot.blockers.length,5);
assert.equal(oe.evidenceCadence.perChange.minimumCoveragePct,100);
assert.equal(oe.evidenceCadence.daily.minimumSuccessfulDaysPct,95);
assert.equal(oe.evidenceCadence.daily.maximumConsecutiveMissedDays,1);
assert.equal(oe.failureTreatment.unexplainedFailureFailsPeriod,true);
assert.equal(oe.failureTreatment.failMustHaveSubsequentResolutionEvidenceToPassPeriod,true);

assert.equal(dry.phase,'P35');
assert.equal(dry.schemaVersion,2);
assert.equal(dry.state,'engine_implemented_period_not_started');
assert.equal(dry.externalAttestation,false);
assert.match(dry.dryRunMeaning,/does not prove real operating effectiveness/);
assert.ok(dry.automaticFailureConditions.includes('synthetic evidence in a real operating period'));

assert.equal(p34.currentReadinessLevel,2);
assert.equal(p34.securityAdvisor.findings.find(x=>x.lint==='authenticated_security_definer_function_executable').count,43);
assert.equal(p34.securityAdvisor.findings.find(x=>x.lint==='rls_enabled_no_policy').count,71);
assert.equal(p34.performanceAdvisor.findings.find(x=>x.lint==='auth_rls_initplan').count,36);

for(const key of ['periodId','mode','observedAt','scopedEpochStableMinutes','highDeficiencyStates','p33HeadHash','controlCatalogSha256','requestedBy','authorizedBy']){
  assert.ok(startSchema.required.includes(key),'start schema missing '+key);
}
for(const key of ['periodId','mode','periodStart','periodEnd','expectedChangeIds','expectedIncidentIds','expectedExceptionIds']){
  assert.ok(periodSchema.required.includes(key),'period schema missing '+key);
}
assert.deepEqual(recordSchema.properties.evidenceKind.enum,['synthetic_test','production_evidence']);
for(const key of ['mode','operatingEffectivenessResultPath','p34AssessmentResultPath','remediationAssessmentPath','p33LedgerPath','p33AnchorPath','sections','artifacts']){
  assert.ok(drySchema.required.includes(key),'dry-run schema missing '+key);
}

for(const token of [
  'active by explicit operator override',
  'hub_h15_tms60_projection',
  '73',
  '47',
  '38',
  '0/73',
  '47/47',
  'six functions',
  'Pro Plan and above',
  '30-calendar-day',
  '90-day',
  'not started',
  'no backfill',
  'synthetic',
  'operating effectiveness',
  'simulation-only',
  'semester-os',
  'P32 remains warn-only',
  'not an external attestation'
]) assert.ok(doc.includes(token),'P35 doc missing '+token);

assert.ok(workflow.includes('pull_request'));
assert.ok(workflow.includes('workflow_dispatch'));
assert.ok(workflow.includes('p35-assess-remediation.py'));
assert.ok(workflow.includes('p35-authorize-period.py'));
assert.ok(workflow.includes('p35-evaluate-operating-effectiveness.py'));
assert.ok(workflow.includes('p35-audit-dry-run.py'));
assert.ok(workflow.includes('current-start-gate.json'));
assert.doesNotMatch(workflow,/contents:\s*write/,'P35 workflow must remain read-only.');

console.log('P35 remediation, operating-effectiveness and dry-run structural contract passed.');
