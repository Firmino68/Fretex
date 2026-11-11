'use strict';

/**
 * Configuração centralizada a partir de variáveis de ambiente.
 *
 * Variáveis obrigatórias: MONGODB_URI e JWT_SECRET.
 * Se faltarem (ou forem inseguras), a aplicação termina com uma mensagem clara.
 * Nunca escrevas os valores reais em logs, commits ou documentação.
 */
const path = require('path');

// Em testes as variáveis são definidas pelo próprio teste; não carregar .env.
if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
}

const JWT_SECRET_MIN_LENGTH = 32;
const PLACEHOLDERS = ['troque_esta_chave', 'sua_chave_secreta', 'changeme', 'change_me'];

function carregarConfig(env = process.env) {
  const erros = [];

  const mongodbUri = (env.MONGODB_URI || '').trim();
  if (!mongodbUri) {
    erros.push('MONGODB_URI não está definida (ex.: mongodb://127.0.0.1:27017/fretex_db).');
  } else if (!/^mongodb(\+srv)?:\/\//.test(mongodbUri)) {
    erros.push('MONGODB_URI tem de começar por "mongodb://" ou "mongodb+srv://".');
  }

  const jwtSecret = env.JWT_SECRET || '';
  if (!jwtSecret) {
    erros.push('JWT_SECRET não está definida.');
  } else if (jwtSecret.length < JWT_SECRET_MIN_LENGTH) {
    erros.push(`JWT_SECRET é demasiado curta (mínimo ${JWT_SECRET_MIN_LENGTH} caracteres).`);
  } else if (PLACEHOLDERS.some((p) => jwtSecret.toLowerCase().includes(p))) {
    erros.push('JWT_SECRET ainda tem o valor de exemplo. Gera uma chave aleatória própria.');
  }

  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    erros.push('PORT inválida (use um inteiro entre 1 e 65535).');
  }

  if (erros.length) {
    const err = new Error(
      'Configuração inválida:\n  - ' + erros.join('\n  - ') +
      '\nCopia .env.example para .env e preenche os valores.'
    );
    err.code = 'CONFIG_INVALIDA';
    throw err;
  }

  // Origens extra permitidas (apenas útil se o frontend for servido de outro sítio,
  // por exemplo o Live Server). Com a arquitetura de mesma origem fica vazio.
  const corsOrigins = (env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    nodeEnv: env.NODE_ENV || 'development',
    isProduction: env.NODE_ENV === 'production',
    port,
    mongodbUri,
    jwtSecret,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
    corsOrigins
  };
}

module.exports = { carregarConfig, JWT_SECRET_MIN_LENGTH };
