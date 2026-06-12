import { sendMetaCapiPurchase } from './_shared/meta-capi';

interface Env {
  ORDERS_KV: KVNamespace;
  META_PIXEL_ID: string;
  META_CAPI_TOKEN: string;
  META_PIXEL_ID_2: string;
  META_CAPI_TOKEN_2: string;
  KIE_API_KEY: string;
  ADMIN_PASSWORD: string;
  OWNER_WHATSAPP: string;
  CALLMEBOT_API_KEY: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  ASAAS_WEBHOOK_TOKEN: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

const PAID_EVENTS = ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED_IN_CASH'];
const PAID_STATUSES = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (env.ASAAS_WEBHOOK_TOKEN) {
    const token = request.headers.get('asaas-access-token') || '';
    if (token !== env.ASAAS_WEBHOOK_TOKEN) {
      return json({ ok: false, error: 'invalid_webhook_token' }, 401);
    }
  }

  let payload: Record<string, unknown>;
  try { payload = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false }, 400); }

  const event = String(payload['event'] ?? '');
  const payment = (payload['payment'] ?? {}) as Record<string, unknown>;
  const paymentId = String(payment['id'] ?? '').replace(/[^a-zA-Z0-9_.-]/g, '');

  if (!paymentId) return json({ ok: true });

  const isPaid = PAID_EVENTS.includes(event)
    || PAID_STATUSES.includes(String(payment['status'] ?? ''));

  console.log('[webhook] event:', event, 'paymentId:', paymentId, 'isPaid:', isPaid, 'status:', String(payment['status'] ?? ''));

  const raw = await env.ORDERS_KV.get('order:' + paymentId);
  if (!raw) {
    console.log('[webhook] order NOT FOUND in KV for paymentId:', paymentId);
    return json({ ok: true });
  }

  const order = JSON.parse(raw) as Record<string, unknown>;
  order['status'] = String(payment['status'] ?? event);
  order['paid'] = isPaid;
  order['updated_at'] = new Date().toISOString();
  order['asaas_event'] = event;

  await env.ORDERS_KV.put('order:' + paymentId, JSON.stringify(order), { expirationTtl: 86400 * 365 });

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
    console.log('[capi] attempting Purchase — pixelId:', env.META_PIXEL_ID ? 'SET' : 'MISSING', 'token:', env.META_CAPI_TOKEN ? 'SET' : 'MISSING');
    const sent = await sendMetaCapiPurchase(env.META_PIXEL_ID, env.META_CAPI_TOKEN, capiOrder);
    console.log('[capi] Purchase result:', sent ? 'SUCCESS' : 'FAILED');
    if (sent) {
      order['metaCapiSent'] = true;
      order['updated_at'] = new Date().toISOString();
      await env.ORDERS_KV.put('order:' + paymentId, JSON.stringify(order), { expirationTtl: 86400 * 30 });
    }
  } else if (isPaid && order['metaCapiSent']) {
    console.log('[capi] Purchase already sent, skipping');
  }

  if (isPaid && !order['metaCapiSent2']) {
    console.log('[capi-2] attempting Purchase - pixelId:', env.META_PIXEL_ID_2 ? 'SET' : 'MISSING', 'token:', env.META_CAPI_TOKEN_2 ? 'SET' : 'MISSING');
    const sent2 = await sendMetaCapiPurchase(env.META_PIXEL_ID_2, env.META_CAPI_TOKEN_2, capiOrder);
    console.log('[capi-2] Purchase result:', sent2 ? 'SUCCESS' : 'FAILED');
    if (sent2) {
      order['metaCapiSent2'] = true;
      order['updated_at'] = new Date().toISOString();
      await env.ORDERS_KV.put('order:' + paymentId, JSON.stringify(order), { expirationTtl: 86400 * 365 });
    }
  } else if (isPaid && order['metaCapiSent2']) {
    console.log('[capi-2] Purchase already sent, skipping');
  }

  if (isPaid) {
    const origin = new URL(request.url).origin;
    const auth   = 'Basic ' + btoa(':' + (env.ADMIN_PASSWORD || ''));

    // 0. Push notification de nova venda
    if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
      const name   = String(order['name']  ?? 'Cliente').split(' ')[0];
      const value  = Number(order['value'] ?? 39.9).toFixed(2).replace('.', ',');
      const bumps  = [
        order['orderBumpVideo']        ? '🎬 Vídeo' : '',
        order['orderBumpExtraSongs']   ? '🎵 +2 músicas' : '',
        order['orderBumpExtraVersion'] ? '➕ Versão extra' : '',
        order['orderBumpQrCode']       ? '📲 QR Code' : '',
      ].filter(Boolean).join(' · ');
      context.waitUntil(
        fetch(origin + '/push-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': auth },
          body: JSON.stringify({
            title: `💰 Venda confirmada — R$${value}`,
            message: `${name}${bumps ? ' · ' + bumps : ''}`,
          }),
        }).catch(() => {}),
      );
    }

    // 1. Notificação de vídeo pendente (WhatsApp via CallMeBot — opcional)
    if (order['orderBumpVideo'] === true && !order['videoNotified']) {
      order['videoPending']  = true;
      order['videoNotified'] = false;
      order['updated_at']    = new Date().toISOString();
      await env.ORDERS_KV.put('order:' + paymentId, JSON.stringify(order), { expirationTtl: 86400 * 365 });

      if (env.OWNER_WHATSAPP && env.CALLMEBOT_API_KEY) {
        const name  = String(order['name'] ?? '');
        const para2 = String(order['brief'] ?? '').match(/Para quem:\s*([^\n]+)/i)?.[1] ?? '';
        const msg   = `🎬 NOVO PEDIDO COM VÍDEO\nCliente: ${name}\nPara: ${para2}\nPedido: ${paymentId}\nAcesse: ${origin}/m/${paymentId}`;
        context.waitUntil(
          fetch(`https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(env.OWNER_WHATSAPP)}&text=${encodeURIComponent(msg)}&apikey=${env.CALLMEBOT_API_KEY}`)
            .then(r => { if (r.ok) { order['videoNotified'] = true; return env.ORDERS_KV.put('order:' + paymentId, JSON.stringify(order), { expirationTtl: 86400 * 30 }); } })
            .catch(() => {}),
        );
      }
    }

    // 3. Músicas extras — marcar como pendente para acompanhamento
    if (order['orderBumpExtraSongs'] === true && !order['extraSongsPending']) {
      order['extraSongsPending'] = true;
      order['updated_at']        = new Date().toISOString();
      await env.ORDERS_KV.put('order:' + paymentId, JSON.stringify(order), { expirationTtl: 86400 * 365 });
    }
  }

  return json({ ok: true });
};
