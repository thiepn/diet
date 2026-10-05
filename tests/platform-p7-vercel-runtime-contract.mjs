import assert from "node:assert/strict";
import fs from "node:fs";

const api=fs.readFileSync("api/copilot.js","utf8");
const health=fs.readFileSync("api/health.js","utf8");
const runtime=fs.readFileSync("v2/server-runtime.mjs","utf8");
const manifest=JSON.parse(fs.readFileSync("platform-p7-runtime-certification.json","utf8"));

assert.match(api,/SUPABASE_PUBLISHABLE_KEY/);
assert.match(api,/\/auth\/v1\/user/);
assert.doesNotMatch(api,/SERVICE_ROLE|SUPABASE_SECRET_KEY/);
assert.match(api,/MAX_BODY_BYTES=30000/);
assert.match(api,/MAX_CONTEXT_BYTES=18000/);
assert.match(api,/PROVIDER_TIMEOUT_MS=22000/);
assert.match(api,/origin_not_allowed/);
assert.match(api,/ALLOWED_ACTIONS/);
assert.match(api,/cleanReply/);
assert.match(api,/runtime:"vercel"/);

assert.match(health,/ready:supabaseConfigured&&providerConfigured/);
assert.match(health,/VERCEL_REGION/);

assert.match(runtime,/active:"supabase-edge"/);
assert.match(runtime,/https:\/\/thiepn-diet\.vercel\.app\/api\/copilot/);
assert.match(runtime,/cutoverRequiresCertification:true/);

assert.equal(manifest.phase,"P7");
assert.equal(manifest.workload.owner,"diet");
assert.equal(manifest.workload.targetRuntime.project,"thiepn-diet");
assert.equal(manifest.workload.targetRuntime.region,"dub1");
assert.equal(manifest.boundaries.supabase,"auth_data_rls_realtime_authority");
assert.equal(manifest.auth.serviceRoleRequired,false);
assert.equal(manifest.auth.databaseAccessFromVercel,false);
assert.equal(manifest.deployment.gitIntegration,false);
assert.equal(manifest.deployment.automaticDeployments,false);
assert.equal(manifest.deployment.productionDomainCutover,false);
assert.equal(manifest.deployment.deploymentCertified,false);
assert.equal(manifest.safety.serverMayWriteDietData,false);

console.log("Platform P7 product-owned Vercel runtime contract passed (prepared, not yet activated).");
