import assert from 'node:assert/strict';
import fs from 'node:fs';

const p=JSON.parse(fs.readFileSync('platform-p33-evidence-policy.json','utf8'));
const anchor=JSON.parse(fs.readFileSync('platform-p33-ledger-anchor.json','utf8'));
const ledger=fs.readFileSync('platform-p33-audit-ledger.jsonl','utf8').trim().split(/\n+/).map(JSON.parse);
const ledgerSchema=JSON.parse(fs.readFileSync('contracts/p33-ledger-entry.schema.json','utf8'));
const anchorSchema=JSON.parse(fs.readFileSync('contracts/p33-ledger-anchor.schema.json','utf8'));
const provenanceSchema=JSON.parse(fs.readFileSync('contracts/p33-provenance-manifest.schema.json','utf8'));
const doc=fs.readFileSync('docs/P33-COMPLIANCE-EVIDENCE-PROVENANCE.md','utf8');
const workflow=fs.readFileSync('.github/workflows/p33-evidence-staging.yml','utf8');

assert.equal(p.phase,'P33');
assert.ok(p.schemaVersion>=2);
assert.equal(p.state,'implementation_active_operator_override');
assert.equal(p.policyVersion,'2026-10-03.1');
assert.equal(p.sourceMainSha,'0e7e48c57cc505ec0d42dcc706e364763b8e8c63');
assert.equal(p.evidencePrinciples.appendOnlyLogicalLedger,true);
assert.equal(p.evidencePrinciples.tamperEvidentHashChain,true);
assert.equal(p.evidencePrinciples.reviewedHeadAnchor,true);
assert.equal(p.evidencePrinciples.externalComplianceCertificationClaimed,false);
assert.equal(p.currentLiveAttestation.migrationHead,'20261003202015');
assert.equal(p.currentLiveAttestation.migrationName,'hub_h12_h13_notes_projection');
assert.equal(p.currentLiveAttestation.gomokuRoomVersion,48);
assert.equal(p.currentLiveAttestation.cronJobs,14);
assert.equal(p.currentLiveAttestation.registeredApps,7);
assert.equal(p.currentLiveAttestation.p32SnapshotSupersededByNewMigration,true);
assert.equal(p.currentAuditCapability.organizationPlan,'free');
assert.equal(p.currentAuditCapability.platformAuditLogs.available,false);
assert.equal(p.currentAuditCapability.authAuditLogs.postgresRowsObserved,0);
assert.equal(p.currentAuditCapability.postgresConnectionLogging,'off');
assert.equal(p.currentAuditCapability.pgauditInstalled,false);
assert.equal(p.currentAuditCapability.pgStatStatementsInstalled,true);
assert.equal(p.currentAuditCapability.pgCronInstalled,true);
assert.equal(p.currentAuditCapability.automaticConfigurationChangeByP33,false);
assert.equal(p.ledgerRules.anchorRequired,true);
assert.ok(p.ledgerRules.anchorChecks.includes('ledgerSha256'));
assert.equal(p.provenanceRules.ledgerAnchorBindingRequired,true);
assert.equal(p.p32GovernanceProvenance.pr,23);
assert.equal(p.p32GovernanceProvenance.mergeSha,'0e7e48c57cc505ec0d42dcc706e364763b8e8c63');
assert.deepEqual(p.p32GovernanceProvenance.workflows.map(x=>x.runNumber).sort((a,b)=>a-b),[1,456,784]);

assert.equal(ledger.length,4);
for(let i=0;i<ledger.length;i++){
  assert.equal(ledger[i].schemaVersion,2);
  assert.equal(ledger[i].sequence,i);
  assert.match(ledger[i].entryHash,/^[0-9a-f]{64}$/);
  if(i===0) assert.equal(ledger[i].previousHash,null);
  else assert.equal(ledger[i].previousHash,ledger[i-1].entryHash);
}
assert.equal(ledger[1].eventType,'governance_history_import');
assert.deepEqual(ledger[1].evidence.phases.map(x=>x.phase),['P26','P27','P28','P29','P30','P31','P32']);
assert.equal(ledger[2].evidence.migrationHead,'20261003202015');
assert.equal(ledger[2].evidence.priorP32MigrationHead,'20261003105645');
assert.equal(ledger[3].evidence.platformAuditLogs.available,false);

assert.equal(anchor.entryCount,4);
assert.equal(anchor.headSequence,3);
assert.equal(anchor.headEventId,ledger.at(-1).eventId);
assert.equal(anchor.headHash,ledger.at(-1).entryHash);
assert.match(anchor.ledgerSha256,/^[0-9a-f]{64}$/);

assert.equal(ledgerSchema.properties.schemaVersion.const,2);
assert.equal(anchorSchema.properties.hashAlgorithm.const,'SHA-256');
for(const key of ['git','workflows','chainRefs','ledgerPath','ledgerAnchorPath','requiredArtifacts']){
  assert.ok(provenanceSchema.required.includes(key),'P33 provenance schema missing '+key);
}

for(const token of [
  'active by explicit operator override',
  'Not an external compliance certification',
  'hub_h12_h13_notes_projection',
  'v48',
  'reviewed head anchor',
  'tail truncation',
  'Platform Audit Logs',
  'Team and Enterprise',
  'auth.audit_log_entries',
  'P32 governance provenance',
  'raw Auth audit payloads',
  'Existing ledger entries are never edited'
]) assert.ok(doc.includes(token),'P33 doc missing '+token);

assert.ok(workflow.includes('workflow_dispatch'));
assert.ok(workflow.includes('pull_request'));
assert.ok(workflow.includes('p33-ledger.py verify'));
assert.ok(workflow.includes('--anchor platform-p33-ledger-anchor.json'));
assert.ok(workflow.includes('p33-build-provenance.py'));
assert.ok(workflow.includes('37123067111'));
assert.doesNotMatch(workflow,/contents:\s*write/,'P33 evidence workflow must be read-only.');

console.log('P33 anchored evidence/provenance structural contract passed.');
