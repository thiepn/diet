import assert from 'node:assert/strict';
import fs from 'node:fs';

const catalog=JSON.parse(fs.readFileSync('platform-p34-control-catalog.json','utf8'));
const snap=JSON.parse(fs.readFileSync('platform-p34-assurance-snapshot.json','utf8'));
const plan=JSON.parse(fs.readFileSync('platform-p34-audit-readiness-plan.json','utf8'));
const defs=JSON.parse(fs.readFileSync('platform-p34-deficiency-register.json','utf8'));
const p33=JSON.parse(fs.readFileSync('platform-p33-evidence-policy.json','utf8'));
const anchor=JSON.parse(fs.readFileSync('platform-p33-ledger-anchor.json','utf8'));
const deficiencySchema=JSON.parse(fs.readFileSync('contracts/p34-deficiency.schema.json','utf8'));
const packageSchema=JSON.parse(fs.readFileSync('contracts/p34-audit-package-manifest.schema.json','utf8'));
const doc=fs.readFileSync('docs/P34-SECURITY-CONTROL-ASSURANCE.md','utf8');
const workflow=fs.readFileSync('.github/workflows/p34-assurance-staging.yml','utf8');

assert.equal(catalog.phase,'P34');
assert.equal(catalog.schemaVersion,2);
assert.equal(catalog.catalogVersion,'2026-10-03.1');
assert.equal(catalog.controls.length,18);
assert.deepEqual(catalog.frameworkBasis.nistCsf20.functions,['GOVERN','IDENTIFY','PROTECT','DETECT','RESPOND','RECOVER']);
assert.deepEqual(catalog.frameworkBasis.soc2Readiness.domains,['Security','Availability','Processing Integrity','Confidentiality','Privacy']);
assert.match(catalog.mappingNotice,/Internal readiness crosswalk/);
for(const c of catalog.controls){
  assert.match(c.id,/^TH-[A-Z]{2}-\d{2}$/);
  assert.ok(c.owner&&c.objective&&c.test);
  assert.ok(c.nist.length>=1&&c.soc2.length>=1&&c.evidence.length>=1);
  assert.ok(c.maxEvidenceAgeHours>0);
}

assert.equal(snap.phase,'P34');
assert.equal(snap.snapshotVersion,'2026-10-03.1');
assert.equal(snap.overallState,'not_audit_ready');
assert.equal(snap.currentReadinessLevel,2);
assert.equal(snap.externalAttestationClaim,false);
assert.equal(snap.livePlatform.status,'ACTIVE_HEALTHY');
assert.equal(snap.livePlatform.migrationHead,'20261003202015');
assert.equal(snap.livePlatform.migrationName,'hub_h12_h13_notes_projection');
assert.equal(snap.livePlatform.semanticSchemaSha256,'5b7b1caddef09b97f59c85d79d04eabfbe55120fe1754340a7367c1b14d39375');
assert.equal(snap.livePlatform.gomokuRoomVersion,48);
assert.equal(snap.livePlatform.cronJobs,14);
assert.equal(snap.livePlatform.registeredApps,7);
assert.equal(snap.securityAdvisor.warningCount,44);
assert.equal(snap.securityAdvisor.infoCount,71);
assert.equal(snap.securityAdvisor.findings.find(x=>x.lint==='authenticated_security_definer_function_executable').count,43);
assert.equal(snap.securityAdvisor.findings.find(x=>x.lint==='auth_leaked_password_protection').count,1);
assert.equal(snap.securityAdvisor.findings.find(x=>x.lint==='rls_enabled_no_policy').count,71);
assert.equal(snap.performanceAdvisor.warningCount,36);
assert.equal(snap.performanceAdvisor.infoCount,184);
assert.equal(snap.performanceAdvisor.findings.find(x=>x.lint==='auth_rls_initplan').count,36);
assert.equal(snap.performanceAdvisor.findings.find(x=>x.lint==='unindexed_foreign_keys').count,61);
assert.equal(snap.performanceAdvisor.findings.find(x=>x.lint==='unused_index').count,123);
assert.equal(snap.governance.dependencyCoveragePct,94.44);
assert.equal(snap.governance.registeredAppGovernanceCoveragePct,85.71);
assert.deepEqual(snap.governance.unmodeledComponents,['semester-os']);
assert.equal(snap.governance.p32AdmissionMode,'warn');
assert.equal(snap.governance.p33LedgerAnchored,true);
assert.equal(snap.governance.p33MergeSha,'36793ca329a73fe7dba895e13ca753bc20349271');
assert.equal(snap.controlAssessments.length,18);
assert.ok(snap.controlAssessments.every(x=>x.freshness==='fresh'));
assert.ok(snap.controlAssessments.every(x=>x.operatingEffectiveness==='insufficient_period'));
assert.deepEqual(snap.deficiencies,{open:8,high:4,medium:4,critical:0});

assert.equal(plan.phase,'P34');
assert.equal(plan.schemaVersion,2);
assert.equal(plan.state,'implementation_active_operator_override');
assert.equal(plan.sourceMainSha,'36793ca329a73fe7dba895e13ca753bc20349271');
assert.equal(plan.currentReadinessLevel,2);
assert.equal(plan.targetBeforeExternalAudit,4);
assert.equal(plan.externalCertificationClaimed,false);
assert.equal(plan.continuousAssuranceRules.controlCannotBeEffectiveFromDesignEvidenceAlone,true);
assert.equal(plan.continuousAssuranceRules.operatingEffectivenessRequiresDefinedPeriod,true);
assert.equal(plan.continuousAssuranceRules.deficiencyClosureRequiresRetest,true);
assert.equal(plan.auditReadyGate.maximumOpenHigh,0);
assert.equal(plan.auditReadyGate.maximumOpenCritical,0);
assert.equal(plan.automation.productionMutationAllowed,false);
assert.equal(plan.automation.automaticRemediationAllowed,false);
assert.equal(plan.automation.externalCertificationClaimAllowed,false);
assert.deepEqual(plan.currentBlockers,['P34-D001','P34-D002','P34-D003','P34-D004','P34-D005','P34-D006','P34-D007','P34-D008']);

assert.equal(defs.phase,'P34');
assert.equal(defs.schemaVersion,2);
assert.equal(defs.items.length,8);
assert.ok(defs.items.every(x=>x.state==='open'));
assert.ok(defs.items.every(x=>x.automaticRemediation===false));
assert.equal(defs.items.find(x=>x.id==='P34-D001').observedCount,1);
assert.equal(defs.items.find(x=>x.id==='P34-D002').observedCount,43);
assert.equal(defs.items.find(x=>x.id==='P34-D003').observedCount,71);
assert.equal(defs.items.find(x=>x.id==='P34-D005').observedCount,1);
assert.equal(defs.items.find(x=>x.id==='P34-D007').source,'P32 policy bundle mode=warn');
assert.equal(defs.items.find(x=>x.id==='P34-D008').observedCount,36);
assert.equal(defs.closurePolicy.closureRequiresRetest,true);
assert.equal(defs.closurePolicy.historicalItemsNeverDeleted,true);

assert.equal(p33.state,'implementation_active_operator_override');
assert.equal(anchor.entryCount,4);
assert.match(anchor.headHash,/^[0-9a-f]{64}$/);

assert.equal(deficiencySchema.properties.automaticRemediation.const,false);
for(const key of ['scope','periodStart','periodEnd','readinessStatement','readinessLevel','externalAttestation','assessmentResultPath','deficiencyRegisterPath','p33LedgerPath','p33AnchorPath','requiredArtifacts']){
  assert.ok(packageSchema.required.includes(key),'P34 package schema missing '+key);
}

for(const token of [
  'active by explicit operator override',
  'not an external certification',
  'NIST CSF 2.0',
  'Trust Services Criteria',
  'Current readiness level: **2**',
  'Target readiness level: **4**',
  'hub_h12_h13_notes_projection',
  '43',
  '71',
  '36',
  'semester-os',
  'P32 remains **warn-only**',
  'operating effectiveness',
  'P33 anchored ledger',
  '8 open deficiencies'
]) assert.ok(doc.includes(token),'P34 doc missing '+token);

assert.ok(workflow.includes('pull_request'));
assert.ok(workflow.includes('workflow_dispatch'));
assert.ok(workflow.includes('p34-assess-controls.py'));
assert.ok(workflow.includes('p34-build-audit-package.py'));
assert.ok(workflow.includes('platform-p33-ledger-anchor.json'));
assert.doesNotMatch(workflow,/contents:\s*write/,'P34 assurance workflow must remain read-only.');

console.log('P34 security-control mapping and continuous-assurance structural contract passed.');
