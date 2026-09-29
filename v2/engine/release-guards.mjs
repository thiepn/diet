const AUTH_CODES=new Set([
  'bad_jwt','invalid_jwt','session_not_found','user_not_found',
  'refresh_token_not_found','refresh_token_already_used','refresh_token_reuse_detected'
]);

export function isDefinitiveAuthFailure(error){
  if(!error)return false;
  const status=Number(error?.status);
  const code=String(error?.code??'').toLowerCase();
  const message=String(error?.message??error??'').toLowerCase();
  if(status===401||status===403)return true;
  if(AUTH_CODES.has(code))return true;
  return /invalid (jwt|token)|jwt.*invalid|session.*not found|user.*not found|refresh token.*(invalid|not found|already used|reused|revoked)/i.test(message);
}

export function classifyReadFailure(error){
  if(isDefinitiveAuthFailure(error))return 'auth_invalid';
  const status=Number(error?.status);
  const name=String(error?.name??'');
  const message=String(error?.message??error??'');
  if(status===408||status===425||status===429||status>=500)return 'transient';
  if(['TypeError','AbortError','TimeoutError'].includes(name))return 'transient';
  if(/network|failed to fetch|fetch failed|timeout|timed out|connection|offline/i.test(message))return 'transient';
  return 'other';
}

export const DietReleaseGuardsP10=Object.freeze({
  version:'1.0.0-p10',
  definitiveAuthCodes:[...AUTH_CODES]
});
