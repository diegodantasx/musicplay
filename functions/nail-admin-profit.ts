interface Env { ORDERS_KV: KVNamespace; ADMIN_PASSWORD: string }

function authorized(request: Request, password: string): boolean {
  const encoded = (request.headers.get('Authorization') || '').replace(/^Basic\s+/i, '');
  if (!encoded || !password) return false;
  try { return atob(encoded).split(':').slice(1).join(':') === password; } catch { return false; }
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (!authorized(request, env.ADMIN_PASSWORD)) return Response.json({ ok: false }, { status: 401 });
  if (request.method !== 'GET') {
    return Response.json({ ok: false, error: 'A Meta da Nail deve ser configurada separadamente da Music.' }, { status: 400 });
  }
  const url = new URL(request.url);
  const from = url.searchParams.get('from') || new Date().toISOString().slice(0, 10);
  const to = url.searchParams.get('to') || from;
  let gross = 0;
  let paidCount = 0;
  let pendingCount = 0;
  const page = await env.ORDERS_KV.list({ prefix: 'order:' });
  await Promise.all(page.keys.map(async ({ name }) => {
    const raw = await env.ORDERS_KV.get(name);
    if (!raw) return;
    const order = JSON.parse(raw) as Record<string, unknown>;
    if (order.product !== 'nail-collection' || order.archived === true) return;
    const date = String(order.paid_at || order.created_at || '').slice(0, 10);
    if (date < from || date > to) return;
    if (order.paid === true) { gross += Number(order.value || 0); paidCount += 1; }
    else pendingCount += 1;
  }));
  const asaasFee = paidCount * 0.99;
  return Response.json({
    ok: true,
    from,
    to,
    totals: { gross, adSpend: 0, faceTax: 0, asaasFee, profit: gross - asaasFee },
    asaas: { customers: paidCount + pendingCount, count: paidCount, pendingCount, pendingGross: pendingCount * 10, fee: asaasFee, feePerOrder: 0.99 },
    counts: { paid: paidCount, pending: pendingCount },
    meta: { ok: false, configured: false, error: 'Meta Nail não conectada' },
    note: 'Receita exclusiva Nail. Meta Ads Nail ainda não conectada; nenhum dado da Music é utilizado.',
  }, { headers: { 'Cache-Control': 'no-store' } });
};
