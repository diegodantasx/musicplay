(() => {
  const checkoutLinks = document.querySelectorAll(
    'a[href*="pay.cakto.com"], a[href*="nailartspremium.pages.dev"]',
  );
  if (!checkoutLinks.length) return;

  const style = document.createElement('style');
  style.textContent = `
    .nail-checkout-backdrop{position:fixed;inset:0;background:rgba(10,3,8,.82);z-index:999999;display:none;align-items:center;justify-content:center;padding:18px;font-family:Inter,Arial,sans-serif}
    .nail-checkout-backdrop.open{display:flex}.nail-checkout{width:min(470px,100%);max-height:94vh;overflow:auto;background:#fff;border-radius:24px;padding:26px;color:#24151d;box-shadow:0 25px 80px rgba(0,0,0,.45)}
    .nail-checkout h2{margin:0 0 6px;font-size:26px}.nail-checkout p{margin:0 0 18px;color:#69545f}.nail-checkout label{display:block;font-size:13px;font-weight:700;margin:12px 0 5px}
    .nail-checkout input{box-sizing:border-box;width:100%;border:1px solid #d8cbd1;border-radius:10px;padding:12px;font-size:16px}.nail-checkout button{width:100%;border:0;border-radius:12px;padding:14px;font-size:16px;font-weight:800;cursor:pointer}
    .nail-pay{margin-top:18px;background:#25a65a;color:#fff}.nail-close{margin-top:9px;background:#f1e9ed;color:#553846}.nail-error{color:#b42318!important;margin-top:12px!important}.nail-pix{text-align:center}.nail-pix img{width:min(270px,100%);display:block;margin:12px auto}.nail-code{font-size:12px;word-break:break-all;background:#f6f2f4;padding:10px;border-radius:8px}.nail-copy{background:#171717;color:#fff;margin-top:10px}.nail-success{padding:16px;background:#e9f8ef;border-radius:12px;color:#176b38!important;font-weight:700}
  `;
  document.head.appendChild(style);

  const backdrop = document.createElement('div');
  backdrop.className = 'nail-checkout-backdrop';
  backdrop.innerHTML = `
    <div class="nail-checkout" role="dialog" aria-modal="true" aria-label="Pagamento Nail Collection">
      <div class="nail-form-step">
        <h2>Finalizar compra</h2><p>Nail Collection por <strong>R$ 10,00</strong>. Receba o acesso pelo WhatsApp após a confirmação do Pix.</p>
        <form>
          <label>Nome completo</label><input name="nome" required maxlength="120" autocomplete="name">
          <label>E-mail</label><input name="email" type="email" required maxlength="160" autocomplete="email">
          <label>WhatsApp com DDD</label><input name="whatsapp" inputmode="tel" required maxlength="20" placeholder="(92) 99999-9999" autocomplete="tel">
          <label>CPF</label><input name="cpf" inputmode="numeric" required maxlength="14" placeholder="000.000.000-00">
          <button class="nail-pay" type="submit">GERAR PIX DE R$ 10,00</button>
          <p class="nail-error" hidden></p>
        </form>
      </div>
      <div class="nail-pix" hidden>
        <h2>Pague com Pix</h2><p>Escaneie o QR Code ou copie o código abaixo.</p>
        <img alt="QR Code Pix"><div class="nail-code"></div><button class="nail-copy" type="button">COPIAR CÓDIGO PIX</button>
        <p class="nail-wait">Aguardando confirmação do pagamento…</p>
      </div>
      <button class="nail-close" type="button">Fechar</button>
    </div>`;
  document.body.appendChild(backdrop);

  const form = backdrop.querySelector('form');
  const error = backdrop.querySelector('.nail-error');
  const pixStep = backdrop.querySelector('.nail-pix');
  const formStep = backdrop.querySelector('.nail-form-step');
  const payButton = backdrop.querySelector('.nail-pay');
  const pixCode = backdrop.querySelector('.nail-code');
  let statusTimer;

  const open = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    backdrop.classList.add('open');
  };
  document.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a') : null;
    if (link && Array.from(checkoutLinks).includes(link)) open(event);
  }, true);
  backdrop.querySelector('.nail-close').addEventListener('click', () => {
    backdrop.classList.remove('open');
    if (statusTimer) clearInterval(statusTimer);
  });

  backdrop.querySelector('.nail-copy').addEventListener('click', async () => {
    await navigator.clipboard.writeText(pixCode.textContent || '');
    backdrop.querySelector('.nail-copy').textContent = 'CÓDIGO COPIADO';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.hidden = true;
    payButton.disabled = true;
    payButton.textContent = 'GERANDO PIX…';
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch('/nail-create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || 'Não foi possível gerar o Pix.');
      formStep.hidden = true;
      pixStep.hidden = false;
      pixCode.textContent = result.payload || '';
      pixStep.querySelector('img').src = `data:image/png;base64,${result.encodedImage}`;

      statusTimer = setInterval(async () => {
        const statusResponse = await fetch(`/nail-payment-status?paymentId=${encodeURIComponent(result.paymentId)}`);
        const status = await statusResponse.json();
        if (status.paid) {
          clearInterval(statusTimer);
          pixStep.innerHTML = '<h2>Pagamento confirmado!</h2><p class="nail-success">Enviamos o acesso ao Nail Collection para o seu WhatsApp.</p>';
        }
      }, 4000);
    } catch (err) {
      error.textContent = err instanceof Error ? err.message : 'Erro ao gerar o Pix.';
      error.hidden = false;
      payButton.disabled = false;
      payButton.textContent = 'GERAR PIX DE R$ 10,00';
    }
  });
})();
