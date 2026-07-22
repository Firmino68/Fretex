/**
 * ============================================================
 * auth.js - FRETEX Autenticação com Verificação de Email
 * ============================================================
 */

// Configuração EmailJS
const EMAILJS_CONFIG = {
  publicKey: 'o3vFoQacwHnFL1fju',
  serviceId: 'service_7z1lxtp',
  templateId: 'template_njxm5i6'
};

// Inicializar EmailJS
if (typeof emailjs !== 'undefined') {
  emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });
}

// Estado de verificação
let _verifyEmail = '';
let _verifyCode = '';
let _verifyFirstName = '';
let _verifyType = '';

// ============================================================
// 1. REGISTAR
// ============================================================

async function doRegister() {
  const nome = document.getElementById('rNome')?.value.trim();
  const apelido = document.getElementById('rAp')?.value.trim();
  const email = document.getElementById('rEmail')?.value.trim();
  const telefone = document.getElementById('rTel')?.value.trim();
  const password = document.getElementById('rPass')?.value;
  const veiculo = document.getElementById('rVeh')?.value;
  
  // Determinar tipo (cliente ou motorista)
  const rcDriver = document.getElementById('rcDriver');
  const tipo = rcDriver?.classList.contains('active') ? 'motorista' : 'cliente';

  // Limpar erro anterior
  document.getElementById('registerError').style.display = 'none';

  // Validação
  if (!nome || !apelido || !email || !telefone || !password) {
    mostrarErro('registerError', '❌ Preencha todos os campos obrigatórios');
    return;
  }

  if (nome.length < 2) {
    mostrarErro('registerError', '❌ Nome demasiado curto');
    return;
  }

  if (!validarEmail(email)) {
    mostrarErro('registerError', '❌ Email inválido — ex: nome@email.com');
    return;
  }

  if (!validarTelefone(telefone)) {
    mostrarErro('registerError', '❌ Telemóvel inválido — ex: 912 345 678');
    return;
  }

  if (!validarPassword(password)) {
    mostrarErro('registerError', '❌ Password com mínimo 8 caracteres');
    return;
  }

  if (tipo === 'motorista' && !veiculo) {
    mostrarErro('registerError', '❌ Seleciona o tipo de veículo');
    return;
  }

  // Desabilitar botão
  const btn = document.getElementById('btnReg');
  const textOrig = btn.textContent;
  btn.textContent = '⏳ A criar conta...';
  btn.disabled = true;

  try {
    const nomeCompleto = nome + ' ' + apelido;
    
    const response = await fetch('/api/auth/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: nomeCompleto,
        email,
        telefone,
        password,
        tipo,
        veiculo: tipo === 'motorista' ? veiculo : null
      })
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarErro('registerError', data.error || 'Erro ao registar');
      btn.textContent = textOrig;
      btn.disabled = false;
      return;
    }

    // ✅ Registo sucesso - Mostrar painel de verificação
    btn.textContent = textOrig;
    btn.disabled = false;
    _showSuccess(tipo, email, nome);

  } catch (err) {
    mostrarErro('registerError', 'Erro na ligação: ' + err.message);
    btn.textContent = textOrig;
    btn.disabled = false;
  }
}

// ============================================================
// 2. MOSTRAR PAINEL DE VERIFICAÇÃO
// ============================================================

function _showSuccess(tipo, email, firstName) {
  _verifyEmail = email;
  _verifyType = tipo;
  _verifyFirstName = firstName;

  // Gerar código de 6 dígitos
  _verifyCode = String(Math.floor(100000 + Math.random() * 900000));
  
  // Guardar código temporariamente (localStorage)
  localStorage.setItem('fx_verify_' + email, _verifyCode);

  // Esconder painéis
  ['pLogin', 'pReg', 'spanel', 'pForgot', 'pReset'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const tabsRow = document.getElementById('tabsRow');
  if (tabsRow) tabsRow.style.display = 'none';

  // Mostrar painel de verificação
  const pVerify = document.getElementById('pVerify');
  if (pVerify) pVerify.style.display = 'block';

  const emailEl = document.getElementById('verifyEmailAddr');
  if (emailEl) emailEl.textContent = email;

  // Mostrar hint de envio
  const hint = document.getElementById('codeDevHint');
  if (hint) {
    hint.style.display = 'block';
    hint.style.background = '#E3F2FD';
    hint.style.borderColor = '#90CAF9';
    hint.style.color = '#1565C0';
    hint.textContent = '📧 A enviar código para ' + email + '…';
  }

  // Enviar email com código via EmailJS
  enviarEmailVerificacao(email, firstName, _verifyCode, hint);

  // Focar primeiro campo do código
  setTimeout(() => {
    const firstCodeInput = document.querySelector('[data-code-digit="0"]');
    if (firstCodeInput) firstCodeInput.focus();
  }, 300);
}

// ============================================================
// 3. ENVIAR EMAIL COM CÓDIGO
// ============================================================

function enviarEmailVerificacao(email, nome, codigo, hintElement) {
  // Preparar template parameters
  const templateParams = {
    to_email: email,
    to_name: nome,
    verification_code: codigo,
    expiry_minutes: '10'
  };

  emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, templateParams)
    .then(() => {
      console.log('✅ Email enviado com sucesso');
      
      if (hintElement) {
        hintElement.style.background = '#E8F5E9';
        hintElement.style.borderColor = '#A5D6A7';
        hintElement.style.color = '#2E7D32';
        hintElement.textContent = '✅ Código enviado! Verifica a caixa de entrada.';
      }
    })
    .catch(err => {
      console.error('❌ Erro EmailJS:', err);
      
      if (hintElement) {
        hintElement.style.background = '#FFF8E1';
        hintElement.style.borderColor = '#FFE082';
        hintElement.style.color = '#795548';
        hintElement.textContent = '⚠️ Erro ao enviar. Código de emergência: ' + codigo;
      }
    });
}

// ============================================================
// 4. VERIFICAR CÓDIGO
// ============================================================

async function verifyCode() {
  // Recolher código dos 6 campos
  const codeInputs = document.querySelectorAll('[data-code-digit]');
  const code = Array.from(codeInputs).map(input => input.value).join('');

  if (code.length !== 6) {
    mostrarErro('verifyErr', '❌ Insira os 6 dígitos do código');
    return;
  }

  const savedCode = localStorage.getItem('fx_verify_' + _verifyEmail);

  if (code !== savedCode) {
    mostrarErro('verifyErr', '❌ Código inválido');
    return;
  }

  // ✅ Código correto
  document.getElementById('verifyErr').style.display = 'none';
  
  // Guardar utilizador como verificado
  const usuario = {
    email: _verifyEmail,
    nome: _verifyFirstName,
    tipo: _verifyType,
    dataCriacao: new Date().toISOString(),
    emailVerificado: true
  };

  localStorage.setItem('usuarioAtual', JSON.stringify(usuario));
  localStorage.removeItem('fx_verify_' + _verifyEmail);

  mostrarAlerta('✅ Email verificado com sucesso!', 'success');

  // Redirecionar para dashboard
  const dashboard = _verifyType === 'cliente' 
    ? 'cliente-dashboard.html' 
    : 'motorista-dashboard.html';

  setTimeout(() => {
    window.location.href = dashboard;
  }, 2000);
}

// ============================================================
// 5. LOGIN
// ============================================================

async function doLogin() {
  const email = document.getElementById('lEmail')?.value.trim();
  const password = document.getElementById('lPass')?.value;

  document.getElementById('lEmailErr').style.display = 'none';
  document.getElementById('lPassErr').style.display = 'none';

  if (!email) {
    mostrarErro('lEmailErr', '❌ Email obrigatório');
    return;
  }

  if (!password) {
    mostrarErro('lPassErr', '❌ Password obrigatória');
    return;
  }

  const btn = document.getElementById('btnLogin');
  const textOrig = btn.textContent;
  btn.textContent = '⏳ A entrar...';
  btn.disabled = true;

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarErro('loginError', data.error || 'Email ou password incorretos');
      btn.textContent = textOrig;
      btn.disabled = false;
      return;
    }

    // ✅ Login sucesso
    localStorage.setItem('usuarioAtual', JSON.stringify({
      id: data.usuario.id,
      nome: data.usuario.nome,
      email: data.usuario.email,
      tipo: data.usuario.tipo,
      veiculo: data.usuario.veiculo,
      avaliacao: data.usuario.avaliacao,
      dataCriacao: new Date().toISOString()
    }));

    mostrarAlerta('✅ Login realizado!', 'success');

    const dashboard = data.usuario.tipo === 'cliente' 
      ? 'cliente-dashboard.html' 
      : 'motorista-dashboard.html';
    
    setTimeout(() => {
      window.location.href = dashboard;
    }, 1500);

  } catch (err) {
    mostrarErro('loginError', 'Erro: ' + err.message);
    btn.textContent = textOrig;
    btn.disabled = false;
  }
}

// ============================================================
// 6. FUNÇÕES AUXILIARES
// ============================================================

function mostrarErro(elementId, msg) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
}

function limparErro(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.style.display = 'none';
}

function mostrarAlerta(msg, tipo = 'info') {
  const div = document.createElement('div');
  div.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: ${
      tipo === 'success' ? '#10B981' :
      tipo === 'error' ? '#EF4444' :
      tipo === 'warning' ? '#F59E0B' : '#3B82F6'
    };
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    font-weight: 600;
    z-index: 9999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
  
  div.textContent = msg;
  document.body.appendChild(div);
  
  setTimeout(() => {
    div.style.opacity = '0';
    div.style.transition = 'opacity 0.3s';
    setTimeout(() => div.remove(), 300);
  }, 3500);
}

function setRole(role) {
  const rcClient = document.getElementById('rcClient');
  const rcDriver = document.getElementById('rcDriver');
  
  if (role === 'client') {
    rcClient?.classList.add('active');
    rcDriver?.classList.remove('active');
  } else {
    rcDriver?.classList.add('active');
    rcClient?.classList.remove('active');
  }
}

function togPass(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🔒';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

function validarEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validarTelefone(tel) {
  const re = /^[0-9]{9,}$/;
  return re.test(tel.replace(/\s/g, ''));
}

function validarPassword(pass) {
  return pass && pass.length >= 8;
}

function verificarAutenticacao() {
  const usuario = localStorage.getItem('usuarioAtual');
  if (!usuario) {
    window.location.href = 'FRETEX.html';
    return null;
  }
  return JSON.parse(usuario);
}

function logout() {
  if (confirm('Tem a certeza que quer sair?')) {
    localStorage.removeItem('usuarioAtual');
    window.location.href = 'FRETEX.html';
  }
}

// ============================================================
// 7. INICIALIZAÇÃO
// ============================================================

window.addEventListener('DOMContentLoaded', () => {
  // Listeners de formulários
  document.getElementById('btnReg')?.addEventListener('click', doRegister);
  document.getElementById('btnLogin')?.addEventListener('click', doLogin);

  // Enter key
  document.getElementById('lPass')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') doLogin();
  });

  document.getElementById('rPass')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') doRegister();
  });

  // Navegação entre campos de código (Enter passa ao próximo)
  document.querySelectorAll('[data-code-digit]').forEach((input, idx) => {
    input.addEventListener('input', (e) => {
      if (e.target.value && idx < 5) {
        document.querySelector(`[data-code-digit="${idx + 1}"]`)?.focus();
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        verifyCode();
      }
    });
  });

  // Limpar erros ao focar
  document.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('focus', () => {
      const errId = el.id + 'Err';
      const err = document.getElementById(errId);
      if (err) err.style.display = 'none';
    });
  });

  console.log('✅ Auth carregado!');
});

console.log('🚚 FRETEX Auth system pronto!');