
'use strict';

/**
 * Utilitários de teste.
 *
 * Os testes que precisam de MongoDB usam TEST_MONGODB_URI.
 * Se não houver MongoDB acessível, esses testes são saltados.
 *
 * O serviço de email é simulado: não envia emails reais.
 * Os códigos ficam disponíveis apenas durante os testes.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'segredo-so-para-testes-com-mais-de-32-caracteres-0123456789';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fretex_test';

const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const { io: ioClient } = require('socket.io-client');

const { carregarConfig } = require('../src/config/env');
const { criarApp } = require('../src/app');
const { registarSockets } = require('../src/sockets');

// Guarda os códigos enviados durante os testes.
const codigosTeste = new Map();

// Serviço de email falso: não envia mensagens reais.
const emailTeste = {
  async enviarCodigoVerificacao(email, nome, codigo) {
    codigosTeste.set(email, codigo);
  }
};

const BASE_URI = (
  process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017'
).replace(/\/$/, '');

async function iniciarServidor(nomeBD, { comBD = true } = {}) {
  const config = carregarConfig({
    ...process.env,
    MONGODB_URI: `${BASE_URI}/${nomeBD}`
  });

  // Cada servidor de teste começa com códigos limpos.
  codigosTeste.clear();

  // Injeta o serviço de email simulado.
  const { app, auth } = criarApp(config, {
    email: emailTeste
  });

  const server = http.createServer(app);
  const io = new Server(server);

  registarSockets(io, auth);

  let temBD = false;

  if (comBD) {
    try {
      await mongoose.connect(`${BASE_URI}/${nomeBD}`, {
        serverSelectionTimeoutMS: 2500
      });

      await mongoose.connection.dropDatabase();
      temBD = true;
    } catch (_) {
      temBD = false;
    }
  }

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const url = `http://127.0.0.1:${server.address().port}`;

  async function parar() {
    io.close();

    await new Promise((resolve) => {
      server.close(resolve);
    });

    if (mongoose.connection.readyState !== 0) {
      if (temBD) {
        await mongoose.connection.dropDatabase().catch(() => {});
      }

      await mongoose.disconnect();
    }

    codigosTeste.clear();
  }

  return {
    app,
    server,
    url,
    config,
    temBD,
    parar,
    codigosTeste
  };
}

function ligarSocket(url, token) {
  return new Promise((resolve, reject) => {
    const s = ioClient(url, {
      auth: token ? { token } : {},
      reconnection: false,
      transports: ['websocket']
    });

    s.once('connect', () => resolve(s));

    s.once('connect_error', (err) => {
      s.close();
      reject(err);
    });
  });
}

function esperarEvento(socket, evento, ms = 3000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`Timeout à espera de "${evento}"`));
    }, ms);

    socket.once(evento, (dados) => {
      clearTimeout(t);
      resolve(dados);
    });
  });
}

module.exports = {
  iniciarServidor,
  ligarSocket,
  esperarEvento
};
