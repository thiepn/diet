'use strict';

// Diet Copilot consumer bridge for the certified THIEPN Account platform.
// Source contract: thiepn/thiepn.github.io@124221f39a932d50f9a86ad5c3da2d8fd1fe50af
// Account SDK 1.2.0 / Platform 1.0.0. This is deliberately classic-script
// compatible so Diet's existing load order and Firefox/Zen recovery vault stay intact.
(function installDietAccountPlatform(global) {
  const SDK_VERSION = '1.2.0';
  const PLATFORM_VERSION = '1.0.0';
  const SOURCE_SHA = '124221f39a932d50f9a86ad5c3da2d8fd1fe50af';
  const APP_ID = 'diet';
  const SESSION_KEY = 'sb-hycegznamzjhwinegaai-auth-token';
  const SUPABASE_URL = 'https://hycegznamzjhwinegaai.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_1rZzRPzfLMaAH5pIgCwIjA_19UPMIsR';
  let activityUserId = null;

  function decodePayload(token) {
    if (typeof token !== 'string' || typeof global.atob !== 'function') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
      const value = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = value.padEnd(Math.ceil(value.length / 4) * 4, '=');
      const binary = global.atob(padded);
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return null;
    }
  }

  function getHandoffState(session) {
    if (!session?.user) {
      return Object.freeze({
        signedIn: false,
        requiresAdditionalVerification: false,
        assuranceLevel: 'aal1'
      });
    }
    const claims = decodePayload(session.access_token);
    const assuranceLevel = claims?.aal === 'aal2' ? 'aal2' : 'aal1';
    const factors = Array.isArray(session.user.factors) ? session.user.factors : [];
    const hasVerifiedFactor = factors.some(factor => factor?.status === 'verified');
    return Object.freeze({
      signedIn: true,
      requiresAdditionalVerification: hasVerifiedFactor && assuranceLevel !== 'aal2',
      assuranceLevel
    });
  }

  async function recordActivity(session) {
    const userId = session?.user?.id;
    if (!userId || !session?.access_token || activityUserId === userId) return null;
    const query = new URLSearchParams({
      on_conflict: 'user_id,app_slug',
      select: 'app_slug,first_used_at,last_used_at'
    });
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/account_user_apps?${query}`, {
        method: 'POST',
        headers: {
          apikey: PUBLISHABLE_KEY,
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify({
          user_id: userId,
          app_slug: APP_ID,
          last_used_at: new Date().toISOString(),
          source: 'app'
        })
      });
      if (!response.ok) throw new Error(`Activity metadata failed (${response.status})`);
      activityUserId = userId;
      return true;
    } catch (error) {
      console.warn('Diet Copilot account activity marker failed', error);
      return null;
    }
  }

  function adoptSession(session) {
    const handoff = getHandoffState(session);
    if (session?.user) void recordActivity(session);
    else activityUserId = null;
    return handoff;
  }

  function clearSessionMarker() {
    activityUserId = null;
  }

  function accountUrl() {
    return new URL('/account/', global.location?.origin || 'https://thiepn.dev').toString();
  }

  global.dietAccountPlatform = Object.freeze({
    sdkVersion: SDK_VERSION,
    platformVersion: PLATFORM_VERSION,
    sourceSha: SOURCE_SHA,
    appId: APP_ID,
    sessionKey: SESSION_KEY,
    adoptSession,
    clearSessionMarker,
    getHandoffState,
    recordActivity,
    accountUrl
  });
})(window);
