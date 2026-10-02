import assert from 'node:assert/strict';
import fs from 'node:fs';

const rem=JSON.parse(fs.readFileSync('platform-p35-remediation-plan.json','utf8'));
const oe=JSON.parse(fs.readFileSync('platform-p35-operating-effectiveness-plan.json','utf8'));
const dry=JSON.parse(fs.readFileSync('platform-p35-audit-dry-run-plan.json','utf8'));
const app=JSON.parse(fs.readFileSync('.well-known/thiepn-app.json','utf8'));
const doc=fs.readFileSync('docs/P35-CONTROL-REMEDIATION-OE-DRYRUN.md','utf8');
const workflow=fs.readFileSync('.github/workflows/p35-operating-effectiveness-staging.yml','utf8');

assert.equal(rem.phase,'P35');
assert.equal(rem.state,'staged_no_production_remediation_applied');
assert.equal(rem.liveBaseline.migrationHead,'20261002062342_gomoku_p15_operations_rollouts_drills');
assert.equal(rem.technicalTriage.rlsNoPolicy.tables,53);
assert.equal(rem.technicalTriage.rlsNoPolicy.withAnonAnyDmlGrant,0);
assert.equal(rem.technicalTriage.rlsNoPolicy.withAuthenticatedAnyDmlGrant,0);
assert.equal(rem.technicalTriage.securityDefiner.functions,39);
assert.equal(rem.technicalTriage.securityDefiner.anonExecutable,0);
assert.equal(rem.technicalTriage.securityDefiner.referencesAuthUid,39);
assert.equal(rem.technicalTriage.securityDefiner.controlledSearchPath,39);
assert.equal(rem.technicalTriage.securityDefiner.emptySearchPath,39);
assert.equal(rem.technicalTriage.leakedPasswordProtection.currentPlan,'free');
assert.ok(rem.technicalTriage.leakedPasswordProtection.currentSupabaseDocsRequirement.includes('Pro Plan or above'));
assert.equal(rem.deficiencies.length,7);
assert.ok(rem.deficiencies.every(x=>x.productionChangePrepared===false));

assert.equal(oe.phase,'P35');
assert.equal(oe.state,'not_started_blocked_by_moving_release_epoch');
assert.equal(oe.evidencePeriod.internalDryRunMinimumDays,30);
assert.equal(oe.evidencePeriod.externalReadinessTargetDays,90);
assert.equal(oe.evidencePeriod.startsAutomatically,false);
assert.equal(oe.startGate.replacementP25BurnInCertified,true);
assert.equal(oe.completionGate.externalCertificationClaim,false);

assert.equal(dry.phase,'P35');
assert.equal(dry.state,'staged_not_certified');
assert.ok(dry.certificationMeaning.includes('not an external attestation'));

assert.equal(app.operationsVersion,'P25.0');

for(const token of [
  'P35 is **staged, not active**',
  'gomoku_p15_operations_rollouts_drills',
  '53',
  '39/39',
  'Pro Plan',
  '30-day',
  '90-day',
  'Operating-effectiveness evidence period',
  'dry-run',
  'not an external attestation'
]) assert.ok(doc.includes(token),'P35 doc missing '+token);

assert.ok(workflow.includes('workflow_dispatch'));
assert.ok(workflow.includes('pull_request'));
assert.ok(workflow.includes('p35-assess-remediation.py'));
assert.ok(workflow.includes('p35-evaluate-operating-effectiveness.py'));
assert.ok(workflow.includes('p35-audit-dry-run.py'));
assert.doesNotMatch(workflow,/contents:\s*write/,'P35 staging workflow must remain read-only.');

console.log('P35 staged remediation/OE/dry-run contract passed.');
