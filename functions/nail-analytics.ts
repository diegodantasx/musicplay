interface Env {
  ORDERS_KV: KVNamespace;
  ADMIN_PASSWORD: string;
}

function authorized(request: Request, password: string): boolean {
  const encoded = (request.headers.get('Authorization') || '').replace(/^Basic\s+/i, '');
  if (!encoded || !password) return false;
  try { return atob(encoded).split(':').slice(1).join(':') === password; }
  catch { return false; }
}

function day(daysAgo: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!authorized(request, env.ADMIN_PASSWORD)) return Response.json({ ok: false }, { status: 401 });
  const days = [];
  for (let index = 0; index < 7; index += 1) {
    const date = day(index);
    const raw = await env.ORDERS_KV.get(`nail:analytics:${date}`);
    const stored = raw ? JSON.parse(raw) as { data?: Record<string, number>; sources?: Record<string, Record<string, number>> } : {};
    days.push({ date, data: stored.data || {}, sources: stored.sources || {} });
  }
  return Response.json({ ok: true, days }, { headers: { 'Cache-Control': 'no-store' } });
};
