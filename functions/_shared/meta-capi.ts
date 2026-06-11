interface Order {
  paymentId?: string;
  customerId?: string;
  externalReference?: string;
  name?: string;
  email?: string;
  phone?: string;
  value?: number;
  fbp?: string;
  fbc?: string;
  clientIp?: string;
  userAgent?: string;
  pageUrl?: string;
  metaCapiSent?: boolean;
  brief?: string;
}

interface MetaEventInput {
  eventName: string;
  eventId: string;
  value?: number;
  currency?: string;
  contentName?: string;
  contentIds?: string[];
  contentType?: string;
  eventSourceUrl?: string;
  fbp?: string;
  fbc?: string;
  email?: string;
  phone?: string;
  name?: string;
  externalId?: string;
  clientIp?: string;
  userAgent?: string;
}

async function sha256hex(value: string): Promise<string | null> {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256digits(value: string): Promise<string | null> {
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(digits));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function buildUserData(input: {
  email?: string;
  phone?: string;
  name?: string;
  externalId?: string;
  clientIp?: string;
  userAgent?: string;
  fbp?: string;
  fbc?: string;
}): Promise<Record<string, unknown>> {
  const nameParts = (input.name || '').trim().split(/\s+/);
  const [em, ph, fn, ln] = await Promise.all([
    sha256hex(input.email || ''),
    sha256digits(input.phone || ''),
    sha256hex(nameParts[0] || ''),
    sha256hex(nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''),
  ]);

  const userData: Record<string, unknown> = {
    em: em ? [em] : undefined,
    ph: ph ? [ph] : undefined,
    fn: fn ? [fn] : undefined,
    ln: (ln && nameParts.length > 1) ? [ln] : undefined,
    external_id: input.externalId || undefined,
    client_ip_address: input.clientIp || undefined,
    client_user_agent: input.userAgent || undefined,
    fbp: input.fbp || undefined,
    fbc: input.fbc || undefined,
  };

  Object.keys(userData).forEach(k => userData[k] == null && delete userData[k]);
  return userData;
}

export async function sendMetaCapiEvent(
  pixelId: string,
  capiToken: string,
  input: MetaEventInput,
): Promise<boolean> {
  if (!pixelId || !capiToken || !input.eventName || !input.eventId) return false;

  const userData = await buildUserData({
    email: input.email,
    phone: input.phone,
    name: input.name,
    externalId: input.externalId,
    clientIp: input.clientIp,
    userAgent: input.userAgent,
    fbp: input.fbp,
    fbc: input.fbc,
  });

  const customData: Record<string, unknown> = {
    currency: input.currency || 'BRL',
    value: Number(input.value || 0) || undefined,
    content_name: input.contentName || 'MusicLove Studio',
    content_ids: input.contentIds || ['musiclove_studio'],
    content_type: input.contentType || 'product',
  };
  Object.keys(customData).forEach(k => customData[k] == null && delete customData[k]);

  const payload = {
    data: [{
      event_name: input.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: input.eventId,
      action_source: 'website',
      event_source_url: input.eventSourceUrl || 'https://musiclovestudio.online/',
      user_data: userData,
      custom_data: customData,
    }],
  };

  try {
    const url = `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${capiToken}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const resBody = await res.json().catch(() => ({})) as Record<string, unknown>;
    console.log('[meta-capi-event]', input.eventName, 'status:', res.status, 'body:', JSON.stringify(resBody));
    return res.ok;
  } catch(e) {
    console.log('[meta-capi-event] exception:', String(e));
    return false;
  }
}

export async function sendMetaCapiPurchase(
  pixelId: string,
  capiToken: string,
  order: Order,
): Promise<boolean> {
  if (!pixelId || !capiToken) return false;

  const eventId = 'purchase_' + (order.paymentId || '').replace(/[^a-zA-Z0-9_.-]/g, '');

  // Extrair estilo musical do brief para content_name mais preciso
  function extractEstilo(brief: string): string {
    const m = brief.match(/Estilo[:\s]+([^\n]+)/i);
    return m ? m[1].trim().slice(0, 60) : '';
  }
  const estilo = extractEstilo(order.brief || '');
  const contentName = estilo ? `MusicLove Studio – ${estilo}` : 'MusicLove Studio';

  const userData = await buildUserData({
    email: order.email,
    phone: order.phone,
    name: order.name,
    externalId: order.customerId || order.paymentId,
    clientIp: order.clientIp,
    userAgent: order.userAgent,
    fbp: order.fbp,
    fbc: order.fbc,
  });

  const payload = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: 'website',
      event_source_url: order.pageUrl || 'https://musiclovestudio.online/',
      user_data: userData,
      custom_data: {
        currency: 'BRL',
        value: Number(order.value || 29.9),
        content_name: contentName,
        content_ids: ['musiclove_studio'],
        content_type: 'product',
        order_id: order.externalReference || order.paymentId || '',
      },
    }],
  };

  try {
    const url = `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${capiToken}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const resBody = await res.json().catch(() => ({})) as Record<string, unknown>;
    console.log('[meta-capi] status:', res.status, 'body:', JSON.stringify(resBody));
    return res.ok;
  } catch(e) {
    console.log('[meta-capi] exception:', String(e));
    return false;
  }
}
