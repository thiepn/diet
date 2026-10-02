import assert from 'node:assert/strict';
import fs from 'node:fs';

const rem=JSON.parse(fs.readFileSync('platform-p36-remediation-execution.json','utf8'));
const freeze=JSON.parse(fs.readFileSync('platform-p36-stable-epoch-freeze.json','utf8'));
const oe=JSON.parse(fs.readFileSync('platform-p36-operating-effectiveness-state.json','utf8'));
const p25=JSON.parse(fs.readFileSync('platform-p25-burn-in-plan.json','utf8'));
const app=JSON.parse(fs.readFileSync('.well-known/thiepn-app.json','utf8'));
const doc=fs.readFileSync('docs/P36-REMEDIATION-FREEZE-OE-ACTIVATION.md','utf8');
const workflow=fs.readFileSync('.github/workflows/p36-remediation-freeze-oe-staging.yml','utf8');

assert.equal(rem.phase,'P36');
assert.equal(rem.productionMutationPerformed,false);
assert.equal(rem.executedDispositions.length,3);
assert.equal(rem.remainingDeficiencies.length,4);
assert.equal(rem.securityAdvisorExpectedState.rlsEnabledNoPolicy.count,58);
assert.equal(rem.securityAdvisorExpectedState.authenticatedSecurityDefinerExecutable.count,39);

assert.equal(freeze.phase,'P36');
assert.equal(freeze.state,'active');
assert.equal(freeze.p25Generation,2);
assert.equal(freeze.activatedOnMain,true);
assert.equal(freeze.mainCommit,'f722d576b483991adaa865e188cc04bea583e6a6');
assert.equal(freeze.frozenEpoch.migrationName,'gomoku_p16_certification_null_fix');
assert.equal(freeze.frozenEpoch.gomokuRoomVersion,42);
assert.equal(freeze.quietEvidenceAtActivation.satisfied,true);

assert.equal(oe.phase,'P36');
assert.equal(oe.state,'armed_waiting_p25_generation2');
assert.equal(oe.active,false);
assert.equal(oe.activationIsRetroactive,false);
assert.equal(oe.activationGates.p25Generation2Certified,false);

assert.equal(p25.generation,2);
assert.equal(app.operationsVersion,'P25.0');
assert.equal(app.health.p25BurnInGeneration,2);

for(const token of [
  'P36 is **staged, not active**',
  'P25 generation 2 is active on main',
  'P34-D002',
  'P34-D003',
  'P34-D005',
  '58',
  '39/39',
  'gomoku_p16_certification_null_fix',
  'not backdated',
  '2026-10-03T14:32:00.744993Z'
]) assert.ok(doc.includes(token),'P36 doc missing '+token);

assert.ok(workflow.includes('workflow_dispatch'));
assert.ok(workflow.includes('pull_request'));
assert.ok(workflow.includes('p36-evaluate-activation.py'));
assert.ok(workflow.includes('p36-activate-oe.py'));
assert.doesNotMatch(workflow,/contents:\s*write/,'P36 staging workflow must remain read-only.');

console.log('P36 staged remediation/freeze/OE activation contract passed.');
