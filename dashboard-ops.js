'use strict';

// A7 operational layer. This file intentionally does not own identity, data, or
// network transport. It observes the final dashboard contract and emits only
// redacted operational metadata.
const DIET_OPERATIONS_VERSION = 'A7.1';

function dietOperationId() {
  try { return crypto.randomUUID(); }
  catch { return `op-${Date.now()}-${Math.random().toString(36).slice(2,10)}`; }
}

function dietFailureCategory(status = 0) {
  const code = Number(status || 0);
  if (code === 0) return 'network';
  if (code === 401) return 'authentication';
  if (code === 403) return 'authorization';
  if (code === 429) return 'rate_limit';
  if (code >= 500) return 'service';
  if (code >= 400) return 'request';
  return 'unknown';
}

function dietOperationalEvent(event, fields = {}) {
  const allowed = ['operation_id','category','http_status','duration_ms','attempt','online','cloud_status','release','error_name'];
  const payload = { event, operations_version: DIET_OPERATIONS_VERSION };
  for (const key of allowed) {
    const value = fields[key];
    if (value !== undefined && value !== null) payload[key] = value;
  }
  const serialized = JSON.stringify(payload);
  if (String(event).endsWith('.failure') || fields.category === 'service') console.warn(serialized);
  else console.info(serialized);
}

function dietOperationalSnapshot() {
  return Object.freeze({
    app: 'diet',
    operationsVersion: DIET_OPERATIONS_VERSION,
    release: typeof RELEASE === 'string' ? RELEASE : null,
    online: navigator.onLine,
    cloudStatus: cloud?.status ?? 'unknown',
    hasSession: Boolean(cloud?.user),
    cachedAt: dashboard?.fetchedAt ?? null,
    source: dashboard?.source ?? null,
  });
}

const dietRefreshBeforeOperations = typeof refreshData === 'function' ? refreshData : null;
if (dietRefreshBeforeOperations) {
  refreshData = async function refreshDataA7(...args) {
    const operationId = dietOperationId();
    const started = Date.now();
    try {
      const result = await dietRefreshBeforeOperations.apply(this, args);
      if (cloud?.status === 'error') {
        dietOperationalEvent('diet.refresh.failure', {
          operation_id: operationId,
          category: navigator.onLine ? 'service' : 'network',
          duration_ms: Date.now() - started,
          online: navigator.onLine,
          cloud_status: cloud.status,
          release: RELEASE,
        });
      } else {
        dietOperationalEvent('diet.refresh.success', {
          operation_id: operationId,
          duration_ms: Date.now() - started,
          online: navigator.onLine,
          cloud_status: cloud?.status ?? 'unknown',
          release: RELEASE,
        });
      }
      return result;
    } catch (error) {
      dietOperationalEvent('diet.refresh.failure', {
        operation_id: operationId,
        category: navigator.onLine ? 'service' : 'network',
        duration_ms: Date.now() - started,
        online: navigator.onLine,
        cloud_status: cloud?.status ?? 'unknown',
        release: RELEASE,
        error_name: error?.name || 'Error',
      });
      throw error;
    }
  };
}

window.addEventListener('offline', () => {
  dietOperationalEvent('diet.network.offline', {
    operation_id: dietOperationId(),
    category: 'network',
    online: false,
    cloud_status: cloud?.status ?? 'unknown',
    release: RELEASE,
  });
});

window.addEventListener('online', () => {
  dietOperationalEvent('diet.network.online', {
    operation_id: dietOperationId(),
    online: true,
    cloud_status: cloud?.status ?? 'unknown',
    release: RELEASE,
  });
});

window.DietOperations = Object.freeze({
  version: DIET_OPERATIONS_VERSION,
  classifyStatus: dietFailureCategory,
  createOperationId: dietOperationId,
  snapshot: dietOperationalSnapshot,
});
