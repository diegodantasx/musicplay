interface Env { ORDERS_KV: KVNamespace }

const events = new Set(['funnel_open', 'checkout_reached', 'pix_generated']);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Record<string, unknown> = {};
  try { body = await request.json() as Record<string, unknown>; } catch {}
  const event = String(body.event || '');
  if (!events.has(event)) return Response.json({ ok: false }, { status: 400 });
  const sourceValue = String(body.source || '').toLowerCase();
  const source = sourceValue.includes('kwai') ? 'kwai' : sourceValue.includes('facebook') || sourceValue.includes('fb') || sourceValue.includes('meta') ? 'facebook' : 'direct';
  const date = new Date().toISOString().slice(0, 10);
  const key = `nail:analytics:${date}`;
  const raw = await env.ORDERS_KV.get(key);
  const stored = raw ? JSON.parse(raw) as { data?: Record<string, number>; sources?: Record<string, Record<string, number>> } : {};
  stored.data ||= {};
  stored.sources ||= {};
  stored.sources[source] ||= {};
  stored.data[event] = (stored.data[event] || 0) + 1;
  stored.sources[source][event] = (stored.sources[source][event] || 0) + 1;
  await env.ORDERS_KV.put(key, JSON.stringify(stored), { expirationTtl: 86400 * 90 });
  return Response.json({ ok: true });
};
