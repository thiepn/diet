import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  defaultGoalRate, deriveStartingTargets, onboardingStatus, validateOnboarding, goalModeCopy
} from '../v2/p30-onboarding.mjs';

assert.equal(defaultGoalRate('maintain',80),0);
assert.equal(defaultGoalRate('lose',80),-0.4);
assert.equal(defaultGoalRate('gain',80),0.2);

const loss=deriveStartingTargets({currentWeight:80,goalMode:'lose',desiredRate:-0.4});
assert.equal(loss.maintenanceEstimate,2400);
assert.equal(loss.calories,1950);
assert.equal(loss.protein,145);
assert.equal(loss.fiber,30);

const gain=deriveStartingTargets({currentWeight:80,goalMode:'gain',desiredRate:0.2});
assert.equal(gain.calories,2625);

assert.deepEqual(onboardingStatus({profile:null,phase:null,latestWeight:null}).missing,
  ['weight','profile','active_phase','calorie_target','protein_target']);

const complete=onboardingStatus({
  profile:{calorie_target:2200,protein_target:150,fiber_target:30,goal_weight:75,desired_weekly_weight_change:-0.3},
  phase:{active:true,phase_type:'cut',calorie_target:2100,protein_target:155,fiber_target:32,goal_weight:75,desired_weekly_weight_change:-0.3},
  latestWeight:{weight:80}
});
assert.equal(complete.complete,true);
assert.equal(complete.goalMode,'lose');
assert.equal(complete.currentWeight,80);
assert.equal(complete.calorieTarget,2100);

assert.equal(validateOnboarding({
  currentWeight:80,goalMode:'lose',goalWeight:75,desiredRate:-0.4,
  calorieTarget:2000,proteinTarget:145,fiberTarget:30
}).valid,true);
assert.equal(validateOnboarding({
  currentWeight:80,goalMode:'lose',goalWeight:85,desiredRate:-0.4,
  calorieTarget:2000,proteinTarget:145,fiberTarget:30
}).valid,false);
assert.equal(validateOnboarding({
  currentWeight:80,goalMode:'gain',goalWeight:85,desiredRate:-0.2,
  calorieTarget:2600,proteinTarget:145,fiberTarget:30
}).valid,false);
assert.equal(goalModeCopy('maintain').phase,'Maintenance');

const html=fs.readFileSync('index.html','utf8');
const onboarding=fs.readFileSync('v2/onboarding.js','utf8');
const readModel=fs.readFileSync('v2/read-model.mjs','utf8');
const writeApi=fs.readFileSync('v2/write-api.mjs','utf8');
const migration=fs.readFileSync('supabase/migrations/20261005194103_diet_p30_onboarding_goal_phase_setup.sql','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const aliasSw=fs.readFileSync('v2/sw.js','utf8');

for(const id of [
  'onboardingBanner','onboardingDialog','onboardingWeight','onboardingGoalWeight',
  'onboardingRate','onboardingCalories','onboardingProtein','onboardingFiber',
  'onboardingOpen','onboardingEditPlan','onboardingSave'
]) assert.ok(html.includes(`id="${id}"`),`missing ${id}`);

assert.ok(onboarding.includes('completeOnboarding'));
assert.ok(onboarding.includes('SESSION_DISMISS_KEY'));
assert.ok(onboarding.includes("state().source==='cloud'"));
assert.ok(onboarding.includes('Do this later')===false,'button copy belongs in HTML, not JS');
assert.ok(readModel.includes('onboardingStatus'));
assert.ok(readModel.includes('onboarding,'));
assert.ok(writeApi.includes("completeOnboarding:'diet_app_complete_onboarding'"));
assert.ok(writeApi.includes('export async function completeOnboarding'));

for(const token of [
  'security definer',
  "set search_path = ''",
  'private.diet_p19_begin_mutation',
  'private.diet_p19_complete_mutation',
  'revoke all on function public.diet_app_complete_onboarding',
  'from public, anon',
  'grant execute on function public.diet_app_complete_onboarding',
  'to authenticated',
  'insert into public.profiles',
  'insert into public.weight_entries',
  'insert into public.goal_phases',
  'update public.daily_logs'
]) assert.ok(migration.toLowerCase().includes(token.toLowerCase()),`migration missing ${token}`);

assert.ok(sw.includes('./v2/p30-onboarding.mjs'));
assert.ok(sw.includes('./v2/onboarding.js'));
assert.ok(aliasSw.includes('./p30-onboarding.mjs'));
assert.ok(aliasSw.includes('./onboarding.js'));

console.log('P30 onboarding, goals and phase setup contract passed.');
