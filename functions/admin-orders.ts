interface Env {
  ORDERS_KV: KVNamespace;
  ADMIN_PASSWORD: string;
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

function unauthorized(): Response {
  return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function checkAuth(request: Request, env: Env): boolean {
  const auth = request.headers.get('Authorization') ?? '';
  const b64 = auth.replace(/^Basic\s+/i, '');
  if (!b64) return false;
  try {
    const decoded = atob(b64);
    const [, pass] = decoded.split(':');
    return !!env.ADMIN_PASSWORD && pass === env.ADMIN_PASSWORD;
  } catch {
    return false;
  }
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (!checkAuth(request, env)) return unauthorized();

  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  // PATCH /admin-orders?paymentId=xxx  → update order fields
  if (method === 'PATCH') {
    const paymentId = url.searchParams.get('paymentId')?.replace(/[^a-zA-Z0-9_.-]/g, '') ?? '';
    if (!paymentId) return json({ ok: false, error: 'missing_payment_id' }, 400);

    const raw = await env.ORDERS_KV.get('order:' + paymentId);
    if (!raw) return json({ ok: false, error: 'not_found' }, 404);

    const order = JSON.parse(raw) as Record<string, unknown>;
    const body = await request.json() as Record<string, unknown>;

    const allowed = ['delivered', 'notes', 'status', 'prodStatus', 'musicLink', 'savedLetra', 'videoDelivered', 'videoPending'];
    for (const key of allowed) {
      if (key in body) order[key] = body[key];
    }
    order['updated_at'] = new Date().toISOString();

    await env.ORDERS_KV.put('order:' + paymentId, JSON.stringify(order), { expirationTtl: 86400 * 30 });
    return json({ ok: true });
  }

  // GET /admin-orders  → list all orders
  if (method === 'GET') {
    const cursor = url.searchParams.get('cursor') ?? undefined;
    let list: KVNamespaceListResult<unknown>;
    try {
      list = await env.ORDERS_KV.list({ prefix: 'order:', cursor, limit: 100 });
    } catch (error) {
      console.log('[admin-orders] KV list failed:', String(error));
      return json({ ok: false, error: 'kv_list_failed' }, 500);
    }

    const orders = await Promise.all(
      list.keys.map(async (k) => {
        try {
          const raw = await env.ORDERS_KV.get(k.name);
          if (!raw) return null;
          return JSON.parse(raw) as Record<string, unknown>;
        } catch (error) {
          console.log('[admin-orders] bad order:', k.name, String(error));
          return null;
        }
      })
    );

    const cleanOrders = orders.filter(Boolean);
    return json({
      ok: true,
      count: cleanOrders.length,
      orders: cleanOrders,
      cursor: list.list_complete ? null : list.cursor,
    });
  }

  return json({ ok: false, error: 'method_not_allowed' }, 405);
};
