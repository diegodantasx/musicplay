interface Ga4PurchaseOrder {
  paymentId: string;
  value: number;
  clientId?: string;
  sessionId?: string;
  orderBumpExtraVersion?: boolean;
  orderBumpExtraSongs?: boolean;
  orderBumpVideo?: boolean;
  orderBumpQrCode?: boolean;
  orderBumpBackOffer?: boolean;
}

function purchaseItems(order: Ga4PurchaseOrder): Array<Record<string, unknown>> {
  if (order.orderBumpBackOffer) {
    return [{ item_id: 'musiclove_back_offer', item_name: 'MusicLove Studio + video', price: 49.90, quantity: 1 }];
  }

  const items: Array<Record<string, unknown>> = [
    { item_id: 'musiclove_studio', item_name: 'MusicLove Studio', price: 39.99, quantity: 1 },
  ];
  if (order.orderBumpExtraVersion) items.push({ item_id: 'extra_version', item_name: 'Versao extra', price: 19.89, quantity: 1 });
  if (order.orderBumpExtraSongs) items.push({ item_id: 'extra_songs', item_name: 'Duas musicas extras', price: 25.89, quantity: 1 });
  if (order.orderBumpVideo) items.push({ item_id: 'music_video', item_name: 'Video da musica', price: 32.89, quantity: 1 });
  if (order.orderBumpQrCode) items.push({ item_id: 'qr_code', item_name: 'QR Code da musica', price: 21.89, quantity: 1 });
  return items;
}

export async function sendGa4Purchase(
  measurementId: string,
  apiSecret: string,
  order: Ga4PurchaseOrder,
): Promise<boolean> {
  if (!measurementId || !apiSecret || !order.paymentId) return false;

  const clientId = order.clientId || `server.${order.paymentId}`;
  const params: Record<string, unknown> = {
    transaction_id: order.paymentId,
    currency: 'BRL',
    value: Number(order.value.toFixed(2)),
    engagement_time_msec: 1,
    items: purchaseItems(order),
  };
  if (order.sessionId) params['session_id'] = order.sessionId;

  const endpoint = new URL('https://www.google-analytics.com/mp/collect');
  endpoint.searchParams.set('measurement_id', measurementId);
  endpoint.searchParams.set('api_secret', apiSecret);

  try {
    const response = await fetch(endpoint.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        timestamp_micros: String(Date.now() * 1000),
        events: [{ name: 'purchase', params }],
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
