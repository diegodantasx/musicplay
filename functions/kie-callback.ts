interface Env {
  ORDERS_KV: KVNamespace;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/**
 * Payload real da Kie.ai (confirmado em teste):
 * {
 *   code: 200,
 *   msg: "All generated successfully.",
 *   data: {
 *     callbackType: "complete",
 *     task_id: "...",
 *     data: [
 *       {
 *         audio_url: "https://tempfile.aiquickdraw.com/..." (temporária),
 *         stream_audio_url: "https://musicfile.kie.ai/..."  (permanente ← usar),
 *         source_stream_audio_url: "https://cdn1.suno.ai/...",
 *         image_url: "https://musicfile.kie.ai/....jpeg",
 *         duration: 36.88,
 *         title: "Nossa História",
 *         tags: "Pop romantico, voz feminina"
 *       },
 *       { ... segunda versão ... }
 *     ]
 *   }
 * }
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const url     = new URL(request.url);
  const orderId = url.searchParams.get('orderId')?.replace(/[^a-zA-Z0-9_.-]/g, '') ?? '';

  let payload: Record<string, unknown> = {};
  try { payload = await request.json() as Record<string, unknown>; } catch { /* ignora */ }

  console.log('KIE CALLBACK:', JSON.stringify({ orderId, payload }, null, 2));

  if (!orderId) return json({ ok: false, error: 'missing_order_id' }, 400);

  const raw = env.ORDERS_KV ? await env.ORDERS_KV.get('order:' + orderId) : null;
  if (!raw) return json({ ok: true, ignored: 'order_not_found' });

  const order = JSON.parse(raw) as Record<string, unknown>;

  // Estrutura: payload.data.callbackType / payload.data.data[]
  const outer        = (payload['data']       ?? payload)       as Record<string, unknown>;
  const callbackType = String(outer['callbackType'] ?? '').toLowerCase();
  const isComplete   = callbackType === 'complete'
    || String(payload['msg'] ?? '').toLowerCase().includes('success');

  if (isComplete) {
    const tracks = (outer['data'] ?? []) as Array<Record<string, unknown>>;
    const t1 = tracks[0] ?? {};
    const t2 = tracks[1] ?? null;

    // Preferir stream_audio_url (permanente); audio_url é temporária
    const audioUrl       = String(t1['stream_audio_url'] ?? t1['audio_url'] ?? '');
    const downloadUrl    = String(t1['audio_url']        ?? audioUrl);
    const imageUrl       = String(t1['image_url']        ?? '');
    const duration       = t1['duration'] ?? null;

    if (audioUrl) {
      order['audioUrl']         = audioUrl;
      order['streamAudioUrl']   = audioUrl;
      order['downloadUrl']      = downloadUrl;
      order['imageUrl']         = imageUrl;
      order['duration']         = duration;
      order['generationStatus'] = 'ready';
      order['updated_at']       = new Date().toISOString();

      // Guardar segunda versão se existir
      if (t2) {
        order['audioUrl2']     = String(t2['stream_audio_url'] ?? t2['audio_url'] ?? '');
        order['downloadUrl2']  = String(t2['audio_url'] ?? order['audioUrl2']);
        order['duration2']     = t2['duration'] ?? null;
      }

      await env.ORDERS_KV.put('order:' + orderId, JSON.stringify(order), {
        expirationTtl: 86400 * 365,
      });

      console.log(`KIE CALLBACK OK: ${orderId} → ${audioUrl}`);
    }
  } else if (outer['callbackType'] === 'failed') {
    order['generationStatus'] = 'failed';
    order['updated_at']       = new Date().toISOString();
    await env.ORDERS_KV.put('order:' + orderId, JSON.stringify(order), { expirationTtl: 86400 * 30 });
  }

  return json({ ok: true });
};
