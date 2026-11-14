
'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const usuarioSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  nome: {
    type: String,
    required: true
  },
  tipo: {
    type: String,
    enum: ['cliente', 'motorista'],
    required: true
  },
  documento: String,
  telefone: String,
  veiculo: {
    type: String,
    default: null
  },
  distrito: {
    type: String,
    default: null
  },
  morada: String,

  // Estado de confirmação do endereço de email
  emailVerificado: {
    type: Boolean,
    default: false
  },

  // Dados privados do processo de verificação
  codigoVerificacaoHash: {
    type: String,
    default: undefined,
    select: false
  },
  codigoVerificacaoExpira: {
    type: Date,
    default: undefined,
    select: false
  },
  codigoVerificacaoTentativas: {
    type: Number,
    default: 0,
    select: false
  },
  ultimoEnvioCodigoEm: {
    type: Date,
    default: undefined,
    select: false
  },

  criadoEm: {
    type: Date,
    default: Date.now
  }
});

// Hash da password antes de guardar
usuarioSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Comparar password introduzida com o hash guardado
usuarioSchema.methods.compararPassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('Usuario', usuarioSchema);