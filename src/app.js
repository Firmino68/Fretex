'use strict';

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { criarAuth } = require('./middleware/auth');
const { criarRotasAuth } = require('./routes/auth');
const { criarRotasFretes } = require('./routes/fretes');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

/**
 * Cria a aplicação Express (sem ligar a rede nem à BD),
 * o que permite testá-la com supertest.
 */
function criarApp(config) {
  const app = express();
  const auth = criarAuth(config);

  app.disable('x-powered-by');
  // O frontend usa scripts inline, Leaflet (unpkg) e EmailJS (CDN); por isso a CSP
  // está desligada. Os restantes cabeçalhos de segurança do Helmet ficam ativos.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

  // Mesma origem: não é preciso CORS. Só é ativado se CORS_ORIGINS estiver definido.
  if (config.corsOrigins.length) {
    app.use(cors({ origin: config.corsOrigins }));
  }

  app.use(express.json({ limit: '100kb' }));

  // Limite de tentativas nas rotas de autenticação (protege contra força bruta).
  const limiteAuth = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.nodeEnv === 'test' ? 1000 : 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Demasiadas tentativas. Tenta novamente mais tarde.', erro: 'Demasiadas tentativas. Tenta novamente mais tarde.' }
  });

  // API
  app.get('/api/test', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
  });
  app.use('/api/auth', criarRotasAuth({ auth, limiteAuth }));
  app.use('/api/fretes', criarRotasFretes({ auth }));
  app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));

  // Frontend (Express serve tudo: http://localhost:3000)
  app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'FRETEX.html')));
  app.use(express.static(PUBLIC_DIR));

  // Tratamento centralizado de erros
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed') {
      return res.status(400).json({ erro: 'JSON inválido' });
    }
    if (err && err.type === 'entity.too.large') {
      return res.status(413).json({ erro: 'Pedido demasiado grande' });
    }
    console.error('Erro não tratado:', err);
    const body = { erro: 'Erro interno do servidor', error: 'Erro interno do servidor' };
    if (!config.isProduction && err && err.message) body.details = err.message;
    res.status(500).json(body);
  });

  return { app, auth };
}

module.exports = { criarApp };
