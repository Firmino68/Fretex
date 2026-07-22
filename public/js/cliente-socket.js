/**
 * ============================================================
 * FRETEX - Cliente Dashboard com Socket.IO + EmailJS
 * Arquivo: public/cliente-socket.js
 * ✅ Com emails integrados
 * ============================================================
 */

const SOCKET_URL = window.location.origin;
const socket = io(SOCKET_URL);

let USER = null;
let PEDIDOS = [];
let MOTORISTA_ATUAL = null;

// ============================================================
// INICIALIZAÇÃO
// ============================================================

window.addEventListener('DOMContentLoaded', () => {
  const usuarioData = localStorage.getItem('usuarioAtual');
  if (!usuarioData) {
    window.location.href = 'FRETEX.html';
    return;
  }

  USER = JSON.parse(usuarioData);

  // Conectar ao Socket.IO
  socket.emit('user_join', {
    usuarioId: USER.id || USER.email,
    tipo: 'cliente'
  });

  // Renderizar interface
  renderNav();
  renderHome();
  carregarFretes();
});

// ============================================================
// SOCKET.IO LISTENERS
// ============================================================

// Motorista aceitou frete
socket.on('frete_aceito', (data) => {
  const { freteId, motorista } = data;
  const frete = PEDIDOS.find(p => p.id === freteId);
  if (!frete) return;

  frete.status = 'aceito';
  frete.motorista = motorista;
  MOTORISTA_ATUAL = motorista;

  savePedidos();
  toast(`🎉 ${motorista.nome} aceitou seu frete!`, 'success');
  showActiveBanner(frete);
  renderHome();
});

// Localização atualizada
socket.on('localizacao_motorista', (data) => {
  const { latitude, longitude } = data;
  if (DRIVER_MARKER && MAP) {
    DRIVER_MARKER.setLatLng([latitude, longitude]);
    const userPos = USER_MARKER.getLatLng();
    if (ROUTE_LINE) {
      ROUTE_LINE.setLatLngs([[latitude, longitude], userPos]);
    }
    const distancia = haversine(
      { lat: latitude, lng: longitude },
      { lat: userPos.lat, lng: userPos.lng }
    );
    const minutosEstimados = Math.max(1, Math.ceil(distancia / 20 * 60));
    document.getElementById('trkEta').textContent = minutosEstimados + ' min';
  }
});

// Mensagem nova
socket.on('mensagem_nova', (data) => {
  const { remetenteNome, texto, timestamp } = data;
  addMsg('theirs', texto, timestamp);
});

// Entrega iniciada
socket.on('entrega_iniciada', (data) => {
  advPhase();
  toast('🚗 Motorista iniciou o trajeto!', 'info');
});

// Entrega concluída
socket.on('entrega_concluida', (data) => {
  finishDelivery();
  toast('✅ Sua encomenda foi entregue!', 'success');
});

// ✅ EVENT DE EMAIL
socket.on('email_event', async (data) => {
  const { tipo } = data;
  
  if (tipo === 'frete_novo') {
    // Motorista recebeu email - não é para cliente
    return;
  }
  
  if (tipo === 'frete_aceito') {
    // Cliente recebe notificação que motorista aceitou
    await enviarNotificacaoAceito(
      { origem: data.origin, destino: data.destination, preco: data.price },
      { nome: data.driverName, veiculo: data.driverVehicle, telefone: data.driverPhone, avaliacao: data.driverRating },
      data.clienteEmail,
      data.clienteNome
    );
  }
  
  if (tipo === 'entrega_cliente') {
    // Cliente recebe notificação que entrega foi concluída
    await enviarNotificacaoEntregaCliente(
      { origem: data.origin, destino: data.destination, preco: data.price, id: data.freteId },
      { nome: data.driverName },
      data.clienteEmail,
      data.clienteNome
    );
  }
});

// ============================================================
// FUNÇÕES DE INTERFACE
// ============================================================

function renderNav() {
  const f = (USER.nome || USER.name || '?').split(' ')[0];
  document.getElementById('navAvatar').textContent = f[0].toUpperCase();
  document.getElementById('navName').textContent = f;
}

function renderHome() {
  const f = (USER.nome || USER.name || 'Cliente').split(' ')[0];
  const h = new Date().getHours();
  const s = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  document.getElementById('homeGreeting').textContent = `${s}, ${f}! 👋`;

  const done = PEDIDOS.filter(p => p.status === 'entregue');
  const act = PEDIDOS.filter(p => p.status === 'aceito' || p.status === 'em_andamento');
  const gasto = done.reduce((a, p) => a + (p.precoTotal || 0), 0);

  document.getElementById('stTotal').textContent = PEDIDOS.length;
  document.getElementById('stEntregues').textContent = done.length;
  document.getElementById('stAtivos').textContent = act.length;
  document.getElementById('stGasto').textContent = gasto.toFixed(0) + '€';

  const el = document.getElementById('recentList');
  const last = PEDIDOS.slice(0, 4);

  if (!last.length) {
    el.innerHTML = '<div class="empty-state"><div class="ico">📭</div><p>Nenhum pedido ainda.<br>Cria o teu primeiro frete!</p></div>';
    return;
  }

  el.innerHTML = last.map(p => orderCardHtml(p)).join('');
}

function carregarFretes() {
  const fretes = localStorage.getItem('pedidos_' + USER.email);
  PEDIDOS = fretes ? JSON.parse(fretes) : [];
}

function savePedidos() {
  localStorage.setItem('pedidos_' + USER.email, JSON.stringify(PEDIDOS));
}

function orderCardHtml(p) {
  const vn = { moto: 'Moto', van: 'Van', caminhao: 'Caminhão', caminhao_grande: 'Caminhão Grande' }[p.veiculo] || p.veiculo;
  const isAct = p.status === 'aceito' || p.status === 'em_andamento';
  return `<div class="order-card">
    <div class="order-top">
      <div><div class="order-id">${p.id}</div><div class="order-date">${p.data}${p.agendado ? ' · 📅 ' + p.agendado : ''}</div></div>
      <span class="status-pill s-${p.status}">${statusLabel(p.status)}</span>
    </div>
    <div class="order-route">
      <div class="route-icons"><div class="dot-g"></div><div class="route-line"></div><div class="dot-o"></div></div>
      <div class="route-addrs">
        <div class="route-addr">${p.origem}<small>${p.origemApt || ''}</small></div>
        <div class="route-addr">${p.destino}<small>${p.destinoApt || ''}</small></div>
      </div>
    </div>
    <div class="order-foot">
      <span class="order-price">${(p.precoTotal || 0).toFixed(2)}€</span>
      <span class="order-veh">${vn}</span>
      ${isAct ? '<button class="btn-track" onclick="goView(\'acompanhar\')">🗺️ Ver</button>' : ''}
    </div>
  </div>`;
}

function statusLabel(s) {
  return { pendente: 'Pendente', aceito: 'Aceite', em_andamento: 'Em curso', entregue: 'Entregue', cancelado: 'Cancelado', agendado: 'Agendado' }[s] || s;
}

// ============================================================
// CRIAR FRETE
// ============================================================

async function submitPedido() {
  if (!validatePayment()) return;

  const btn = document.getElementById('btnSubmit');
  btn.textContent = '⏳ A enviar…';
  btn.disabled = true;

  goView('matching');

  const freteData = {
    clienteId: USER.id || USER.email,
    clienteNome: USER.nome || USER.name,
    clienteEmail: USER.email,
    origem: PED.origem,
    destino: PED.destino,
    origemApt: PED.origemApt,
    destinoApt: PED.destinoApt,
    item: PED.item,
    veiculo: PED.veiculo,
    peso: PED.peso,
    qtd: PED.qtd,
    descricao: PED.descricao,
    photo: PED.photo,
    preco: PED.precoTotal,
    dist: PED.dist,
    schedule: PED.schedule,
    agendado: PED.schedule === 'later' ? PED.schDate + ' ' + PED.schTime : null
  };

  // Enviar via Socket.IO
  socket.emit('frete_criar', freteData);

  setTimeout(() => showDriverFound('FR-' + Date.now()), 3000 + Math.random() * 2000);
}

// ============================================================
// TRACKING & DELIVERY
// ============================================================

function startTracking() {
  const d = MOTORISTA_ATUAL || PED.motorista;
  const isAgendado = PED.schedule === 'later';

  const novoPedido = {
    id: 'FR-' + Date.now(),
    status: isAgendado ? 'agendado' : 'aceito',
    origem: PED.origem,
    destino: PED.destino,
    origemApt: PED.origemApt,
    destinoApt: PED.destinoApt,
    item: PED.item,
    veiculo: PED.veiculo,
    descricao: PED.descricao,
    precoTotal: PED.precoTotal,
    motorista: d,
    data: new Date().toLocaleDateString('pt-PT'),
    agendado: PED.schedule === 'later' ? PED.schDate + ' ' + PED.schTime : null,
    dataCriacao: new Date().toISOString()
  };

  PEDIDOS.unshift(novoPedido);
  savePedidos();

  document.getElementById('tab-acompanhar').style.display = 'flex';
  document.getElementById('tab-acompanhar').classList.add('pulse');

  showActiveBanner(novoPedido);

  if (isAgendado) {
    toast(`📅 Frete agendado para ${PED.schDate} às ${PED.schTime}!`, 'success');
    goView('home');
    renderHome();
    return;
  }

  goView('acompanhar');
  toast('Motorista a caminho!', 'success');

  setTimeout(() => schedDelivery(), 1000);
}

function finishDelivery() {
  if (TRK_INT) clearInterval(TRK_INT);
  if (PEDIDOS.length) PEDIDOS[0].status = 'entregue';
  savePedidos();
  document.getElementById('tab-acompanhar').classList.remove('pulse');
  toast('✅ Entregue com sucesso!', 'success');
  setTimeout(() => {
    document.getElementById('rateDriverName').textContent = PED.motorista?.nome?.split(' ')[0] || 'o motorista';
    setRating(5);
    document.getElementById('ratingOverlay').classList.add('open');
  }, 1500);
}

// ============================================================
// CHAT
// ============================================================

function openChat() {
  if (MOTORISTA_ATUAL) {
    document.getElementById('chatDrvIni').textContent = MOTORISTA_ATUAL.nome[0] || 'C';
    document.getElementById('chatDrvName').textContent = MOTORISTA_ATUAL.nome || 'Motorista';
  }
  document.getElementById('chatOverlay').classList.add('open');
  setTimeout(() => document.getElementById('chatInput').focus(), 300);
}

function closeChat() {
  document.getElementById('chatOverlay').classList.remove('open');
}

function sendMsg() {
  const inp = document.getElementById('chatInput');
  const txt = inp.value.trim();
  if (!txt) return;

  addMsg('mine', txt, nowTime());
  inp.value = '';

  const freteAtiva = PEDIDOS.find(p => p.status === 'aceito' || p.status === 'em_andamento');
  if (freteAtiva && MOTORISTA_ATUAL) {
    socket.emit('mensagem_enviar', {
      freteId: freteAtiva.id,
      remetenteId: USER.id || USER.email,
      remetenteNome: USER.nome || USER.name,
      destinatarioId: MOTORISTA_ATUAL.id,
      texto: txt
    });
  }

  const DRIVER_MSGS = [
    'Estou a caminho, já chego! 👍',
    'Perfeito, obrigado!',
    'Sem problema, rota traçada.',
    'Vejo-o em breve! 🚐',
    'Ok, já estou quase!'
  ];

  setTimeout(() => {
    addMsg('theirs', DRIVER_MSGS[Math.floor(Math.random() * DRIVER_MSGS.length)], nowTime());
  }, 1200 + Math.random() * 800);
}

function addMsg(who, text, time) {
  const ini = who === 'theirs' ? MOTORISTA_ATUAL?.nome?.[0] || 'C' : USER?.nome?.[0] || 'U';
  const msgs = document.getElementById('chatMsgs');
  const div = document.createElement('div');
  div.className = 'msg ' + who;

  div.innerHTML = `
    ${who === 'theirs' ? `<div class="msg-ava" style="width:26px;height:26px;background:var(--blue);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">${ini}</div>` : ''}
    <div>
      <div class="msg-bubble">${text}</div>
      <div class="msg-time">${time}</div>
    </div>
    ${who === 'mine' ? `<div class="msg-ava" style="width:26px;height:26px;background:var(--orange);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">${ini}</div>` : ''}
  `;

  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function nowTime() {
  const d = new Date();
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

// ============================================================
// UTILIDADES
// ============================================================

function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  setTimeout(() => el.classList.remove('show'), 3500);
}

function doLogout() {
  localStorage.setItem('usuarioAtual', '');
  window.location.href = 'FRETEX.html';
}

console.log('✅ Cliente Socket.IO carregado!');
