const BASE='https://world.openfoodfacts.org';
const SEARCH_MIN_INTERVAL=6500;
const CACHE_MS=15*60*1000;
const cache=new Map();
let lastSearchAt=0;

function finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));}
function num(v){return finite(v)?Number(v):null;}
function cleanBarcode(value){return String(value??'').replace(/\D/g,'');}
function kcal(n){
  const direct=num(n?.['energy-kcal_100g']);
  if(direct!=null)return direct;
  const kj=num(n?.energy_100g);
  return kj==null?null:kj/4.184;
}
function servingKcal(n){
  const direct=num(n?.['energy-kcal_serving']);
  if(direct!=null)return direct;
  const kj=num(n?.energy_serving);
  return kj==null?null:kj/4.184;
}
function normalizeProduct(product={}){
  const n=product.nutriments??{};
  const code=cleanBarcode(product.code);
  const name=String(product.product_name??product.product_name_en??'').trim();
  if(!code||!name)return null;
  const per100={
    calories:kcal(n),
    protein:num(n.proteins_100g),
    carbs:num(n.carbohydrates_100g),
    fat:num(n.fat_100g),
    fiber:num(n.fiber_100g)
  };
  const serving={
    calories:servingKcal(n),
    protein:num(n.proteins_serving),
    carbs:num(n.carbohydrates_serving),
    fat:num(n.fat_serving),
    fiber:num(n.fiber_serving)
  };
  const servingQuantity=num(product.serving_quantity);
  const hasServing=serving.calories!=null || (servingQuantity!=null&&servingQuantity>0);
  return {
    code,
    name,
    brand:String(product.brands??'').split(',')[0].trim(),
    imageUrl:String(product.image_front_small_url??product.image_front_url??'').trim(),
    servingSize:String(product.serving_size??'').trim(),
    servingQuantity:servingQuantity&&servingQuantity>0?servingQuantity:null,
    per100,
    serving:hasServing?serving:null
  };
}
function withFields(url){
  url.searchParams.set('fields','code,product_name,product_name_en,brands,serving_size,serving_quantity,image_front_small_url,image_front_url,nutriments');
  return url;
}
async function jsonFetch(url){
  const response=await fetch(url,{method:'GET',credentials:'omit',headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error(`Open Food Facts request failed (${response.status}).`);
  return response.json();
}
function cached(key){
  const hit=cache.get(key);
  if(hit&&Date.now()-hit.at<CACHE_MS)return hit.value;
  if(hit)cache.delete(key);
  return null;
}
function put(key,value){cache.set(key,{at:Date.now(),value});return value;}

export async function lookupOpenFoodFactsBarcode(value){
  const code=cleanBarcode(value);
  if(code.length<8||code.length>14)throw new Error('Barcode must contain 8 to 14 digits.');
  const key=`barcode:${code}`;
  const hit=cached(key);
  if(hit)return hit;
  const url=withFields(new URL(`${BASE}/api/v2/product/${encodeURIComponent(code)}.json`));
  const data=await jsonFetch(url);
  if(Number(data?.status)!==1||!data?.product)return put(key,null);
  return put(key,normalizeProduct({...data.product,code:data.code??code}));
}

export async function searchOpenFoodFacts(query,{pageSize=10}={}){
  const q=String(query??'').trim();
  if(q.length<2)throw new Error('Enter at least 2 characters.');
  const key=`search:${q.toLowerCase()}`;
  const hit=cached(key);
  if(hit)return hit;

  const wait=SEARCH_MIN_INTERVAL-(Date.now()-lastSearchAt);
  if(wait>0)throw new Error(`Online search is rate-limited. Try again in ${Math.ceil(wait/1000)}s.`);
  lastSearchAt=Date.now();

  const url=new URL(`${BASE}/cgi/search.pl`);
  url.searchParams.set('search_terms',q);
  url.searchParams.set('search_simple','1');
  url.searchParams.set('action','process');
  url.searchParams.set('json','1');
  url.searchParams.set('page_size',String(Math.max(1,Math.min(12,pageSize))));
  url.searchParams.set('fields','code,product_name,product_name_en,brands,serving_size,serving_quantity,image_front_small_url,image_front_url,nutriments');
  const data=await jsonFetch(url);
  const products=(data?.products??[]).map(normalizeProduct).filter(Boolean).filter(p=>p.per100.calories!=null).slice(0,pageSize);
  return put(key,products);
}

export function scaleOpenFoodFactsProduct(product,grams){
  const g=Number(grams);
  if(!product||!Number.isFinite(g)||g<=0)throw new Error('Enter a valid serving weight.');
  const scale=g/100;
  const n=product.per100;
  const scaleValue=v=>v==null?null:Math.round(v*scale*10)/10;
  return {
    name:product.name,
    brand:product.brand||null,
    barcode:product.code,
    photoUrl:product.imageUrl||null,
    quantityText:`${Math.round(g*10)/10} g`,
    calories:scaleValue(n.calories),
    protein:scaleValue(n.protein)??0,
    carbs:scaleValue(n.carbs),
    fat:scaleValue(n.fat),
    fiber:scaleValue(n.fiber)
  };
}
