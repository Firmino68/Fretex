'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { carregarConfig } = require('../src/config/env');

const valido = {
  MONGODB_URI: 'mongodb://127.0.0.1:27017/fretex_db',
  JWT_SECRET: 'x'.repeat(40),
  PORT: '3000'
};

test('aceita uma configuração válida e aplica valores por defeito', () => {
  const cfg = carregarConfig(valido);
  assert.equal(cfg.port, 3000);
  assert.equal(cfg.nodeEnv, 'development');
  assert.deepEqual(cfg.corsOrigins, []);
});

test('falha com mensagem clara se faltar MONGODB_URI', () => {
  assert.throws(() => carregarConfig({ ...valido, MONGODB_URI: '' }), /MONGODB_URI não está definida/);
});

test('falha se faltar JWT_SECRET (sem chave alternativa no código)', () => {
  assert.throws(() => carregarConfig({ ...valido, JWT_SECRET: '' }), /JWT_SECRET não está definida/);
});

test('rejeita JWT_SECRET curta ou de exemplo', () => {
  assert.throws(() => carregarConfig({ ...valido, JWT_SECRET: 'curta' }), /demasiado curta/);
  assert.throws(
    () => carregarConfig({ ...valido, JWT_SECRET: 'troque_esta_chave_por_uma_chave_longa_e_secreta' }),
    /valor de exemplo/
  );
});

test('rejeita PORT inválida e MONGODB_URI com esquema errado', () => {
  assert.throws(() => carregarConfig({ ...valido, PORT: 'abc' }), /PORT inválida/);
  assert.throws(() => carregarConfig({ ...valido, MONGODB_URI: 'mysql://localhost/x' }), /mongodb:\/\//);
});

test('lê CORS_ORIGINS como lista', () => {
  const cfg = carregarConfig({ ...valido, CORS_ORIGINS: 'http://a.pt, http://b.pt' });
  assert.deepEqual(cfg.corsOrigins, ['http://a.pt', 'http://b.pt']);
});
