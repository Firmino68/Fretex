'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const Usuario = require('../../models/Usuario');

function respostaUsuario(u) {
  return {
    id: u._id,
    email: u.email,
    nome: u.nome,
    tipo: u.tipo,
    telefone: u.telefone,
    tel: u.telefone,
    veiculo: u.veiculo,
    distrito: u.distrito
  };
}

// Responde com "error" e "erro" (o frontend usa ambos em sítios diferentes).
function falha(res, status, mensagem, extra = {}) {
  return res.status(status).json({ error: mensagem, erro: mensagem, ...extra });
}

function validar(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  return falha(res, 400, result.array()[0].msg);
}

function criarRotasAuth({ auth, limiteAuth }) {
  const router = express.Router();

  const validaRegisto = [
    body('email').isString().withMessage('Email inválido').trim().toLowerCase().isEmail().withMessage('Email inválido').isLength({ max: 254 }).withMessage('Email inválido'),
    body('password').isString().withMessage('Password obrigatória').isLength({ min: 8, max: 128 }).withMessage('A password deve ter entre 8 e 128 caracteres'),
    body('nome').isString().trim().isLength({ min: 2, max: 100 }).withMessage('Nome inválido'),
    body('telefone').isString().trim().isLength({ min: 6, max: 30 }).withMessage('Telefone inválido'),
    body('tipo').isIn(['cliente', 'motorista']).withMessage('Tipo de utilizador inválido'),
    body('veiculo').if(body('tipo').equals('motorista')).isString().trim().notEmpty().isLength({ max: 50 }).withMessage('Seleciona o tipo de veículo'),
    body('distrito').optional({ nullable: true }).isString().trim().isLength({ max: 60 }).withMessage('Distrito inválido')
  ];

  router.post('/registrar', limiteAuth, validaRegisto, validar, async (req, res, next) => {
    try {
      const { email, password, nome, tipo, telefone, veiculo, distrito } = req.body;

      if (await Usuario.findOne({ email })) {
        return falha(res, 400, 'Email já registado');
      }

      const novoUsuario = new Usuario({
        email,
        password, // o hash é feito no hook pre('save') do modelo
        nome,
        tipo,
        telefone,
        veiculo: tipo === 'motorista' ? veiculo : null,
        distrito: tipo === 'motorista' ? (distrito || null) : null
      });
      await novoUsuario.save();

      res.status(201).json({
        success: true,
        mensagem: 'Utilizador registado com sucesso!',
        token: auth.assinarToken(novoUsuario),
        usuario: respostaUsuario(novoUsuario)
      });
    } catch (error) {
      if (error && error.code === 11000) return falha(res, 400, 'Email já registado');
      console.error('Erro no registo:', error);
      next(error);
    }
  });

  const validaLogin = [
    body('email').isString().trim().notEmpty().withMessage('Email e password obrigatórios'),
    body('password').isString().notEmpty().withMessage('Email e password obrigatórios')
  ];

  router.post('/login', limiteAuth, validaLogin, validar, async (req, res, next) => {
    try {
      const email = String(req.body.email).trim().toLowerCase();
      const usuario = await Usuario.findOne({ email });
      // Mesma resposta para email inexistente e password errada (evita enumeração de contas).
      if (!usuario || !(await usuario.compararPassword(req.body.password))) {
        return falha(res, 401, 'Email ou password incorretos');
      }
      res.json({ success: true, token: auth.assinarToken(usuario), usuario: respostaUsuario(usuario) });
    } catch (error) {
      console.error('Erro no login:', error);
      next(error);
    }
  });

  router.get('/perfil', auth.exigirAutenticacao, (req, res) => {
    res.json({ usuario: respostaUsuario(req.usuario.doc) });
  });

  return router;
}

module.exports = { criarRotasAuth };
