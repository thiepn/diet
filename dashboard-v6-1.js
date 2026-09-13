'use strict';

// V6.1 polish: Open Food Facts macros are always the per-100 g values, even
// when the database also exposes a serving-size string. Keep that distinction
// explicit so the UI never implies the per-100 g numbers are per serving.
if (typeof v6BarcodeProductMarkup === 'function') {
  const v61BarcodeMarkupBase = v6BarcodeProductMarkup;
  v6BarcodeProductMarkup = function v61BarcodeProductMarkup(product) {
    if (product?.source === 'Open Food Facts') product = { ...product, quantity: 'per 100 g' };
    return v61BarcodeMarkupBase(product);
  };
}

// The base realtime channel predates activity_daily. Add a small owner-scoped
// activity channel so Health Connect / ChatGPT activity updates refresh an open
// dashboard without waiting for a manual refresh.
let v61ActivityRefreshTimer = null;
if (typeof subscribeRealtime === 'function') {
  const v61SubscribeRealtimeBase = subscribeRealtime;
  subscribeRealtime = async function subscribeRealtimeV61() {
    if (cloud.v6ActivityChannel && cloud.client) {
      try { await cloud.client.removeChannel(cloud.v6ActivityChannel); } catch {}
      cloud.v6ActivityChannel = null;
    }
    await v61SubscribeRealtimeBase();
    if (!cloud.client || !cloud.user) return;
    cloud.v6ActivityChannel = cloud.client
      .channel(`diet-activity-v6-${cloud.user.id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'activity_daily'},()=>{
        clearTimeout(v61ActivityRefreshTimer);
        v61ActivityRefreshTimer = setTimeout(()=>refreshData({silent:true}),300);
      })
      .subscribe();
  };
}

if (typeof disposeCloud === 'function') {
  const v61DisposeCloudBase = disposeCloud;
  disposeCloud = async function disposeCloudV61() {
    clearTimeout(v61ActivityRefreshTimer);
    if (cloud.v6ActivityChannel && cloud.client) {
      try { await cloud.client.removeChannel(cloud.v6ActivityChannel); } catch {}
      cloud.v6ActivityChannel = null;
    }
    return v61DisposeCloudBase();
  };
}
