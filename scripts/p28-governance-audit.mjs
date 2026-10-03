#!/usr/bin/env node
import fs from 'node:fs';
const args=process.argv.slice(2);
function val(flag,fallback){const i=args.indexOf(flag);return i>=0?args[i+1]:fallback;}
const outPath=val('--out','p28-governance-audit.json');
const plan=JSON.parse(fs.readFileSync('platform-p28-lifecycle-governance-plan.json','utf8'));
const ownership=JSON.parse(fs.readFileSync('platform-p28-resource-ownership.json','utf8'));
const failures=[];
function require(ok,code){if(!ok) failures.push(code);}
require(ownership.registeredApps.length===plan.platformInventory.registeredApps,'registered_app_count_mismatch');
require(ownership.edgeFunctions.length===plan.platformInventory.edgeFunctions,'edge_function_count_mismatch');
require(ownership.cronJobs.length===plan.platformInventory.cronJobs,'cron_count_mismatch');
require(ownership.storageBuckets.length===plan.platformInventory.storageBuckets,'storage_bucket_count_mismatch');
require(ownership.registeredApps.every(x=>x.owner&&x.lifecycle&&x.route),'app_manifest_incomplete');
require(ownership.sharedServices.every(x=>x.owner&&x.lifecycle),'shared_service_manifest_incomplete');
require(ownership.edgeFunctions.every(x=>x.owner),'edge_owner_missing');
require(ownership.cronJobs.every(x=>x.owner),'cron_owner_missing');
require(ownership.storageBuckets.every(x=>x.owner),'storage_owner_missing');
require((ownership.databaseInventory.unresolved||[]).length===0,'database_unresolved_resources');
require(ownership.ownershipCoverage.knownDatabaseExceptionsResolved===true,'database_exception_unresolved');
require(plan.billingDocsSnapshot.refreshBeforeAnyPlanCostOrQuotaDecision===true,'billing_docs_refresh_not_required');
require(plan.costEfficiencyPolicy.unknownUsageState==='unknown_not_zero','unknown_usage_treated_as_zero');
require(plan.retirementPolicy.automaticUserDataDeletion===false,'automatic_user_data_deletion_enabled');
require(plan.retirementPolicy.automaticProjectPauseOrDelete===false,'automatic_project_delete_enabled');
require(plan.automation.destructiveActionAllowed===false,'destructive_automation_enabled');
require(plan.automation.billingActionAllowed===false,'billing_automation_enabled');
require(plan.platformCompatibilityWatch.some(x=>x.id==='supabase-data-api-explicit-grants-2026-10-30'),'data_api_breaking_change_watch_missing');
const report={
  schemaVersion:1,phase:'P28',checkedAt:new Date().toISOString(),
  passed:failures.length===0,failures,
  ownershipCoverage:{
    edgeFunctionsPct:ownership.ownershipCoverage.edgeFunctionsPct,
    cronJobsPct:ownership.ownershipCoverage.cronJobsPct,
    storageBucketsPct:ownership.ownershipCoverage.storageBucketsPct,
    unresolvedKnownResources:ownership.ownershipCoverage.unresolvedKnownResources
  },
  destructiveActionAllowed:false,billingActionAllowed:false
};
fs.writeFileSync(outPath,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report));
if(failures.length) process.exit(1);
