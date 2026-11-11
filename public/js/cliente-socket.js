/**
 * ============================================================
 * FRETEX - Cliente Dashboard
 * Socket.IO + MySQL + EmailJS
 * Arquivo: public/cliente-socket.js
 * ============================================================
 */

const SOCKET_URL = window.location.origin;
const socket = io(SOCKET_URL, {
  // O servidor exige o JWT guardado no login; é lido a cada (re)ligação.
  auth: (cb) => cb({ token: localStorage.getItem('fx_token') || '' })
});
function fxAuthHeaders() {
  const t = localStorage.getItem('fx_token');
  return t ? { Authorization: 'Bearer ' + t } : {};
}
function fxSessaoExpirada() {
  localStorage.removeItem('usuarioAtual');
  localStorage.removeItem('fx_token');
  window.location.href = 'login.html';
}
let clienteSocketJoinedId = null;

// ============================================================
// DADOS GLOBAIS
// ============================================================

let USER = null;
let PEDIDOS = [];
let MOTORISTA_ATUAL = null;

let MAP = null;
let DRIVER_MARKER = null;
let USER_MARKER = null;
let DEST_MARKER = null;
let ROUTE_LINE = null;
let TRK_INT = null;
let MAP_MINI = null;
let RATING = 0;
let PAY_METHOD = 'mb';
let TRK_PHASE = 0;
let GPS_SIM = null;
let GPS_SIM_INDEX = 0;
let TRACK_ROUTE = [];
let TRACK_ROUTE_LAYER = null;
let TRACK_HISTORY = [];
let TRACK_HISTORY_LAYER = null;
let TRACK_LAST_UPDATE = 0;
let TRACK_RECALC_TIMER = null;
let TRACK_REAL_MODE = false;
let TRACK_ACTIVE_FRETE = null;

// ============================================================
// PEDIDO ATUAL
// ============================================================

let PED = {
  origem: '',
  origemApt: '',
  destino: '',
  destinoApt: '',

  destLat: null,
  destLon: null,

  item: '',
  veiculo: '',
  peso: 0,
  qtd: 1,
  descricao: '',

  photo: null,

  schedule: 'now',
  schDate: '',
  schTime: '',

  precoTotal: 0,
  dist: 0,

  extras: {
    ajudante: false,
    escadas: false,
    seguro: false,
    urgente: false
  },

  motorista: null,
  freteId: null
};

// ============================================================
// PREÇOS
// ============================================================

const t = {
  b: 12,
  k: 1.20,
  m: 12
};

// ============================================================
// INICIALIZAÇÃO
// ============================================================

window.addEventListener('DOMContentLoaded', () => {

  console.log('🚚 Inicializando Cliente FRETEX...');

  const usuarioData = localStorage.getItem('usuarioAtual');

  if (!usuarioData || !localStorage.getItem('fx_token')) {
    window.location.href = 'FRETEX.html';
    return;
  }

  try {
    USER = JSON.parse(usuarioData);
  } catch (error) {
    console.error('❌ Erro ao ler usuarioAtual:', error);

    localStorage.removeItem('usuarioAtual');
    window.location.href = 'FRETEX.html';
    return;
  }

  if (!USER || !USER.id) {
    console.error('❌ Utilizador inválido:', USER);

    localStorage.removeItem('usuarioAtual');
    window.location.href = 'FRETEX.html';
    return;
  }

  console.log('👤 Cliente:', USER);

  carregarFretes();
  joinClienteSocket();

  renderNav();
  renderHome();

  console.log('✅ Cliente inicializado');
});

// ============================================================
// SOCKET - CONEXÃO
// ============================================================

socket.on('connect', () => {
  console.log('🟢 Socket conectado:', socket.id);
  clienteSocketJoinedId = null;
  joinClienteSocket();
  setTimeout(() => {
    requestTrackingRecovery();
    sincronizarFretesServidorCliente();
  }, 300);
});

function joinClienteSocket() {
  if (!USER || !USER.id || !socket.connected) return;
  if (clienteSocketJoinedId === String(USER.id)) return;

  clienteSocketJoinedId = String(USER.id);
  socket.emit('user_join', {
    usuarioId: USER.id,
    tipo: 'cliente'
  });
}

socket.on('disconnect', (reason) => {
  clienteSocketJoinedId = null;
  console.log('🔴 Socket desconectado:', reason);
  if (TRACK_REAL_MODE) {
    const badge = document.getElementById('trackingDemoBadge');
    if (badge) badge.textContent = '● Ligação GPS perdida — a reconectar';
    if (badge) badge.style.color = 'var(--error)';
  }
});

socket.on('connect_error', (error) => {
  console.error('❌ Erro Socket.IO:', error);
  if (error && error.message === 'Não autenticado') fxSessaoExpirada();
});

// ============================================================
// SOCKET - ERROS
// ============================================================

socket.on('erro', (data) => {
  console.error('❌ Erro recebido do servidor:', data);

  toast(
    data?.message || 'Ocorreu um erro no servidor.',
    'error'
  );
});

socket.on('frete_aceitar_erro', (data) => {
  console.error('❌ Erro aceitar frete:', data);

  toast(
    data?.message || 'Não foi possível aceitar o frete.',
    'error'
  );
});

// ============================================================
// SOCKET - FRETE CRIADO
// ============================================================

socket.on('frete_criado', (data) => {

  console.log('✅ Servidor confirmou criação do frete:', data);

  if (!data || !(data.freteId || data.id || data._id)) {
    return;
  }

  PED.freteId = data.freteId;

  const pedido = PEDIDOS.find(
    p => p.id === data.freteId
  );

  if (pedido) {
    pedido.id = data.freteId;
    pedido.status = data.status || 'pendente';

    savePedidos();
    renderHome();
  }

  const btn = document.getElementById('btnSubmit');

  if (btn) {
    btn.textContent = 'Frete enviado ✓';
  }

  toast(
    '📦 Frete enviado aos motoristas!',
    'success'
  );
});

// ============================================================
// SOCKET - MOTORISTA ACEITOU
// ============================================================

socket.on('fretes_sincronizados', (fretes) => {
  if (!Array.isArray(fretes)) return;

  const mapa = new Map(PEDIDOS.map(p => [String(p.id), p]));
  fretes.forEach(raw => {
    const p = {
      ...raw,
      id: String(raw.id || raw.freteId || raw._id || ''),
      freteId: String(raw.freteId || raw.id || raw._id || ''),
      clienteNome: raw.clienteNome || raw.cliente?.nome || USER?.nome || 'Cliente',
      origem: typeof raw.origem === 'object' ? (raw.origem?.endereco || '') : (raw.origem || ''),
      destino: typeof raw.destino === 'object' ? (raw.destino?.endereco || '') : (raw.destino || ''),
      descricao: raw.descricao || raw.item || '',
      motorista: raw.motorista || null
    };
    if (p.id) mapa.set(p.id, { ...(mapa.get(p.id) || {}), ...p });
  });

  PEDIDOS = Array.from(mapa.values());
  const ativo = PEDIDOS.find(p => ['aceito','em_andamento'].includes(p.status));
  if (ativo) {
    PED.freteId = ativo.id;
    atualizarCartaoMotorista(ativo.motorista);
    PED.motorista = ativo.motorista || null;
    MOTORISTA_ATUAL = ativo.motorista || null;
  }

  savePedidos();
  renderHome();

  if (ativo) {
    showActiveBanner(ativo);
  }
});

socket.on('sincronizacao_erro', data => {
  console.warn('⚠️ Sincronização de fretes:', data);
});

socket.on('frete_aceito', (data) => {

  console.log('🎉 FRETE ACEITO:', data);

  if (!data || !data.freteId) {
    console.warn('⚠️ frete_aceito sem freteId');
    return;
  }

  const freteId = String(data.freteId || data.id || data._id);
  const frete = PEDIDOS.find(
    p => String(p.id) === freteId
  );

  if (!frete) {
    console.warn(
      '⚠️ Frete não encontrado localmente; criando referência:',
      freteId
    );

    const recebido = data.frete || data;
    const novo = {
      ...recebido,
      id: freteId,
      freteId,
      status: 'aceito',
      origem: typeof recebido.origem === 'object' ? recebido.origem.endereco : recebido.origem,
      destino: typeof recebido.destino === 'object' ? recebido.destino.endereco : recebido.destino,
      motorista: data.motorista || recebido.motorista || null
    };
    PEDIDOS.unshift(novo);
    PED.freteId = freteId;
    PED.motorista = novo.motorista;
    MOTORISTA_ATUAL = novo.motorista;
    atualizarCartaoMotorista(MOTORISTA_ATUAL);
    savePedidos();
    renderHome();
    toast(`🎉 ${MOTORISTA_ATUAL?.nome || 'Um motorista'} aceitou seu frete!`, 'success');
    showActiveBanner(novo);
    return;
  }

  frete.status = 'aceito';
  frete.motorista = data.motorista || null;

  PED.motorista = data.motorista || null;
  PED.freteId = freteId;

  MOTORISTA_ATUAL = data.motorista || null;
  atualizarCartaoMotorista(MOTORISTA_ATUAL);

  savePedidos();
  renderHome();

  if (MOTORISTA_ATUAL) {
    console.log(
      '🚗 Motorista:',
      MOTORISTA_ATUAL.nome
    );
  }

  toast(
    `🎉 ${MOTORISTA_ATUAL?.nome || 'Um motorista'} aceitou seu frete!`,
    'success'
  );

  showActiveBanner(frete);

  atualizarInterfaceMotorista();

  goView('acompanhar');
});

// ============================================================
// SOCKET - MOTORISTA INICIOU ENTREGA
// ============================================================

socket.on('entrega_iniciada', (data) => {

  console.log('🚗 Entrega iniciada:', data);

  const freteId = data?.freteId;

  let frete = null;

  if (freteId) {
    frete = PEDIDOS.find(
      p => p.id === freteId
    );
  }

  if (!frete) {
    frete = PEDIDOS.find(
      p =>
        p.status === 'aceito' ||
        p.status === 'em_andamento'
    );
  }

  if (frete) {
    frete.status = 'em_andamento';
    savePedidos();
    renderHome();
    showActiveBanner(frete);
  }

  advPhase();

  toast(
    '🚗 Motorista iniciou o trajeto!',
    'info'
  );
});

// ============================================================
// SOCKET - LOCALIZAÇÃO DO MOTORISTA
// ============================================================

socket.on('localizacao_motorista', (data) => {
  if (!data) return;
  const latitude = Number(data.latitude), longitude = Number(data.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
  if (!TRACK_ACTIVE_FRETE || String(data.freteId) !== String(TRACK_ACTIVE_FRETE.id)) return;

  TRACK_REAL_MODE = true;
  TRACK_LAST_UPDATE = Date.now();
  appendTrackingPoint({ latitude, longitude, accuracy: data.accuracy, speed: data.speed, heading: data.heading, capturedAt: data.capturedAt, source: 'real' });
  updateGpsBadge('real');

  if (DRIVER_MARKER && MAP) DRIVER_MARKER.setLatLng([latitude, longitude]);
  updateTrackingProgressFromPosition(latitude, longitude);
  updateLiveEta(latitude, longitude);
  maybeRecalculateLiveRoute(latitude, longitude);
});

socket.on('trajetoria_frete', (data) => {
  if (!data?.freteId || !TRACK_ACTIVE_FRETE || String(data.freteId) !== String(TRACK_ACTIVE_FRETE.id)) return;
  TRACK_HISTORY = Array.isArray(data.pontos) ? data.pontos.map(p => ({
    latitude: Number(p.latitude), longitude: Number(p.longitude), accuracy: p.accuracy, speed: p.speed,
    heading: p.heading, capturedAt: p.capturedAt, source: p.source || 'real'
  })).filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) : [];
  if (TRACK_HISTORY.length) {
    const last = TRACK_HISTORY[TRACK_HISTORY.length - 1];
    TRACK_LAST_UPDATE = Date.now();
    TRACK_REAL_MODE = true;
    if (DRIVER_MARKER && MAP) DRIVER_MARKER.setLatLng([last.latitude, last.longitude]);
    drawTrackingHistory();
    updateGpsBadge('real');
    updateTrackingProgressFromPosition(last.latitude, last.longitude);
    updateLiveEta(last.latitude, last.longitude);
  }
});

function sincronizarFretesServidorCliente() {
  if (!USER?.id || !socket.connected) return;

  socket.emit('sincronizar_fretes');

  // Fallback HTTP para recuperar o estado mesmo que um evento Socket.IO
  // tenha ocorrido enquanto a ligação estava interrompida.
  fetch('/api/fretes/meus', { headers: fxAuthHeaders() })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
    .then(data => {
      const remotos = Array.isArray(data.fretes) ? data.fretes : [];
      if (!remotos.length) return;

      const mapa = new Map(PEDIDOS.map(p => [String(p.id), p]));
      remotos.forEach(raw => {
        const p = {
          ...raw,
          id: String(raw.id || raw.freteId || raw._id || ''),
          freteId: String(raw.freteId || raw.id || raw._id || ''),
          clienteNome: raw.clienteNome || raw.cliente?.nome || USER.nome,
          origem: typeof raw.origem === 'object' ? (raw.origem?.endereco || '') : (raw.origem || ''),
          destino: typeof raw.destino === 'object' ? (raw.destino?.endereco || '') : (raw.destino || ''),
          descricao: raw.descricao || raw.item || '',
          motorista: raw.motorista || null
        };
        if (p.id) mapa.set(p.id, { ...(mapa.get(p.id) || {}), ...p });
      });

      PEDIDOS = Array.from(mapa.values());
      const ativos = PEDIDOS.find(p => ['aceito','em_andamento'].includes(p.status));
      if (ativos) {
        PED.freteId = ativos.id;
        atualizarCartaoMotorista(ativos.motorista);
        PED.motorista = ativos.motorista || null;
        MOTORISTA_ATUAL = ativos.motorista || null;
      }

      savePedidos();
      renderHome();

      const entregue = PEDIDOS.find(p => p.status === 'entregue');
      if (entregue) {
        // O estado final também fica disponível no histórico após uma
        // desconexão/reconexão.
        console.log('📚 Estado recuperado do MongoDB:', entregue.id);
      }
    })
    .catch(err => console.warn('⚠️ Recuperação HTTP do cliente falhou:', err));
}

function requestTrackingRecovery() {
  const frete = TRACK_ACTIVE_FRETE || PEDIDOS.find(p => ['aceito','em_andamento'].includes(p.status));
  if (frete?.id && socket.connected) socket.emit('pedir_trajetoria', { freteId: frete.id });
}

function updateGpsBadge(mode) {
  const badge = document.getElementById('trackingDemoBadge');
  if (!badge) return;
  if (mode === 'simulation') {
    badge.textContent = '● GPS SIMULADO — demonstração';
    badge.style.color = 'var(--orange)';
  } else {
    badge.textContent = '● GPS EM TEMPO REAL';
    badge.style.color = 'var(--success)';
  }
}

function appendTrackingPoint(point) {
  if (!point) return;
  const last = TRACK_HISTORY[TRACK_HISTORY.length - 1];
  if (last && Math.abs(last.latitude-point.latitude) < 0.000001 && Math.abs(last.longitude-point.longitude) < 0.000001) return;
  TRACK_HISTORY.push(point);
  if (TRACK_HISTORY.length > 2000) TRACK_HISTORY = TRACK_HISTORY.slice(-2000);
  drawTrackingHistory();
}

function drawTrackingHistory() {
  if (!MAP || !TRACK_HISTORY.length || typeof L === 'undefined') return;
  const latlngs = TRACK_HISTORY.map(p => [p.latitude, p.longitude]);
  if (!TRACK_HISTORY_LAYER) {
    TRACK_HISTORY_LAYER = L.polyline(latlngs, { color: '#1A3A8F', weight: 5, opacity: .85 }).addTo(MAP);
  } else TRACK_HISTORY_LAYER.setLatLngs(latlngs);
}

function updateTrackingProgressFromPosition(lat, lng) {
  if (!TRACK_ROUTE.length) return;
  let nearest = 0, best = Infinity;
  TRACK_ROUTE.forEach((p, i) => { const d = Math.pow(p.lat-lat,2)+Math.pow(p.lng-lng,2); if (d < best) { best=d; nearest=i; } });
  updateTrackingPhase(nearest / Math.max(1, TRACK_ROUTE.length-1));
}

async function updateLiveEta(lat, lng) {
  if (!TRACK_ACTIVE_FRETE || !Number.isFinite(Number(TRACK_ACTIVE_FRETE.destLat)) || !Number.isFinite(Number(TRACK_ACTIVE_FRETE.destLon))) return;
  const now = Date.now();
  if (window.__lastEtaFetch && now-window.__lastEtaFetch < 12000) return;
  window.__lastEtaFetch = now;
  try {
    const dlat = Number(TRACK_ACTIVE_FRETE.destLat), dlon = Number(TRACK_ACTIVE_FRETE.destLon);
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${lng},${lat};${dlon},${dlat}?overview=false`, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('OSRM ' + res.status);
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) return;
    const minutes = Math.max(1, Math.ceil(Number(route.duration || 0) / 60));
    const eta = document.getElementById('trkEta');
    if (eta) eta.textContent = minutes + ' min';
  } catch (e) {
    const dest = { lat: Number(TRACK_ACTIVE_FRETE.destLat), lng: Number(TRACK_ACTIVE_FRETE.destLon) };
    const minutes = Math.max(1, Math.ceil(haversine({lat,lng}, dest) / 20 * 60));
    const eta = document.getElementById('trkEta');
    if (eta) eta.textContent = minutes + ' min';
  }
}

async function maybeRecalculateLiveRoute(lat, lng) {
  if (!MAP || !TRACK_ACTIVE_FRETE) return;
  if (TRACK_RECALC_TIMER) return;
  TRACK_RECALC_TIMER = setTimeout(async () => {
    TRACK_RECALC_TIMER = null;
    if (!Number.isFinite(Number(TRACK_ACTIVE_FRETE.destLat)) || !Number.isFinite(Number(TRACK_ACTIVE_FRETE.destLon))) return;
    try {
      const dl = Number(TRACK_ACTIVE_FRETE.destLon), da = Number(TRACK_ACTIVE_FRETE.destLat);
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${lng},${lat};${dl},${da}?overview=full&geometries=geojson`, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return;
      const data = await res.json();
      const coords = data?.routes?.[0]?.geometry?.coordinates;
      if (Array.isArray(coords) && coords.length > 1) {
        TRACK_ROUTE = coords.map(([lo, la]) => ({lat:Number(la), lng:Number(lo)})).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
        if (TRACK_ROUTE_LAYER) TRACK_ROUTE_LAYER.setLatLngs(TRACK_ROUTE.map(p => [p.lat,p.lng]));
      }
    } catch (e) { console.warn('⚠️ Não foi possível recalcular a rota ao vivo.', e); }
  }, 15000);
}

// ============================================================
// SOCKET - MENSAGEM NOVA
// ============================================================

socket.on('mensagem_nova', (data) => {

  console.log('💬 Nova mensagem recebida:', data);

  if (!data) {
    return;
  }

  /*
   * Se o servidor enviar freteId,
   * podemos garantir que pertence ao frete atual.
   */

  if (
    data.freteId &&
    PED.freteId &&
    String(data.freteId) !== String(PED.freteId)
  ) {
    console.log(
      'ℹ️ Mensagem pertence a outro frete:',
      data.freteId
    );

    return;
  }

  const remetenteId =
    data.remetenteId != null
      ? String(data.remetenteId)
      : null;

  /*
   * Se a mensagem foi enviada pelo próprio cliente,
   * não duplicar na interface.
   */

  if (
    USER &&
    remetenteId === String(USER.id)
  ) {
    return;
  }

  addMsg(
    'theirs',
    data.texto || '',
    formatMessageTime(data.timestamp)
  );
});

socket.on('mensagens_historico', (data) => {
  if (!data?.mensagens || !PED.freteId || String(data.freteId) !== String(PED.freteId)) return;
  const box = document.getElementById('chatMsgs');
  if (!box) return;
  box.innerHTML = '';
  data.mensagens.forEach(msg => {
    const own = String(msg.senderId || msg.remetenteId) === String(USER?.id);
    addMsg(own ? 'mine' : 'theirs', msg.texto || msg.conteudo || '', formatMessageTime(msg.timestamp || msg.dataEnvio));
  });
});

// ============================================================
// SOCKET - ENTREGA FINALIZADA
// ============================================================

socket.on('entrega_finalizada', (data) => {

  console.log(
    '✅ Entrega finalizada:',
    data
  );

  finishDelivery(
    data?.freteId
  );
});

// Compatibilidade caso o servidor envie este nome

socket.on('entrega_concluida', (data) => {

  console.log(
    '✅ Entrega concluída:',
    data
  );

  finishDelivery(
    data?.freteId
  );
});

// ============================================================
// SOCKET - EVENTOS DE EMAIL
// ============================================================

socket.on('email_event', async (data) => {

  console.log(
    '📧 Evento email:',
    data
  );

  if (!data || !data.tipo) {
    return;
  }

  // ----------------------------------------------------------
  // FRETE NOVO
  // Cliente não precisa receber este email
  // ----------------------------------------------------------

  if (data.tipo === 'frete_novo') {
    return;
  }

  // ----------------------------------------------------------
  // FRETE ACEITO
  // ----------------------------------------------------------

  if (data.tipo === 'frete_aceito') {

    if (typeof enviarNotificacaoAceito !== 'function') {
      console.warn(
        '⚠️ enviarNotificacaoAceito não está disponível.'
      );

      return;
    }

    try {

      await enviarNotificacaoAceito(

        {
          origem:
            data.origin || data.origem || '',

          destino:
            data.destination || data.destino || '',

          preco:
            Number(data.price || data.preco || 0)
        },

        {
          nome:
            data.driverName ||
            data.motoristaNome ||
            'Motorista',

          veiculo:
            data.driverVehicle ||
            data.motoristaVeiculo ||
            '',

          telefone:
            data.driverPhone ||
            data.motoristaTelefone ||
            '',

          avaliacao:
            Number(
              data.driverRating ||
              data.motoristaAvaliacao ||
              5
            )
        },

        data.clienteEmail ||
        USER?.email,

        data.clienteNome ||
        USER?.nome ||
        USER?.name
      );

    } catch (error) {

      console.error(
        '❌ Erro enviar email aceite:',
        error
      );
    }
  }

  // ----------------------------------------------------------
  // ENTREGA CLIENTE
  // ----------------------------------------------------------

  if (data.tipo === 'entrega_cliente') {

    if (
      typeof enviarNotificacaoEntregaCliente !==
      'function'
    ) {
      console.warn(
        '⚠️ enviarNotificacaoEntregaCliente não está disponível.'
      );

      return;
    }

    try {

      await enviarNotificacaoEntregaCliente(

        {
          origem:
            data.origin || data.origem || '',

          destino:
            data.destination || data.destino || '',

          preco:
            Number(
              data.price ||
              data.preco ||
              0
            ),

          id:
            data.freteId || ''
        },

        {
          nome:
            data.driverName ||
            data.motoristaNome ||
            'Motorista'
        },

        data.clienteEmail ||
        USER?.email,

        data.clienteNome ||
        USER?.nome ||
        USER?.name
      );

    } catch (error) {

      console.error(
        '❌ Erro enviar email entrega:',
        error
      );
    }
  }
});

// ============================================================
// NAVEGAÇÃO
// ============================================================

function goView(view) {

  console.log(
    '📄 Ir para view:',
    view
  );

  document
    .querySelectorAll('.view')
    .forEach(el => {
      el.style.display = 'none';
    });

  document
    .querySelectorAll('.nav-tab')
    .forEach(el => {
      el.classList.remove('active');
    });

  const targetView =
    document.getElementById(
      `view-${view}`
    );

  if (targetView) {

    targetView.style.display = 'block';

    console.log(
      '✅ View exibida:',
      view
    );
  } else {

    console.warn(
      '⚠️ View não encontrada:',
      view
    );
  }

  const targetTab =
    document.getElementById(
      `tab-${view}`
    );

  if (targetTab) {
    targetTab.classList.add('active');
  }
}

// ============================================================
// NAV
// ============================================================

function renderNav() {

  if (!USER) {
    return;
  }

  const nome =
    USER.nome ||
    USER.name ||
    'Cliente';

  const f =
    nome.split(' ')[0];

  const avatar =
    document.getElementById('navAvatar');

  const navName =
    document.getElementById('navName');

  if (avatar) {
    avatar.textContent =
      f[0]?.toUpperCase() || 'C';
  }

  if (navName) {
    navName.textContent = f;
  }
}

// ============================================================
// HOME
// ============================================================

function renderHome() {

  if (!USER) {
    return;
  }

  const nome =
    USER.nome ||
    USER.name ||
    'Cliente';

  const f =
    nome.split(' ')[0];

  const h =
    new Date().getHours();

  const s =
    h < 12
      ? 'Bom dia'
      : h < 18
        ? 'Boa tarde'
        : 'Boa noite';

  const greeting =
    document.getElementById(
      'homeGreeting'
    );

  if (greeting) {
    greeting.textContent =
      `${s}, ${f}! 👋`;
  }

  const done =
    PEDIDOS.filter(
      p => p.status === 'entregue'
    );

  const act =
    PEDIDOS.filter(
      p =>
        p.status === 'aceito' ||
        p.status === 'em_andamento'
    );

  const gasto =
    done.reduce(
      (a, p) =>
        a + (Number(p.precoTotal) || 0),
      0
    );

  const total =
    document.getElementById('stTotal');

  const entregues =
    document.getElementById('stEntregues');

  const ativos =
    document.getElementById('stAtivos');

  const stGasto =
    document.getElementById('stGasto');

  if (total) {
    total.textContent =
      PEDIDOS.length;
  }

  if (entregues) {
    entregues.textContent =
      done.length;
  }

  if (ativos) {
    ativos.textContent =
      act.length;
  }

  if (stGasto) {
    stGasto.textContent =
      gasto.toFixed(0) + '€';
  }

  const el =
    document.getElementById(
      'recentList'
    );

  if (!el) {
    return;
  }

  const last =
    PEDIDOS.slice(0, 4);

  if (!last.length) {

    el.innerHTML = `
      <div class="empty-state">
        <div class="ico">📭</div>
        <p>
          Nenhum pedido ainda.<br>
          Cria o teu primeiro frete!
        </p>
      </div>
    `;

    return;
  }

  el.innerHTML =
    last.map(
      p => orderCardHtml(p)
    ).join('');
}

// ============================================================
// CARREGAR FRETES
// ============================================================

function carregarFretes() {

  if (!USER?.email) {
    PEDIDOS = [];
    return;
  }

  const chave =
    'pedidos_' + USER.email;

  const fretes =
    localStorage.getItem(chave);

  try {

    PEDIDOS =
      fretes
        ? JSON.parse(fretes)
        : [];

  } catch (error) {

    console.error(
      '❌ Erro carregar pedidos:',
      error
    );

    PEDIDOS = [];
  }

  /*
   * Recuperar motorista do último frete ativo
   */

  const ativo =
    PEDIDOS.find(
      p =>
        p.status === 'aceito' ||
        p.status === 'em_andamento'
    );

  if (ativo?.motorista) {

    MOTORISTA_ATUAL =
      ativo.motorista;

    PED.motorista =
      ativo.motorista;

    PED.freteId =
      ativo.id;
  }
}

// ============================================================
// GUARDAR FRETES
// ============================================================

function savePedidos() {

  if (!USER?.email) {
    return;
  }

  localStorage.setItem(
    'pedidos_' + USER.email,
    JSON.stringify(PEDIDOS)
  );
}

// ============================================================
// CARD PEDIDO
// ============================================================

function orderCardHtml(p) {

  const vn = {
    moto: 'Moto',
    van: 'Van',
    caminhao: 'Caminhão',
    caminhao_grande: 'Caminhão Grande'
  }[p.veiculo] || p.veiculo || '';

  const isAct =
    p.status === 'aceito' ||
    p.status === 'em_andamento';

  const preco =
    Number(p.precoTotal) || 0;

  const verButton =
    isAct
      ? `
        <button
          class="btn-track"
          onclick="goView('acompanhar')"
        >
          🗺️ Ver
        </button>
      `
      : '';

  return `
    <div class="order-card">

      <div class="order-top">

        <div>

          <div class="order-id">
            ${escapeHtml(p.id || '')}
          </div>

          <div class="order-date">
            ${escapeHtml(p.data || '')}
            ${
              p.agendado
                ? ' · 📅 ' +
                  escapeHtml(p.agendado)
                : ''
            }
          </div>

        </div>

        <span
          class="status-pill s-${escapeHtml(
            p.status || ''
          )}"
        >
          ${escapeHtml(
            statusLabel(p.status)
          )}
        </span>

      </div>

      <div class="order-route">

        <div class="route-icons">

          <div class="dot-g"></div>

          <div class="route-line"></div>

          <div class="dot-o"></div>

        </div>

        <div class="route-addrs">

          <div class="route-addr">

            ${escapeHtml(
              p.origem || ''
            )}

            <small>
              ${escapeHtml(
                p.origemApt || ''
              )}
            </small>

          </div>

          <div class="route-addr">

            ${escapeHtml(
              p.destino || ''
            )}

            <small>
              ${escapeHtml(
                p.destinoApt || ''
              )}
            </small>

          </div>

        </div>

      </div>

      <div class="order-foot">

        <span class="order-price">
          ${preco.toFixed(2)}€
        </span>

        <span class="order-veh">
          ${escapeHtml(vn)}
        </span>

        ${verButton}

      </div>

    </div>
  `;
}

// ============================================================
// STATUS
// ============================================================

function statusLabel(s) {

  return {
    pendente: 'Pendente',
    aceito: 'Aceite',
    em_andamento: 'Em curso',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
    agendado: 'Agendado'
  }[s] || s || '';
}

// ============================================================
// CRIAR FRETE
// ============================================================

async function submitPedido() {

  if (
    typeof validatePayment === 'function' &&
    !validatePayment()
  ) {
    return;
  }

  if (!USER?.id) {

    toast(
      '❌ Cliente não identificado.',
      'error'
    );

    return;
  }

  const origemInput = document.getElementById('origemInput');
  const destinoInput = document.getElementById('destinoInput');
  const origemTexto = origemInput?.value.trim() || PED.origem?.trim() || '';
  const destinoTexto = destinoInput?.value.trim() || PED.destino?.trim() || '';

  if (!origemTexto) {
    toast('⚠️ Informe a origem.', 'error');
    return;
  }

  if (!destinoTexto) {
    toast('⚠️ Informe o destino.', 'error');
    return;
  }

  if (origemTexto !== PED.origem || PED.origemLat == null || PED.origemLon == null) {
    if (!(await resolveAddress('origemInput', 'origemDrop', false))) return;
  }

  if (destinoTexto !== PED.destino || PED.destLat == null || PED.destLon == null) {
    if (!(await resolveAddress('destinoInput', 'destinoDrop', true))) return;
  }

  await calcDistance();

  if (!PED.item) {

    toast(
      '⚠️ Selecione o tipo de carga.',
      'error'
    );

    return;
  }

  const btn =
    document.getElementById(
      'btnSubmit'
    );

  if (btn) {

    btn.textContent =
      '⏳ A enviar…';

    btn.disabled = true;
  }

  const freteId =
    'FR-' + Date.now();

  PED.freteId =
    freteId;

  const freteData = {

    freteId,

    clienteId:
      USER.id,

    clienteNome:
      USER.nome ||
      USER.name ||
      'Cliente',

    clienteEmail:
      USER.email,

    origem:
      PED.origem,

    destino:
      PED.destino,

    origemLat: Number(PED.origemLat),
    origemLon: Number(PED.origemLon),
    destLat: Number(PED.destLat),
    destLon: Number(PED.destLon),

    origemApt:
      PED.origemApt,

    destinoApt:
      PED.destinoApt,

    item:
      PED.item,

    veiculo:
      PED.veiculo,

    peso:
      Number(PED.peso) || 0,

    qtd:
      Number(PED.qtd) || 1,

    descricao:
      PED.descricao,

    photo:
      PED.photo,

    preco:
      Number(PED.precoTotal) || 0,

    dist:
      Number(PED.dist) || 0,

    schedule:
      PED.schedule || 'now',

    agendado:
      PED.schedule === 'later'
        ? `${PED.schDate} ${PED.schTime}`
        : null
  };

  const novoPedido = {

    id:
      freteId,

    status:
      'pendente',

    origem:
      PED.origem,

    destino:
      PED.destino,

    origemLat: Number(PED.origemLat),
    origemLon: Number(PED.origemLon),
    destLat: Number(PED.destLat),
    destLon: Number(PED.destLon),

    origemApt:
      PED.origemApt,

    destinoApt:
      PED.destinoApt,

    item:
      PED.item,

    veiculo:
      PED.veiculo,

    descricao:
      PED.descricao,

    precoTotal:
      Number(PED.precoTotal) || 0,

    dist:
      Number(PED.dist) || 0,

    motorista:
      null,

    data:
      new Date().toLocaleDateString(
        'pt-PT'
      ),

    agendado:
      PED.schedule === 'later'
        ? `${PED.schDate} ${PED.schTime}`
        : null,

    dataCriacao:
      new Date().toISOString()
  };

  /*
   * Evitar duplicação
   */

  PEDIDOS =
    PEDIDOS.filter(
      p => p.id !== freteId
    );

  PEDIDOS.unshift(
    novoPedido
  );

  savePedidos();
  renderHome();

  console.log(
    '📤 Enviando frete:',
    freteData
  );

  socket.emit(
    'frete_criar',
    freteData
  );
}

// ============================================================
// MOTORISTA ATUAL
// ============================================================

function atualizarCartaoMotorista(motorista) {
  const d = motorista || {};
  const nome = d.nome || 'Motorista';
  const veiculo = d.veiculo || 'Veículo não indicado';
  const avaliacao = d.avaliacao ?? d.rating ?? 5;
  const iniciais = nome.charAt(0).toUpperCase();

  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  set('fdIni', iniciais);
  set('fdName', nome);
  set('fdVeh', `🚚 ${veiculo}`);
  set('fdRating', `⭐ ${Number(avaliacao).toFixed(1)} · motorista FRETEX`);
  set('fdRat2', Number(avaliacao).toFixed(1));
  set('trkDrvIni', iniciais);
  set('trkDrvName', nome);
  set('trkDrvVeh', `🚚 ${veiculo}`);
  set('rateDriverName', nome.split(' ')[0]);
}

function atualizarInterfaceMotorista() {

  const motorista =
    MOTORISTA_ATUAL;

  if (!motorista) {
    return;
  }

  const name =
    document.getElementById(
      'chatDrvName'
    );

  const ini =
    document.getElementById(
      'chatDrvIni'
    );

  if (name) {
    name.textContent =
      motorista.nome ||
      'Motorista';
  }

  if (ini) {

    ini.textContent =
      (
        motorista.nome ||
        'M'
      )[0].toUpperCase();
  }

  const driverName =
    document.getElementById(
      'trkDrvName'
    );

  if (driverName) {

    driverName.textContent =
      motorista.nome ||
      'Motorista';
  }

  const vehicle =
    document.getElementById(
      'trkDrvVeh'
    );

  if (vehicle) {

    vehicle.textContent =
      motorista.veiculo ||
      '';
  }
}

// ============================================================
// TRAJETÓRIA + SIMULAÇÃO GPS
// ============================================================

function getTrackingCoords(frete) {
  const origem = {
    lat: Number(frete?.origemLat ?? PED.origemLat),
    lng: Number(frete?.origemLon ?? PED.origemLon)
  };
  const destino = {
    lat: Number(frete?.destLat ?? PED.destLat),
    lng: Number(frete?.destLon ?? PED.destLon)
  };
  if (![origem.lat, origem.lng, destino.lat, destino.lng].every(Number.isFinite)) return null;
  return { origem, destino };
}

async function initTrackingMap(frete) {
  if (typeof L === 'undefined') return;
  TRACK_ACTIVE_FRETE = frete;
  TRACK_REAL_MODE = false;
  TRACK_HISTORY = [];
  if (TRACK_RECALC_TIMER) { clearTimeout(TRACK_RECALC_TIMER); TRACK_RECALC_TIMER = null; }
  const coords = getTrackingCoords(frete);
  if (!coords) {
    toast('⚠️ Não foi possível obter as coordenadas da trajetória.', 'error');
    return;
  }

  if (MAP) { try { MAP.remove(); } catch (e) {} }
  MAP = L.map('liveMap', { zoomControl: true }).setView([coords.origem.lat, coords.origem.lng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(MAP);

  USER_MARKER = L.marker([coords.origem.lat, coords.origem.lng]).addTo(MAP).bindPopup('📍 Recolha');
  if (DEST_MARKER) { try { DEST_MARKER.remove(); } catch(e) {} }
  DEST_MARKER = L.marker([coords.destino.lat, coords.destino.lng]).addTo(MAP).bindPopup('🏁 Entrega');

  TRACK_ROUTE = buildInterpolatedRoute(coords.origem, coords.destino, 80);
  try {
    const routeRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords.origem.lng},${coords.origem.lat};${coords.destino.lng},${coords.destino.lat}?overview=full&geometries=geojson`, { headers: { 'Accept': 'application/json' } });
    if (routeRes.ok) {
      const routeData = await routeRes.json();
      const geometry = routeData?.routes?.[0]?.geometry?.coordinates;
      if (Array.isArray(geometry) && geometry.length > 1) {
        TRACK_ROUTE = geometry.map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      }
    }
  } catch (routeErr) {
    console.warn('⚠️ OSRM indisponível; usando trajetória simulada.', routeErr);
  }
  if (TRACK_ROUTE_LAYER) { try { TRACK_ROUTE_LAYER.remove(); } catch (e) {} }
  if (TRACK_HISTORY_LAYER) { try { TRACK_HISTORY_LAYER.remove(); } catch (e) {} }
  TRACK_HISTORY_LAYER = null;
  TRACK_ROUTE_LAYER = L.polyline(TRACK_ROUTE.map(p => [p.lat, p.lng]), {
    color: '#F57C20', weight: 5, opacity: .55, dashArray: '9 8'
  }).addTo(MAP);

  const start = TRACK_ROUTE[0];
  DRIVER_MARKER = L.marker([start.lat, start.lng], {
    icon: L.divIcon({ className: '', html: '<div class="driver-marker-ico">🚐</div>', iconSize:[40,40], iconAnchor:[20,20] })
  }).addTo(MAP).bindPopup('🚐 Motorista');

  const bounds = L.latLngBounds(TRACK_ROUTE.map(p => [p.lat, p.lng]));
  MAP.fitBounds(bounds, { padding: [30, 30] });
  setTimeout(() => MAP.invalidateSize(), 150);
  updateTrackingPhase(0);
  updateGpsBadge('real');
  requestTrackingRecovery();
}

function buildInterpolatedRoute(a, b, points = 80) {
  const route = [];
  for (let i = 0; i <= points; i++) {
    const t = i / points;
    // Pequena curva lateral para tornar a simulação visualmente semelhante a uma trajetória real.
    const curve = Math.sin(t * Math.PI) * 0.0015;
    route.push({ lat: a.lat + (b.lat - a.lat) * t + curve, lng: a.lng + (b.lng - a.lng) * t - curve * .7 });
  }
  return route;
}

function fitTrackingRoute() {
  if (!MAP || !TRACK_ROUTE.length) return;
  MAP.fitBounds(L.latLngBounds(TRACK_ROUTE.map(p => [p.lat, p.lng])), { padding: [30, 30] });
}

function updateTrackingPhase(progress) {
  const phase = progress < .22 ? 0 : progress < .55 ? 1 : progress < .86 ? 2 : 3;
  const titles = ['Motorista a caminho da recolha', 'Motorista a caminho da recolha', 'Carga recolhida — a caminho da entrega', 'Entrega em aproximação'];
  const subs = ['A deslocar-se até ao ponto de recolha', 'A deslocar-se até ao ponto de recolha', 'A caminho do destino', 'Quase a chegar ao destino'];
  const phaseEl = document.getElementById('trkPhase');
  const subEl = document.getElementById('trkPhaseSub');
  if (phaseEl) phaseEl.textContent = titles[phase];
  if (subEl) subEl.textContent = subs[phase];
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById('tp' + i);
    if (!el) continue;
    el.classList.toggle('done', i < phase || (phase === 3 && i <= 3));
    el.classList.toggle('active', i === phase && phase < 3);
  }
  [1,2,3].forEach(i => {
    const line = document.getElementById('tpl' + i);
    if (line) line.classList.toggle('done', i <= phase);
  });
}

function stopGpsSimulation() {
  if (GPS_SIM) clearInterval(GPS_SIM);
  GPS_SIM = null;
  document.body.classList.remove('gps-simulated');
  const btn = document.getElementById('btnSimGps');
  if (btn) btn.textContent = '▶ Simular GPS';
}

function toggleGpsSimulation() {
  if (GPS_SIM) { stopGpsSimulation(); return; }
  if (!TRACK_ROUTE.length || !DRIVER_MARKER) {
    const frete = PEDIDOS.find(p => p.status === 'aceito' || p.status === 'em_andamento');
    if (frete) initTrackingMap(frete);
  }
  if (!TRACK_ROUTE.length || !DRIVER_MARKER) {
    toast('⚠️ Abra um frete ativo com coordenadas para iniciar a simulação.', 'error');
    return;
  }
  GPS_SIM_INDEX = 0;
  TRACK_REAL_MODE = false;
  TRACK_HISTORY = [];
  if (TRACK_HISTORY_LAYER) { try { TRACK_HISTORY_LAYER.remove(); } catch(e) {} TRACK_HISTORY_LAYER = null; }
  document.body.classList.add('gps-simulated');
  updateGpsBadge('simulation');
  const btn = document.getElementById('btnSimGps');
  if (btn) btn.textContent = '■ Parar simulação';
  toast('📍 Simulação GPS iniciada — trajetória em movimento.', 'info');
  GPS_SIM = setInterval(() => {
    if (GPS_SIM_INDEX >= TRACK_ROUTE.length - 1) {
      stopGpsSimulation();
      updateTrackingPhase(1);
      if (DRIVER_MARKER) DRIVER_MARKER.setLatLng(TRACK_ROUTE[TRACK_ROUTE.length - 1]);
      if (document.getElementById('trkEta')) document.getElementById('trkEta').textContent = '0 min';
      toast('🏁 Simulação chegou ao destino.', 'success');
      return;
    }
    const pos = TRACK_ROUTE[GPS_SIM_INDEX++];
    DRIVER_MARKER.setLatLng([pos.lat, pos.lng]);
    const progress = GPS_SIM_INDEX / (TRACK_ROUTE.length - 1);
    updateTrackingPhase(progress);
    const remaining = Math.max(0, Math.ceil((1 - progress) * 12));
    const eta = document.getElementById('trkEta');
    if (eta) eta.textContent = remaining + ' min';
    if (MAP && progress > .02) MAP.panTo([pos.lat, pos.lng], { animate: true, duration: .35 });
  }, 900);
}

// ============================================================
// START TRACKING
// ============================================================

function startTracking(freteExistente) {

  let frete =
    freteExistente;

  /*
   * Procurar frete atual
   */

  if (!frete) {

    frete =
      PEDIDOS.find(
        p =>
          p.status === 'aceito' ||
          p.status === 'em_andamento'
      );
  }

  if (!frete) {

    console.warn(
      '⚠️ Nenhum frete para acompanhar.'
    );

    return;
  }

  const d =
    MOTORISTA_ATUAL ||
    frete.motorista ||
    PED.motorista ||
    null;

  MOTORISTA_ATUAL =
    d;

  PED.motorista =
    d;

  PED.freteId =
    frete.id;
  TRACK_ACTIVE_FRETE = frete;

  frete.motorista =
    d;

  /*
   * Se for agendado
   */

  if (frete.agendado) {

    frete.status =
      'agendado';

    savePedidos();
    renderHome();

    showActiveBanner(frete);

    toast(
      `📅 Frete agendado para ${frete.agendado}!`,
      'success'
    );

    goView('home');

    return;
  }

  if (
    frete.status === 'pendente'
  ) {
    frete.status =
      'aceito';
  }

  savePedidos();
  renderHome();

  const tab =
    document.getElementById(
      'tab-acompanhar'
    );

  if (tab) {

    tab.style.display =
      'flex';

    tab.classList.add(
      'pulse'
    );
  }

  showActiveBanner(frete);
  initTrackingMap(frete);
  atualizarInterfaceMotorista();

  goView('acompanhar');

  toast(
    '🚗 Motorista a caminho!',
    'success'
  );
}

// ============================================================
// BANNER FRETE ATIVO
// ============================================================

function showActiveBanner(frete) {

  if (!frete) {
    return;
  }

  console.log(
    '📦 Frete ativo:',
    frete
  );

  const banner =
    document.getElementById(
      'activeBanner'
    );

  if (!banner) {
    return;
  }

  banner.style.display =
    'block';

  const id =
    banner.querySelector(
      '[data-frete-id]'
    );

  if (id) {
    id.textContent =
      frete.id || '';
  }
}

// ============================================================
// FINALIZAR ENTREGA
// ============================================================

function finishDelivery(freteId) {

  stopGpsSimulation();

  if (TRK_INT) {

    clearInterval(
      TRK_INT
    );

    TRK_INT = null;
  }

  TRACK_ACTIVE_FRETE = null;
  if (TRACK_RECALC_TIMER) { clearTimeout(TRACK_RECALC_TIMER); TRACK_RECALC_TIMER = null; }

  let frete = null;

  if (freteId) {

    frete =
      PEDIDOS.find(
        p =>
          String(p.id) ===
          String(freteId)
      );
  }

  if (!frete) {

    frete =
      PEDIDOS.find(
        p =>
          p.status === 'aceito' ||
          p.status === 'em_andamento'
      );
  }

  if (frete) {

    frete.status =
      'entregue';

    if (frete.motorista) {

      MOTORISTA_ATUAL =
        frete.motorista;
    }

    savePedidos();
  }

  const tab =
    document.getElementById(
      'tab-acompanhar'
    );

  if (tab) {
    tab.classList.remove(
      'pulse'
    );
  }

  renderHome();

  toast(
    '✅ Entregue com sucesso!',
    'success'
  );

  setTimeout(() => {

    const name =
      document.getElementById(
        'rateDriverName'
      );

    if (name) {

      name.textContent =
        MOTORISTA_ATUAL
          ?.nome
          ?.split(' ')[0] ||
        'o motorista';
    }

    if (
      typeof setRating ===
      'function'
    ) {
      setRating(5);
    }

    const overlay =
      document.getElementById(
        'ratingOverlay'
      );

    if (overlay) {
      overlay.classList.add(
        'open'
      );
    }

  }, 1500);
}

// ============================================================
// CHAT
// ============================================================

function openChat() {

  const motorista =
    MOTORISTA_ATUAL;

  if (!motorista) {

    toast(
      '⚠️ Ainda não há motorista associado.',
      'info'
    );

    return;
  }

  const ini =
    document.getElementById(
      'chatDrvIni'
    );

  const name =
    document.getElementById(
      'chatDrvName'
    );

  if (ini) {

    ini.textContent =
      (
        motorista.nome ||
        'M'
      )[0].toUpperCase();
  }

  if (name) {

    name.textContent =
      motorista.nome ||
      'Motorista';
  }

  const overlay =
    document.getElementById(
      'chatOverlay'
    );

  if (overlay) {
    overlay.classList.add(
      'open'
    );
  }

  setTimeout(() => {

    const input =
      document.getElementById(
        'chatInput'
      );

    if (input) {
      input.focus();
    }

  }, 300);
}

// ============================================================
// FECHAR CHAT
// ============================================================

function closeChat() {

  const overlay =
    document.getElementById(
      'chatOverlay'
    );

  if (overlay) {

    overlay.classList.remove(
      'open'
    );
  }
}

// ============================================================
// ENVIAR MENSAGEM
// ============================================================

function sendMsg() {

  const inp =
    document.getElementById(
      'chatInput'
    );

  if (!inp) {
    return;
  }

  const txt =
    inp.value.trim();

  if (!txt) {
    return;
  }

  /*
   * Encontrar frete ativo
   */

  const freteAtiva =
    PEDIDOS.find(
      p =>
        p.status === 'aceito' ||
        p.status === 'em_andamento'
    );

  if (!freteAtiva) {

    toast(
      '⚠️ Não existe um frete ativo.',
      'error'
    );

    return;
  }

  if (!MOTORISTA_ATUAL) {

    toast(
      '⚠️ Motorista ainda não disponível.',
      'error'
    );

    return;
  }

  /*
   * Mostrar imediatamente na interface
   */

  addMsg(
    'mine',
    txt,
    nowTime()
  );

  inp.value = '';

  /*
   * IMPORTANTE:
   * enviar para o server.js
   */

  const mensagem = {

    freteId:
      freteAtiva.id,

    remetenteId:
      USER.id,

    senderId:
      USER.id,

    remetenteNome:
      USER.nome ||
      USER.name ||
      'Cliente',

    destinatarioId:
      MOTORISTA_ATUAL.id,

    texto:
      txt,

    conteudo:
      txt
  };

  console.log(
    '📤 Enviando mensagem:',
    mensagem
  );

  socket.emit(
    'mensagem_enviar',
    mensagem
  );
}

// ============================================================
// ENTER NO CHAT
// ============================================================

function chatKeyDown(event) {

  if (event.key === 'Enter') {

    event.preventDefault();

    sendMsg();
  }
}

// ============================================================
// ADICIONAR MENSAGEM
// ============================================================

function addMsg(
  who,
  text,
  time
) {

  const msgs =
    document.getElementById(
      'chatMsgs'
    );

  if (!msgs) {
    return;
  }

  const div =
    document.createElement(
      'div'
    );

  div.className =
    'msg ' + who;

  const ini =
    who === 'theirs'
      ? (
          MOTORISTA_ATUAL
            ?.nome?.[0] ||
          'M'
        ).toUpperCase()
      : (
          USER
            ?.nome?.[0] ||
          USER
            ?.name?.[0] ||
          'U'
        ).toUpperCase();

  /*
   * Não usar innerHTML com texto vindo
   * do utilizador.
   */

  const ava =
    document.createElement(
      'div'
    );

  ava.className =
    'msg-ava';

  ava.style.cssText =
    `
      width:26px;
      height:26px;
      color:#fff;
      border-radius:50%;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:10px;
      font-weight:700;
      flex-shrink:0;
      background:${
        who === 'theirs'
          ? 'var(--blue)'
          : 'var(--orange)'
      };
    `;

  ava.textContent =
    ini;

  const content =
    document.createElement(
      'div'
    );

  const bubble =
    document.createElement(
      'div'
    );

  bubble.className =
    'msg-bubble';

  bubble.textContent =
    text;

  const timeEl =
    document.createElement(
      'div'
    );

  timeEl.className =
    'msg-time';

  timeEl.textContent =
    time || nowTime();

  content.appendChild(
    bubble
  );

  content.appendChild(
    timeEl
  );

  if (who === 'theirs') {

    div.appendChild(
      ava
    );

    div.appendChild(
      content
    );

  } else {

    div.appendChild(
      content
    );

    div.appendChild(
      ava
    );
  }

  msgs.appendChild(
    div
  );

  msgs.scrollTop =
    msgs.scrollHeight;
}

// ============================================================
// HORA
// ============================================================

function nowTime() {

  const d =
    new Date();

  return (
    d.getHours()
      .toString()
      .padStart(2, '0') +
    ':' +
    d.getMinutes()
      .toString()
      .padStart(2, '0')
  );
}

// ============================================================
// FORMATA TIMESTAMP
// ============================================================

function formatMessageTime(timestamp) {

  if (!timestamp) {
    return nowTime();
  }

  const d =
    new Date(timestamp);

  if (
    Number.isNaN(
      d.getTime()
    )
  ) {
    return nowTime();
  }

  return (
    d.getHours()
      .toString()
      .padStart(2, '0') +
    ':' +
    d.getMinutes()
      .toString()
      .padStart(2, '0')
  );
}

// ============================================================
// GEOLOCALIZAÇÃO
// ============================================================

function getGeo() {

  console.log(
    '📍 Obtendo localização...'
  );

  if (
    !('geolocation' in navigator)
  ) {

    alert(
      '❌ Geolocalização não suportada.'
    );

    return;
  }

  navigator.geolocation.getCurrentPosition(

    async position => {

      const {
        latitude,
        longitude
      } = position.coords;

      console.log(
        `✅ Localização: ${latitude}, ${longitude}`
      );

      try {

        const response =
          await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
            {
              headers: {
                'Accept-Language':
                  'pt-PT'
              }
            }
          );

        if (!response.ok) {
          throw new Error(
            'Erro HTTP ' +
            response.status
          );
        }

        const data =
          await response.json();

        const cidade =
          data.address?.city ||
          data.address?.town ||
          data.address?.village ||
          'Localização';

        const codigoPostal =
          data.address?.postcode ||
          '';

        const endereco =
          data.display_name ||
          `${cidade} ${codigoPostal}`;

        PED.origem =
          endereco;
        PED.origemLat = Number(latitude);
        PED.origemLon = Number(longitude);

        const origemField =
          document.querySelector(
            'input[placeholder*="3º Dto"], input[placeholder*="Origem"]'
          );

        if (origemField) {

          origemField.value =
            endereco;
        }

        console.log(
          '📍 Origem:',
          PED.origem,
          PED.origemLat,
          PED.origemLon
        );

        const geoOk = document.getElementById('geoOk');
        if (geoOk) geoOk.classList.add('show');
        if (PED.destino && PED.destLat != null && PED.destLon != null) {
          await calcDistance();
        }

        alert(
          `📍 Localização:\n${cidade}\n${codigoPostal}`
        );

      } catch (err) {

        console.error(
          '❌ Erro reverse geocoding:',
          err
        );

        alert(
          `📍 Coordenadas:\n${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
        );
      }
    },

    error => {

      console.error(
        '❌ Erro GPS:',
        error
      );

      alert(
        '❌ Erro ao obter localização. Ative o GPS e permita o acesso à localização.'
      );
    },

    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    }
  );
}

// ============================================================
// AGENDA
// ============================================================

function setSchedule(type) {

  console.log(
    '📅 Agenda:',
    type
  );

  PED.schedule =
    type;

  const scheduleFields =
    document.getElementById(
      'scheduleFields'
    );

  if (scheduleFields) {

    scheduleFields.style.display =
      type === 'later'
        ? 'block'
        : 'none';
  }

  document
    .querySelectorAll('.sch-btn')
    .forEach(btn => {
      btn.classList.remove(
        'active'
      );
    });

  if (type === 'now') {

    document
      .getElementById(
        'sch-now'
      )
      ?.classList.add(
        'active'
      );

  } else {

    document
      .getElementById(
        'sch-later'
      )
      ?.classList.add(
        'active'
      );

    const date =
      document.getElementById(
        'schDate'
      );

    const time =
      document.getElementById(
        'schTime'
      );

    PED.schDate =
      date?.value || '';

    PED.schTime =
      time?.value || '';
  }
}

// ============================================================
// WIZARD
// ============================================================

async function nextStep(step) {

  console.log('👣 Ir para passo:', step);

  if (step === 2) {
    const origemInput = document.getElementById('origemInput');
    const destinoInput = document.getElementById('destinoInput');

    const origemTexto = origemInput?.value.trim() || PED.origem?.trim() || '';
    const destinoTexto = destinoInput?.value.trim() || PED.destino?.trim() || '';

    if (!origemTexto) {
      toast('⚠️ Informe a origem.', 'error');
      return;
    }
    if (!destinoTexto) {
      toast('⚠️ Informe o destino.', 'error');
      return;
    }

    if (origemTexto !== PED.origem || PED.origemLat == null || PED.origemLon == null) {
      const okOrigem = await resolveAddress('origemInput', 'origemDrop', false);
      if (!okOrigem) return;
    }

    if (destinoTexto !== PED.destino || PED.destLat == null || PED.destLon == null) {
      const okDestino = await resolveAddress('destinoInput', 'destinoDrop', true);
      if (!okDestino) return;
    }

    await calcDistance();
  }

  document.querySelectorAll('.step-card').forEach(el => {
    el.style.display = 'none';
  });

  document.querySelectorAll('.wp-step').forEach(el => {
    el.classList.remove('current');
    el.classList.remove('done');
  });

  const stepCard = document.getElementById(`step${step}`);
  const wpStep = document.getElementById(`wps${step}`);

  if (stepCard) {
    stepCard.style.display = 'block';
    window.scrollTo(0, 0);
  }

  if (wpStep) {
    wpStep.classList.add('current');
    for (let i = 1; i < step; i++) {
      document.getElementById(`wps${i}`)?.classList.add('done');
    }
  }
}

// ============================================================
// SUGERIR VEÍCULO
// ============================================================

function suggestVehicle(item) {
  // Recomendação original do FRETEX:
  // item -> veículo mais adequado.
  const suggestions = {
    caixas: {
      value: 'van',
      title: 'Van recomendada',
      sub: 'Ideal para caixas e cargas até 500 kg',
      icon: '🚐'
    },
    sofa: {
      value: 'van',
      title: 'Van recomendada',
      sub: 'Ideal para sofás e móveis volumosos',
      icon: '🚐'
    },
    frigorifico: {
      value: 'van',
      title: 'Van recomendada',
      sub: 'Espaço adequado para eletrodomésticos grandes',
      icon: '🚐'
    },
    cama: {
      value: 'van',
      title: 'Van recomendada',
      sub: 'Boa opção para camas e móveis',
      icon: '🚐'
    },
    mota: {
      value: 'caminhao',
      title: 'Caminhão recomendado',
      sub: 'Mais seguro para transportar uma mota',
      icon: '🚚'
    },
    mudanca: {
      value: 'caminhao_grande',
      title: 'Caminhão grande recomendado',
      sub: 'Recomendado para mudanças e cargas volumosas',
      icon: '🚛'
    },
    eletro: {
      value: 'moto',
      title: 'Moto recomendada',
      sub: 'Ideal para pequenos eletrónicos e cargas leves',
      icon: '🏍️'
    },
    obra: {
      value: 'caminhao',
      title: 'Caminhão recomendado',
      sub: 'Adequado para materiais de obra',
      icon: '🚚'
    },
    outro: {
      value: 'van',
      title: 'Van recomendada',
      sub: 'Opção equilibrada para este tipo de carga',
      icon: '🚐'
    }
  };

  const suggestion = suggestions[item] || suggestions.outro;
  const select = document.getElementById('veiculoSelect');
  const suggestBox = document.getElementById('vehSuggest');
  const icon = document.getElementById('vsIco');
  const title = document.getElementById('vsTitle');
  const sub = document.getElementById('vsSub');

  // Guardar a recomendação no pedido.
  PED.veiculo = suggestion.value;

  // Atualizar o seletor visível.
  if (select) {
    select.value = suggestion.value;
  }

  // Mostrar o cartão de recomendação.
  if (suggestBox) {
    suggestBox.classList.add('show');
  }

  if (icon) {
    icon.textContent = suggestion.icon;
  }

  if (title) {
    title.innerHTML =
      `${suggestion.title} <span class="badge-ideal">✓ IDEAL</span>`;
  }

  if (sub) {
    sub.textContent = suggestion.sub;
  }

  // Atualizar resumo, caso o passo 3 já esteja visível.
  const resumo = document.getElementById('sumVeiculo');
  if (resumo && select) {
    resumo.textContent =
      select.options[select.selectedIndex]?.text || suggestion.title;
  }

  console.log(
    '🚗 Veículo recomendado para',
    item,
    ':',
    suggestion.value
  );
}

// Permitir que o cliente altere manualmente o veículo recomendado.
function onVehicleChanged() {
  const select = document.getElementById('veiculoSelect');
  if (!select) return;

  PED.veiculo = select.value;

  const resumo = document.getElementById('sumVeiculo');
  if (resumo) {
    resumo.textContent =
      select.options[select.selectedIndex]?.text || select.value;
  }
}

// ============================================================
// SELECIONAR ITEM
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const vehicleSelect = document.getElementById('veiculoSelect');
  if (vehicleSelect) {
    vehicleSelect.addEventListener('change', onVehicleChanged);
  }
});

function selectItem(
  item,
  element
) {

  console.log(
    '📦 Item:',
    item
  );

  document
    .querySelectorAll(
      '.item-card'
    )
    .forEach(card => {

      card.classList.remove(
        'selected'
      );
    });

  if (element) {

    element.classList.add(
      'selected'
    );
  }

  PED.item =
    item;

  suggestVehicle(
    item
  );
}

// ============================================================
// PESQUISA DE ENDEREÇOS / DESTINO
// ============================================================

async function resolveAddress(inputId, dropId, isDestino = false) {
  const input = document.getElementById(inputId);
  const drop = document.getElementById(dropId);
  const query = input?.value.trim() || '';

  if (query.length < 2) {
    toast('⚠️ Introduza um endereço válido.', 'error');
    return false;
  }

  if (drop) {
    drop.classList.add('open');
    drop.innerHTML = '<div class="ac-spinner">🔎 A pesquisar endereço…</div>';
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Portugal')}&format=json&limit=5&addressdetails=1`,
      { headers: { 'Accept-Language': 'pt-PT' } }
    );
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const results = await response.json();

    if (!results.length) {
      if (drop) drop.innerHTML = '<div class="ac-spinner">Nenhum endereço encontrado.</div>';
      toast(`⚠️ Não encontrei "${query}".`, 'error');
      return false;
    }

    const result = results[0];
    const full = result.display_name || query;
    const lat = Number(result.lat);
    const lon = Number(result.lon);

    if (input) input.value = full;
    if (drop) {
      drop.innerHTML = '';
      drop.classList.remove('open');
    }

    if (isDestino) {
      PED.destino = full;
      PED.destLat = lat;
      PED.destLon = lon;
    } else {
      PED.origem = full;
      PED.origemLat = lat;
      PED.origemLon = lon;
    }

    if (isDestino) await calcDistance();
    return true;
  } catch (err) {
    console.error('❌ Erro na pesquisa de endereço:', err);
    if (drop) drop.innerHTML = '<div class="ac-spinner">Erro ao pesquisar. Tente novamente.</div>';
    toast('⚠️ Erro ao pesquisar o endereço.', 'error');
    return false;
  }
}

async function searchAddress(inputId, dropId) {
  const isDestino = inputId === 'destinoInput';
  return resolveAddress(inputId, dropId, isDestino);
}

// ============================================================
// AUTOCOMPLETE
// ============================================================

async function acSearch(
  input,
  dropId
) {

  if (!input) {
    return;
  }

  const query =
    input.value.trim();

  const drop =
    document.getElementById(
      dropId
    );

  if (!drop) {
    return;
  }

  if (
    !query ||
    query.length < 2
  ) {

    drop.innerHTML = '';
    drop.classList.remove('open');

    return;
  }

  drop.classList.add('open');
  drop.innerHTML = '<div class="ac-spinner">🔎 A pesquisar…</div>';

  console.log(
    '🔍 Procurando:',
    query
  );

  try {

    const response =
      await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Portugal')}&format=json&limit=10&addressdetails=1`,
        {
          headers: {
            'Accept-Language':
              'pt-PT'
          }
        }
      );

    if (!response.ok) {
      throw new Error(
        'HTTP ' +
        response.status
      );
    }

    const resultados =
      await response.json();

    if (!resultados.length) {

      drop.innerHTML = `
        <div
          style="
            padding:10px;
            color:var(--muted);
            font-size:12px;
          "
        >
          Sem resultados
        </div>
      `;

      return;
    }

    drop.innerHTML = '';
    drop.classList.add('open');

    resultados.forEach(
      res => {

        const nome =
          res.display_name
            .split(',')[0];

        const div =
          document.createElement(
            'div'
          );

        div.style.cssText =
          `
            padding:12px;
            cursor:pointer;
            border-bottom:1px solid var(--border);
            font-size:13px;
          `;

        const titulo =
          document.createElement(
            'div'
          );

        titulo.style.fontWeight =
          '600';

        titulo.textContent =
          '📍 ' + nome;

        const detalhe =
          document.createElement(
            'div'
          );

        detalhe.style.cssText =
          `
            font-size:11px;
            color:var(--muted);
          `;

        detalhe.textContent =
          res.display_name;

        div.appendChild(
          titulo
        );

        div.appendChild(
          detalhe
        );

        div.addEventListener(
          'click',
          async () => {
            if (input.id === 'origemInput') {
              selectAc(null, 'origemInput', dropId, res.lat, res.lon, res.display_name);
            } else {
              await selectDestino(res.display_name, res.lat, res.lon);
            }
          }
        );

        drop.appendChild(
          div
        );
      }
    );

  } catch (err) {

    console.error(
      '❌ Erro procurar endereço:',
      err
    );

    drop.innerHTML = `
      <div
        style="
          padding:10px;
          color:red;
          font-size:12px;
        "
      >
        Erro ao procurar
      </div>
    `;
  }
}

// ============================================================
// SELECIONAR DESTINO
// ============================================================

async function selectDestino(local, lat, lon) {
  console.log('📍 Destino selecionado:', local);

  const input = document.getElementById('destinoInput');
  const drop = document.getElementById('destinoDrop');

  if (input) input.value = local || '';
  if (drop) {
    drop.innerHTML = '';
    drop.classList.remove('open');
  }

  PED.destino = String(local || '').trim();
  PED.destLat = Number(lat);
  PED.destLon = Number(lon);

  if (!Number.isFinite(PED.destLat) || !Number.isFinite(PED.destLon)) {
    return false;
  }

  await calcDistance();
  return true;
}

// ============================================================
// CALCULAR DISTÂNCIA
// ============================================================

async function calcDistance() {
  if (!PED.origem || !PED.destino) {
    console.warn('⚠️ Origem ou destino ausentes.');
    return false;
  }

  try {
    let oriLat = Number(PED.origemLat);
    let oriLon = Number(PED.origemLon);

    if (!Number.isFinite(oriLat) || !Number.isFinite(oriLon)) {
      const origemRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(PED.origem + ', Portugal')}&format=json&limit=1&addressdetails=1`,
        { headers: { 'Accept-Language': 'pt-PT' } }
      );
      if (!origemRes.ok) throw new Error('HTTP ' + origemRes.status);
      const origemData = await origemRes.json();
      if (!origemData[0]) {
        toast('⚠️ Não foi possível localizar a origem.', 'error');
        return false;
      }
      oriLat = Number(origemData[0].lat);
      oriLon = Number(origemData[0].lon);
      PED.origemLat = oriLat;
      PED.origemLon = oriLon;
    }

    const destLat = Number(PED.destLat);
    const destLon = Number(PED.destLon);

    if (!Number.isFinite(destLat) || !Number.isFinite(destLon)) {
      toast('⚠️ Pesquise e selecione um destino válido.', 'error');
      return false;
    }

    const distance = haversine(
      { lat: oriLat, lon: oriLon },
      { lat: destLat, lon: destLon }
    );
    PED.dist = Number(distance.toFixed(1));

    try {
      const routeRes = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${oriLon},${oriLat};${destLon},${destLat}?overview=false`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (routeRes.ok) {
        const routeData = await routeRes.json();
        const meters = Number(routeData?.routes?.[0]?.distance);
        if (Number.isFinite(meters) && meters > 0) {
          PED.dist = Number((meters / 1000).toFixed(1));
        }
      }
    } catch (routeErr) {
      console.warn('⚠️ Rota OSRM indisponível; usando distância estimada.', routeErr);
    }

    console.log(`📍 Distância: ${PED.dist} km`);
    calcPrice();
    renderMiniMap(false);
    return true;
  } catch (err) {
    console.error('❌ Erro calcular distância:', err);
    toast('⚠️ Não foi possível calcular a distância.', 'error');
    return false;
  }
}

// ============================================================
// CÁLCULO DE PREÇO
// ============================================================

function calcPrice() {
  const distancia = Number(PED.dist) || 0;
  const base = Number(t.b) || 0;
  const kmRate = Number(t.k) || 0;

  const tarifaBase = base;
  const valorDistancia = distancia * kmRate;
  const subtotal = Math.max(tarifaBase + valorDistancia, Number(t.m) || 0);

  const extrasFixos =
    (PED.extras.ajudante ? 20 : 0) +
    (PED.extras.escadas ? 15 : 0) +
    (PED.extras.seguro ? 8 : 0);

  const urgenteValor = PED.extras.urgente ? subtotal * 0.50 : 0;
  const preco = subtotal + urgenteValor + extrasFixos;

  PED.precoTotal = Number(preco.toFixed(2));

  const prBase = document.getElementById('prBase');
  const prDist = document.getElementById('prDist');
  const prKm = document.getElementById('prKm');
  const prExRow = document.getElementById('prExRow');
  const prExtra = document.getElementById('prExtra');
  const prUrRow = document.getElementById('prUrRow');
  const prUr = document.getElementById('prUr');
  const prTotal = document.getElementById('prTotal');

  if (prBase) prBase.textContent = `${tarifaBase.toFixed(2)}€`;
  if (prDist) prDist.textContent = distancia > 0 ? distancia.toFixed(1) : '?';
  if (prKm) prKm.textContent = `${valorDistancia.toFixed(2)}€`;

  if (prExRow && prExtra) {
    prExRow.style.display = extrasFixos > 0 ? 'flex' : 'none';
    prExtra.textContent = `+${extrasFixos.toFixed(2)}€`;
  }

  if (prUrRow && prUr) {
    prUrRow.style.display = urgenteValor > 0 ? 'flex' : 'none';
    prUr.textContent = `+${urgenteValor.toFixed(2)}€`;
  }

  if (prTotal) prTotal.textContent = `${PED.precoTotal.toFixed(2)}€`;

  const totalPrice = document.getElementById('totalPrice');
  if (totalPrice) totalPrice.textContent = `${PED.precoTotal.toFixed(2)}€`;

  console.log('💰 Preço:', PED.precoTotal);
  return PED.precoTotal;
}

// ============================================================
// MOTORISTA ENCONTRADO
// ============================================================

function showDriverFound(
  freteId
) {

  console.log(
    '🎉 Motorista encontrado:',
    freteId
  );

  if (MOTORISTA_ATUAL) {

    console.log(
      '👤',
      MOTORISTA_ATUAL.nome
    );

    console.log(
      '📱',
      MOTORISTA_ATUAL.telefone
    );

    console.log(
      '🚗',
      MOTORISTA_ATUAL.veiculo
    );
  }
}

// ============================================================
// Haversine
// ============================================================

function haversine(
  p1,
  p2
) {

  const R =
    6371;

  const dLat =
    (
      p2.lat -
      p1.lat
    ) *
    Math.PI /
    180;

  const dLon =
    (
      p2.lng -
      p1.lng
    ) *
    Math.PI /
    180;

  const a =
    Math.sin(dLat / 2) ** 2 +

    Math.cos(
      p1.lat *
      Math.PI /
      180
    ) *

    Math.cos(
      p2.lat *
      Math.PI /
      180
    ) *

    Math.sin(dLon / 2) ** 2;

  return (
    R *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}

// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(value) {

  return String(
    value ?? ''
  )
    .replaceAll(
      '&',
      '&amp;'
    )
    .replaceAll(
      '<',
      '&lt;'
    )
    .replaceAll(
      '>',
      '&gt;'
    )
    .replaceAll(
      '"',
      '&quot;'
    )
    .replaceAll(
      "'",
      '&#039;'
    );
}

// ============================================================
// TOAST
// ============================================================

function toast(
  msg,
  type = 'info'
) {

  const el =
    document.getElementById(
      'toast'
    );

  if (!el) {

    console.log(
      `[${type}]`,
      msg
    );

    return;
  }
  el.textContent =
    msg;

  el.className =
    `toast ${type} show`;

  setTimeout(
    () => {
      el.classList.remove(
        'show'
      );
    },
    3500
  );
}
// ============================================================
// LOGOUT
// ============================================================
function doLogout() {

  try {
    socket.disconnect();
  } catch (e) {}

  localStorage.removeItem(
    'usuarioAtual'
  );
  localStorage.removeItem('fx_token');

  window.location.href =
    'FRETEX.html';
}

// ============================================================
// FASE DA ENTREGA
// ============================================================

function advPhase() {

  console.log(
    '🚗 Avançar fase da entrega'
  );

  /*
   * Se o HTML tiver funções próprias,
   * tenta utilizá-las.
   */
  if (
    typeof window.advPhaseUI ===
    'function'
  ) {
    window.advPhaseUI();
  }
}
// ============================================================
// LOG FINAL
// ============================================================
console.log(
  '✅ cliente-socket.js carregado!'
); 


// ============================================================
// COMPATIBILIDADE COM A UI DO DASHBOARD
// ============================================================

function cancelarSolicitar() {
  try { localStorage.removeItem('fx_pending_id'); } catch (e) {}
  if (typeof goView === 'function') goView('home');
}

function triggerPhoto() {
  const input = document.getElementById('photoInput');
  if (input) input.click();
}

function removePhoto(ev) {
  if (ev) ev.stopPropagation();
  PED.photo = null;
  const img = document.getElementById('photoImg');
  const placeholder = document.getElementById('photoPlaceholder');
  const preview = document.getElementById('photoPreview');
  const area = document.getElementById('photoArea');
  const input = document.getElementById('photoInput');
  if (img) img.src = '';
  if (placeholder) placeholder.style.display = '';
  if (preview) preview.style.display = 'none';
  if (area) area.classList.remove('has-photo');
  if (input) input.value = '';
}

function salvarPerfil() {
  const tel = document.getElementById('profTel');
  if (tel && USER) USER.tel = tel.value.trim();
  try { localStorage.setItem('usuarioAtual', JSON.stringify(USER)); } catch (e) {}
  toast('Perfil guardado!', 'success');
}

function selectAc(ev, inpId, dropId, lat, lng, full) {
  if (ev) ev.stopPropagation();
  const inp = document.getElementById(inpId);
  const drop = document.getElementById(dropId);
  if (inp) inp.value = full || '';
  if (drop) drop.classList.remove('open');

  const nlat = Number(lat), nlng = Number(lng);
  if (inpId === 'origemInput') {
    PED.origem = full || '';
    PED.origemLat = Number.isFinite(nlat) ? nlat : null;
    PED.origemLon = Number.isFinite(nlng) ? nlng : null;
  } else if (inpId === 'destinoInput') {
    PED.destino = full || '';
    PED.destLat = Number.isFinite(nlat) ? nlat : null;
    PED.destLon = Number.isFinite(nlng) ? nlng : null;
  }
  if (PED.origem && PED.destino && typeof calcDistance === 'function') calcDistance();
}

function renderMiniMap(onlyUser = false) {
  const el = document.getElementById('miniMap');
  if (!el || typeof L === 'undefined') return;
  if (MAP_MINI) { try { MAP_MINI.remove(); } catch (e) {} MAP_MINI = null; }
  el.innerHTML = '';
  const lat = Number(PED.origemLat) || 38.717;
  const lng = Number(PED.origemLon) || -9.139;
  MAP_MINI = L.map('miniMap', { zoomControl:false, attributionControl:false }).setView([lat,lng],14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(MAP_MINI);
  L.marker([lat,lng]).addTo(MAP_MINI).bindPopup('Origem').openPopup();
  if (!onlyUser && Number.isFinite(Number(PED.destLat)) && Number.isFinite(Number(PED.destLon))) {
    const dlat=Number(PED.destLat), dlng=Number(PED.destLon);
    L.marker([dlat,dlng]).addTo(MAP_MINI).bindPopup('Destino');
    L.polyline([[lat,lng],[dlat,dlng]], {weight:3}).addTo(MAP_MINI);
    MAP_MINI.fitBounds([[lat,lng],[dlat,dlng]], {padding:[20,20]});
  }
}

function selectPayTab(method) {
  PAY_METHOD = method;
  ['mb','card','cash'].forEach(k => {
    const tab = document.getElementById('ptab-' + k);
    const panel = document.getElementById('pp-' + k);
    if (tab) tab.classList.toggle('active', k === method);
    if (panel) panel.classList.toggle('active', k === method);
  });
}

function setRating(n) {
  RATING = Number(n) || 0;
  document.querySelectorAll('.star').forEach((s,i) => s.classList.toggle('active', i < RATING));
}

function submitRating() {
  const overlay = document.getElementById('ratingOverlay');
  if (overlay) overlay.classList.remove('open');
  if (MAP) { try { MAP.remove(); } catch (e) {} MAP = null; }
  TRK_PHASE = 0;
  toast('⭐ Obrigado pela avaliação!', 'success');
  if (typeof goView === 'function') goView('home');
  if (typeof renderHome === 'function') renderHome();
}

function toggleExtra(key) {
  if (!PED.extras) PED.extras = {};
  PED.extras[key] = !PED.extras[key];
  const el = document.getElementById('ex-' + key);
  if (el) el.classList.toggle('active', PED.extras[key]);
  if (typeof calcPrice === 'function') calcPrice();
}
