import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  rankFoodCaptureMatches,
  normalizePortionMultiplier,
  portionPreview,
  portionQuantityText,
  latestRepeatCandidate
} from '../v2/p28-food-capture.mjs';

const model={food:{
  savedFoods:[
    {id:'f1',name:'Greek Yogurt',brand:'Fage',barcode:'12345678',favorite:false,useCount:3,calories:150,protein:20,quantity:'250 g'},
    {id:'f2',name:'Greek Yogurt Blueberry',brand:'Store',barcode:'',favorite:true,useCount:8,calories:180,protein:18,quantity:'1 tub'}
  ],
  savedMeals:[
    {id:'m1',name:'Chicken Rice',mealType:'Lunch',favorite:false,useCount:5,calories:650,protein:48,servingText:'1 bowl'},
    {id:'m2',name:'Chicken Wrap',mealType:'Dinner',favorite:true,useCount:2,calories:520,protein:35,servingText:'1 wrap'}
  ]
}};

{
  const hits=rankFoodCaptureMatches(model,'12345678',{mealType:'Lunch'});
  assert.equal(hits[0].item.id,'f1','exact barcode must dominate ranking');
}
{
  const hits=rankFoodCaptureMatches(model,'chicken',{mealType:'Lunch'});
  assert.equal(hits[0].item.id,'m1','same-meal-type reuse should rank appropriately');
}
{
  const hits=rankFoodCaptureMatches(model,'Greek Yogurt',{mealType:'Breakfast'});
  assert.equal(hits[0].item.id,'f1','exact food name should beat longer prefix');
}
assert.equal(normalizePortionMultiplier(0),0.1);
assert.equal(normalizePortionMultiplier(99),10);
assert.equal(normalizePortionMultiplier('1.5'),1.5);
assert.deepEqual(portionPreview({calories:240,protein:30},1.5),{multiplier:1.5,calories:360,protein:45});
assert.equal(portionQuantityText({quantity:'250 g'},.5,''),'0.5× 250 g');
assert.equal(portionQuantityText({servingText:'1 bowl'},2,''),'2× 1 bowl');
assert.equal(portionQuantityText({quantity:'250 g'},1,'180 g'),'180 g');

const recent=[
  {id:'a',type:'Dinner',title:'Latest dinner'},
  {id:'b',type:'Lunch',title:'Latest lunch'}
];
assert.equal(latestRepeatCandidate(recent,'Lunch').id,'b');
assert.equal(latestRepeatCandidate(recent,'Snack').id,'a');

const html=fs.readFileSync('index.html','utf8');
const food=fs.readFileSync('v2/food.js','utf8');
const management=fs.readFileSync('v2/food-management.js','utf8');
const css=fs.readFileSync('v2/shell.css','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const aliasSw=fs.readFileSync('v2/sw.js','utf8');

for(const id of ['foodRepeatLast','foodPortionDialog','foodPortionMultiplier','foodPortionSubmit'])assert.ok(html.includes(`id="${id}"`),`missing ${id}`);
assert.ok(food.includes("event.key==='ArrowDown'"));
assert.ok(food.includes("event.key==='Enter'&&ui.searchMatches.length"));
assert.ok(food.includes("event.key==='/'&&!typing"));
assert.ok(food.includes("clearSearchAfter:true"));
assert.ok(food.includes("matchMedia('(min-width:761px)').matches"));
assert.ok(management.includes("event.defaultPrevented||event.key!=='Enter'"));
assert.ok(css.includes('.dc-log-portion'));
assert.ok(css.includes('.dc-portion-presets'));
assert.ok(sw.includes('./v2/p28-food-capture.mjs'));
assert.ok(aliasSw.includes('./p28-food-capture.mjs'));

console.log('P28 frictionless food capture contract passed.');
