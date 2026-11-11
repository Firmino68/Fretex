'use strict';

/**
 * FRETEX - ponto de entrada.
 * Um único processo Node.js serve: frontend (public/), API REST, Socket.IO e liga ao MongoDB.
 * Acesso: http://localhost:<PORT> (por defeito 3000). O Apache/XAMPP não é necessário.
 */
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const { carregarConfig } = require('./src/config/env');

let config;
try {
  config = carregarConfig();
} catch (err) {
  console.error('❌ ' + err.message);
  process.exit(1);
}

const { criarApp } = require('./src/app');
const { registarSockets } = require('./src/sockets');

const { app, auth } = criarApp(config);
const server = http.createServer(app);

// Mesma origem: o Socket.IO não precisa de CORS. Se CORS_ORIGINS existir, aplica-se a lista.
const io = new Server(server, config.corsOrigins.length
  ? { cors: { origin: config.corsOrigins, methods: ['GET', 'POST'] } }
  : {});
registarSockets(io, auth);

async function arrancar() {
  try {
    await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 8000 });
    console.log('🗄️  MongoDB conectado (base de dados: ' + mongoose.connection.name + ')');
  } catch (err) {
    console.error('❌ Não foi possível ligar ao MongoDB. Verifica se o serviço está ativo e a MONGODB_URI no .env.');
    console.error('   Motivo:', err.message);
    process.exit(1);
  }

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ A porta ${config.port} já está em uso. Fecha o outro processo ou altera PORT no .env.`);
    } else {
      console.error('❌ Erro no servidor:', err);
    }
    process.exit(1);
  });

  server.listen(config.port, () => {
    console.log(`🚚 FRETEX a correr em http://localhost:${config.port}  (${config.nodeEnv})`);
  });
}

function encerrar(sinal) {
  console.log(`\n${sinal} recebido: a encerrar...`);
  io.close(() => {
    server.close(async () => {
      await mongoose.connection.close().catch(() => {});
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', () => encerrar('SIGINT'));
process.on('SIGTERM', () => encerrar('SIGTERM'));
process.on('unhandledRejection', (reason) => console.error('Promise rejeitada sem tratamento:', reason));

arrancar();
