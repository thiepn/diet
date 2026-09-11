'use strict';
  function queueWeight(w) { queueOp({ kind: 'upsert', table: 'weight_entries', rowId: w.id, payload: { id: w.id, entry_date: w.date, weight: Number(w.weight), notes: w.notes || null, created_at: w.createdAt || nowIso(), updated_at: w.updatedAt || nowIso() } }); }
  function queueSavedFood(f) { queueOp({ kind: 'upsert', table: 'saved_foods', rowId: f.id, payload: { id: f.id, name: f.name, quantity_text: f.quantity || null, calories: Number(f.calories || 0), protein: Number(f.protein || 0), confidence: f.confidence || 'high', source: f.source || 'manual_exact', favorite: Boolean(f.favorite), use_count: Number(f.useCount || 0), last_used_at: f.lastUsedAt || null, created_at: f.createdAt || nowIso(), updated_at: f.updatedAt || nowIso() } }); }
  function queueSavedMeal(sm, previous) {
    queueOp({ kind: 'upsert', table: 'saved_meals', rowId: sm.id, payload: { id: sm.id, name: sm.name, meal_type: sm.mealType, favorite: Boolean(sm.favorite), use_count: Number(sm.useCount || 0), last_used_at: sm.lastUsedAt || null, created_at: sm.createdAt || nowIso(), updated_at: sm.updatedAt || nowIso() } });
    const nextIds = new Set((sm.items || []).map(i => i.id)); (previous?.items || []).filter(i => !nextIds.has(i.id)).forEach(i => queueDelete('saved_meal_items', i.id));
    (sm.items || []).forEach((i, idx) => queueOp({ kind: 'upsert', table: 'saved_meal_items', rowId: i.id, payload: { id: i.id, saved_meal_id: sm.id, saved_food_id: i.savedFoodId || null, name: i.name, quantity_text: i.quantity || null, calories: Number(i.calories || 0), protein: Number(i.protein || 0), calories_low: i.caloriesLow ?? null, calories_high: i.caloriesHigh ?? null, confidence: i.confidence || 'high', source: i.source || 'saved_food', sort_order: idx, updated_at: nowIso() } }));
  }
  function queueDelete(table, id) {
    if (table === 'meals') state.syncQueue = state.syncQueue.filter(q => !(q.table === 'meal_items' && q.payload?.meal_id === id));
    if (table === 'saved_meals') state.syncQueue = state.syncQueue.filter(q => !(q.table === 'saved_meal_items' && q.payload?.saved_meal_id === id));
    if (table === 'saved_foods') state.syncQueue.forEach(q => { if ((q.table === 'meal_items' || q.table === 'saved_meal_items') && q.payload?.saved_food_id === id) q.payload.saved_food_id = null; });
    queueOp({ kind: 'delete', table, rowId: id });
  }

  async function verifyCloudSchema(showFeedback = false) {
    if (!cloud.client || !cloud.user) return false;
    if (!isOnline()) { if (showFeedback) showToast('Offline — cloud schema cannot be verified yet'); return false; }
    try {
      const { data, error } = await cloud.client.rpc('diet_copilot_healthcheck');
      if (error) throw error;
      const caps = data?.capabilities || {};
      const required = ['get_diet_context','search_diet_history','log_meal_from_ai','update_meal_from_ai','delete_meal_from_ai','log_weight_from_ai','undo_ai_action'];
      const missing = required.filter(k => caps[k] !== true);
      if (Number(data?.schema_version) < 5 || missing.length) throw new Error(`V0.5 schema required${missing.length ? `; missing ${missing.join(', ')}` : ''}`);
      cloud.health = data; cloud.healthCheckedAt = nowIso(); return true;
    } catch (e) {
      cloud.status = 'error'; cloud.error = `Cloud schema check failed: ${e.message || e}`; updateSyncPill(); if (showFeedback) showToast('Install the V0.5 Supabase upgrade before enabling sync'); return false;
    }
  }

  async function initCloud(showFeedback = false) {
    cloud.error = null;
    if (!cloudConfig.url || !cloudConfig.key) { await unsubscribeRealtime(); cloud = { client: null, user: null, status: 'local', busy: false, lastSyncAt: null, error: null, channel: null, remotePending: false, remoteEventCount: 0, deferredRefresh: false, health: null, healthCheckedAt: null }; updateSyncPill(); return; }
    if (!window.supabase?.createClient) { cloud.status = 'error'; cloud.error = 'Supabase SDK did not load'; updateSyncPill(); if (showFeedback) showToast('Supabase SDK could not load; local mode still works'); return; }
    try {
      await unsubscribeRealtime();
      cloud.client = window.supabase.createClient(cloudConfig.url, cloudConfig.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      const { data, error } = await cloud.client.auth.getSession(); if (error) throw error; cloud.user = data.session?.user || null; cloud.status = cloud.user ? 'connected' : 'configured';
      cloud.client.auth.onAuthStateChange((_event, session) => { cloud.user = session?.user || null; cloud.status = cloud.user ? 'connected' : 'configured'; updateSyncPill(); if (cloud.user && cloudConfig.activated) subscribeRealtime(); if (currentView === 'settings') renderSettings(); });
      updateSyncPill(); if (showFeedback) showToast(cloud.user ? 'Supabase connected' : 'Supabase configured — sign in next');
      if (cloud.user && cloudConfig.activated) { if (isOnline() && !(await verifyCloudSchema(showFeedback))) return; await flushQueue(); if (!state.syncQueue.length && !cloud.remotePending) await downloadCloudData(false, { silent: true }); subscribeRealtime(); }
    } catch (e) { cloud.status = 'error'; cloud.error = e.message || String(e); updateSyncPill(); if (showFeedback) showToast(`Cloud connection failed: ${cloud.error}`); }
  }
  async function signIn(email, password) { if (!cloud.client) return; setCloudBusy(true); const { data, error } = await cloud.client.auth.signInWithPassword({ email, password }); setCloudBusy(false); if (error) { showToast(error.message); return; } cloud.user = data.user; cloud.status = 'connected'; showToast('Signed in'); renderSettings(); if (cloudConfig.activated) { if (isOnline() && !(await verifyCloudSchema(true))) return; await flushQueue(); if (!state.syncQueue.length && !cloud.remotePending) await downloadCloudData(false, { silent: true }); subscribeRealtime(); } }
