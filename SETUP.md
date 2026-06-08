# Guia de Configuração — SaaS de Música Personalizada com IA

Este projeto é um SaaS completo para venda de músicas personalizadas com IA.
O cliente preenche um briefing, vê a letra gerada, paga via Pix, e você entrega a música pelo WhatsApp.

---

## Stack utilizada

- **Cloudflare Pages** — hospedagem + funções serverless (gratuito até 500 deploys/mês)
- **Cloudflare KV** — banco de dados chave-valor para pedidos (gratuito até 100k ops/dia)
- **Cloudflare R2** — armazenamento de áudio (opcional, gratuito até 10GB)
- **Asaas** — gateway de pagamentos PIX brasileiro (gratuito para começar)
- **OpenAI ou Anthropic** — geração de letras de música com IA
- **Meta Pixel + CAPI** — rastreamento de vendas para anúncios (opcional)
- **Suno AI** — você cria a música manualmente com o prompt gerado pelo sistema

---

## Pré-requisitos (crie as contas antes)

1. [Cloudflare](https://cloudflare.com) — conta gratuita
2. [Asaas](https://asaas.com) — conta gratuita (modo sandbox para testes)
3. [OpenAI](https://platform.openai.com) ou [Anthropic](https://console.anthropic.com) — créditos mínimos (~$5)
4. [GitHub](https://github.com) — para hospedar o código
5. [Suno AI](https://suno.ai) — para criar as músicas manualmente (opcional, plano pago)

---

## Passo 1 — Configurar o GitHub

1. Crie um repositório **privado** no seu GitHub (ex: `minha-musica-saas`)
2. Faça upload de todos os arquivos deste projeto para o repositório
3. Anote a URL do repositório

---

## Passo 2 — Configurar a Cloudflare

### 2.1 — Criar o projeto Pages

1. Acesse [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Vá em **Pages** → **Create a project** → **Connect to Git**
3. Conecte ao seu GitHub e selecione o repositório
4. Configurações de build:
   - **Framework preset:** None
   - **Build command:** `npm run build` (ou deixe vazio)
   - **Build output directory:** `public`
5. Clique em **Save and Deploy**

### 2.2 — Criar o KV Namespace (banco de pedidos)

1. No Cloudflare Dashboard → **KV** → **Create a namespace**
2. Nome: `ORDERS_KV` (ou qualquer nome)
3. Copie o **Namespace ID** gerado
4. Abra o arquivo `wrangler.toml` e substitua `SEU_KV_NAMESPACE_ID` pelo ID copiado

### 2.3 — Criar o R2 Bucket (armazenamento de áudio — opcional)

1. No Cloudflare Dashboard → **R2** → **Create bucket**
2. Nome: pode ser qualquer nome (ex: `minha-musica-audio`)
3. Abra o `wrangler.toml` e substitua `SEU_R2_BUCKET` pelo nome escolhido

### 2.4 — Vincular KV e R2 ao projeto Pages

1. No Cloudflare Dashboard → **Pages** → seu projeto → **Settings** → **Functions**
2. Em **KV namespace bindings**: adicione `ORDERS_KV` → selecione o namespace criado
3. Em **R2 bucket bindings**: adicione `AUDIO_BUCKET` → selecione o bucket criado

---

## Passo 3 — Variáveis de ambiente

No Cloudflare Pages → **Settings** → **Environment variables**, adicione todas abaixo:

| Variável | Descrição | Onde obter |
|---|---|---|
| `ASAAS_API_KEY` | Chave da API Asaas | Asaas → Minha conta → Integrações → API |
| `OPENAI_API_KEY` | Chave OpenAI (geração de letras) | platform.openai.com → API Keys |
| `ANTHROPIC_API_KEY` | Alternativa ao OpenAI | console.anthropic.com → API Keys |
| `META_PIXEL_ID` | ID do seu pixel Meta | Meta Events Manager |
| `META_CAPI_TOKEN` | Token da API de Conversões Meta | Meta Events Manager → Configurações |
| `ADMIN_PASSWORD` | Senha para acessar /admin | Crie uma senha forte |
| `OWNER_WHATSAPP` | Seu número com DDI (ex: 5541999999999) | Seu WhatsApp |
| `CALLMEBOT_API_KEY` | Chave CallMeBot (alertas WhatsApp) | callmebot.com |
| `VAPID_PUBLIC_KEY` | Chave pública VAPID (push notifications) | Ver passo 5 |
| `VAPID_PRIVATE_KEY` | Chave privada VAPID | Ver passo 5 |
| `KIE_API_KEY` | Chave Kie.ai (não obrigatório no fluxo manual) | kie.ai |

> **Dica:** Adicione as variáveis tanto em **Production** quanto em **Preview** environment.

---

## Passo 4 — Configurar o Asaas

### 4.1 — Obter a API Key

1. Acesse [Asaas](https://asaas.com) → **Minha conta** → **Integrações** → **API**
2. Gere uma nova chave e salve em `ASAAS_API_KEY`
3. Para testes: use o ambiente **Sandbox** (asaas.com/sandbox)

### 4.2 — Configurar o Webhook

1. Asaas → **Configurações** → **Integrações** → **Webhooks** → **Novo Webhook**
2. URL: `https://SEU_DOMINIO.com/asaas-webhook`
3. Eventos a marcar:
   - ✅ `PAYMENT_RECEIVED`
   - ✅ `PAYMENT_CONFIRMED`
4. **IMPORTANTE:** Certifique-se que o toggle "Este Webhook ficará ativo?" está **ATIVADO** (erro comum)
5. Salve e confirme que aparece como **Ativo**

---

## Passo 5 — Gerar chaves VAPID (push notifications)

As chaves VAPID permitem enviar notificações push para o admin quando uma venda é feita.

Execute no terminal (precisa ter Node.js instalado):

```bash
npx web-push generate-vapid-keys
```

Saída esperada:
```
Public Key: BExemplo...
Private Key: exemplo...
```

Salve as chaves nas variáveis `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`.

---

## Passo 6 — Configurar o domínio

### 6.1 — Domínio personalizado (recomendado)

1. Cloudflare Pages → seu projeto → **Custom domains** → **Set up a custom domain**
2. Informe seu domínio (ex: `minhamusica.com.br`)
3. Siga as instruções para apontar o DNS

### 6.2 — Atualizar o domínio no código

Após ter o domínio, pesquise e substitua `SEU_DOMINIO.com` pelo seu domínio real em:
- `public/admin/index.html`
- `public/index.html`
- `functions/m/[id].ts`
- `functions/_shared/meta-capi.ts`

Ou peça para a IA do seu editor fazer isso automaticamente.

---

## Passo 7 — Personalizar a identidade visual

Arquivos principais para personalizar:

| Arquivo | O que mudar |
|---|---|
| `public/index.html` | Nome da marca, texto do funil, preços |
| `public/admin/index.html` | Nome exibido no admin |
| `public/contato.html` | Seu WhatsApp e e-mail de contato |
| `public/faq.html` | Seu WhatsApp |
| `public/privacidade.html` | Seus dados de contato |
| `public/termos.html` | Seus dados de contato |

Substitua `SEU_WHATSAPP_AQUI`, `SEU_EMAIL_AQUI`, `SEU_TELEFONE` pelos seus dados reais.

---

## Passo 8 — Primeiro deploy e teste

1. Faça push das alterações para o GitHub (o Cloudflare faz o deploy automático)
2. Acesse `https://SEU_DOMINIO.com/admin/` com a senha configurada em `ADMIN_PASSWORD`
3. Teste o fluxo completo:
   - Acesse a página principal
   - Preencha o briefing
   - Veja a letra gerada
   - Faça um pagamento de teste no Asaas Sandbox
   - Confirme que o webhook dispara (aba Logs no Asaas)
   - Confirme que o pedido aparece no admin

---

## Fluxo de produção (como usar no dia a dia)

1. Cliente acessa o site, preenche o briefing e paga via Pix
2. Você recebe notificação push + vibração no celular (admin aberto)
3. Acesse `/admin/` → aba **Produção** → localize o pedido
4. Copie o **Prompt Suno** gerado automaticamente
5. Cole no [Suno AI](https://suno.ai) e gere a música
6. No admin: insira o link da música e clique em **Salvar**
7. Copie o **Link de Entrega** (`/m/ID`) e envie pelo WhatsApp
8. O cliente acessa o link, ouve a música e pode baixar

---

## Estrutura do projeto

```
/
├── public/               # Site estático (landing page + admin)
│   ├── index.html        # Funil de vendas principal
│   ├── admin/
│   │   ├── index.html    # Painel administrativo
│   │   └── sw.js         # Service worker (push notifications)
│   └── *.html            # Páginas institucionais
│
├── functions/            # Cloudflare Pages Functions (serverless)
│   ├── create-payment.ts    # Cria cobrança PIX no Asaas
│   ├── asaas-webhook.ts     # Processa confirmação de pagamento
│   ├── generate-lyrics.ts   # Gera letra com IA
│   ├── m/[id].ts           # Página de entrega da música
│   ├── dl/[id].ts          # Download proxy da música
│   ├── admin-orders.ts      # API do painel admin
│   └── _shared/             # Funções compartilhadas (Asaas, Meta CAPI)
│
└── wrangler.toml         # Configuração Cloudflare
```

---

## Solução de problemas comuns

**Pagamento não aparece no admin:**
- Verifique se o webhook do Asaas está ativo (toggle verde)
- Confirme a URL do webhook: `https://SEU_DOMINIO.com/asaas-webhook`
- Veja os logs em Asaas → Webhook → Histórico

**Meta Pixel não registra vendas:**
- Acesse `https://SEU_DOMINIO.com/test-capi` (requer login admin)
- Se retornar `ok: false`, verifique `META_PIXEL_ID` e `META_CAPI_TOKEN`
- Confirme que o webhook Asaas está disparando antes

**Notificações push não chegam:**
- Gere novas chaves VAPID e atualize as variáveis de ambiente
- No admin, clique no ícone de sino para (re)ativar as notificações
- Teste em Chrome desktop primeiro

**Letra não gera:**
- Verifique `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY` nas variáveis de ambiente
- Confirme que há créditos na conta da API

---

## Suporte

Este projeto foi desenvolvido para funcionar com:
- Cloudflare Free Plan
- Asaas (sem mensalidade, cobra % por transação)
- OpenAI ou Anthropic (pay-as-you-go, ~$0.01 por letra gerada)
- Suno AI (plano pago para uso comercial)

Peça para a IA do seu editor (Cursor, VS Code + Copilot, Claude Code etc.) te ajudar com qualquer personalização — o código está bem organizado e comentado.
