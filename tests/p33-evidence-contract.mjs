import assert from 'node:assert/strict';
import fs from 'node:fs';

const p=JSON.parse(fs.readFileSync('platform-p33-evidence-policy.json','utf8'));
const app=JSON.parse(fs.readFileSync('.well-known/thiepn-app.json','utf8'));
const doc=fs.readFileSync('docs/P33-COMPLIANCE-EVIDENCE-PROVENANCE.md','utf8');
const workflow=fs.readFileSync('.github/workflows/p33-evidence-staging.yml','utf8');
const ledger=fs.readFileSync('platform-p33-audit-ledger.jsonl','utf8').trim().split(/\n+/).map(JSON.parse);

assert.equal(p.phase,'P33');
assert.equal(p.state,'staged_pending_p32');
assert.equal(p.activeOperationsRelease,'P25.0');
assert.equal(app.operationsVersion,'P25.0');
assert.equal(p.evidencePrinciples.appendOnlyLogicalLedger,true);
assert.equal(p.evidencePrinciples.tamperEvidentHashChain,true);
assert.equal(p.evidencePrinciples.rawSecretsForbidden,true);
assert.equal(p.evidencePrinciples.rawAuthAuditRowsForbidden,true);
assert.equal(p.evidencePrinciples.complianceCertificationClaimed,false);
assert.equal(p.currentAuditCapability.organizationPlan,'free');
assert.equal(p.currentAuditCapability.platformAuditLogs.available,false);
assert.equal(p.currentAuditCapability.authAuditLogs.postgresRowsObserved,0);
assert.equal(p.currentAuditCapability.postgresConnectionLogging,'off');
assert.equal(p.currentAuditCapability.pgauditInstalled,false);
assert.equal(p.ledgerRules.hashAlgorithm,'SHA-256');
assert.equal(p.ledgerRules.deletionForbidden,true);
assert.equal(p.ledgerRules.mutationOfExistingEntryForbidden,true);
assert.equal(p.ledgerRules.correctionModel.includes('append'),true);

assert.equal(ledger.length,2);
assert.equal(ledger[0].sequence,0);
assert.equal(ledger[1].sequence,1);
assert.equal(ledger[0].previousHash,null);
assert.equal(ledger[1].previousHash,ledger[0].entryHash);
assert.match(ledger[0].entryHash,/^[0-9a-f]{64}$/);
assert.match(ledger[1].entryHash,/^[0-9a-f]{64}$/);
assert.equal(ledger[0].evidence.migrationHead,'20261001183709_gomoku_p13_reliability_heartbeat');
assert.equal(ledger[0].evidence.gomokuRoomVersion,39);

for(const token of [
  'P33 is **staged, not active**',
  'Not a compliance certification',
  'gomoku_p13_reliability_heartbeat',
  'v39',
  'Tamper evidence, not magical immutability',
  'raw Auth audit payloads',
  'Existing ledger events are never edited'
]) assert.ok(doc.includes(token),'P33 doc missing '+token);

assert.ok(workflow.includes('workflow_dispatch'));
assert.ok(workflow.includes('pull_request'));
assert.ok(workflow.includes('p33-ledger.py verify'));
assert.ok(workflow.includes('p33-build-provenance.py'));
assert.doesNotMatch(workflow,/contents:\s*write/,'P33 staging must not write repository content.');

console.log('P33 staged evidence/provenance contract passed.');
