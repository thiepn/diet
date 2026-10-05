const ENERGY_DENSITY=7700;

function finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));}
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function roundTo(v,step){return Math.round(Number(v)/step)*step;}

export function defaultGoalRate(mode,currentWeight){
  const weight=Number(currentWeight);
  if(!Number.isFinite(weight)||weight<=0)return 0;
  if(mode==='lose')return -Math.min(0.5,Math.max(0.15,Math.round(weight*0.005*20)/20));
  if(mode==='gain')return Math.min(0.25,Math.max(0.1,Math.round(weight*0.0025*20)/20));
  return 0;
}

export function deriveStartingTargets({currentWeight,goalMode='maintain',desiredRate=null}={}){
  const weight=Number(currentWeight);
  if(!Number.isFinite(weight)||weight<=0)return {calories:null,protein:null,fiber:30,maintenanceEstimate:null};
  const rate=desiredRate==null?defaultGoalRate(goalMode,weight):Number(desiredRate);
  const maintenance=roundTo(clamp(weight*30,1400,5000),25);
  const adjusted=goalMode==='maintain'?maintenance:maintenance+rate*ENERGY_DENSITY/7;
  return {
    calories:roundTo(clamp(adjusted,1200,6000),25),
    protein:roundTo(clamp(weight*1.8,60,300),5),
    fiber:30,
    maintenanceEstimate:maintenance
  };
}

export function onboardingStatus({profile=null,phase=null,latestWeight=null}={}){
  const missing=[];
  const currentWeight=Number(latestWeight?.weight??latestWeight);
  if(!Number.isFinite(currentWeight)||currentWeight<=0)missing.push('weight');
  if(!profile)missing.push('profile');
  if(!phase?.active)missing.push('active_phase');
  if(!finite(phase?.calorie_target??profile?.calorie_target))missing.push('calorie_target');
  if(!finite(phase?.protein_target??profile?.protein_target))missing.push('protein_target');
  const complete=missing.length===0;
  return {
    complete,
    missing,
    currentWeight:Number.isFinite(currentWeight)&&currentWeight>0?currentWeight:null,
    goalMode:phase?.phase_type==='cut'?'lose':phase?.phase_type==='gain'?'gain':phase?.phase_type==='maintain'?'maintain':null,
    goalWeight:finite(phase?.goal_weight??profile?.goal_weight)?Number(phase?.goal_weight??profile?.goal_weight):null,
    desiredRate:finite(phase?.desired_weekly_weight_change??profile?.desired_weekly_weight_change)
      ?Number(phase?.desired_weekly_weight_change??profile?.desired_weekly_weight_change):null,
    calorieTarget:finite(phase?.calorie_target??profile?.calorie_target)?Number(phase?.calorie_target??profile?.calorie_target):null,
    proteinTarget:finite(phase?.protein_target??profile?.protein_target)?Number(phase?.protein_target??profile?.protein_target):null,
    fiberTarget:finite(phase?.fiber_target??profile?.fiber_target)?Number(phase?.fiber_target??profile?.fiber_target):30
  };
}

export function validateOnboarding(values={}){
  const errors={};
  const weight=Number(values.currentWeight);
  const mode=String(values.goalMode??'');
  const goal=Number(values.goalWeight);
  const rate=Number(values.desiredRate);
  const calories=Number(values.calorieTarget);
  const protein=Number(values.proteinTarget);
  const fiber=Number(values.fiberTarget);

  if(!Number.isFinite(weight)||weight<25||weight>400)errors.currentWeight='Enter a weight from 25–400 kg.';
  if(!['lose','maintain','gain'].includes(mode))errors.goalMode='Choose lose, maintain, or gain.';
  if(mode==='lose'&&(!Number.isFinite(goal)||goal<=0||goal>=weight))errors.goalWeight='Goal weight must be below current weight.';
  if(mode==='gain'&&(!Number.isFinite(goal)||goal<=weight))errors.goalWeight='Goal weight must be above current weight.';
  if(mode==='maintain'&&Number.isFinite(weight))values.goalWeight=weight;
  if(mode==='lose'&&(!Number.isFinite(rate)||rate>=0||rate< -2))errors.desiredRate='Loss rate must be between -2 and 0 kg/week.';
  if(mode==='gain'&&(!Number.isFinite(rate)||rate<=0||rate>2))errors.desiredRate='Gain rate must be between 0 and 2 kg/week.';
  if(mode==='maintain'&&Math.abs(rate)>0.001)errors.desiredRate='Maintenance rate must be 0 kg/week.';
  if(!Number.isFinite(calories)||calories<1200||calories>6000)errors.calorieTarget='Calories must be 1200–6000 kcal.';
  if(!Number.isFinite(protein)||protein<20||protein>500)errors.proteinTarget='Protein must be 20–500 g.';
  if(!Number.isFinite(fiber)||fiber<0||fiber>100)errors.fiberTarget='Fiber must be 0–100 g.';

  return {valid:Object.keys(errors).length===0,errors};
}

export function goalModeCopy(mode){
  if(mode==='lose')return {label:'Lose weight',phase:'Initial cut',verb:'lose'};
  if(mode==='gain')return {label:'Gain weight',phase:'Initial gain',verb:'gain'};
  return {label:'Maintain weight',phase:'Maintenance',verb:'maintain'};
}
