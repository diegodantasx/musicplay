import { asaas } from './_shared/asaas';

interface Env {
  ORDERS_KV: KVNamespace;
  ASAAS_API_KEY: string;
  ADMIN_PASSWORD: string;
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function authorized(request: Request, password: string): boolean {
  const encoded = (request.headers.get('Authorization') || '').replace(/^Basic\s+/i, '');
  if (!encoded || !password) return false;
  try { return atob(encoded).split(':').slice(1).join(':') === password; }
  catch { return false; }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!authorized(request, env.ADMIN_PASSWORD)) return json({ ok: false, error: 'unauthorized' }, 401);
  const url = new URL(request.url);
  const paymentId = (url.searchParams.get('paymentId') || '').replace(/[^a-zA-Z0-9_.-]/g, '');
  if (!paymentId) return json({ ok: false, error: 'missing_payment_id' }, 400);

  const originalKey = `order:${paymentId}`;
  const raw = await env.ORDERS_KV.get(originalKey);
  if (!raw) return json({ ok: false, error: 'not_found' }, 404);
  const order = JSON.parse(raw) as Record<string, unknown>;
  if (order.product !== 'nail-collection') return json({ ok: false, error: 'not_found' }, 404);
  if (order.paid === true) return json({ ok: false, error: 'already_paid' }, 409);

  const existing = await asaas(env.ASAAS_API_KEY, 'GET', `/payments/${encodeURIComponent(paymentId)}/pixQrCode`);
  if (existing.ok && existing.data.payload) {
    return json({
      ok: true,
      reused: true,
      paymentId,
      payload: existing.data.payload,
      encodedImage: existing.data.encodedImage ?? null,
      name: order.name,
      phone: order.phone,
      value: order.value,
    });
  }

  const due = new Date();
  due.setDate(due.getDate() + 1);
  const payment = await asaas(env.ASAAS_API_KEY, 'POST', '/payments', {
    customer: order.customerId,
    billingType: 'PIX',
    value: Number(order.value || 10),
    dueDate: due.toISOString().slice(0, 10),
    description: 'Nail Collection - recuperação de pedido',
    externalReference: `${String(order.externalReference || paymentId)}-recovery-${Date.now()}`,
  });
  if (!payment.ok || !payment.data.id) return json({ ok: false, error: 'asaas_error' }, 502);

  const newPaymentId = String(payment.data.id);
  const qr = await asaas(env.ASAAS_API_KEY, 'GET', `/payments/${encodeURIComponent(newPaymentId)}/pixQrCode`);
  if (!qr.ok || !qr.data.payload) return json({ ok: false, error: 'qr_not_ready' }, 502);

  const recoveredOrder: Record<string, unknown> = {
    ...order,
    paymentId: newPaymentId,
    originalPaymentId: paymentId,
    recovery: true,
    paid: false,
    status: 'PENDING',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  order.archived = true;
  order.replacedByPaymentId = newPaymentId;
  order.updated_at = new Date().toISOString();
  await Promise.all([
    env.ORDERS_KV.put(originalKey, JSON.stringify(order), { expirationTtl: 86400 * 365 }),
    env.ORDERS_KV.put(`order:${newPaymentId}`, JSON.stringify(recoveredOrder), { expirationTtl: 86400 * 365 }),
  ]);

  return json({
    ok: true,
    reused: false,
    paymentId: newPaymentId,
    payload: qr.data.payload,
    encodedImage: qr.data.encodedImage ?? null,
    name: recoveredOrder.name,
    phone: recoveredOrder.phone,
    value: recoveredOrder.value,
  });
};
