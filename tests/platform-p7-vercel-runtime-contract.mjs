import assert from "node:assert/strict";
import fs from "node:fs";

const api=fs.readFileSync("api/copilot.js","utf8");
const health=fs.readFileSync("api/health.js","utf8");
const runtime=fs.readFileSync("v2/server-runtime.mjs","utf8");
const client=fs.readFileSync("v2/copilot.js","utf8");
const manifest=JSON.parse(fs.readFileSync("platform-p7-runtime-certification.json","utf8"));
const vercel=JSON.parse(fs.readFileSync("vercel.json","utf8"));
const apiPackage=JSON.parse(fs.readFileSync("api/package.json","utf8"));
const vercelIgnore=fs.readFileSync(".vercelignore","utf8");

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
assert.doesNotMatch(api,/generateText/);
assert.match(api,/model="gpt-6-luna"/);
assert.doesNotMatch(api,/openai\/gpt-6-luna/);
assert.doesNotMatch(api,/vercel-ai-gateway/);
assert.doesNotMatch(api,/VERCEL_OIDC_TOKEN/);
assert.match(api,/diet-copilot-ai success/);
assert.doesNotMatch(api,/console\.(?:info|warn|error)\([^\n]*(?:question|userId|Authorization)/);

assert.match(health,/ready:supabaseConfigured&&providerConfigured/);
assert.match(health,/VERCEL_REGION/);

assert.match(runtime,/active:"vercel"/);
assert.match(runtime,/https:\/\/thiepn-diet\.vercel\.app\/api\/copilot/);

assert.match(client,/DietServerRuntime/);
assert.match(client,/invokeRemoteCopilot/);
assert.match(client,/client\.auth\.getSession\(\)/);
assert.match(client,/Authorization:'Bearer '\+t/);
assert.match(client,/client\.functions\.invoke\('diet-copilot-ai'/);
assert.match(client,/return e\(\)/);

assert.equal(manifest.phase,"P7");
assert.equal(manifest.workload.owner,"diet");
assert.equal(manifest.workload.targetRuntime.project,"thiepn-diet");
assert.equal(manifest.workload.targetRuntime.region,"dub1");
assert.equal(manifest.boundaries.supabase,"auth_data_rls_realtime_authority");
assert.equal(manifest.auth.serviceRoleRequired,false);
assert.equal(manifest.auth.databaseAccessFromVercel,false);
assert.equal(manifest.auth.provider,"openai-direct");
assert.equal(manifest.auth.providerSecretRequired,true);
assert.equal(manifest.auth.model,"gpt-6-luna");
assert.equal(manifest.deployment.gitIntegration,false);
assert.equal(manifest.deployment.automaticDeployments,false);
assert.equal(manifest.deployment.productionDomainCutover,false);
assert.equal(manifest.deployment.deploymentCertified,false);
assert.equal(manifest.deployment.liveBoundaryCertified,true);
assert.equal(manifest.deployment.browserCutover,true);
assert.equal(manifest.deployment.cutoverMode,"vercel-first-with-supabase-edge-fallback");
assert.equal(manifest.safety.serverMayWriteDietData,false);
assert.deepEqual(vercel.regions,["dub1"]);
assert.equal(vercel.functions["api/copilot.js"].maxDuration,30);
assert.equal(apiPackage.type,"module");
assert.equal(apiPackage.dependencies,undefined);
assert.match(vercelIgnore,/!api/);
assert.match(vercelIgnore,/!vercel\.json/);

console.log("Platform P7 product-owned Vercel runtime contract passed (Vercel-first canary with Edge fallback).");
