'use strict';

const mongoose = require('mongoose');
const Frete = require('../../models/Frete');

// Converte um documento Frete para o formato que o frontend espera.
function formatarFrete(frete) {
  const f = frete?.toObject ? frete.toObject() : frete;
  const cliente = f.clienteId && typeof f.clienteId === 'object' ? f.clienteId : null;
  const motorista = f.motoristaId && typeof f.motoristaId === 'object' ? f.motoristaId : null;

  return {
    ...f,
    id: String(f.codigoFrete || f._id),
    freteId: String(f.codigoFrete || f._id),
    mongoId: String(f._id),
    clienteId: cliente ? String(cliente._id) : String(f.clienteId || ''),
    clienteNome: cliente?.nome || f.clienteNome || 'Cliente',
    clienteTelefone: cliente?.telefone || '',
    motoristaId: motorista ? String(motorista._id) : (f.motoristaId ? String(f.motoristaId) : null),
    motorista: motorista ? {
      id: String(motorista._id),
      nome: motorista.nome,
      email: motorista.email,
      telefone: motorista.telefone || '',
      veiculo: motorista.veiculo || null
    } : (f.motorista || null),
    origem: typeof f.origem === 'object' ? (f.origem?.endereco || '') : (f.origem || ''),
    destino: typeof f.destino === 'object' ? (f.destino?.endereco || '') : (f.destino || ''),
    origemLat: typeof f.origem === 'object' ? f.origem?.latitude : f.origemLat,
    origemLon: typeof f.origem === 'object' ? f.origem?.longitude : f.origemLon,
    destLat: typeof f.destino === 'object' ? f.destino?.latitude : f.destLat,
    destLon: typeof f.destino === 'object' ? f.destino?.longitude : f.destLon,
    item: f.item || f.descricao || '',
    precoTotal: Number(f.preco || f.precoTotal || 0),
    dist: Number(f.dist || 0)
  };
}

async function obterFretesDisponiveis() {
  return Frete.find({ status: 'disponivel' })
    .populate('clienteId', 'nome telefone email')
    .sort({ criadoEm: -1 });
}

// Resolver frete pelo código público (FR-...) ou pelo ObjectId MongoDB.
function consultaFreteId(id) {
  const valor = String(id || '').trim();
  if (mongoose.isValidObjectId(valor)) {
    return { $or: [{ _id: valor }, { codigoFrete: valor }] };
  }
  return { codigoFrete: valor };
}

async function obterFreteCompleto(id) {
  return Frete.findOne(consultaFreteId(id))
    .populate('clienteId', 'nome telefone email')
    .populate('motoristaId', 'nome telefone email veiculo distrito');
}

/** Mensagem técnica só fora de produção, para não expor detalhes internos. */
function detalheErro(error) {
  return process.env.NODE_ENV === 'production' ? undefined : error && error.message;
}

module.exports = { formatarFrete, obterFretesDisponiveis, consultaFreteId, obterFreteCompleto, detalheErro };
