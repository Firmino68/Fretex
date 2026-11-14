
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const {
  iniciarServidor,
  ligarSocket,
  esperarEvento
} = require('./helpers');

let ctx;

test.before(async () => {
  ctx = await iniciarServidor('fretex_test_socket');
});

test.after(async () => {
  await ctx.parar();
});

/**
 * Regista, confirma o email e inicia sessão.
 */
async function registarEAutenticar(dados) {
  const reg = await request(ctx.app)
    .post('/api/auth/registrar')
    .send(dados);

  assert.equal(reg.status, 201, JSON.stringify(reg.body));

  const email = reg.body.usuario.email;
  const codigo = ctx.codigosTeste.get(email);

  assert.ok(codigo, `Código de verificação não encontrado para ${email}`);

  const verificacao = await request(ctx.app)
    .post('/api/auth/verificar-email')
    .send({
      email,
      codigo
    });

  assert.equal(verificacao.status, 200, JSON.stringify(verificacao.body));

  const login = await request(ctx.app)
    .post('/api/auth/login')
    .send({
      email,
      password: dados.password
    });

  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.ok(login.body.token);

  return {
    usuario: login.body.usuario,
    token: login.body.token
  };
}

test('Socket.IO recusa ligações sem token ou com token inválido', async () => {
  await assert.rejects(
    ligarSocket(ctx.url),
    /Não autenticado/
  );

  await assert.rejects(
    ligarSocket(ctx.url, 'token.falso.aqui'),
    /Não autenticado/
  );
});

test('fluxo em tempo real: criar -> aceitar -> iniciar -> chat -> finalizar', async (t) => {
  if (!ctx.temBD) return t.skip('MongoDB não disponível');

  const c = await registarEAutenticar({
    nome: 'Cliente Um',
    email: 'c1@x.pt',
    telefone: '911111111',
    password: 'Segredo123',
    tipo: 'cliente'
  });

  const intruso = await registarEAutenticar({
    nome: 'Cliente Dois',
    email: 'c2@x.pt',
    telefone: '922222222',
    password: 'Segredo123',
    tipo: 'cliente'
  });

  const m = await registarEAutenticar({
    nome: 'Motorista Um',
    email: 'm1@x.pt',
    telefone: '933333333',
    password: 'Segredo123',
    tipo: 'motorista',
    veiculo: 'Carrinha'
  });

  const sc = await ligarSocket(ctx.url, c.token);
  const sm = await ligarSocket(ctx.url, m.token);
  const si = await ligarSocket(ctx.url, intruso.token);

  t.after(() => {
    sc.close();
    sm.close();
    si.close();
  });

  // Motorista não pode criar fretes via socket; cliente pode.
  const erro = esperarEvento(sm, 'erro');

  sm.emit('frete_criar', {
    origem: 'A',
    destino: 'B'
  });

  assert.match((await erro).mensagem, /Apenas clientes/);

  const novoParaMotorista = esperarEvento(sm, 'frete_novo');
  const criado = esperarEvento(sc, 'frete_criado');

  // clienteId falsificado no payload tem de ser ignorado.
  sc.emit('frete_criar', {
    origem: 'Setúbal',
    destino: 'Lisboa',
    preco: 40,
    clienteId: intruso.usuario.id
  });

  const { freteId } = await criado;
  const frete = await novoParaMotorista;

  assert.equal(frete.clienteId, c.usuario.id);

  // Cliente não pode aceitar fretes.
  const recusa = esperarEvento(sc, 'frete_aceitar_erro');

  sc.emit('frete_aceitar', {
    freteId
  });

  assert.match((await recusa).message, /Apenas motoristas/);

  const aceiteCliente = esperarEvento(sc, 'frete_aceito');
  const aceiteMot = esperarEvento(sm, 'frete_aceito_sucesso');

  sm.emit('frete_aceitar', {
    freteId
  });

  await aceiteMot;

  assert.equal((await aceiteCliente).status, 'aceito');

  // Segundo motorista não consegue aceitar o mesmo frete.
  const m2 = await registarEAutenticar({
    nome: 'Motorista Dois',
    email: 'm2@x.pt',
    telefone: '944444444',
    password: 'Segredo123',
    tipo: 'motorista',
    veiculo: 'Carrinha'
  });

  const sm2 = await ligarSocket(ctx.url, m2.token);

  t.after(() => {
    sm2.close();
  });

  const jaAceite = esperarEvento(sm2, 'frete_aceitar_erro');

  sm2.emit('frete_aceitar', {
    freteId
  });

  assert.match((await jaAceite).message, /já foi aceite/);

  const iniciada = esperarEvento(sm, 'entrega_iniciada_sucesso');

  sm.emit('entrega_iniciar', {
    freteId
  });

  await iniciada;

  // Chat: participantes comunicam; não-participante não envia nem lê.
  const nova = esperarEvento(sm, 'mensagem_nova');

  sc.emit('mensagem_enviar', {
    freteId,
    texto: '<img src=x onerror=alert(1)> Olá'
  });

  assert.match((await nova).texto, /Olá/);

  const negada = esperarEvento(si, 'mensagem_erro');

  si.emit('mensagem_enviar', {
    freteId,
    texto: 'intruso'
  });

  assert.match((await negada).message, /Não participa/);

  let recebeuHistorico = false;

  si.once('mensagens_historico', () => {
    recebeuHistorico = true;
  });

  si.emit('mensagens_carregar', {
    freteId
  });

  await new Promise((resolve) => setTimeout(resolve, 400));

  assert.equal(
    recebeuHistorico,
    false,
    'não participante não pode ler o histórico'
  );

  const final = esperarEvento(sm, 'entrega_finalizada_sucesso');

  sm.emit('entrega_finalizar', {
    freteId
  });

  assert.equal((await final).frete.status, 'entregue');
});
