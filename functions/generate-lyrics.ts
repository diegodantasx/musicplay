interface Env {
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function clean(obj: Record<string, unknown>, key: string, limit = 800): string {
  return String(obj[key] ?? '').trim().replace(/\s+/g, ' ').slice(0, limit);
}

// ─── Mapa de estilo para o agente de letra ───────────────────────────────────
const STYLE_CONTEXT: Record<string, string> = {
  'arrocha':                      'Arrocha baiano: ritmo lento e arrastado, letra sofrida e apaixonada, vocabulário simples nordestino, refrão grudento.',
  'axé':                          'Axé music: animado e festivo, letras alegres, vocabulário baiano, refrão fácil de cantar em grupo.',
  'brega / brega funk':           'Brega funk: batida eletrônica pesada, letras de amor e sensualidade, linguagem urbana informal, refrão repetitivo e direto.',
  'eletrônica / edm':             'Eletrônica/EDM: clima de euforia ou emoção intensa, refrão longo e marcante, poucos versos mas muito impactantes.',
  'forró':                        'Forró nordestino: animado, letras de amor e saudade, vocabulário regional simples, refrão fácil e dançante.',
  'funk carioca / funk brasileiro':'Funk brasileiro: batida 150bpm, linguagem urbana carioca informal, refrão repetitivo e curto.',
  'gospel / música cristã':       'Gospel: letra de fé, gratidão e superação com Deus, vocabulário cristão, refrão celebrativo e emocionante.',
  'jazz / instrumental':          'Jazz: letra sofisticada e poética, temática de amor complexo, vocabulário refinado.',
  'mpb':                          'MPB: letra poética e narrativa, vocabulário culto mas acessível, mistura emoção e cotidiano.',
  'pagode':                       'Pagode: letra de amor, saudade e amizade, vocabulário informal carioca, refrão contagiante.',
  'pop':                          'Pop: letra direta e comercial, vocabulário moderno, refrão marcante que fica na cabeça.',
  'pop romântico acústico':       'Pop romântico acústico: letra íntima e delicada, clima de violão, emoção no verso e explosão no refrão.',
  'rap nacional':                 'Rap nacional: letra narrativa rimada, vocabulário urbano, versos longos com rimas internas.',
  'r&b / soul':                   'R&B/Soul: letra sensual e emocional, vocabulário suave, groove lento, refrão intenso.',
  'reggae':                       'Reggae: ritmo tranquilo e positivo, letra de amor e superação, vocabulário simples, refrão fácil.',
  'rock nacional':                'Rock nacional: letra intensa, vocabulário direto, refrão explosivo, pode ter metáforas fortes.',
  'romântico':                    'Romântico: letra suave e emocionante, vocabulário apaixonado, foco nos sentimentos, refrão que emociona.',
  'samba':                        'Samba: ritmo alegre e sincopado, letra de amor e celebração, vocabulário carioca informal.',
  'sertanejo raiz':               'Sertanejo raiz: viola e acordeão, vocabulário caipira autêntico, letra de amor e saudade do campo.',
  'sertanejo universitário':      'Sertanejo universitário: pop-sertanejo acelerado, vocabulário moderno e informal, letra de amor intenso, refrão grudenento.',
  'sertanejo romântico':          'Sertanejo romântico: batida média, declaração de amor, saudade e parceria, vocabulário simples e sentimental.',
  'trap / trap brasileiro':       'Trap: batida pesada com hi-hats, letras de conquista ou amor com linguagem urbana, refrão hook curto.',
};

function getStyleContext(estilo: string): string {
  const key = estilo.toLowerCase().trim();
  if (STYLE_CONTEXT[key]) return STYLE_CONTEXT[key];
  for (const [k, v] of Object.entries(STYLE_CONTEXT)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return `Estilo ${estilo}: letra emocional em português, estrutura musical natural, vocabulário acessível.`;
}

// ─── Prompt principal ─────────────────────────────────────────────────────────
function buildPrompt(
  destinatario: string, relacao: string, ocasiao: string, estilo: string,
  voz: string, historia: string, correcoes: string, currentLyrics: string,
): string {
  const styleCtx = getStyleContext(estilo);
  const perspectiva = voz === 'Masculina'
    ? 'ele cantando pra ela — primeira pessoa masculina'
    : 'ela cantando pra ele — primeira pessoa feminina';

  const reescrita = currentLyrics
    ? `\n\nRESCREVER E MELHORAR ESTA LETRA (mantenha a essência, melhore a qualidade):\n${currentLyrics}`
    : '';
  const ajustes = correcoes ? `\n\nAJUSTES OBRIGATÓRIOS: ${correcoes}` : '';

  return `Você é um compositor profissional especializado em transformar histórias reais em músicas completas, emocionantes e prontas para gravação.

ESTILO: ${styleCtx}
VOZ/PERSPECTIVA: ${perspectiva}
PARA: ${destinatario} (${relacao})
OCASIÃO: ${ocasiao}
HISTÓRIA DO CLIENTE:
${historia}${ajustes}${reescrita}

REGRAS OBRIGATÓRIAS:
- Transformar TODA a história em música — não inventar fatos, usar apenas o que foi contado
- Narrativa musical: início (como tudo começou) → desenvolvimento (desafios/superações de forma sutil) → clímax emocional → final (amor, esperança ou declaração)
- Linguagem simples, humana, emocional e cantável — como uma conversa cantada
- Sempre incluir o nome ${destinatario} na letra
- Rimas apenas quando forem NATURAIS — zero rimas forçadas
- Dores, perdas e temas sensíveis: tratar de forma sutil e implícita, priorizando superação
- Datas devem ser escritas por extenso
- Duração máxima: letra equivalente a 3 minutos de música
- NUNCA usar marcadores como "Verso 1", "Refrão", "Ponte", "Pré-refrão"
- Entregar letra corrida, sem títulos técnicos, sem emojis, sem explicações
- Fiel ao estilo musical indicado — ritmo, vocabulário e clima do estilo devem estar presentes

FORMATO DE RESPOSTA — JSON válido:
{"title":"Título da música","lyrics":"letra completa corrida aqui"}`;
}

// ─── Agente de pronúncia de nomes ─────────────────────────────────────────────
// Aplica acentuação fonética em nomes próprios não-padrão para o Kie.ai pronunciar corretamente
const PRONUNCIATION_MAP: Record<string, string> = {
  // Nomes estrangeiros / grafias incomuns
  'brayan': 'Bráian', 'brian': 'Bráian', 'bryan': 'Bráian',
  'jhon': 'Jôn', 'jhonatan': 'Jônatan', 'jhonatas': 'Jônatas',
  'john': 'Jôn', 'jonathan': 'Jônatan',
  'kaique': 'Kaíque', 'kayque': 'Kaíque',
  'raique': 'Raíque', 'rayque': 'Raíque',
  'laique': 'Laíque',
  'yasmim': 'Iásmim', 'yasmin': 'Iásmin',
  'yago': 'Iago', 'yuri': 'Iúri',
  'weslley': 'Uésli', 'wesley': 'Uésli',
  'willian': 'Uílian', 'william': 'Uíliam',
  'wilson': 'Uílson',
  'wadson': 'Uádson', 'wadison': 'Uádison',
  'kevin': 'Kévin',
  'kelvin': 'Kélvin',
  'daiane': 'Daiane', // já fonético
  'dayane': 'Daiane',
  'dayana': 'Daiana',
  'raiane': 'Raiane',
  'rayane': 'Raiane',
  'thaiane': 'Taiane',
  'thayane': 'Taiane',
  'thayna': 'Taina',
  'thaís': 'Taís',
  'thais': 'Taís',
  'thuany': 'Tuani',
  'thuane': 'Tuane',
  'layne': 'Laine',
  'laysa': 'Laisa',
  'laísa': 'Laísa',
  'rhenan': 'Renan',
  'rhuan': 'Ruan',
  'rhuam': 'Ruam',
  'rhenan': 'Rénan',
  'kauê': 'Kauê',
  'cauê': 'Cauê',
  'kaue': 'Kauê',
  'caue': 'Cauê',
  'abner': 'Ábner',
  'edson': 'Édson',
  'nelson': 'Nélson',
  'elton': 'Élton',
  'everton': 'Éverton',
  'welton': 'Uélton',
  'walton': 'Uálton',
  'cleiton': 'Cléiton',
  'cleyton': 'Cléiton',
  'clayton': 'Cléiton',
  'leandro': 'Leândro',
  'leandre': 'Leândre',
  'suelen': 'Suélen',
  'sueli': 'Suéli',
  'nubia': 'Núbia',
  'nubya': 'Núbia',
  'lyvia': 'Lívia',
  'lyandra': 'Liândra',
  'lyandra': 'Liândra',
  'mylena': 'Milena',
  'mylenna': 'Milena',
  'mylene': 'Milene',
};

function applyPronunciation(lyrics: string): string {
  let result = lyrics;
  for (const [original, phonetic] of Object.entries(PRONUNCIATION_MAP)) {
    // Substituição case-insensitive, palavra inteira
    const regex = new RegExp(`\\b${original}\\b`, 'gi');
    result = result.replace(regex, (match) => {
      // Preserva capitalização da primeira letra
      if (match[0] === match[0].toUpperCase()) {
        return phonetic.charAt(0).toUpperCase() + phonetic.slice(1);
      }
      return phonetic.toLowerCase();
    });
  }
  return result;
}

// ─── Chamadas de IA ───────────────────────────────────────────────────────────
async function tryAnthropic(apiKey: string, prompt: string): Promise<{ title: string; lyrics: string } | null> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) { console.log('[lyrics] Anthropic error:', res.status); return null; }
    const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
    const text = data?.content?.find(b => b.type === 'text')?.text ?? '';
    const j = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    if (!j) return null;
    const parsed = JSON.parse(j) as { title?: string; lyrics?: string };
    const title  = String(parsed.title  || '').trim();
    const lyrics = String(parsed.lyrics || '').trim();
    if (lyrics.length < 40) return null;
    console.log('[lyrics] Anthropic OK, len:', lyrics.length);
    return { title, lyrics };
  } catch(e) { console.log('[lyrics] Anthropic exception:', String(e)); return null; }
}

async function tryOpenAI(apiKey: string, prompt: string): Promise<{ title: string; lyrics: string } | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.88,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) { console.log('[lyrics] OpenAI error:', res.status); return null; }
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data?.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(content) as { title?: string; lyrics?: string };
    const title  = String(parsed.title  || '').trim();
    const lyrics = String(parsed.lyrics || '').trim();
    if (lyrics.length < 40) return null;
    console.log('[lyrics] OpenAI OK, len:', lyrics.length);
    return { title, lyrics };
  } catch(e) { console.log('[lyrics] OpenAI exception:', String(e)); return null; }
}

function fallbackLyrics(destinatario: string, ocasiao: string, historia: string): { title: string; lyrics: string } {
  const nome = destinatario || 'meu amor';
  return {
    title: `Para ${nome}`,
    lyrics: `Tem momentos que a gente não esquece,\nque ficam guardados dentro do peito.\nE quando a saudade aparece,\ntudo volta, tão bonito, tão perfeito.\n\nVocê chegou e mudou tudo,\ntrouxe luz pra cada dia meu.\nSem precisar de muito,\nvocê me fez acreditar de novo.\n\n${nome}, essa música é sua,\nfeita da nossa história, feita de verdade.\nQue onde eu for, onde eu esteja,\nvocê vai ser sempre minha metade.\n\nO tempo passa, a vida muda,\nmas o que sinto por você fica igual.\nMeu coração quando te escuta\nsabe que você é meu bem, meu lar.`,
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let input: Record<string, unknown>;
  try { input = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  // ── Rate limit por IP: 5 letras por hora ────────────────────────────────────
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const hour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const rlKey = `ratelimit:lyrics:${ip}:${hour}`;
  if (env.ORDERS_KV) {
    const rlRaw = await env.ORDERS_KV.get(rlKey);
    const rlCount = rlRaw ? parseInt(rlRaw) : 0;
    if (rlCount >= 5) {
      console.log('[ratelimit] lyrics IP bloqueado:', ip, 'tentativas:', rlCount);
      return json({ ok: false, error: 'rate_limit', message: 'Muitas gerações. Aguarde alguns minutos.' }, 429);
    }
    await env.ORDERS_KV.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });
  }

  const destinatario  = clean(input, 'destinatario', 80);
  const relacao       = clean(input, 'relacao', 80);
  const ocasiao       = clean(input, 'ocasiao', 80);
  const estilo        = clean(input, 'estilo', 80);
  const voz           = clean(input, 'voz', 30);
  const historia      = clean(input, 'historia', 900);
  const currentLyrics = clean(input, 'currentLyrics', 1500);
  const correcoes     = clean(input, 'correcoes', 400);

  if (!destinatario || !relacao || !ocasiao || !estilo || historia.length < 8) {
    return json({ ok: false, error: 'missing_fields' }, 422);
  }

  const prompt = buildPrompt(destinatario, relacao, ocasiao, estilo, voz, historia, correcoes, currentLyrics);

  // 1. Tenta Claude (Anthropic) — principal
  if (env.ANTHROPIC_API_KEY) {
    const result = await tryAnthropic(env.ANTHROPIC_API_KEY, prompt);
    if (result) {
      result.lyrics = applyPronunciation(result.lyrics);
      return json({ ok: true, ...result, source: 'anthropic' });
    }
  }

  // 2. Fallback: GPT-4o-mini
  if (env.OPENAI_API_KEY) {
    const result = await tryOpenAI(env.OPENAI_API_KEY, prompt);
    if (result) {
      result.lyrics = applyPronunciation(result.lyrics);
      return json({ ok: true, ...result, source: 'openai' });
    }
  }

  // 3. Fallback local
  const result = fallbackLyrics(destinatario, ocasiao, historia);
  result.lyrics = applyPronunciation(result.lyrics);
  return json({ ok: true, ...result, source: 'fallback' });
};
