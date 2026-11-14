
'use strict';

// ============================================================
// ESTADO DA CONFIRMAÇÃO DE EMAIL
// ============================================================

let _verifyEmail = '';
let _verifyFirstName = '';


// ============================================================
// 1. REGISTAR
// ============================================================

async function doRegister() {
  const nome = document.getElementById('rNome')?.value.trim();
  const apelido = document.getElementById('rAp')?.value.trim();
  const email = document.getElementById('rEmail')?.value.trim().toLowerCase();
  const telefone = document.getElementById('rTel')?.value.trim();
  const password = document.getElementById('rPass')?.value;
  const veiculo = document.getElementById('rVeh')?.value;
  const distrito = document.getElementById('rDist')?.value;

  const rcDriver = document.getElementById('rcDriver');
  const tipo = rcDriver?.classList.contains('active')
    ? 'motorista'
    : 'cliente';

  limparErro('registerError');

  // Validar campos obrigatórios
  if (!nome || !apelido || !email || !telefone || !password) {
    mostrarErro('registerError', 'Preenche todos os campos obrigatórios.');
    return;
  }

  if (nome.length < 2) {
    mostrarErro('registerError', 'Nome demasiado curto.');
    return;
  }

  if (!validarEmail(email)) {
    mostrarErro('registerError', 'Email inválido.');
    return;
  }

  if (!validarTelefone(telefone)) {
    mostrarErro('registerError', 'Telemóvel inválido.');
    return;
  }

  if (!validarPassword(password)) {
    mostrarErro('registerError', 'A password deve ter pelo menos 8 caracteres.');
    return;
  }

  if (tipo === 'motorista' && !veiculo) {
    mostrarErro('registerError', 'Seleciona o tipo de veículo.');
    return;
  }

  const btn = document.getElementById('btnReg');
  const textoOriginal = btn?.textContent;

  if (btn) {
    btn.textContent = 'A criar conta...';
    btn.disabled = true;
  }

  try {
    const response = await fetch('/api/auth/registrar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nome: nome + ' ' + apelido,
        email,
        telefone,
        password,
        tipo,
        veiculo: tipo === 'motorista' ? veiculo : null,
        distrito: tipo === 'motorista' ? distrito : null
      })
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarErro(
        'registerError',
        data.error || data.erro || 'Não foi possível criar a conta.'
      );
      return;
    }

    // O servidor já criou a conta e enviou o código por email.
    _showSuccess(email, nome);

  } catch (err) {
    console.error('Erro no registo:', err);
    mostrarErro(
      'registerError',
      'Erro de ligação ao servidor. Tenta novamente.'
    );
  } finally {
    if (btn) {
      btn.textContent = textoOriginal;
      btn.disabled = false;
    }
  }
}


// ============================================================
// 2. MOSTRAR PAINEL DE CONFIRMAÇÃO
// ============================================================

function _showSuccess(email, firstName) {
  _verifyEmail = email;
  _verifyFirstName = firstName || '';

  // Esconder os restantes painéis
  ['pLogin', 'pReg', 'spanel', 'pForgot', 'pReset'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const tabsRow = document.getElementById('tabsRow');
  if (tabsRow) tabsRow.style.display = 'none';

  // Mostrar painel de confirmação
  const pVerify = document.getElementById('pVerify');
  if (pVerify) pVerify.style.display = 'block';

  const emailEl = document.getElementById('verifyEmailAddr');
  if (emailEl) emailEl.textContent = email;

  const hint = document.getElementById('codeDevHint');

  if (hint) {
    hint.style.display = 'block';
    hint.style.background = '#E8F5E9';
    hint.style.borderColor = '#A5D6A7';
    hint.style.color = '#2E7D32';
    hint.textContent =
      'Código enviado para o teu email. Verifica também a pasta de spam.';
  }

  // Limpar os campos do código
  document.querySelectorAll('[data-code-digit]').forEach(input => {
    input.value = '';
  });

  limparErro('verifyErr');

  // Focar o primeiro campo
  setTimeout(() => {
    document.querySelector('[data-code-digit="0"]')?.focus();
  }, 300);
}


// ============================================================
// 3. VERIFICAR CÓDIGO NO SERVIDOR
// ============================================================

async function verifyCode() {
  const codeInputs = document.querySelectorAll('[data-code-digit]');

  const codigo = Array.from(codeInputs)
    .map(input => input.value.trim())
    .join('');

  if (!/^\d{6}$/.test(codigo)) {
    mostrarErro('verifyErr', 'Insere os 6 dígitos do código.');
    return;
  }

  if (!_verifyEmail) {
    mostrarErro(
      'verifyErr',
      'Não foi possível identificar o email. Volta a iniciar o registo.'
    );
    return;
  }

  const btn = document.querySelector(
    '#pVerify button[onclick="verifyCode()"]'
  );

  const textoOriginal = btn?.textContent;

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'A verificar...';
  }

  try {
    const response = await fetch('/api/auth/verificar-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: _verifyEmail,
        codigo
      })
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarErro(
        'verifyErr',
        data.error || data.erro || 'Código inválido ou expirado.'
      );
      return;
    }

    // Limpar campos do código
    document.querySelectorAll('[data-code-digit]').forEach(input => {
      input.value = '';
    });

    limparErro('verifyErr');

    // Preencher email no formulário de login
    const loginEmail = document.getElementById('lEmail');

    if (loginEmail) {
      loginEmail.value = _verifyEmail;
    }

    mostrarAlerta(
      'Email confirmado com sucesso! Já podes iniciar sessão.',
      'success'
    );

    // Limpar estado temporário
    _verifyEmail = '';
    _verifyFirstName = '';

    // Voltar ao login
    setTimeout(() => {
      switchTo('login');
    }, 1200);

  } catch (err) {
    console.error('Erro na confirmação:', err);

    mostrarErro(
      'verifyErr',
      'Não foi possível contactar o servidor. Tenta novamente.'
    );

  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  }
}


// ============================================================
// 4. REENVIAR CÓDIGO PELO SERVIDOR
// ============================================================

async function resendCode() {
  if (!_verifyEmail) {
    mostrarErro('verifyErr', 'Não foi possível identificar o email.');
    return;
  }

  const hint = document.getElementById('codeDevHint');

  if (hint) {
    hint.style.display = 'block';
    hint.textContent = 'A solicitar novo código...';
  }

  try {
    const response = await fetch('/api/auth/reenviar-codigo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: _verifyEmail
      })
    });

    const data = await response.json();

    if (!response.ok) {
      if (hint) {
        hint.style.background = '#FFF8E1';
        hint.style.borderColor = '#FFE082';
        hint.style.color = '#795548';
        hint.textContent =
          data.error ||
          data.erro ||
          'Não foi possível reenviar o código. Tenta novamente mais tarde.';
      }

      return;
    }

    if (hint) {
      hint.style.background = '#E8F5E9';
      hint.style.borderColor = '#A5D6A7';
      hint.style.color = '#2E7D32';
      hint.textContent =
        data.mensagem ||
        'Se a conta estiver pendente de confirmação, receberás um novo código.';
    }

    // Limpar os campos para inserir o novo código
    document.querySelectorAll('[data-code-digit]').forEach(input => {
      input.value = '';
    });

    limparErro('verifyErr');

    document.querySelector('[data-code-digit="0"]')?.focus();

  } catch (err) {
    console.error('Erro ao reenviar código:', err);

    if (hint) {
      hint.style.background = '#FFF8E1';
      hint.style.borderColor = '#FFE082';
      hint.style.color = '#795548';
      hint.textContent = 'Erro de ligação ao servidor. Tenta novamente.';
    }
  }
}


// ============================================================
// 5. LOGIN
// ============================================================

async function doLogin() {
  const email = document.getElementById('lEmail')?.value.trim().toLowerCase();
  const password = document.getElementById('lPass')?.value;

  limparErro('lEmailErr');
  limparErro('lPassErr');
  limparErro('loginError');

  if (!email) {
    mostrarErro('lEmailErr', 'Email obrigatório.');
    return;
  }

  if (!password) {
    mostrarErro('lPassErr', 'Password obrigatória.');
    return;
  }

  const btn = document.getElementById('btnLogin');
  const textoOriginal = btn?.textContent;

  if (btn) {
    btn.textContent = 'A entrar...';
    btn.disabled = true;
  }

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    const data = await response.json();

    if (!response.ok) {

      // Conta existe, mas ainda não confirmou o email
      if (data.requerVerificacao) {
        _showSuccess(email, '');

        mostrarErro(
          'verifyErr',
          'O teu email ainda não foi confirmado. Introduz o código recebido ou pede um novo.'
        );

        return;
      }

      mostrarErro(
        'loginError',
        data.error || data.erro || 'Email ou password incorretos.'
      );

      return;
    }

    // Guardar token recebido do servidor
    localStorage.setItem('fx_token', data.token || '');

    // Guardar dados do utilizador
    localStorage.setItem('usuarioAtual', JSON.stringify({
      id: data.usuario.id,
      nome: data.usuario.nome,
      email: data.usuario.email,
      tipo: data.usuario.tipo,
      veiculo: data.usuario.veiculo,
      tel: data.usuario.telefone,
      telefone: data.usuario.telefone,
      distrito: data.usuario.distrito,
      avaliacao: data.usuario.avaliacao,
      dataCriacao: new Date().toISOString()
    }));

    mostrarAlerta('Login realizado com sucesso!', 'success');

    const dashboard = data.usuario.tipo === 'cliente'
      ? 'cliente-dashboard.html'
      : 'motorista-dashboard.html';

    setTimeout(() => {
      window.location.href = dashboard;
    }, 1500);

  } catch (err) {
    console.error('Erro no login:', err);

    mostrarErro(
      'loginError',
      'Erro de ligação ao servidor. Tenta novamente.'
    );

  } finally {
    if (btn) {
      btn.textContent = textoOriginal;
      btn.disabled = false;
    }
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

  if (el) {
    el.style.display = 'none';
  }
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
  const driverExtra = document.getElementById('driverExtra');

  if (role === 'client') {
    rcClient?.classList.add('active');
    rcDriver?.classList.remove('active');

    if (driverExtra) {
      driverExtra.style.display = 'none';
    }

  } else {
    rcDriver?.classList.add('active');
    rcClient?.classList.remove('active');

    if (driverExtra) {
      driverExtra.style.display = 'block';
    }
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

  try {
    return JSON.parse(usuario);
  } catch (err) {
    console.error('Dados de utilizador inválidos:', err);
    localStorage.removeItem('usuarioAtual');
    localStorage.removeItem('fx_token');
    window.location.href = 'FRETEX.html';
    return null;
  }
}


function logout() {
  if (confirm('Tem a certeza que quer sair?')) {
    localStorage.removeItem('usuarioAtual');
    localStorage.removeItem('fx_token');
    window.location.href = 'FRETEX.html';
  }
}


// ============================================================
// 7. INICIALIZAÇÃO
// ============================================================

window.addEventListener('DOMContentLoaded', () => {

  // Enter no campo da password faz login
  document.getElementById('lPass')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      doLogin();
    }
  });

  // Enter no campo da password faz registo
  document.getElementById('rPass')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      doRegister();
    }
  });

  // Navegação entre os campos do código
  document.querySelectorAll('[data-code-digit]').forEach((input, idx) => {

    input.addEventListener('input', (e) => {
      if (e.target.value && idx < 5) {
        document
          .querySelector(`[data-code-digit="${idx + 1}"]`)
          ?.focus();
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        verifyCode();
      }
    });

  });

  // Limpar erros quando o utilizador foca um campo
  document.querySelectorAll('input, select').forEach(el => {

    el.addEventListener('focus', () => {
      const errId = el.id + 'Err';
      const err = document.getElementById(errId);

      if (err) {
        err.style.display = 'none';
      }
    });

  });

  console.log('Auth carregado com sucesso!');
});


// ============================================================
// 8. FUNÇÕES DE MODAL E NAVEGAÇÃO
// ============================================================

function switchTo(tab) {
  const pLogin = document.getElementById('pLogin');
  const pReg = document.getElementById('pReg');
  const tabs = document.getElementById('tabsRow');
  const tabLogin = document.getElementById('tabLogin');
  const tabReg = document.getElementById('tabReg');
  const pVerify = document.getElementById('pVerify');
  const overlay = document.getElementById('overlay');

  if (pVerify) pVerify.style.display = 'none';
  if (tabs) tabs.style.display = 'flex';

  if (tab === 'register') {
    if (pLogin) pLogin.style.display = 'none';
    if (pReg) pReg.style.display = 'block';

    tabLogin?.classList.remove('active');
    tabReg?.classList.add('active');

    document.getElementById('mhdrTitle')
      ?.replaceChildren(document.createTextNode('Criar conta'));

    document.getElementById('mhdrSub')
      ?.replaceChildren(document.createTextNode('Regista-te em segundos'));

  } else {
    if (pLogin) pLogin.style.display = 'block';
    if (pReg) pReg.style.display = 'none';

    tabLogin?.classList.add('active');
    tabReg?.classList.remove('active');

    document.getElementById('mhdrTitle')
      ?.replaceChildren(document.createTextNode('Bem-vindo'));

    document.getElementById('mhdrSub')
      ?.replaceChildren(document.createTextNode('Acede à tua conta FRETEX'));
  }

  if (overlay) {
    overlay.classList.add('open');
  }
}


function codeNext(input) {
  if (!input || !input.value) return;

  const idx = Number(input.dataset.idx);

  const next = document.querySelector(
    `[data-group="verify"][data-idx="${idx + 1}"]`
  );

  if (next) {
    next.focus();
  }
}


function codeBack(event, input) {
  if (event.key === 'Backspace' && !input.value) {
    const idx = Number(input.dataset.idx);

    const prev = document.querySelector(
      `[data-group="verify"][data-idx="${idx - 1}"]`
    );

    if (prev) {
      prev.focus();
    }
  }
}


function doGoogle() {
  mostrarAlerta(
    'O login Google ainda não está configurado no servidor.',
    'warning'
  );
}


function showModal(modalId) {
  const overlay = document.getElementById('overlay');
  const pLogin = document.getElementById('pLogin');
  const pReg = document.getElementById('pReg');
  const pVerify = document.getElementById('pVerify');

  // Esconder todos os painéis
  if (pLogin) pLogin.style.display = 'none';
  if (pReg) pReg.style.display = 'none';
  if (pVerify) pVerify.style.display = 'none';

  // Mostrar o painel solicitado
  const modal = document.getElementById(modalId);

  if (modal) {
    modal.style.display = 'block';
  }

  if (overlay) {
    overlay.classList.add('open');
  }
}


function closeModal() {
  const overlay = document.getElementById('overlay');
  const pLogin = document.getElementById('pLogin');
  const pReg = document.getElementById('pReg');
  const pVerify = document.getElementById('pVerify');
  const spanel = document.getElementById('spanel');

  // Esconder painéis
  if (pLogin) pLogin.style.display = 'none';
  if (pReg) pReg.style.display = 'none';
  if (pVerify) pVerify.style.display = 'none';

  // Fechar modal
  if (overlay) {
    overlay.classList.remove('open');
  }

  // Mostrar painel principal
  if (spanel) {
    spanel.style.display = 'block';
  }
}


function openModal(modalId) {
  if (modalId === 'driver') {
    setRole('driver');
    switchTo('register');
    return;
  }

  if (modalId === 'pLogin') {
    switchTo('login');
    return;
  }

  if (modalId === 'pReg') {
    switchTo('register');
    return;
  }

  showModal(modalId);
}
