import assert from 'node:assert/strict';
import fs from 'node:fs';

const catalog=JSON.parse(fs.readFileSync('platform-p34-control-catalog.json','utf8'));
const snap=JSON.parse(fs.readFileSync('platform-p34-assurance-snapshot.json','utf8'));
const plan=JSON.parse(fs.readFileSync('platform-p34-audit-readiness-plan.json','utf8'));
const defs=JSON.parse(fs.readFileSync('platform-p34-deficiency-register.json','utf8'));
const app=JSON.parse(fs.readFileSync('.well-known/thiepn-app.json','utf8'));
const doc=fs.readFileSync('docs/P34-SECURITY-CONTROL-ASSURANCE.md','utf8');
const workflow=fs.readFileSync('.github/workflows/p34-assurance-staging.yml','utf8');

assert.equal(catalog.phase,'P34');
assert.equal(catalog.controls.length,18);
assert.deepEqual(catalog.frameworks.nistCsf20.functions,['GOVERN','IDENTIFY','PROTECT','DETECT','RESPOND','RECOVER']);
assert.deepEqual(catalog.frameworks.soc2Readiness.domains,['Security','Availability','Processing Integrity','Confidentiality','Privacy']);
for(const c of catalog.controls){
  assert.ok(c.id&&c.owner&&c.objective&&c.test);
  assert.ok(c.nist.length>=1&&c.soc2.length>=1&&c.evidence.length>=1);
}

assert.equal(snap.overallState,'not_audit_ready');
assert.equal(snap.externalAttestationClaim,false);
assert.equal(snap.livePlatform.migrationHead,'20261001202408_gomoku_p14_audit_sequence_hardening');
assert.equal(snap.livePlatform.gomokuRoomVersion,40);
assert.equal(snap.securityAdvisor.warningCount,40);
assert.equal(snap.securityAdvisor.infoCount,50);
assert.equal(snap.securityAdvisor.findings.find(x=>x.lint==='authenticated_security_definer_function_executable').count,39);
assert.equal(snap.securityAdvisor.findings.find(x=>x.lint==='rls_enabled_no_policy').count,50);
assert.equal(snap.securityAdvisor.findings.find(x=>x.lint==='auth_leaked_password_protection').count,1);

assert.equal(plan.phase,'P34');
assert.equal(plan.state,'staged_pending_p33');
assert.equal(plan.activeOperationsRelease,'P25.0');
assert.equal(app.operationsVersion,'P25.0');
assert.equal(plan.currentReadinessLevel,2);
assert.equal(plan.targetBeforeExternalAudit,4);
assert.equal(plan.continuousAssuranceRules.controlCannotBeEffectiveFromDesignEvidenceAlone,true);

assert.equal(defs.items.length,7);
assert.ok(defs.items.every(x=>x.automaticRemediation===false));
assert.ok(defs.items.some(x=>x.id==='P34-D001'&&x.severity==='high'));
assert.ok(defs.items.some(x=>x.id==='P34-D002'&&x.observedCount===39));

for(const token of [
  'P34 is **staged, not active**',
  'not an external certification',
  'gomoku_p14_audit_sequence_hardening',
  'v40',
  '39',
  '50',
  'Leaked password protection',
  'operating effectiveness',
  'NIST CSF 2.0',
  'SOC 2'
]) assert.ok(doc.includes(token),'P34 doc missing '+token);

assert.ok(workflow.includes('pull_request'));
assert.ok(workflow.includes('workflow_dispatch'));
assert.ok(workflow.includes('p34-assess-controls.py'));
assert.ok(workflow.includes('p34-build-audit-package.py'));
assert.doesNotMatch(workflow,/contents:\s*write/,'P34 staging must stay read-only.');

console.log('P34 staged security-control/assurance contract passed.');
