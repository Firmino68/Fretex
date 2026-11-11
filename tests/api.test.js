'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { iniciarServidor } = require('./helpers');

let ctx;
test.before(async () => { ctx = await iniciarServidor('fretex_test_api'); });
test.after(async () => { await ctx.parar(); });

const cliente = { nome: 'Ana Cliente', email: 'ana@exemplo.pt', telefone: '912345678', password: 'Segredo123', tipo: 'cliente' };
const motorista = { nome: 'Rui Motorista', email: 'rui@exemplo.pt', telefone: '913456789', password: 'Segredo123', tipo: 'motorista', veiculo: 'Carrinha', distrito: 'Setúbal' };

// ---------- Sem base de dados (nunca chegam à BD) ----------
test('GET / serve FRETEX.html a partir do Express', async () => {
  const res = await request(ctx.app).get('/');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /html/);
  assert.match(res.text, /FRETEX/i);
});

test('ficheiros estáticos são servidos (login.html, estilo.css, js/auth.js)', async () => {
  for (const f of ['/login.html', '/estilo.css', '/js/auth.js']) {
    const res = await request(ctx.app).get(f);
    assert.equal(res.status, 200, f);
  }
});

test('GET /api/test responde ok', async () => {
  const res = await request(ctx.app).get('/api/test');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('rota /api desconhecida devolve 404 JSON', async () => {
  const res = await request(ctx.app).get('/api/nao-existe');
  assert.equal(res.status, 404);
});

test('rotas protegidas recusam pedidos sem token (401)', async () => {
  for (const rota of ['/api/auth/perfil', '/api/fretes/meus', '/api/fretes/disponivel', '/api/fretes/disponiveis', '/api/fretes/FR-1']) {
    const res = await request(ctx.app).get(rota);
    assert.equal(res.status, 401, rota);
  }
  const post = await request(ctx.app).post('/api/fretes/criar').send({});
  assert.equal(post.status, 401);
});

test('token inválido é recusado', async () => {
  const res = await request(ctx.app).get('/api/fretes/meus').set('Authorization', 'Bearer isto.nao.e.jwt');
  assert.equal(res.status, 401);
});

test('registo valida os dados (email, password curta, tipo, veículo)', async () => {
  const r1 = await request(ctx.app).post('/api/auth/registrar').send({ ...cliente, email: 'invalido' });
  assert.equal(r1.status, 400);
  const r2 = await request(ctx.app).post('/api/auth/registrar').send({ ...cliente, password: '123' });
  assert.equal(r2.status, 400);
  const r3 = await request(ctx.app).post('/api/auth/registrar').send({ ...cliente, tipo: 'admin' });
  assert.equal(r3.status, 400);
  const r4 = await request(ctx.app).post('/api/auth/registrar').send({ ...motorista, veiculo: '' });
  assert.equal(r4.status, 400);
});

test('JSON malformado devolve 400 e não rebenta', async () => {
  const res = await request(ctx.app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
  assert.equal(res.status, 400);
});

test('cabeçalhos de segurança presentes e sem X-Powered-By', async () => {
  const res = await request(ctx.app).get('/api/test');
  assert.equal(res.headers['x-powered-by'], undefined);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
});

test('não há CORS aberto por defeito (mesma origem)', async () => {
  const res = await request(ctx.app).get('/api/test').set('Origin', 'http://evil.example');
  assert.equal(res.headers['access-control-allow-origin'], undefined);
});

// ---------- Com base de dados ----------
test('fluxo registo -> login -> perfil, sem expor a password', async (t) => {
  if (!ctx.temBD) return t.skip('MongoDB não disponível');
  const reg = await request(ctx.app).post('/api/auth/registrar').send({ ...cliente, email: '  ANA@Exemplo.PT ' });
  assert.equal(reg.status, 201);
  assert.ok(reg.body.token);
  assert.equal(reg.body.usuario.email, 'ana@exemplo.pt');
  assert.equal(reg.body.usuario.password, undefined);

  const dup = await request(ctx.app).post('/api/auth/registrar').send(cliente);
  assert.equal(dup.status, 400);

  const mau = await request(ctx.app).post('/api/auth/login').send({ email: cliente.email, password: 'errada123' });
  assert.equal(mau.status, 401);
  const inexistente = await request(ctx.app).post('/api/auth/login').send({ email: 'x@y.pt', password: 'qualquer123' });
  assert.equal(inexistente.status, 401);
  assert.equal(inexistente.body.erro, mau.body.erro); // mesma mensagem: sem enumeração de contas

  const login = await request(ctx.app).post('/api/auth/login').send({ email: 'ANA@exemplo.pt', password: cliente.password });
  assert.equal(login.status, 200);

  const perfil = await request(ctx.app).get('/api/auth/perfil').set('Authorization', `Bearer ${login.body.token}`);
  assert.equal(perfil.status, 200);
  assert.equal(perfil.body.usuario.nome, cliente.nome);
  assert.equal(perfil.body.usuario.password, undefined);
});

test('autorização por perfil e isolamento entre utilizadores', async (t) => {
  if (!ctx.temBD) return t.skip('MongoDB não disponível');
  const c = (await request(ctx.app).post('/api/auth/registrar').send({ ...cliente, email: 'c2@exemplo.pt' })).body;
  const c2 = (await request(ctx.app).post('/api/auth/registrar').send({ ...cliente, email: 'c3@exemplo.pt' })).body;
  const m = (await request(ctx.app).post('/api/auth/registrar').send(motorista)).body;
  const auth = (tok) => ({ Authorization: `Bearer ${tok}` });

  // Cliente não pode listar fretes disponíveis; motorista não pode criar fretes
  assert.equal((await request(ctx.app).get('/api/fretes/disponiveis').set(auth(c.token))).status, 403);
  assert.equal((await request(ctx.app).post('/api/fretes/criar').set(auth(m.token)).send({ origem: 'A', destino: 'B' })).status, 403);

  const criado = await request(ctx.app).post('/api/fretes/criar').set(auth(c.token)).send({ origem: 'Setúbal', destino: 'Lisboa', preco: 50 });
  assert.equal(criado.status, 201);
  const id = criado.body.freteId;

  // Motorista vê o frete disponível
  const disp = await request(ctx.app).get('/api/fretes/disponiveis').set(auth(m.token));
  assert.equal(disp.status, 200);
  assert.equal(disp.body.fretes.length, 1);

  // /meus devolve só os do próprio utilizador (o ?usuarioId= é ignorado)
  const meus = await request(ctx.app).get(`/api/fretes/meus?usuarioId=${c.usuario.id}`).set(auth(c2.token));
  assert.equal(meus.body.fretes.length, 0);
  const meus1 = await request(ctx.app).get('/api/fretes/meus').set(auth(c.token));
  assert.equal(meus1.body.fretes.length, 1);

  // IDOR: outro cliente não vê o frete; o dono vê
  assert.equal((await request(ctx.app).get(`/api/fretes/${id}`).set(auth(c2.token))).status, 403);
  assert.equal((await request(ctx.app).get(`/api/fretes/${id}`).set(auth(c.token))).status, 200);
  assert.equal((await request(ctx.app).get('/api/fretes/nao-valido').set(auth(c.token))).status, 400);
});
