'use strict';

// Final release hardening. This layer fixes issues found during the V4 audit
// without changing Diet Copilot's data model or Supabase behavior.

p2WeightSub = function p2WeightSubP6(todayWeight, latest) {
  if (todayWeight) return String(todayWeight.notes || '').trim() || 'Today';
  if (latest) return `Latest · ${prettyDate(latest.date,{day:'numeric',month:'short'})}`;
  return 'No weigh-ins yet';
};

function p6ChartLabel(date, value, unit) {
  return `${prettyDate(date,{day:'numeric',month:'short'})}: ${fmt(value,unit==='kg'||unit==='g'?1:0)} ${unit}`;
}

p3WeightChart = function p3WeightChartP6(weights, moving) {
  if (weights.length < 2) return `<div class="p3-chart-empty"><strong>Not enough weight data yet</strong><span>Two or more weigh-ins are needed to draw a trend.</span></div>`;
  const width = 760, height = 250, left = 42, right = 18, top = 24, bottom = 34;
  const values = [...weights.map(w=>Number(w.weight)), ...moving.map(w=>Number(w.value))];
  let min = Math.min(...values), max = Math.max(...values);
  const padValue = Math.max(.3,(max-min)*.2);
  min -= padValue; max += padValue;
  if (min === max) { min -= .5; max += .5; }
  const xFor = (i,len) => left + i * ((width-left-right)/Math.max(1,len-1));
  const yFor = value => top + (max-value)/(max-min) * (height-top-bottom);
  const raw = weights.map((w,i)=>({x:xFor(i,weights.length),y:yFor(w.weight),value:w.weight,date:w.date}));
  const smooth = moving.map((w,i)=>({x:xFor(i,moving.length),y:yFor(w.value),value:w.value,date:w.date}));
  const path = points => points.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  return `<div class="p3-chart-wrap"><svg class="p3-chart p3-weight-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Weight trend chart">
    <line class="p3-grid" x1="${left}" x2="${width-right}" y1="${top}" y2="${top}"/>
    <line class="p3-grid" x1="${left}" x2="${width-right}" y1="${height-bottom}" y2="${height-bottom}"/>
    <path class="p3-weight-raw-line" d="${path(raw)}"/>
    <path class="p3-weight-trend-line" d="${path(smooth)}"/>
    ${raw.map(p=>{ const label=p6ChartLabel(p.date,p.value,'kg'); return `<circle class="p3-weight-point p6-chart-hit" cx="${p.x}" cy="${p.y}" r="4" tabindex="0" role="img" aria-label="${esc(label)}" data-chart-label="${esc(label)}"><title>${esc(label)}</title></circle>`; }).join('')}
    <text class="p3-axis-label" x="${left}" y="16">${fmt(max,1)} kg</text>
    <text class="p3-axis-label" x="${left}" y="${height-bottom-6}">${fmt(min,1)} kg</text>
    <text class="p3-axis-date" x="${left}" y="${height-8}" text-anchor="start">${prettyDate(weights[0].date,{day:'numeric',month:'short'})}</text>
    <text class="p3-axis-date" x="${width-right}" y="${height-8}" text-anchor="end">${prettyDate(weights.at(-1).date,{day:'numeric',month:'short'})}</text>
  </svg></div>`;
};

p3BarChart = function p3BarChartP6(metric, dates) {
  if (!dates.length) return `<div class="p3-chart-empty"><strong>No ${esc(metric)} data yet</strong><span>Logged days will appear here as your history grows.</span></div>`;
  const width = 760, height = 250, left = 42, right = 18, top = 24, bottom = 34;
  const isCalories = metric === 'calories';
  const points = dates.map(date => ({
    date,
    value: isCalories ? totalsFor(date).calories : totalsFor(date).protein,
    target: isCalories ? targetsFor(date).calories : targetsFor(date).protein,
    complete: dayLog(date).status === 'complete'
  }));
  const max = Math.max(1,...points.map(p=>Math.max(Number(p.value)||0,Number(p.target)||0))) * 1.12;
  const plotWidth = width-left-right;
  const step = plotWidth / Math.max(1,points.length);
  // Long all-time ranges must shrink rather than overlap one another.
  const barWidth = Math.max(1.5,Math.min(30,step*.58));
  const yFor = value => top + (1-(Number(value)||0)/max)*(height-top-bottom);
  const targetPath = points.map((p,i)=>`${i?'L':'M'} ${(left+step*i+step/2).toFixed(1)} ${yFor(p.target).toFixed(1)}`).join(' ');
  const unit = isCalories ? 'kcal' : 'g';
  return `<div class="p3-chart-wrap"><svg class="p3-chart p3-bar-chart ${metric}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${isCalories?'Calorie':'Protein'} trend chart">
    <line class="p3-grid" x1="${left}" x2="${width-right}" y1="${top}" y2="${top}"/>
    <line class="p3-grid" x1="${left}" x2="${width-right}" y1="${height-bottom}" y2="${height-bottom}"/>
    ${points.map((p,i)=>{ const x=left+step*i+(step-barWidth)/2; const y=yFor(p.value); const h=Math.max(1,height-bottom-y); const label=p6ChartLabel(p.date,p.value,unit); return `<rect class="p3-bar ${p.complete?'complete':'partial'} p6-chart-hit" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(6,barWidth/2).toFixed(1)}" tabindex="0" role="img" aria-label="${esc(label)}" data-chart-label="${esc(label)}"><title>${esc(label)}</title></rect>`; }).join('')}
    <path class="p3-target-line" d="${targetPath}"/>
    <text class="p3-axis-label" x="${left}" y="16">${fmt(max,isCalories?0:1)} ${unit}</text>
    <text class="p3-axis-date" x="${left}" y="${height-8}" text-anchor="start">${prettyDate(points[0].date,{day:'numeric',month:'short'})}</text>
    <text class="p3-axis-date" x="${width-right}" y="${height-8}" text-anchor="end">${prettyDate(points.at(-1).date,{day:'numeric',month:'short'})}</text>
  </svg><div class="p3-chart-legend"><span><i class="p3-legend-bar"></i>Recorded</span><span><i class="p3-legend-line"></i>Target</span></div></div>`;
};

function p6EnsureChartTooltip() {
  let tip = document.getElementById('chartTooltip');
  if (tip) return tip;
  tip = document.createElement('div');
  tip.id = 'chartTooltip';
  tip.className = 'p6-chart-tooltip';
  tip.setAttribute('role','status');
  tip.hidden = true;
  document.body.appendChild(tip);
  return tip;
}

function p6ShowChartTooltip(target) {
  const label = target?.dataset?.chartLabel;
  if (!label) return;
  const tip = p6EnsureChartTooltip();
  tip.textContent = label;
  tip.hidden = false;
  requestAnimationFrame(()=>{
    const rect = target.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const left = Math.min(window.innerWidth-tipRect.width-10,Math.max(10,rect.left+rect.width/2-tipRect.width/2));
    const top = Math.max(10,rect.top-tipRect.height-9);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  });
}

function p6HideChartTooltip() {
  const tip = document.getElementById('chartTooltip');
  if (tip) tip.hidden = true;
}

document.addEventListener('click',event=>{
  const hit = event.target.closest?.('.p6-chart-hit');
  if (hit) p6ShowChartTooltip(hit);
  else if (!event.target.closest?.('#chartTooltip')) p6HideChartTooltip();
});
document.addEventListener('focusin',event=>{ if (event.target.matches?.('.p6-chart-hit')) p6ShowChartTooltip(event.target); });
document.addEventListener('focusout',event=>{ if (event.target.matches?.('.p6-chart-hit')) p6HideChartTooltip(); });

const p6RenderBase = render;
render = function renderP6() {
  const result = p6RenderBase();
  p6HideChartTooltip();
  return result;
};

p6EnsureChartTooltip();
