import { asaas } from './_shared/asaas';
import { sendMetaCapiPurchase } from './_shared/meta-capi';

interface Env {
  ORDERS_KV: KVNamespace;
  ASAAS_API_KEY: string;
  META_PIXEL_ID: string;
  META_CAPI_TOKEN: string;
  META_PIXEL_ID_2: string;
  META_CAPI_TOKEN_2: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

const PAID_STATUSES = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const paymentId = url.searchParams.get('paymentId')?.replace(/[^a-zA-Z0-9_.-]/g, '') ?? '';
  if (!paymentId) return json({ ok: false, error: 'missing_payment_id' }, 400);

  const raw = env.ORDERS_KV ? await env.ORDERS_KV.get('order:' + paymentId) : null;
  if (!raw) return json({ ok: true, paid: false, status: 'PENDING' });

  const order = JSON.parse(raw) as Record<string, unknown>;
  let isPaid = order['paid'] === true;
  let status = String(order['status'] ?? 'PENDING');

  if (!isPaid) {
    const res = await asaas(env.ASAAS_API_KEY, 'GET', `/payments/${encodeURIComponent(paymentId)}`);
    if (res.ok && res.data['status']) {
      status = String(res.data['status']);
      isPaid = PAID_STATUSES.includes(status);
      if (isPaid) {
        order['paid'] = true;
        order['status'] = status;
        order['updated_at'] = new Date().toISOString();
        if (env.ORDERS_KV) await env.ORDERS_KV.put('order:' + paymentId, JSON.stringify(order), { expirationTtl: 86400 * 365 });
      }
    }
  }

  const capiOrder = {
    paymentId,
    customerId: String(order['customerId'] ?? ''),
    externalReference: String(order['externalReference'] ?? ''),
    name: String(order['name'] ?? ''),
    email: String(order['email'] ?? ''),
    phone: String(order['phone'] ?? ''),
    value: Number(order['value'] ?? 39.9),
    fbp: String(order['fbp'] ?? ''),
    fbc: String(order['fbc'] ?? ''),
    clientIp: String(order['clientIp'] ?? ''),
    userAgent: String(order['userAgent'] ?? ''),
    pageUrl: String(order['pageUrl'] ?? ''),
    brief: String(order['brief'] ?? ''),
  };

  if (isPaid && !order['metaCapiSent']) {
    const sent = await sendMetaCapiPurchase(env.META_PIXEL_ID, env.META_CAPI_TOKEN, capiOrder);
    if (sent) {
      order['metaCapiSent'] = true;
      order['updated_at'] = new Date().toISOString();
      if (env.ORDERS_KV) await env.ORDERS_KV.put('order:' + paymentId, JSON.stringify(order), { expirationTtl: 86400 * 365 });
    }
  }

  if (isPaid && !order['metaCapiSent2']) {
    const sent2 = await sendMetaCapiPurchase(env.META_PIXEL_ID_2, env.META_CAPI_TOKEN_2, capiOrder);
    if (sent2) {
      order['metaCapiSent2'] = true;
      order['updated_at'] = new Date().toISOString();
      if (env.ORDERS_KV) await env.ORDERS_KV.put('order:' + paymentId, JSON.stringify(order), { expirationTtl: 86400 * 365 });
    }
  }

  return json({
    ok: true,
    paid: isPaid,
    status,
    // Campos de áudio (presentes se a música já foi gerada)
    audioUrl:       order['audioUrl']       ? String(order['audioUrl'])       : undefined,
    streamAudioUrl: order['streamAudioUrl'] ? String(order['streamAudioUrl']) : undefined,
    downloadUrl:    order['downloadUrl']    ? String(order['downloadUrl'])    : undefined,
    imageUrl:       order['imageUrl']       ? String(order['imageUrl'])       : undefined,
    duration:       order['duration']       ?? undefined,
    generationStatus: order['generationStatus'] ? String(order['generationStatus']) : undefined,
    sessionId:      order['sessionId']      ? String(order['sessionId'])      : undefined,
  });
};
