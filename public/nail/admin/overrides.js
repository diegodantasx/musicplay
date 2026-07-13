/* Camada isolada do painel Nail Collection. */
(function () {
  var style = document.createElement('style');
  style.textContent = `
    #push-btn{display:none!important}
    .tabs .tab:nth-child(n+3),.tab-content .tab-pane:nth-child(n+3){display:none!important}
    .login-box h1 span,header h1 span,.stat .sv{color:#f062a6!important}
    .btn-primary{background:linear-gradient(135deg,#b51f68,#f062a6)!important}
    .fbtn.active,.fbtn:hover{background:#b51f68!important;border-color:#b51f68!important}
    .nail-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
    .nail-card{background:#0f0f13;border:1px solid #2a2a3a;border-radius:8px;padding:10px 12px}
    .nail-card small{display:block;color:#888;font-size:10px;text-transform:uppercase;margin-bottom:4px}
    .nail-wa{display:inline-block;background:#168c4b;color:#fff;text-decoration:none;padding:9px 14px;border-radius:8px;margin-top:12px;font-weight:700}
    @media(max-width:600px){.nail-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  window.updateStats = function () {
    var paid = allOrders.filter(function (o) { return o.paid; });
    var delivered = allOrders.filter(function (o) { return o.deliverySent; });
    var revenue = paid.reduce(function (sum, o) { return sum + Number(o.value || 0); }, 0);
    document.getElementById('s-total').textContent = allOrders.length;
    document.getElementById('s-paid').textContent = paid.length;
    document.getElementById('s-delivered').textContent = delivered.length;
    document.getElementById('s-revenue').textContent = 'R$' + revenue.toFixed(2).replace('.', ',');
  };

  window.getFiltered = function () {
    var query = document.getElementById('srch').value.toLowerCase();
    return allOrders.filter(function (order) {
      if (currentFilter === 'paid' && !order.paid) return false;
      if (currentFilter === 'pending' && order.paid) return false;
      if (currentFilter === 'delivered' && !order.deliverySent) return false;
      if (currentFilter === 'todeliver' && (!order.paid || order.deliverySent)) return false;
      if (currentFilter === 'today' && !isToday(order)) return false;
      if (query && JSON.stringify(order).toLowerCase().indexOf(query) === -1) return false;
      return true;
    });
  };

  window.renderTable = function () {
    filteredRows = getFiltered();
    var body = document.getElementById('tbody');
    document.getElementById('tempty').style.display = filteredRows.length ? 'none' : 'block';
    body.innerHTML = filteredRows.map(function (o, index) {
      var created = o.created_at ? new Date(o.created_at).toLocaleString('pt-BR') : '-';
      var status = o.deliverySent ? ['bd','Entregue'] : o.paid ? ['bp','Pago'] : ['bpend','Pendente'];
      var source = typeof getTrafficSourceInfo === 'function' ? getTrafficSourceInfo(o) : { label: 'Direto' };
      var wa = o.deliverySent ? '<span class="badge bp">Entrega OK</span>' : o.recovery ? '<span class="badge" style="background:#24163a;color:#c4b5fd">Recuperação OK</span>' : o.phone ? '<span style="color:#888">Cadastrado</span>' : '<span class="badge" style="background:#3a1717;color:#f87171">Erro</span>';
      var recover = !o.paid ? ' <button class="abtn" style="border-color:#f59e0b;color:#f59e0b" data-pid="'+esc(o.paymentId)+'" data-name="'+esc(o.name||'')+'" data-phone="'+esc(o.phone||'')+'" onclick="recoverPix(this.dataset.pid,this.dataset.name,this.dataset.phone)">&#128279; Recuperar</button>' : '';
      return '<tr><td style="color:#888;font-size:12px">'+created+'</td><td><strong>'+esc(o.name||'-')+'</strong></td><td style="color:#aaa">'+esc(o.email||'-')+'</td><td>R$'+Number(o.value||0).toFixed(2).replace('.',',')+'</td><td><span class="badge '+status[0]+'">'+status[1]+'</span></td><td><span class="badge" style="background:#171c2b;color:#aab4d0">'+esc(source.label||'Direto')+'</span></td><td>'+wa+'</td><td>'+(o.deliverySent?'<span style="color:#4caf82">✓</span>':'-')+'</td><td><button class="abtn" data-idx="'+index+'" onclick="openOrder(Number(this.dataset.idx))">Ver</button>'+recover+'</td></tr>';
    }).join('');
  };

  window.openOrder = function (index) {
    var o = filteredRows[index]; if (!o) return; currentOrder = o;
    document.getElementById('mtitle').textContent = o.name || o.paymentId;
    document.getElementById('f-nome').textContent = o.name || '-';
    document.getElementById('f-phone').textContent = o.phone || '-';
    document.getElementById('f-email').textContent = o.email || '-';
    document.getElementById('f-pid').textContent = o.paymentId || '-';
    document.getElementById('f-date').textContent = o.created_at ? new Date(o.created_at).toLocaleString('pt-BR') : '-';
    document.getElementById('f-valor').textContent = 'R$ '+Number(o.value||0).toFixed(2).replace('.',',');
    document.getElementById('f-status-badge').innerHTML = '<span class="status-badge '+(o.paid?'sb-letra':'sb-briefing')+'">'+(o.paid?'Pago':'Pendente')+'</span>';
    var digits = String(o.phone||'').replace(/\D/g,''); if (digits && !digits.startsWith('55')) digits='55'+digits;
    document.getElementById('f-bumps').innerHTML = '<div class="nail-grid"><div class="nail-card"><small>Produto</small>Nail Collection</div><div class="nail-card"><small>Data e hora</small>'+(o.created_at?new Date(o.created_at).toLocaleString('pt-BR'):'-')+'</div><div class="nail-card"><small>Entrega</small>'+(o.deliverySent?'Enviada pela Evolution':'Não enviada')+'</div><div class="nail-card"><small>Atualização</small>'+(o.updated_at?new Date(o.updated_at).toLocaleString('pt-BR'):'-')+'</div></div><a class="nail-wa" target="_blank" href="https://wa.me/'+digits+'">Falar com cliente no WhatsApp</a><div class="fld" style="margin-top:14px"><label>Observações internas</label><textarea id="nail-notes" rows="4">'+esc(o.notes||'')+'</textarea></div>';
    var delivered = document.getElementById('f-delivered'); if (delivered) delivered.checked = !!o.deliverySent;
    switchTab(0, document.querySelectorAll('.tab')[0]);
    document.getElementById('overlay').style.display = 'flex';
  };

  window.saveOrder = function () {
    if (!currentOrder) return;
    var notes = document.getElementById('nail-notes');
    fetch('/nail-admin-orders?paymentId='+encodeURIComponent(currentOrder.paymentId), { method:'PATCH', headers:{Authorization:auth,'Content-Type':'application/json'}, body:JSON.stringify({notes:notes?notes.value:'',deliverySent:document.getElementById('f-delivered').checked}) })
      .then(function(r){if(!r.ok)throw new Error(); closeModal(); loadOrders(); toast('Salvo!');}).catch(function(){toast('Erro ao salvar','err');});
  };

  var headers = document.querySelectorAll('thead th');
  ['Data e hora','Nome','E-mail','Valor','Status','Origem','WhatsApp','Entrega','Ações'].forEach(function(label,index){if(headers[index])headers[index].textContent=label;});
  var profitNote = document.getElementById('profit-note');
  if (profitNote) profitNote.textContent = 'Dados financeiros exclusivos da Nail Collection.';
})();
