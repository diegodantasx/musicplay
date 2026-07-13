import { sendEvolutionText } from './_shared/evolution';

interface Env {
  ORDERS_KV: KVNamespace;
  ADMIN_PASSWORD: string;
  EVOLUTION_API_URL: string;
  EVOLUTION_API_KEY: string;
  EVOLUTION_INSTANCE: string;
  NAIL_EVOLUTION_API_URL?: string;
  NAIL_EVOLUTION_INSTANCE?: string;
  NAIL_DELIVERY_URL: string;
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function authorized(request: Request, password: string): boolean {
  const encoded = (request.headers.get('Authorization') || '').replace(/^Basic\s+/i, '');
  if (!encoded || !password) return false;
  try {
    return atob(encoded).split(':').slice(1).join(':') === password;
  } catch {
    return false;
  }
}

function paymentIdFrom(url: URL): string {
  return (url.searchParams.get('paymentId') || '').replace(/[^a-zA-Z0-9_.-]/g, '');
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (!authorized(request, env.ADMIN_PASSWORD)) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method === 'GET') {
    const requestedPaymentId = paymentIdFrom(url);
    if (requestedPaymentId) {
      const raw = await env.ORDERS_KV.get(`order:${requestedPaymentId}`);
      if (!raw) return json({ ok: false, error: 'not_found' }, 404);
      const order = JSON.parse(raw) as Record<string, unknown>;
      if (order.product !== 'nail-collection') return json({ ok: false, error: 'not_found' }, 404);
      return json({ ok: true, order });
    }

    // Uma página por requisição evita exceder o limite de leituras do Cloudflare.
    // O painel já segue o cursor automaticamente até concluir todas as páginas.
    const cursor = url.searchParams.get('cursor') || undefined;
    const page = await env.ORDERS_KV.list({ prefix: 'order:', cursor, limit: 35 });
    const values = await Promise.all(page.keys.map(async ({ name }) => {
      const raw = await env.ORDERS_KV.get(name);
      if (!raw) return null;
      try { return JSON.parse(raw) as Record<string, unknown>; }
      catch { return null; }
    }));
    const orders = values.filter((order): order is Record<string, unknown> => (
      order?.product === 'nail-collection' && order.archived !== true
    ));

    orders.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    return json({
      ok: true,
      count: orders.length,
      orders,
      cursor: page.list_complete ? undefined : page.cursor,
    });
  }

  const paymentId = paymentIdFrom(url);
  if (!paymentId) return json({ ok: false, error: 'missing_payment_id' }, 400);
  const key = `order:${paymentId}`;
  const raw = await env.ORDERS_KV.get(key);
  if (!raw) return json({ ok: false, error: 'not_found' }, 404);
  const order = JSON.parse(raw) as Record<string, unknown>;
  if (order.product !== 'nail-collection') return json({ ok: false, error: 'not_found' }, 404);

  if (method === 'PATCH') {
    const body = await request.json() as Record<string, unknown>;
    if ('notes' in body) order.notes = String(body.notes || '').slice(0, 2000);
    if ('deliverySent' in body) order.deliverySent = body.deliverySent === true;
    order.updated_at = new Date().toISOString();
    await env.ORDERS_KV.put(key, JSON.stringify(order), { expirationTtl: 86400 * 365 });
    return json({ ok: true });
  }

  if (method === 'POST' && url.searchParams.get('action') === 'resend') {
    if (order.paid !== true) return json({ ok: false, error: 'payment_not_confirmed' }, 409);
    const firstName = String(order.name || 'Cliente').trim().split(/\s+/)[0];
    const message = `Olá, ${firstName}! ✅\n\nSeu pagamento do Nail Collection foi confirmado.\n\nAcesse seus arquivos aqui:\n${env.NAIL_DELIVERY_URL}\n\nSalve o link para consultar quando quiser.`;
    const sent = Boolean(env.NAIL_DELIVERY_URL) && await sendEvolutionText({
      apiUrl: env.NAIL_EVOLUTION_API_URL || env.EVOLUTION_API_URL,
      apiKey: env.EVOLUTION_API_KEY,
      instance: env.NAIL_EVOLUTION_INSTANCE || env.EVOLUTION_INSTANCE,
    }, String(order.phone || ''), message);

    order.deliverySent = sent;
    order.deliveryAttemptedAt = new Date().toISOString();
    order.updated_at = new Date().toISOString();
    await env.ORDERS_KV.put(key, JSON.stringify(order), { expirationTtl: 86400 * 365 });
    return json({ ok: sent }, sent ? 200 : 502);
  }

  return json({ ok: false, error: 'method_not_allowed' }, 405);
};
