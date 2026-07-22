/**
 * ============================================================
 * FRETEX - Motorista Dashboard com Socket.IO + EmailJS
 * Arquivo: public/motorista-socket.js
 * ✅ Com emails integrados
 * ============================================================
 */

const SOCKET_URL = window.location.origin;
const socket = io(SOCKET_URL);

let usuarioAtual = null;
let pedidosDisponiveis = [];
let pedidosAceitos = [];
let isOnline = true;

// ============================================================
// INICIALIZAÇÃO
// ============================================================

window.addEventListener('DOMContentLoaded', () => {
  const userData = localStorage.getItem('usuarioAtual');
  if (!userData) {
    window.location.href = 'FRETEX.html';
    return;
  }

  usuarioAtual = JSON.parse(userData);

  // Conectar ao Socket.IO
  socket.emit('user_join', {
    usuarioId: usuarioAtual.id || usuarioAtual.email,
    tipo: 'motorista'
  });

  carregarPedidosAceitos();
  atualizarUI();
  atualizarStats();
  escutarNovosFretes();
});

// ============================================================
// SOCKET.IO LISTENERS
// ============================================================

// 📦 Novo frete disponível
socket.on('frete_novo', (data) => {
  const { frete } = data;

  if (!pedidosDisponiveis.find(p => p.id === frete.id)) {
    pedidosDisponiveis.unshift(frete);
    toast(`🚚 Novo frete disponível de ${frete.clienteNome}!`, 'success');
    atualizarPedidosUI();
  }
});

// ❌ Frete já foi aceito
socket.on('frete_indisponivel', (data) => {
  const { freteId } = data;
  pedidosDisponiveis = pedidosDisponiveis.filter(p => p.id !== freteId);
  toast('Esse frete já foi aceito por outro motorista', 'info');
  atualizarPedidosUI();
});

// 💬 Mensagem do cliente
socket.on('mensagem_nova', (data) => {
  const { remetenteNome, texto, timestamp } = data;
  
  if (document.getElementById('chatOverlay')?.classList.contains('open')) {
    addMsg('theirs', texto, timestamp);
  } else {
    toast(`💬 Mensagem de ${remetenteNome}`, 'info');
  }
});

// ✅ EVENT DE EMAIL
socket.on('email_event', async (data) => {
  const { tipo } = data;
  
  if (tipo === 'frete_novo') {
    // Motorista recebe notificação de novo frete
    await enviarNotificacaoFrete(
      { origem: data.origin, destino: data.destination, item: data.item, peso: data.weight, preco: data.price, descricao: data.description, id: data.freteId },
      data.motoristaEmail,
      data.motoristaNome
    );
  }
  
  if (tipo === 'entrega_motorista') {
    // Motorista recebe recibo de pagamento
    await enviarNotificacaoEntregaMotorista(
      { origem: data.origin, destino: data.destination, dist: data.distance, preco: data.price, id: data.freteId, clienteNome: data.clientName },
      { nome: data.motoristaNome, email: data.motoristaEmail },
      data.motoristaEmail
    );
  }
});

// ============================================================
// FUNÇÕES PRINCIPAIS
// ============================================================

function escutarNovosFretes() {
  console.log('👂 Ouvindo novos fretes...');
  
  fetch('/api/fretes/disponiveis')
    .then(res => res.json())
    .then(data => {
      pedidosDisponiveis = data.fretes || [];
      atualizarPedidosUI();
    })
    .catch(err => console.error('Erro ao carregar fretes:', err));
}

function carregarPedidosAceitos() {
  const key = 'pedidosMotorista_' + usuarioAtual.email;
  const dados = localStorage.getItem(key);
  pedidosAceitos = dados ? JSON.parse(dados) : [];
}

function savePedidosAceitos() {
  const key = 'pedidosMotorista_' + usuarioAtual.email;
  localStorage.setItem(key, JSON.stringify(pedidosAceitos));
}

function atualizarUI() {
  const inicial = usuarioAtual.nome.charAt(0).toUpperCase();
  document.getElementById('userInitial').textContent = inicial;
  document.getElementById('inputNome').value = usuarioAtual.nome || '';
  document.getElementById('inputEmail').value = usuarioAtual.email || '';
  document.getElementById('inputTel').value = usuarioAtual.tel || '';
  document.getElementById('inputVeiculo').value = usuarioAtual.veiculo || '';

  const dataCriacao = new Date(usuarioAtual.dataCriacao);
  document.getElementById('inputData').value = dataCriacao.toLocaleDateString('pt-PT');

  const hora = new Date().getHours();
  let saudacao = 'Bom dia';
  if (hora >= 12 && hora < 18) saudacao = 'Boa tarde';
  if (hora >= 18) saudacao = 'Boa noite';
  document.getElementById('greeting').textContent = `${saudacao}, ${usuarioAtual.nome.split(' ')[0]}! 😊`;
}

function atualizarStats() {
  const total = pedidosAceitos.length;
  const concluidos = pedidosAceitos.filter(p => p.status === 'entregue').length;
  const emAndamento = pedidosAceitos.filter(p => p.status === 'em_andamento').length;
  const ganhos = pedidosAceitos.reduce((sum, p) => sum + (p.preco * 0.8), 0);

  document.getElementById('totalOrders').textContent = total;
  document.getElementById('completedOrders').textContent = concluidos;
  document.getElementById('activeOrders').textContent = emAndamento;
  document.getElementById('totalEarnings').textContent = ganhos.toFixed(2) + '€';

  atualizarPedidosUI();
  atualizarHistorico();
}

// ============================================================
// ACEITAR FRETE
// ============================================================

function aceitarPedido(freteId) {
  const frete = pedidosDisponiveis.find(p => p.id === freteId);
  if (!frete) return;

  socket.emit('frete_aceitar', {
    freteId: freteId,
    motoristaId: usuarioAtual.id || usuarioAtual.email,
    motoristaNome: usuarioAtual.nome,
    motoristaEmail: usuarioAtual.email,
    motoristaVeiculo: usuarioAtual.veiculo,
    motoristaAvaliacao: usuarioAtual.avaliacao || 5,
    motoristaTelefone: usuarioAtual.tel
  });

  socket.once('frete_aceito_sucesso', (data) => {
    const freteAceito = {
      ...frete,
      status: 'aceito',
      motorista: {
        nome: usuarioAtual.nome,
        email: usuarioAtual.email,
        veiculo: usuarioAtual.veiculo
      },
      preco: frete.preco
    };

    pedidosAceitos.unshift(freteAceito);
    savePedidosAceitos();

    pedidosDisponiveis = pedidosDisponiveis.filter(p => p.id !== freteId);

    setTimeout(() => {
      const indice = pedidosAceitos.findIndex(p => p.id === freteId);
      if (indice !== -1) {
        pedidosAceitos[indice].status = 'em_andamento';
        savePedidosAceitos();

        socket.emit('entrega_iniciar', { freteId });

        atualizarStats();
        toast('🚗 Começou a entrega!', 'success');

        startSendingLocation(freteId);
      }
    }, 3000);

    atualizarStats();
    toast(`✅ Frete ${freteId} aceito!`, 'success');
  });
}

// ============================================================
// GPS
// ============================================================

function startSendingLocation(freteId) {
  if (!navigator.geolocation) {
    console.warn('⚠️ Geolocalização não disponível');
    return;
  }

  const freteAtivo = pedidosAceitos.find(p => p.id === freteId && p.status === 'em_andamento');
  if (!freteAtivo) return;

  const locationInterval = setInterval(() => {
    const freteVerificacao = pedidosAceitos.find(p => p.id === freteId);
    
    if (!freteVerificacao || freteVerificacao.status === 'entregue') {
      clearInterval(locationInterval);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        socket.emit('localizacao_atualizar', {
          freteId: freteId,
          clienteId: freteAtivo.clienteId || freteAtivo.clienteEmail,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        });

        console.log(`📍 Localização enviada`);
      },
      (error) => {
        console.error('Erro ao obter localização:', error);
      }
    );
  }, 3000);
}

// ============================================================
// FINALIZAR ENTREGA
// ============================================================

function completarPedido(freteId) {
  if (!confirm('Confirma que completou esta entrega?')) return;

  const indice = pedidosAceitos.findIndex(p => p.id === freteId);
  if (indice === -1) return;

  pedidosAceitos[indice].status = 'entregue';
  savePedidosAceitos();

  socket.emit('entrega_finalizar', { freteId });

  atualizarStats();
  toast(
    '🎉 Entrega concluída! Ganhos: €' + (pedidosAceitos[indice].preco * 0.8).toFixed(2),
    'success'
  );
}

// ============================================================
// CHAT
// ============================================================

function openChat(freteId) {
  const frete = pedidosAceitos.find(p => p.id === freteId);
  if (!frete) return;

  document.getElementById('chatDrvIni').textContent = frete.clienteNome[0] || 'C';
  document.getElementById('chatDrvName').textContent = frete.clienteNome;
  document.getElementById('chatOverlay').classList.add('open');

  window.freteAtualChat = frete;

  setTimeout(() => document.getElementById('chatInput').focus(), 300);
}

function closeChat() {
  document.getElementById('chatOverlay').classList.remove('open');
}

function sendMsg() {
  const inp = document.getElementById('chatInput');
  const txt = inp.value.trim();
  if (!txt) return;

  const frete = window.freteAtualChat;
  if (!frete) return;

  addMsg('mine', txt, nowTime());
  inp.value = '';

  socket.emit('mensagem_enviar', {
    freteId: frete.id,
    remetenteId: usuarioAtual.id || usuarioAtual.email,
    remetenteNome: usuarioAtual.nome,
    destinatarioId: frete.clienteId || frete.clienteEmail,
    texto: txt
  });
}

function addMsg(who, text, time) {
  const ini = who === 'theirs' ? window.freteAtualChat?.clienteNome?.[0] || 'C' : usuarioAtual?.nome?.[0] || 'M';
  const msgs = document.getElementById('chatMsgs');
  const div = document.createElement('div');
  div.className = 'msg ' + who;

  div.innerHTML = `
    ${who === 'theirs' ? `<div class="msg-ava" style="width:26px;height:26px;background:#3B82F6;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">${ini}</div>` : ''}
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
// NAVEGAÇÃO
// ============================================================

function showSection(secao) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(l => l.classList.remove('active'));

  document.getElementById(secao).classList.add('active');

  const navLink = Array.from(document.querySelectorAll('.nav-link')).find(l =>
    l.textContent.includes(
      secao === 'dashboard' ? 'Dashboard' :
      secao === 'pedidos' ? 'Pedidos' :
      secao === 'historico' ? 'Histórico' : 'Perfil'
    )
  );
  if (navLink) navLink.classList.add('active');
}

function toggleStatus() {
  isOnline = !isOnline;
  const toggle = document.getElementById('statusToggle');
  const text = document.getElementById('statusText');

  if (isOnline) {
    toggle.classList.add('online');
    text.textContent = 'Online';
    toast('✅ Agora online - receberás notificações de fretes', 'success');
  } else {
    toggle.classList.remove('online');
    text.textContent = 'Offline';
    toast('⏸️ Está offline - não receberás fretes', 'warning');
  }
}

function logout() {
  if (confirm('Deseja sair da sua conta?')) {
    localStorage.removeItem('usuarioAtual');
    window.location.href = 'FRETEX.html';
  }
}

// ============================================================
// RENDERIZAR PEDIDOS
// ============================================================

function atualizarPedidosUI() {
  const containerAvailable = document.getElementById('availableOrders');
  const containerAll = document.getElementById('pedidosList');

  const disponiveis = pedidosDisponiveis.slice(0, 3);

  if (disponiveis.length === 0) {
    containerAvailable.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">Sem pedidos</div><div class="empty-text">Aguardando novos fretes</div></div>';
  } else {
    containerAvailable.innerHTML = disponiveis.map(p => renderizarOrderCard(p, true)).join('');
  }

  if (pedidosDisponiveis.length === 0) {
    containerAll.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">Sem pedidos disponíveis</div><div class="empty-text">Verifique mais tarde</div></div>';
  } else {
    containerAll.innerHTML = pedidosDisponiveis.map(p => renderizarOrderCard(p, true)).join('');
  }
}

function atualizarHistorico() {
  const container = document.getElementById('historicoList');
  const concluidos = pedidosAceitos.filter(p => p.status === 'entregue');

  if (concluidos.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">Sem entregas</div><div class="empty-text">Aceita pedidos para começar a ganhar</div></div>';
  } else {
    container.innerHTML = concluidos.map(p => renderizarOrderCard(p, false)).join('');
  }
}

function renderizarOrderCard(p, mostraBotaoAceitar) {
  const ganhosMotorista = (p.preco * 0.8).toFixed(2);

  return `
    <div class="order-card">
      <div class="order-header">
        <span class="order-id">${p.id}</span>
        <span class="order-status status-${p.status}">${p.status.replace('_', ' ').toUpperCase()}</span>
      </div>
      <div class="order-details">
        <div class="detail-block">
          <div class="detail-icon">👤</div>
          <div class="detail-content">
            <div class="detail-label">Cliente</div>
            <div class="detail-value">${p.clienteNome}</div>
          </div>
        </div>
        <div class="detail-block">
          <div class="detail-icon">📍</div>
          <div class="detail-content">
            <div class="detail-label">Origem → Destino</div>
            <div class="detail-value">${p.origem} → ${p.destino}</div>
          </div>
        </div>
        <div class="detail-block">
          <div class="detail-icon">📦</div>
          <div class="detail-content">
            <div class="detail-label">Carga</div>
            <div class="detail-value">${p.descricao || p.item}</div>
          </div>
        </div>
        <div class="detail-block">
          <div class="detail-icon">💰</div>
          <div class="detail-content">
            <div class="detail-label">Seu Ganho</div>
            <div class="detail-value" style="color: var(--success); font-weight: 800;">${ganhosMotorista}€</div>
          </div>
        </div>
      </div>
      <div class="order-footer">
        <span class="order-price">${p.preco.toFixed(2)}€</span>
        <div class="order-actions">
          ${mostraBotaoAceitar ? `<button class="btn-small btn-accept" onclick="aceitarPedido('${p.id}')">Aceitar</button>` : ''}
          ${p.status === 'em_andamento' ? `<button class="btn-small btn-complete" onclick="completarPedido('${p.id}')">Finalizar</button>` : ''}
          <button class="btn-small btn-details" onclick="openChat('${p.id}')">💬 Chat</button>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// UTILITÁRIOS
// ============================================================

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3B82F6'};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-weight: 600;
    z-index: 1000;
    animation: slideIn 0.3s ease-out;
  `;
  el.textContent = msg;
  document.body.appendChild(el);

  setTimeout(() => {
    el.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

console.log('✅ Motorista Socket.IO carregado!');
