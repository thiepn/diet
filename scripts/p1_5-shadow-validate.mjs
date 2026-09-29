import fs from 'node:fs';
import { mapLegacyDietData } from '../src/engine/legacy-data-adapter.mjs';
import { runAdaptiveNutritionEngine } from '../src/engine/adaptive-nutrition.mjs';
import { buildShadowComparison, shadowGate } from '../src/engine/shadow-validation.mjs';

const [, , inputPath, asOfArg] = process.argv;
if(!inputPath){
  console.error('Usage: node scripts/p1_5-shadow-validate.mjs <snapshot.json> [YYYY-MM-DD]');
  process.exit(2);
}
const raw=JSON.parse(fs.readFileSync(inputPath,'utf8'));
const snapshot=raw.shadow_input ?? raw;
const asOfDate=asOfArg ?? snapshot.asOfDate ?? snapshot.as_of_date ?? null;

const mapped=mapLegacyDietData(snapshot,{asOfDate});
const p1=runAdaptiveNutritionEngine(mapped.engineInput);
const report=buildShadowComparison({
  legacyV1:snapshot.v1_decision ?? {},
  p1Result:p1,
  adapterMeta:mapped.meta
});
const gate=shadowGate(report);

const output={
  gate,
  classification:report.classification,
  v1:report.v1,
  p1:report.p1,
  deltas:report.deltas,
  safety:report.safety,
  warnings:report.warnings,
  evidence:{
    asOfDate:mapped.meta.asOfDate,
    legacyDailyRows:mapped.meta.legacyDailyRows,
    legacyWeightRows:mapped.meta.legacyWeightRows,
    reliableIntakeDays:p1.estimate.confidence.reliableIntakeDays,
    weighIns:p1.estimate.confidence.weighIns,
    spanDays:p1.estimate.confidence.spanDays,
    p1SeriesPoints:p1.estimate.series.length,
    initialTdeeSource:mapped.meta.initialTdeeSource
  }
};

console.log(JSON.stringify(output,null,2));
if(!gate.pass) process.exit(1);
