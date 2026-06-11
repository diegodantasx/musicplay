import { sendMetaCapiEvent } from './_shared/meta-capi';

interface Env {
  META_PIXEL_ID: string;
  META_CAPI_TOKEN: string;
  META_PIXEL_ID_2: string;
  META_CAPI_TOKEN_2: string;
}

const ALLOWED_EVENTS = new Set([
  'PageView',
  'ViewContent',
  'Lead',
  'InitiateCheckout',
  'AddPaymentInfo',
  'Purchase',
]);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function clean(value: unknown, limit = 300): string {
  return String(value ?? '').trim().slice(0, limit);
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const eventName = clean(body.eventName, 60);
  const eventId = clean(body.eventId, 120);
  if (!ALLOWED_EVENTS.has(eventName) || !eventId) {
    return json({ ok: false, error: 'invalid_event' }, 422);
  }

  const customData = (body.customData && typeof body.customData === 'object')
    ? body.customData as Record<string, unknown>
    : {};
  const attribution = (body.attribution && typeof body.attribution === 'object')
    ? body.attribution as Record<string, unknown>
    : {};
  const customer = (body.customer && typeof body.customer === 'object')
    ? body.customer as Record<string, unknown>
    : {};

  const input = {
    eventName,
    eventId,
    value: num(customData.value),
    currency: clean(customData.currency || 'BRL', 10),
    contentName: clean(customData.content_name || customData.contentName || 'MusicLove Studio', 120),
    contentIds: ['musiclove_studio'],
    contentType: clean(customData.content_type || customData.contentType || 'product', 80),
    eventSourceUrl: clean(attribution.pageUrl || request.url, 900),
    fbp: clean(attribution.fbp, 180),
    fbc: clean(attribution.fbc, 260),
    email: clean(customer.email, 180),
    phone: clean(customer.phone, 60),
    name: clean(customer.name, 160),
    externalId: clean(customer.externalId, 160),
    clientIp: request.headers.get('CF-Connecting-IP') || '',
    userAgent: request.headers.get('User-Agent') || clean(attribution.userAgent, 300),
  };

  const [sent1, sent2] = await Promise.all([
    sendMetaCapiEvent(env.META_PIXEL_ID, env.META_CAPI_TOKEN, input),
    sendMetaCapiEvent(env.META_PIXEL_ID_2, env.META_CAPI_TOKEN_2, input),
  ]);

  return json({ ok: sent1 || sent2, sent1, sent2 });
};
