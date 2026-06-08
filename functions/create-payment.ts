import { asaas } from './_shared/asaas';

interface Env {
  ORDERS_KV: KVNamespace;
  ASAAS_API_KEY: string;
}

function clean(obj: Record<string, unknown>, key: string, limit = 500): string {
  return String(obj[key] ?? '').trim().replace(/[^\S\n]+/g, ' ').slice(0, limit);
}
function cleanBrief(obj: Record<string, unknown>, limit = 3000): string {
  return String(obj['brief'] ?? '').trim().slice(0, limit);
}
function digits(s: string): string { return s.replace(/\D/g, ''); }
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let input: Record<string, unknown>;
  try { input = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const name   = clean(input, 'nome', 120);
  const email  = clean(input, 'email', 160);
  const phone  = digits(clean(input, 'whatsapp', 40)).replace(/^55/, '');
  const cpf    = digits(clean(input, 'cpf', 40));
  const brief      = cleanBrief(input, 3000);
  const savedLetra = String(input['savedLetra'] ?? '').trim().slice(0, 3000);
  const bumpVersion   = input['orderBumpExtraVersion'] === true || input['orderBumpExtraVersion'] === 'true';
  const bumpSongs     = input['orderBumpExtraSongs']   === true || input['orderBumpExtraSongs']   === 'true';
  const bumpVideo     = input['orderBumpVideo']        === true || input['orderBumpVideo']        === 'true';
  const bumpQrCode    = input['orderBumpQrCode']       === true || input['orderBumpQrCode']       === 'true';
  const backOffer     = input['orderBumpBackOffer']    === true || input['orderBumpBackOffer']    === 'true';
  const attr = (input['attribution'] && typeof input['attribution'] === 'object')
    ? input['attribution'] as Record<string, string> : {};

  if (!name || !email || !phone || !cpf) {
    return json({ ok: false, error: 'missing_customer_fields' }, 422);
  }

  const total = backOffer ? 49.90 : (
    29.90
    + (bumpVersion ? 12.90 : 0)
    + (bumpSongs   ? 18.90 : 0)
    + (bumpVideo   ? 25.90 : 0)
    + (bumpQrCode  ? 14.90 : 0)
  );

  const externalRef = 'music-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  const clientIp  = request.headers.get('CF-Connecting-IP') || '';
  const userAgent = request.headers.get('User-Agent') || '';

  // 1. Create or find customer
  const customerRes = await asaas(env.ASAAS_API_KEY, 'POST', '/customers', {
    name, email, cpfCnpj: cpf,
    mobilePhone: phone,
    externalReference: externalRef,
    notificationDisabled: true,
  });

  if (!customerRes.ok || !customerRes.data['id']) {
    const msg = (customerRes.data['errors'] as Array<{description:string}>)?.[0]?.description
      ?? 'Não foi possível criar o cliente.';
    return json({ ok: false, error: 'customer_create_failed', message: msg }, 502);
  }

  const customerId = String(customerRes.data['id']);

  // 2. Create PIX payment
  const paymentRes = await asaas(env.ASAAS_API_KEY, 'POST', '/payments', {
    customer: customerId,
    billingType: 'PIX',
    value: total,
    dueDate: new Date().toISOString().slice(0, 10),
    description: 'Sonara Music - Música personalizada',
    externalReference: externalRef,
  });

  if (!paymentRes.ok || !paymentRes.data['id']) {
    const msg = (paymentRes.data['errors'] as Array<{description:string}>)?.[0]?.description
      ?? 'Não foi possível criar a cobrança Pix.';
    return json({ ok: false, error: 'payment_create_failed', message: msg }, 502);
  }

  const paymentId = String(paymentRes.data['id']);

  // 3. Get PIX QR code
  const qrRes = await asaas(env.ASAAS_API_KEY, 'GET', `/payments/${encodeURIComponent(paymentId)}/pixQrCode`);
  if (!qrRes.ok) {
    return json({ ok: false, error: 'pix_qrcode_failed' }, 502);
  }

  // 4. Store order in KV (optional — funciona sem KV configurado)
  const order = {
    paymentId, customerId, externalReference: externalRef,
    name, email, phone, cpf, brief, savedLetra,
    value: total,
    orderBumpExtraVersion: bumpVersion,
    orderBumpExtraSongs: bumpSongs,
    orderBumpVideo: bumpVideo,
    orderBumpQrCode: bumpQrCode,
    orderBumpBackOffer: backOffer,
    fbp: clean(attr, 'fbp', 180),
    fbc: clean(attr, 'fbc', 260),
    fbclid: clean(attr, 'fbclid', 260),
    pageUrl: clean(attr, 'pageUrl', 900),
    utmSource:   clean(attr, 'utmSource',   120),
    utmMedium:   clean(attr, 'utmMedium',   120),
    utmCampaign: clean(attr, 'utmCampaign', 200),
    utmContent:  clean(attr, 'utmContent',  200),
    utmTerm:     clean(attr, 'utmTerm',     200),
    clientIp, userAgent,
    paid: false, status: 'PENDING',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (env.ORDERS_KV) {
    await env.ORDERS_KV.put('order:' + paymentId, JSON.stringify(order), { expirationTtl: 86400 * 7 });
  }

  return json({
    ok: true,
    paymentId, customerId, externalReference: externalRef,
    value: total,
    orderBumpExtraVersion: bumpVersion,
    orderBumpExtraSongs: bumpSongs,
    orderBumpVideo: bumpVideo,
    orderBumpQrCode: bumpQrCode,
    orderBumpBackOffer: backOffer,
    invoiceUrl: paymentRes.data['invoiceUrl'] ?? null,
    encodedImage: qrRes.data['encodedImage'] ?? null,
    payload: qrRes.data['payload'] ?? null,
    expirationDate: qrRes.data['expirationDate'] ?? null,
  });
};
