
'use strict';

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { criarAuth } = require('./middleware/auth');
const { criarRotasAuth } = require('./routes/auth');
const { criarRotasFretes } = require('./routes/fretes');
const { criarServicoEmail } = require('./services/email');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function criarApp(config, opcoes = {}) {
  const app = express();
  const auth = criarAuth(config);

  const email = Object.hasOwn(opcoes, 'email')
    ? opcoes.email
    : (
        config.smtp?.user && config.smtp?.pass
          ? criarServicoEmail(config)
          : null
      );

  app.disable('x-powered-by');

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));

  if (config.corsOrigins.length) {
    app.use(cors({ origin: config.corsOrigins }));
  }

  app.use(express.json({ limit: '100kb' }));

  const limiteAuth = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.nodeEnv === 'test' ? 1000 : 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      error: 'Demasiadas tentativas. Tenta novamente mais tarde.',
      erro: 'Demasiadas tentativas. Tenta novamente mais tarde.'
    }
  });

  app.get('/api/test', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date()
    });
  });

  app.use(
    '/api/auth',
    criarRotasAuth({ auth, limiteAuth, email, config })
  );

  app.use('/api/fretes', criarRotasFretes({ auth }));

  app.use('/api', (req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada' });
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'FRETEX.html'));
  });

  app.use(express.static(PUBLIC_DIR));

  app.use((err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed') {
      return res.status(400).json({ erro: 'JSON inválido' });
    }

    if (err && err.type === 'entity.too.large') {
      return res.status(413).json({
        erro: 'Pedido demasiado grande'
      });
    }

    console.error('Erro não tratado:', err);

    const body = {
      erro: 'Erro interno do servidor',
      error: 'Erro interno do servidor'
    };

    if (!config.isProduction && err && err.message) {
      body.details = err.message;
    }

    res.status(500).json(body);
  });

  return { app, auth };
}

module.exports = { criarApp };
