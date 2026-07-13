/* Adaptação isolada do painel Music para pedidos Nail Collection. */
(function () {
  var style = document.createElement('style');
  style.textContent = `
    #funnel-section,#push-btn{display:none!important}
    .tabs .tab:nth-child(n+3),.tab-content .tab-pane:nth-child(n+3){display:none!important}
    .login-box h1 span,header h1 span,.stat .sv{color:#f062a6!important}
    .btn-primary{background:linear-gradient(135deg,#b51f68,#f062a6)!important}
    .fbtn.active,.fbtn:hover{background:#b51f68!important;border-color:#b51f68!important}
    .nail-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
    .nail-detail{background:#0f0f13;border:1px solid #2a2a3a;border-radius:8px;padding:10px 12px}
    .nail-detail small{display:block;color:#888;font-size:10px;text-transform:uppercase;margin-bottom:4px}
    .nail-wa{display:inline-block;background:#168c4b;color:#fff;text-decoration:none;padding:9px 14px;border-radius:8px;margin-top:12px;font-weight:700}
    @media(max-width:600px){.nail-detail-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  if (typeof _origLoadOrders === 'function') loadOrders = _origLoadOrders;

  window.updateStats = function () {
    var paid = allOrders.filter(function (o) { return o.paid; });
    var delivered = allOrders.filter(function (o) { return o.deliverySent; });
    var revenue = paid.reduce(function (sum, o) { return sum + (Number(o.value) || 0); }, 0);
    document.getElementById('s-total').textContent = allOrders.length;
    document.getElementById('s-paid').textContent = paid.length;
    document.getElementById('s-delivered').textContent = delivered.length;
    document.getElementById('s-revenue').textContent = 'R$' + revenue.toFixed(2).replace('.', ',');
  };

  window.getFiltered = function () {
    var query = document.getElementById('srch').value.toLowerCase();
    return allOrders.filter(function (order) {
      if (currentFilter === 'paid' && (!order.paid || order.deliverySent)) return false;
      if (currentFilter === 'pending' && order.paid) return false;
      if (currentFilter === 'delivered' && !order.deliverySent) return false;
      if (currentFilter === 'today' && !isToday(order)) return false;
      if (query && JSON.stringify(order).toLowerCase().indexOf(query) === -1) return false;
      return true;
    });
  };

  window.renderTable = function () {
    filteredRows = getFiltered();
    var body = document.getElementById('tbody');
    document.getElementById('tempty').style.display = filteredRows.length ? 'none' : 'block';
    body.innerHTML = filteredRows.map(function (order, index) {
      var created = order.created_at ? new Date(order.created_at).toLocaleString('pt-BR') : '-';
      var badgeClass = order.deliverySent ? 'bd' : order.paid ? 'bp' : 'bpend';
      var badgeLabel = order.deliverySent ? 'Entregue' : order.paid ? 'Pago' : 'Pendente';
      var value = 'R$' + (Number(order.value) || 0).toFixed(2).replace('.', ',');
      var deliver = order.paid && !order.deliverySent
        ? ' <button class="abtn gn" data-pid="' + esc(order.paymentId) + '" onclick="markDelivered(this.dataset.pid)">Entregar</button>' : '';
      var recover = !order.paid
        ? ' <button class="abtn" style="border-color:#f59e0b;color:#f59e0b" data-pid="' + esc(order.paymentId) + '" data-name="' + esc(order.name || '') + '" data-phone="' + esc(order.phone || '') + '" onclick="recoverPix(this.dataset.pid,this.dataset.name,this.dataset.phone)">&#128279; Recuperar e enviar</button>' : '';
      return '<tr><td style="color:#888;font-size:12px">' + created + '</td>'
        + '<td><strong>' + esc(order.name || '-') + '</strong></td>'
        + '<td style="color:#aaa">' + esc(order.email || '-') + '</td>'
        + '<td style="color:#aaa">' + esc(order.phone || '-') + '</td>'
        + '<td>' + value + '</td><td><span class="badge ' + badgeClass + '">' + badgeLabel + '</span></td>'
        + '<td>' + (order.deliverySent ? '<span style="color:#4caf82">&#10003;</span>' : '<span style="color:#444">-</span>') + '</td>'
        + '<td><button class="abtn" data-idx="' + index + '" onclick="openOrder(Number(this.dataset.idx))">Ver</button>' + deliver + recover + '</td></tr>';
    }).join('');
  };

  window.openOrder = function (index) {
    var order = filteredRows[index];
    if (!order) return;
    currentOrder = order;
    document.getElementById('mtitle').textContent = order.name || order.paymentId;
    document.getElementById('f-nome').textContent = order.name || '-';
    document.getElementById('f-phone').textContent = order.phone || '-';
    document.getElementById('f-email').textContent = order.email || '-';
    document.getElementById('f-pid').textContent = order.paymentId || '-';
    document.getElementById('f-date').textContent = order.created_at ? new Date(order.created_at).toLocaleString('pt-BR') : '-';
    if (typeof renderOrigem === 'function') renderOrigem(order);
    document.getElementById('f-valor').textContent = 'R$ ' + (Number(order.value) || 0).toFixed(2).replace('.', ',');
    document.getElementById('f-status-badge').innerHTML = '<span class="status-badge ' + (order.paid ? 'sb-letra' : 'sb-briefing') + '">' + (order.paid ? 'Pago' : 'Pendente') + '</span>';
    var digits = String(order.phone || '').replace(/\D/g, '');
    if (digits && !digits.startsWith('55')) digits = '55' + digits;
    document.getElementById('f-bumps').innerHTML = '<div class="nail-detail-grid">'
      + '<div class="nail-detail"><small>Produto</small>Nail Collection</div>'
      + '<div class="nail-detail"><small>Data e hora</small>' + (order.created_at ? new Date(order.created_at).toLocaleString('pt-BR') : '-') + '</div>'
      + '<div class="nail-detail"><small>Entrega</small>' + (order.deliverySent ? 'Enviada pela Evolution' : 'Não enviada') + '</div>'
      + '<div class="nail-detail"><small>Última atualização</small>' + (order.updated_at ? new Date(order.updated_at).toLocaleString('pt-BR') : '-') + '</div></div>'
      + '<a class="nail-wa" target="_blank" href="https://wa.me/' + digits + '">Falar com cliente no WhatsApp</a>'
      + '<div class="fld" style="margin-top:14px"><label>Observações internas</label><textarea id="nail-notes" rows="4">' + esc(order.notes || '') + '</textarea></div>';
    var delivered = document.getElementById('f-delivered');
    if (delivered) delivered.checked = !!order.deliverySent;
    switchTab(0, document.querySelectorAll('.tab')[0]);
    document.getElementById('overlay').style.display = 'flex';
  };

  window.saveOrder = function () {
    if (!currentOrder) return;
    var notes = document.getElementById('nail-notes');
    fetch('/nail-admin-orders?paymentId=' + encodeURIComponent(currentOrder.paymentId), {
      method: 'PATCH',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notes ? notes.value : (currentOrder.notes || '') }),
    }).then(function (response) {
      if (!response.ok) throw new Error('save_failed');
      currentOrder.notes = notes ? notes.value : currentOrder.notes;
      closeModal(); toast('Salvo!');
    }).catch(function () { toast('Erro ao salvar', 'err'); });
  };

  window.markDelivered = function (paymentId) {
    fetch('/nail-admin-orders?paymentId=' + encodeURIComponent(paymentId), {
      method: 'PATCH',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliverySent: true }),
    }).then(function (response) {
      if (!response.ok) throw new Error('delivery_failed');
      var order = allOrders.find(function (item) { return item.paymentId === paymentId; });
      if (order) order.deliverySent = true;
      updateStats(); renderTable(); toast('Marcado como entregue!');
    }).catch(function () { toast('Erro ao atualizar', 'err'); });
  };

  window.recoverPix = function (paymentId) {
    document.getElementById('recover-overlay').style.display = 'flex';
    document.getElementById('recover-loading').style.display = 'block';
    document.getElementById('recover-content').style.display = 'none';
    document.getElementById('recover-error').style.display = 'none';
    fetch('/nail-recover-pix?paymentId=' + encodeURIComponent(paymentId), {
      method: 'POST', headers: { Authorization: auth },
    }).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok || !data.ok) throw new Error(data.error || 'recovery_failed');
        return data;
      });
    }).then(function (data) {
      document.getElementById('recover-loading').style.display = 'none';
      document.getElementById('recover-content').style.display = 'block';
      document.getElementById('rc-name').textContent = data.name || 'Cliente';
      document.getElementById('rc-phone').textContent = data.phone || '-';
      document.getElementById('rc-value').textContent = 'R$ ' + (Number(data.value) || 10).toFixed(2).replace('.', ',');
      document.getElementById('rc-payload').value = data.payload || '';
      document.getElementById('rc-reused').style.display = data.reused ? 'block' : 'none';
      var phone = String(data.phone || '').replace(/\D/g, '');
      if (phone && !phone.startsWith('55')) phone = '55' + phone;
      var message = 'Olá, ' + String(data.name || 'Cliente').split(' ')[0] + '! Tudo bem? 💅\n\nVi que você iniciou a compra do Nail Collection, mas o pagamento ainda não foi concluído.\n\nVou enviar o código Pix em uma mensagem separada logo abaixo. Assim que o pagamento for confirmado, você receberá o acesso automaticamente pelo WhatsApp.';
      document.getElementById('rc-whatsapp').href = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message);
      document.getElementById('rc-whatsapp').innerHTML = data.messageSent && data.pixSent
        ? 'Mensagens enviadas automaticamente ✓'
        : 'Falhou: enviar mensagem manualmente';
      if (data.messageSent && data.pixSent) toast('Mensagem e Pix enviados pela Evolution!');
      else toast('Envio automático falhou. Use os botões manuais.', 'err');
      if (!data.reused) loadOrders();
    }).catch(function (error) {
      document.getElementById('recover-loading').style.display = 'none';
      document.getElementById('recover-error').style.display = 'block';
      document.getElementById('recover-error').textContent = error.message === 'already_paid' ? 'Este pedido já foi pago.' : 'Não foi possível recuperar o Pix.';
    });
  };

  var headers = document.querySelectorAll('thead th');
  if (headers.length >= 7) {
    headers[0].textContent = 'Data e hora'; headers[1].textContent = 'Nome'; headers[2].textContent = 'E-mail';
    headers[3].textContent = 'WhatsApp'; headers[4].textContent = 'Valor'; headers[5].textContent = 'Status';
    headers[6].textContent = 'Entrega';
    if (headers[7]) headers[7].textContent = 'Ações';
  }
  var recoveryWhatsApp = document.getElementById('rc-whatsapp');
  if (recoveryWhatsApp) recoveryWhatsApp.innerHTML = '1. Enviar mensagem de recuperação';
  var recoveryCopy = document.querySelector('[onclick="copyRecoverPix()"]');
  if (recoveryCopy) recoveryCopy.innerHTML = '2. Copiar código PIX';
})();
