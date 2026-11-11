'use strict';

const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Frete = require('../../models/Frete');
const {
  formatarFrete,
  obterFretesDisponiveis,
  consultaFreteId
} = require('../services/fretes');

function criarRotasFretes({ auth }) {
  const router = express.Router();
  const { exigirAutenticacao, exigirTipo } = auth;

  // Fretes à espera de motorista. Só motoristas autenticados.
  router.get('/disponivel', exigirAutenticacao, exigirTipo('motorista'), async (req, res, next) => {
    try {
      const fretes = await obterFretesDisponiveis();
      res.json(fretes.map(formatarFrete));
    } catch (error) { next(error); }
  });

  // Alias usado pelo motorista-socket.js
  router.get('/disponiveis', exigirAutenticacao, exigirTipo('motorista'), async (req, res, next) => {
    try {
      const fretes = await obterFretesDisponiveis();
      res.json({ fretes: fretes.map(formatarFrete) });
    } catch (error) { next(error); }
  });

  const validaCriar = [
    body('origem').exists().withMessage('Origem obrigatória'),
    body('destino').exists().withMessage('Destino obrigatório'),
    body('preco').optional().isFloat({ min: 0, max: 1000000 }).withMessage('Preço inválido'),
    body('descricao').optional().isString().isLength({ max: 1000 }).withMessage('Descrição demasiado longa')
  ];

  router.post('/criar', exigirAutenticacao, exigirTipo('cliente'), validaCriar, async (req, res, next) => {
    try {
      const erros = validationResult(req);
      if (!erros.isEmpty()) return res.status(400).json({ erro: erros.array()[0].msg });

      const { origem, destino, preco, peso, dimensoes, descricao } = req.body;
      const novoFrete = new Frete({
        clienteId: req.usuario.id,
        codigoFrete: `FR-${Date.now()}`, // gerado no servidor, nunca aceito do cliente
        origem: typeof origem === 'object' ? origem : { endereco: String(origem) },
        destino: typeof destino === 'object' ? destino : { endereco: String(destino) },
        preco,
        peso,
        dimensoes,
        descricao
      });
      await novoFrete.save();
      res.status(201).json({ success: true, freteId: novoFrete._id, codigoFrete: novoFrete.codigoFrete });
    } catch (error) { next(error); }
  });

  // Fretes do utilizador autenticado (o id vem do token, não do pedido).
  router.get('/meus', exigirAutenticacao, async (req, res, next) => {
    try {
      const filtro = req.usuario.tipo === 'motorista'
        ? { motoristaId: req.usuario.id }
        : { clienteId: req.usuario.id };

      const fretes = await Frete.find(filtro)
        .populate('clienteId', 'nome telefone email')
        .populate('motoristaId', 'nome telefone email veiculo distrito')
        .sort({ criadoEm: -1 });

      res.json({ fretes: fretes.map(formatarFrete) });
    } catch (error) { next(error); }
  });

  // Um frete específico: só o cliente dono ou o motorista atribuído.
  router.get('/:id', exigirAutenticacao, async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id) && !/^FR-\d+$/.test(id)) {
        return res.status(400).json({ erro: 'Identificador inválido' });
      }
      const frete = await Frete.findOne(consultaFreteId(id))
        .populate('clienteId', 'nome telefone email')
        .populate('motoristaId', 'nome telefone email');

      if (!frete) return res.status(404).json({ erro: 'Frete não encontrado' });

      const uid = req.usuario.id;
      const donoCliente = String(frete.clienteId?._id || frete.clienteId) === uid;
      const donoMotorista = frete.motoristaId && String(frete.motoristaId?._id || frete.motoristaId) === uid;
      if (!donoCliente && !donoMotorista) {
        return res.status(403).json({ erro: 'Sem permissão para ver este frete' });
      }
      res.json(frete);
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = { criarRotasFretes };
