
'use strict';

/**
 * Configuração centralizada a partir de variáveis de ambiente.
 * Nunca escrever valores secretos nos logs ou no repositório.
 */
const path = require('path');

if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config({
    path: path.join(__dirname, '..', '..', '.env')
  });
}

const JWT_SECRET_MIN_LENGTH = 32;

const PLACEHOLDERS = [
  'troque_esta_chave',
  'sua_chave_secreta',
  'changeme',
  'change_me',
  'gera_uma_chave_aleatoria_e_cola_aqui'
];

function carregarConfig(env = process.env) {
  const erros = [];

  const mongodbUri = (env.MONGODB_URI || '').trim();

  if (!mongodbUri) {
    erros.push('MONGODB_URI não está definida.');
  } else if (!/^mongodb(\+srv)?:\/\//.test(mongodbUri)) {
    erros.push('MONGODB_URI tem de começar por mongodb:// ou mongodb+srv://.');
  }

  const jwtSecret = env.JWT_SECRET || '';

  if (!jwtSecret) {
    erros.push('JWT_SECRET não está definida.');
  } else if (jwtSecret.length < JWT_SECRET_MIN_LENGTH) {
    erros.push(`JWT_SECRET é demasiado curta (mínimo ${JWT_SECRET_MIN_LENGTH} caracteres).`);
  } else if (PLACEHOLDERS.some((p) => jwtSecret.toLowerCase().includes(p))) {
    erros.push('JWT_SECRET ainda tem o valor de exemplo.');
  }

  const port = Number(env.PORT || 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    erros.push('PORT inválida.');
  }

  // Configuração SMTP
  const smtpHost = (env.SMTP_HOST || 'smtp.gmail.com').trim();
  const smtpPort = Number(env.SMTP_PORT || 465);
  const smtpSecure = String(env.SMTP_SECURE || 'true').toLowerCase() === 'true';
  const smtpUser = (env.SMTP_USER || '').trim();
  const smtpPass = env.SMTP_PASS || '';

  if (!smtpHost) {
    erros.push('SMTP_HOST não está definida corretamente.');
  }

  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    erros.push('SMTP_PORT inválida.');
  }

  if ((smtpUser && !smtpPass) || (!smtpUser && smtpPass)) {
    erros.push('SMTP_USER e SMTP_PASS têm de estar ambas configuradas.');
  }

  const corsOrigins = (env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (erros.length) {
    const err = new Error(
      'Configuração inválida:\n  - ' + erros.join('\n  - ') +
      '\nVerifica o ficheiro .env.'
    );
    err.code = 'CONFIG_INVALIDA';
    throw err;
  }

  return {
    nodeEnv: env.NODE_ENV || 'development',
    isProduction: env.NODE_ENV === 'production',
    port,
    mongodbUri,
    jwtSecret,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
    corsOrigins,

    smtp: {
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      user: smtpUser,
      pass: smtpPass,
      from: smtpUser
    }
  };
}

module.exports = { carregarConfig, JWT_SECRET_MIN_LENGTH };
