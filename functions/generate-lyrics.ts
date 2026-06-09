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
  return `Voce e compositor profissional da Music Love.

Crie uma letra COMPLETA de musica personalizada em portugues do Brasil, emocional, comercial, cantavel e pronta para ser transformada em musica.
Nao escreva uma previa curta. A entrega deve parecer uma cancao completa, com comeco, desenvolvimento, refrao forte e fechamento emocionante.

Dados do pedido:
- Nome de quem vai ganhar: ${destinatario}
- Relacao: ${relacao}
- Ocasiao: ${ocasiao}
- Estilo musical desejado: ${estilo}
- Voz desejada: ${voz}
- Historia/mensagem do cliente: ${historia}
- Letra atual, se houver: ${currentLyrics || 'nao informada'}
- Ajustes/correcoes pedidos pelo cliente, se houver: ${correcoes || 'nao informado'}

Regras obrigatorias:
- Responda somente em JSON valido, sem markdown, sem comentarios e sem texto fora do JSON.
- Formato exato: {\"title\":\"Titulo: ...\",\"lyrics\":\"(Verso 1)\\n...\"}
- A letra precisa ser completa, com no minimo: Verso 1, Pre-refrao, Refrao, Verso 2, Ponte e Refrao Final.
- Quando a historia tiver muitos detalhes, inclua tambem um Verso 3 ou uma segunda ponte curta.
- Tamanho da letra: 42 a 70 linhas, contando titulos de secoes e versos. Nao faca menos que isso.
- Use detalhes reais da historia do cliente: nomes, datas, lugares, apelidos, momentos, dificuldades, promessas, filhos, familia, distancia, profissao ou qualquer detalhe citado.
- Nao invente fatos especificos que o cliente nao contou. Se faltar detalhe, escreva de forma emocional sem criar mentira.
- A letra deve ter cara de musica, nao de texto narrativo. Use frases cantaveis, ritmo natural, rimas quando combinarem e repeticoes bonitas no refrao.
- O refrao deve ser memoravel, simples de cantar e emocionalmente forte.
- Adapte a linguagem ao estilo musical desejado. Exemplo: sertanejo mais direto e romantico; gospel mais espiritual; funk/pop mais moderno; rock mais intenso; pagode mais leve e sentimental.
- Evite cliches genericos em excesso como \"meu porto seguro\", \"minha luz\", \"meu coracao\" e \"pra sempre\" se nao estiverem conectados a historia. Prefira imagens pessoais e especificas.
- Se houver ajustes/correcoes pedidos, eles sao prioridade absoluta. Reescreva a letra completa respeitando esse pedido.
- Se houver letra atual, melhore ou refaca em cima dela quando fizer sentido, mantendo as melhores partes e corrigindo o que estiver fraco.
- Mantenha tom bonito, sentimental, humano, profissional e comercial.
- Nao cite IA, robo, sistema, prompt ou tecnologia.
- Nao prometa gravacao pronta, entrega imediata ou qualquer coisa fora da letra.
- Nao use palavroes, conteudo sexual explicito, ofensas ou termos agressivos.`;
}
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
        max_tokens: 2200,
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
        max_tokens: 2200,
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
    lyrics: `VERSO 1
Tem momentos que a gente nao esquece
Ficam guardados dentro do peito
E quando a saudade aparece
Tudo volta bonito e perfeito

PRE-REFRAO
Voce chegou e mudou tudo
Trouxe luz pra cada dia meu
Sem precisar dizer muito
Meu coracao entendeu

REFRAO
${nome}, essa musica e sua
Feita da nossa historia de verdade
Que onde eu for, onde eu esteja
Voce vai ser sempre minha metade

VERSO 2
O tempo passa, a vida muda
Mas o que sinto por voce fica igual
Cada detalhe dessa jornada
Virou nosso presente especial

PONTE
${historia}
E se as palavras faltarem no caminho
A melodia fala por mim baixinho

REFRAO FINAL
${nome}, essa musica e sua
Pra celebrar nosso ${ocasiao}
Com carinho em cada nota
E amor dentro da cancao`,
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
