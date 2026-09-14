import assert from 'node:assert/strict';

function mean(values){return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;}
function nutritionSummary(days){
  const logged=days.filter(d=>(d.meals||[]).length>0);
  const calories=logged.map(d=>d.meals.reduce((s,m)=>s+Number(m.calories||0),0));
  const protein=logged.map(d=>d.meals.reduce((s,m)=>s+Number(m.protein||0),0));
  const fiberRows=logged.map(d=>{
    const known=d.meals.filter(m=>m.fiber!=null);
    return {known:known.length,value:known.reduce((s,m)=>s+Number(m.fiber),0),complete:known.length===d.meals.length};
  }).filter(x=>x.known>0);
  return {
    loggedDays:logged.length,
    avgCalories:mean(calories),
    avgProtein:mean(protein),
    avgKnownFiber:mean(fiberRows.map(x=>x.value)),
    fiberCoveredDays:fiberRows.length,
    fiberFullDays:fiberRows.filter(x=>x.complete).length,
    meals:logged.reduce((n,d)=>n+d.meals.length,0)
  };
}

function regression(weights){
  if(weights.length<2)return null;
  const x0=Date.parse(weights[0].date+'T00:00:00Z')/86400000;
  const pts=weights.map(w=>({x:Date.parse(w.date+'T00:00:00Z')/86400000-x0,y:w.weight}));
  const mx=mean(pts.map(p=>p.x)),my=mean(pts.map(p=>p.y));
  const den=pts.reduce((s,p)=>s+(p.x-mx)**2,0);if(!den)return null;
  const slope=pts.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0)/den;
  return {weekly:slope*7,span:pts.at(-1).x-pts[0].x};
}

function adaptiveDecision({loggedDays,weights,desired=-0.5,currentTarget=2000,uncertainty=0,goal=null,currentWeight=null}){
  const r=regression(weights);
  if(goal!=null&&currentWeight!=null&&Math.abs(currentWeight-goal)<=1.5)return {decision:'prepare_maintenance'};
  if(loggedDays<14||weights.length<4||!r||r.span<14)return {decision:'need_more_data'};
  if(uncertainty>=250&&r.weekly!=null&&Math.abs(r.weekly-desired)<=0.30)return {decision:'observe_another_week'};
  if(Math.abs(r.weekly-desired)<=0.15)return {decision:'keep_target',target:currentTarget};
  if(Math.abs(r.weekly)<=0.10&&r.span>=21)return {decision:'observe_another_week'};
  return {decision:r.weekly>desired?'consider_decrease':'consider_increase'};
}

// Open/Partial/Complete are coverage metadata only; every logged day counts.
{
  const s=nutritionSummary([
    {status:'open',meals:[{calories:1000,protein:60,fiber:8}]},
    {status:'partial',meals:[{calories:2000,protein:120,fiber:12}]},
    {status:'complete',meals:[{calories:1500,protein:90,fiber:10}]}
  ]);
  assert.equal(s.loggedDays,3);
  assert.equal(s.avgCalories,1500);
  assert.equal(s.avgProtein,90);
}

// Missing fiber is unknown, never zero; known fiber still contributes.
{
  const s=nutritionSummary([
    {meals:[{calories:500,protein:30,fiber:7},{calories:500,protein:30,fiber:null}]},
    {meals:[{calories:800,protein:50,fiber:13}]}
  ]);
  assert.equal(s.avgKnownFiber,10);
  assert.equal(s.fiberCoveredDays,2);
  assert.equal(s.fiberFullDays,1);
}

// Explicit identical snacks remain two real entries.
{
  const s=nutritionSummary([{meals:[{calories:217,protein:4.6,fiber:1.95},{calories:217,protein:4.6,fiber:1.95}]}]);
  assert.equal(s.meals,2);
  assert.equal(s.avgCalories,434);
}

// Estimated meals count normally; uncertainty changes confidence, not inclusion.
{
  const s=nutritionSummary([{meals:[{calories:1430,protein:83,fiber:12.5,source:'photo_estimate',low:1050,high:2000},{calories:217,protein:4.6,fiber:1.95,source:'saved_food'}]}]);
  assert.equal(s.avgCalories,1647);
}

// Too little evidence stays a baseline even after dramatic short-term scale movement.
assert.equal(adaptiveDecision({loggedDays:3,weights:[{date:'2026-09-11',weight:84},{date:'2026-09-12',weight:83.2},{date:'2026-09-13',weight:82.95}]}).decision,'need_more_data');

// Established trend close to plan keeps calories unchanged.
{
  const weights=Array.from({length:22},(_,i)=>({date:new Date(Date.UTC(2026,7,1+i)).toISOString().slice(0,10),weight:84-(0.48/7)*i}));
  assert.equal(adaptiveDecision({loggedDays:22,weights,desired:-0.5}).decision,'keep_target');
}

// Material intake uncertainty blocks a small apparent adjustment.
{
  const weights=Array.from({length:22},(_,i)=>({date:new Date(Date.UTC(2026,7,1+i)).toISOString().slice(0,10),weight:84-(0.30/7)*i}));
  assert.equal(adaptiveDecision({loggedDays:22,weights,desired:-0.5,uncertainty:350}).decision,'observe_another_week');
}

// Near-goal cuts prioritize maintenance transition over another calorie reduction.
{
  const weights=Array.from({length:22},(_,i)=>({date:new Date(Date.UTC(2026,7,1+i)).toISOString().slice(0,10),weight:77-(0.5/7)*i}));
  assert.equal(adaptiveDecision({loggedDays:22,weights,desired:-0.5,goal:75,currentWeight:75.8}).decision,'prepare_maintenance');
}

console.log('Diet Copilot Web 1.0 nutrition/coaching policy suite passed.');
