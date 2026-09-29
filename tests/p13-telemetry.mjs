import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('v2/telemetry.mjs','utf8');
assert.doesNotMatch(source,/sendBeacon\(|fetch\(|\.rpc\(|\.from\(/,'P13 telemetry must remain local-only.');
assert.doesNotMatch(source,/access_token|refresh_token|user\.email|calories|protein|weight_entries/i,'P13 telemetry source must not collect private nutrition/auth fields.');
assert.match(source,/MAX_EVENTS=120/);
assert.match(source,/RETENTION_MS=7\*24\*60\*60\*1000/);
assert.match(source,/local operational metadata only/);

const storage=new Map();
const listeners=new Map();
const context=vm.createContext({
  Date,Math,JSON,URL,
  performance:{now:()=>10},
  localStorage:{
    getItem:key=>storage.get(key)??null,
    setItem:(key,value)=>storage.set(key,String(value)),
    removeItem:key=>storage.delete(key)
  },
  navigator:{onLine:true},
  document:{visibilityState:'visible'},
  location:{href:'https://thiepn.dev/diet/'},
  CustomEvent:class CustomEvent{constructor(type){this.type=type;}},
  window:{
    addEventListener:(name,fn)=>listeners.set(name,fn),
    dispatchEvent:()=>{}
  },
  console
});
let runnable=source
  .replaceAll('export function ','function ')
  .replaceAll('export const ','const ')
  + '\n;globalThis.__telemetry={recordTelemetry,getTelemetrySnapshot,buildTelemetryDiagnostics,clearTelemetry,telemetryErrorCode};';
vm.runInContext(runnable,context);

context.__telemetry.recordTelemetry('write_success',{
  operation:'diet_app_log_meal',
  durationMs:12.7,
  token:'must-drop',
  email:'must-drop',
  message:'must-drop',
  source:'cloud'
});
const snap=context.__telemetry.getTelemetrySnapshot();
const last=snap.recent.at(-1);
assert.equal(last.type,'write_success');
assert.equal(last.meta.operation,'diet_app_log_meal');
assert.equal(last.meta.durationMs,13);
assert.equal(last.meta.source,'cloud');
assert.equal(Object.hasOwn(last.meta,'token'),false);
assert.equal(Object.hasOwn(last.meta,'email'),false);
assert.equal(Object.hasOwn(last.meta,'message'),false);

const report=context.__telemetry.buildTelemetryDiagnostics({
  status:'ready',source:'cloud',writeBlocked:false,
  email:'must-drop',reason:'must-drop'
});
assert.equal(report.operational.status,'ready');
assert.equal(report.operational.source,'cloud');
assert.equal(report.operational.writeBlocked,false);
assert.equal(Object.hasOwn(report.operational,'email'),false);
assert.equal(Object.hasOwn(report.operational,'reason'),false);
assert.match(report.telemetryPolicy,/no nutrition records/);

listeners.get('unhandledrejection')?.({reason:Object.assign(new Error('secret text'),{code:'NETWORK_FAIL'})});
const runtime=context.__telemetry.getTelemetrySnapshot().recent.at(-1);
assert.equal(runtime.type,'runtime_error');
assert.equal(runtime.meta.code,'NETWORK_FAIL');
assert.equal(Object.values(runtime.meta).includes('secret text'),false);

assert.equal(context.__telemetry.clearTelemetry(),true);
assert.equal(context.__telemetry.getTelemetrySnapshot().eventCount,0);
console.log('Diet Copilot P13 local telemetry privacy and retention contract passed.');
