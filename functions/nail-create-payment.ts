import { asaas } from './_shared/asaas';

interface Env {
  ORDERS_KV: KVNamespace;
  ASAAS_API_KEY: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function text(value: unknown, max: number): string {
  return String(value ?? '').trim().replace(/[^\S\n]+/g, ' ').slice(0, max);
}

function digits(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let input: Record<string, unknown>;
  try {
    input = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const name = text(input.nome, 120);
  const email = text(input.email, 160).toLowerCase();
  const phone = digits(input.whatsapp).replace(/^55/, '');
  const cpf = digits(input.cpf);
  const utmSource = text(input.utmSource, 80).toLowerCase();

  if (!name || !email || phone.length < 10 || cpf.length !== 11) {
    return json({ ok: false, error: 'invalid_customer_fields' }, 422);
  }

  const externalReference = `nail-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const customerResult = await asaas(env.ASAAS_API_KEY, 'POST', '/customers', {
    name,
    email,
    cpfCnpj: cpf,
    mobilePhone: phone,
    externalReference,
    notificationDisabled: true,
  });

  if (!customerResult.ok || !customerResult.data.id) {
    const errors = customerResult.data.errors as Array<{ description?: string }> | undefined;
    return json({
      ok: false,
      error: 'customer_create_failed',
      message: errors?.[0]?.description ?? 'Não foi possível cadastrar o comprador.',
    }, 502);
  }

  const customerId = String(customerResult.data.id);
  const paymentResult = await asaas(env.ASAAS_API_KEY, 'POST', '/payments', {
    customer: customerId,
    billingType: 'PIX',
    value: 10,
    dueDate: new Date().toISOString().slice(0, 10),
    description: 'Nail Collection - Caderno de Moldes para Nail Art',
    externalReference,
  });

  if (!paymentResult.ok || !paymentResult.data.id) {
    const errors = paymentResult.data.errors as Array<{ description?: string }> | undefined;
    return json({
      ok: false,
      error: 'payment_create_failed',
      message: errors?.[0]?.description ?? 'Não foi possível criar a cobrança Pix.',
    }, 502);
  }

  const paymentId = String(paymentResult.data.id);
  const qrResult = await asaas(
    env.ASAAS_API_KEY,
    'GET',
    `/payments/${encodeURIComponent(paymentId)}/pixQrCode`,
  );
  if (!qrResult.ok) return json({ ok: false, error: 'pix_qrcode_failed' }, 502);

  const order = {
    product: 'nail-collection',
    paymentId,
    customerId,
    externalReference,
    name,
    email,
    phone,
    cpf,
    value: 10,
    paid: false,
    status: 'PENDING',
    clientIp: request.headers.get('CF-Connecting-IP') || '',
    userAgent: request.headers.get('User-Agent') || '',
    pageUrl: new URL(request.url).origin + '/nail/',
    utmSource,
    source: utmSource.includes('kwai') ? 'kwai' : utmSource.includes('facebook') || utmSource.includes('fb') || utmSource.includes('meta') ? 'facebook' : 'direct',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await env.ORDERS_KV.put(`order:${paymentId}`, JSON.stringify(order), {
    expirationTtl: 86400 * 365,
  });

  return json({
    ok: true,
    paymentId,
    value: 10,
    encodedImage: qrResult.data.encodedImage ?? null,
    payload: qrResult.data.payload ?? null,
    expirationDate: qrResult.data.expirationDate ?? null,
  });
};
