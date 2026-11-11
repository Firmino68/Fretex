const mongoose = require('mongoose');

const freteSchema = new mongoose.Schema({
  codigoFrete: {
    type: String,
    unique: true, // cria o índice único (não declarar também index: true)
    sparse: true
  },
  clienteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  motoristaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  },
  origem: {
    endereco: String,
    latitude: Number,
    longitude: Number
  },
  destino: {
    endereco: String,
    latitude: Number,
    longitude: Number
  },
  status: {
    type: String,
    enum: ['disponivel', 'aceito', 'em_andamento', 'entregue', 'cancelado'],
    default: 'disponivel'
  },
  preco: Number,
  peso: String,
  dimensoes: String,
  descricao: String,
  dataInicio: Date,
  dataFim: Date,
  criadoEm: {
    type: Date,
    default: Date.now
  },
  atualizadoEm: {
    type: Date,
    default: Date.now
  }
}, { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' } });

freteSchema.index({ status: 1, criadoEm: -1 });
freteSchema.index({ clienteId: 1, criadoEm: -1 });
freteSchema.index({ motoristaId: 1, atualizadoEm: -1 });

module.exports = mongoose.model('Frete', freteSchema);
