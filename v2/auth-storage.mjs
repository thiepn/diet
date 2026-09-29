export const DIET_V2_AUTH_STORAGE_KEY='sb-hycegznamzjhwinegaai-auth-token';

const COOKIE_PREFIX='diet-auth-v2-';
const PKCE_FALLBACK_PREFIX='diet-v2-pkce:';

function isPkceKey(key){return String(key).endsWith('-code-verifier');}
function pkceFallbackKey(key){return PKCE_FALLBACK_PREFIX+String(key);}

function cookieName(key){return `${COOKIE_PREFIX}${encodeURIComponent(String(key))}`;}
function readCookie(name){
  const prefix=`${name}=`;
  const entry=document.cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith(prefix));
  return entry===undefined?null:entry.slice(prefix.length);
}
function writeCookie(name,value,age=31536000){
  const secure=location.protocol==='https:'?'; Secure':'';
  document.cookie=`${name}=${value}; Path=/; Max-Age=${age}; SameSite=Lax${secure}`;
}
function manifestFor(key){
  const raw=readCookie(`${cookieName(key)}.n`);
  if(raw===null)return null;
  if(/^[1-9]\d?$/.test(raw)&&Number(raw)<=24)return {raw,revision:'',count:Number(raw)};
  const match=/^v3-([a-z0-9]+)-([1-9]\d?)$/.exec(raw);
  if(match&&Number(match[2])<=24)return {raw,revision:`${match[1]}.`,count:Number(match[2])};
  return null;
}
function cookieGet(key){
  const manifest=manifestFor(key);
  if(!manifest)return null;
  const base=cookieName(key);
  let encoded='';
  for(let i=0;i<manifest.count;i++){
    const chunk=readCookie(`${base}.${manifest.revision}${i}`);
    if(chunk===null)return null;
    encoded+=chunk;
  }
  if(readCookie(`${base}.n`)!==manifest.raw)return null;
  try{return decodeURIComponent(encoded)}catch{return null}
}
function cookieRemove(key){
  const prefix=`${cookieName(key)}.`;
  for(const name of document.cookie.split(';').map(v=>v.trim().split('=')[0]).filter(n=>n.startsWith(prefix))){
    writeCookie(name,'',0);
  }
}
function cookieSet(key,text){
  const base=cookieName(key);
  const previous=document.cookie.split(';').map(v=>v.trim().split('=')[0]).filter(n=>n.startsWith(`${base}.`));
  const encoded=encodeURIComponent(text);
  const chunks=encoded.match(/.{1,2800}/g)||[];
  if(!chunks.length||chunks.length>24)throw new Error('Auth session is too large for resilient cookie storage.');
  const revision=`${Date.now().toString(36)}${Math.random().toString(36).slice(2,10)}`;
  const written=[];
  try{
    chunks.forEach((chunk,i)=>{
      const name=`${base}.${revision}.${i}`;
      written.push(name);
      writeCookie(name,chunk);
      if(readCookie(name)!==chunk)throw new Error('Browser did not retain auth cookie.');
    });
    writeCookie(`${base}.n`,`v3-${revision}-${chunks.length}`);
    if(cookieGet(key)!==text)throw new Error('Auth cookie verification failed.');
  }catch(error){
    written.forEach(name=>{try{writeCookie(name,'',0)}catch{}});
    throw error;
  }
  for(const name of previous){
    if(name!==`${base}.n`)writeCookie(name,'',0);
  }
}

function cookieOwns(key){
  try{return readCookie(`${cookieName(key)}.n`)!==null}catch{return false}
}

export const dietV2AuthStorage=Object.freeze({
  getItem(key){
    if(key===DIET_V2_AUTH_STORAGE_KEY&&cookieOwns(key)){
      const cookie=cookieGet(key);
      if(cookie!==null)return cookie;
      try{localStorage.removeItem(key)}catch{}
      return null;
    }
    try{
      const local=localStorage.getItem(key);
      if(local!==null)return local;
    }catch{}
    if(isPkceKey(key)){
      try{return sessionStorage.getItem(pkceFallbackKey(key))}catch{}
    }
    return null;
  },
  setItem(key,value){
    const text=String(value);
    if(key===DIET_V2_AUTH_STORAGE_KEY&&cookieOwns(key)){
      cookieSet(key,text);
      try{localStorage.removeItem(key)}catch{}
      return;
    }
    try{
      localStorage.setItem(key,text);
      if(localStorage.getItem(key)===text){
        if(isPkceKey(key))try{sessionStorage.removeItem(pkceFallbackKey(key))}catch{}
        return;
      }
    }catch{}
    if(key===DIET_V2_AUTH_STORAGE_KEY){
      cookieSet(key,text);
      try{localStorage.removeItem(key)}catch{}
      return;
    }
    if(isPkceKey(key)){
      try{
        sessionStorage.setItem(pkceFallbackKey(key),text);
        if(sessionStorage.getItem(pkceFallbackKey(key))===text)return;
      }catch{}
    }
    throw new Error('Browser storage is unavailable.');
  },
  removeItem(key){
    try{localStorage.removeItem(key)}catch{}
    if(isPkceKey(key))try{sessionStorage.removeItem(pkceFallbackKey(key))}catch{}
    if(key===DIET_V2_AUTH_STORAGE_KEY){
      try{cookieRemove(key)}catch{}
    }
  }
});
