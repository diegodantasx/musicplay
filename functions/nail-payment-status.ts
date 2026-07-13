interface Env {
  ORDERS_KV: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const paymentId = new URL(request.url).searchParams.get('paymentId')
    ?.replace(/[^a-zA-Z0-9_.-]/g, '') ?? '';
  if (!paymentId) return Response.json({ ok: false }, { status: 400 });

  const raw = await env.ORDERS_KV.get(`order:${paymentId}`);
  if (!raw) return Response.json({ ok: false }, { status: 404 });

  const order = JSON.parse(raw) as Record<string, unknown>;
  return Response.json({
    ok: true,
    paid: order.paid === true,
    status: String(order.status ?? 'PENDING'),
    delivered: order.deliverySent === true,
  }, { headers: { 'Cache-Control': 'no-store' } });
};
