'use strict';

// V6.1 compatibility helper retained for the barcode lookup library.
// V6.6 owns all dashboard realtime subscriptions, so the old separate
// activity_daily channel has been retired.
if (typeof v6BarcodeProductMarkup === 'function') {
  const v61BarcodeMarkupBase = v6BarcodeProductMarkup;
  v6BarcodeProductMarkup = function v61BarcodeProductMarkup(product) {
    if (product?.source === 'Open Food Facts') product = { ...product, quantity: 'per 100 g' };
    return v61BarcodeMarkupBase(product);
  };
}
