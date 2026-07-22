/**
 * ============================================================
 * FINAL_04_emailjs-fretex.js
 * FRETEX - Sistema de Email com EmailJS
 * ✅ Implementação completa pronta para produção
 * ============================================================
 */

const EMAILJS_CONFIG = {
  publicKey: 'o3vFoQacwHnFL1fju',
  serviceId: 'service_7z1lxtp',
  templates: {
    boasVindas: 'template_boas_vindas',
    verificacao: 'template_njxm5i6',
    fretePendente: 'template_frete_novo',
    freteAceito: 'template_frete_aceito',
    entregueCliente: 'template_entrega_cliente',
    entregueMotorista: 'template_entrega_motorista',
    resetPassword: 'template_reset_password'
  }
};

// Inicializar EmailJS
(function() {
  if (typeof emailjs !== 'undefined') {
    emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });
    console.log('✅ EmailJS inicializado');
  }
})();

let _verifyEmail = '';
let _verifyCode = '';
let _verifyName = '';
let _verifyType = '';

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
};

// ============================================================
// VERIFICAÇÃO DE EMAIL
// ============================================================

function _showSuccess(badge, dest, firstName) {
  _verifyType = badge;
  _verifyEmail = document.getElementById('rEmail')?.value || '';
  _verifyName = firstName;

  _verifyCode = String(Math.floor(100000 + Math.random() * 900000));
  store.set('fx_verify_' + _verifyEmail, _verifyCode);

  ['pLogin','pReg','spanel','pForgot','pReset'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const tabsRow = document.getElementById('tabsRow');
  if (tabsRow) tabsRow.style.display = 'none';

  const pv = document.getElementById('pVerify');
  if (pv) pv.style.display = 'block';

  const emailEl = document.getElementById('verifyEmailAddr');
  if (emailEl) emailEl.textContent = _verifyEmail;

  const hint = document.getElementById('codeDevHint');
  if (hint) {
    hint.style.display = 'block';
    hint.style.background = '#E3F2FD';
    hint.style.borderColor = '#90CAF9';
    hint.style.color = '#1565C0';
    hint.textContent = '📧 A enviar código para ' + _verifyEmail + '…';
  }

  enviarCodigoVerificacao(_verifyEmail, _verifyName, _verifyCode)
    .then(result => {
      if (result.success && hint) {
        hint.style.background = '#E8F5E9';
        hint.style.borderColor = '#A5D6A7';
        hint.style.color = '#2E7D32';
        hint.textContent = '✅ Código enviado! Verifica a caixa de entrada.';
      } else if (!result.success && hint) {
        hint.style.background = '#FFF8E1';
        hint.style.borderColor = '#FFE082';
        hint.style.color = '#795548';
        hint.textContent = '⚠️ Erro ao enviar. Código: ' + _verifyCode;
      }
    });

  setTimeout(() => document.querySelector('[data-group="verify"]')?.focus(), 300);
}

function _verifyCode_Check() {
  const inputCode = document.getElementById('codeVerifyInput')?.value || '';

  if (inputCode === _verifyCode) {
    const usuario = {
      id: _verifyEmail,
      nome: _verifyName,
      email: _verifyEmail,
      tipo: _verifyType,
      verificado: true,
      dataCriacao: new Date().toISOString()
    };

    store.set('usuarioAtual', JSON.stringify(usuario));

    enviarEmailBoasVindas(usuario);

    const hint = document.getElementById('codeDevHint');
    if (hint) {
      hint.style.background = '#E8F5E9';
      hint.style.borderColor = '#A5D6A7';
      hint.style.color = '#2E7D32';
      hint.textContent = '🎉 Verificado com sucesso! A redirecionar...';
    }

    setTimeout(() => {
      const dashboard = _verifyType === 'cliente' ? 'cliente-dashboard.html' : 'motorista-dashboard.html';
      window.location.href = dashboard;
    }, 2000);

  } else {
    const hint = document.getElementById('codeDevHint');
    if (hint) {
      hint.style.background = '#FFEBEE';
      hint.style.borderColor = '#EF9A9A';
      hint.style.color = '#C62828';
      hint.textContent = '❌ Código incorreto.';
    }
    const inp = document.getElementById('codeVerifyInput');
    if (inp) inp.value = '';
  }
}

// ============================================================
// EMAILS
// ============================================================

async function enviarEmailBoasVindas(usuario) {
  try {
    await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templates.boasVindas, {
      to_email: usuario.email,
      to_name: usuario.nome,
      user_type: usuario.tipo === 'cliente' ? 'Cliente' : 'Motorista',
      app_url: window.location.origin,
      current_year: new Date().getFullYear()
    });
    console.log('✅ Email boas-vindas enviado');
    return { success: true };
  } catch (error) {
    console.error('❌ Erro:', error);
    return { success: false };
  }
}

async function enviarCodigoVerificacao(email, nome, codigo) {
  try {
    await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templates.verificacao, {
      to_email: email,
      to_name: nome,
      verification_code: codigo,
      expiry_minutes: '10'
    });
    console.log('✅ Código de verificação enviado');
    return { success: true };
  } catch (error) {
    console.error('❌ Erro:', error);
    return { success: false };
  }
}

async function enviarNotificacaoFrete(frete, motoristaEmail, motoristaNome) {
  try {
    const ganhoMotorista = (frete.preco * 0.8).toFixed(2);
    await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templates.fretePendente, {
      to_email: motoristaEmail,
      to_name: motoristaNome,
      frete_id: frete.id,
      client_name: frete.clienteNome,
      origin: frete.origem,
      destination: frete.destino,
      item: frete.item,
      weight: frete.peso,
      price: frete.preco.toFixed(2),
      driver_earnings: ganhoMotorista,
      description: frete.descricao || 'nenhuma',
      app_url: window.location.origin,
      dashboard_link: window.location.origin + '/motorista-dashboard.html'
    });
    console.log('✅ Notificação frete enviada');
    return { success: true };
  } catch (error) {
    console.error('❌ Erro:', error);
    return { success: false };
  }
}

async function enviarNotificacaoAceito(frete, motorista, clienteEmail, clienteNome) {
  try {
    await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templates.freteAceito, {
      to_email: clienteEmail,
      to_name: clienteNome,
      frete_id: frete.id,
      driver_name: motorista.nome,
      driver_vehicle: motorista.veiculo || 'Van',
      driver_phone: motorista.telefone || 'Ver no app',
      driver_rating: motorista.avaliacao || 5.0,
      origin: frete.origem,
      destination: frete.destino,
      price: frete.preco.toFixed(2),
      app_url: window.location.origin,
      tracking_link: window.location.origin + '/cliente-dashboard.html'
    });
    console.log('✅ Notificação aceitação enviada');
    return { success: true };
  } catch (error) {
    console.error('❌ Erro:', error);
    return { success: false };
  }
}

async function enviarNotificacaoEntregaCliente(frete, motorista, clienteEmail, clienteNome) {
  try {
    await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templates.entregueCliente, {
      to_email: clienteEmail,
      to_name: clienteNome,
      frete_id: frete.id,
      driver_name: motorista.nome,
      origin: frete.origem,
      destination: frete.destino,
      price: frete.preco.toFixed(2),
      delivery_date: new Date().toLocaleDateString('pt-PT'),
      delivery_time: new Date().toLocaleTimeString('pt-PT'),
      app_url: window.location.origin,
      review_link: window.location.origin + '/cliente-dashboard.html'
    });
    console.log('✅ Notificação entrega (cliente) enviada');
    return { success: true };
  } catch (error) {
    console.error('❌ Erro:', error);
    return { success: false };
  }
}

async function enviarNotificacaoEntregaMotorista(frete, motorista, motoristaEmail) {
  try {
    const ganhoMotorista = (frete.preco * 0.8).toFixed(2);
    const comissaoFretex = (frete.preco * 0.2).toFixed(2);

    await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templates.entregueMotorista, {
      to_email: motoristaEmail,
      to_name: motorista.nome,
      frete_id: frete.id,
      client_name: frete.clienteNome,
      origin: frete.origem,
      destination: frete.destino,
      distance: frete.dist.toFixed(1),
      price: frete.preco.toFixed(2),
      commission: comissaoFretex,
      earnings: ganhoMotorista,
      delivery_date: new Date().toLocaleDateString('pt-PT'),
      delivery_time: new Date().toLocaleTimeString('pt-PT'),
      app_url: window.location.origin,
      wallet_link: window.location.origin + '/motorista-dashboard.html'
    });
    console.log('✅ Recibo pagamento enviado');
    return { success: true };
  } catch (error) {
    console.error('❌ Erro:', error);
    return { success: false };
  }
}

async function enviarEmailResetPassword(email, nome, token) {
  try {
    const resetLink = window.location.origin + '/reset-password.html?token=' + token;
    await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templates.resetPassword, {
      to_email: email,
      to_name: nome,
      reset_link: resetLink,
      expiry_hours: '24',
      support_email: 'suporte@fretex.com'
    });
    console.log('✅ Email reset enviado');
    return { success: true };
  } catch (error) {
    console.error('❌ Erro:', error);
    return { success: false };
  }
}

// ============================================================
// TESTES
// ============================================================

async function testarEmailJS() {
  console.log('🧪 Testando EmailJS...');
  try {
    await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templates.verificacao, {
      to_email: 'teste@fretex.com',
      to_name: 'Teste',
      verification_code: '123456',
      expiry_minutes: '10'
    });
    console.log('✅ EmailJS OK!');
    alert('✅ EmailJS funcionando!');
  } catch (error) {
    console.error('❌ Erro:', error);
    alert('❌ Erro ao testar EmailJS');
  }
}

function ativarModoDebug() {
  localStorage.setItem('debugMode', 'true');
  console.log('🔧 Debug ativado');
}

function desativarModoDebug() {
  localStorage.setItem('debugMode', 'false');
  console.log('✅ Debug desativado');
}

console.log('✅ EmailJS FRETEX carregado!');