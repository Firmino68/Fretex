
'use strict';

const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const Usuario = require('../../models/Usuario');

const TEMPO_VALIDADE_CODIGO = 10 * 60 * 1000;
const INTERVALO_REENVIO = 60 * 1000;
const MAX_TENTATIVAS = 5;

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

function falha(res, status, mensagem, extra = {}) {
  return res.status(status).json({
    error: mensagem,
    erro: mensagem,
    ...extra
  });
}

function validar(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  return falha(res, 400, result.array()[0].msg);
}

// Gera um código criptograficamente seguro, incluindo zeros iniciais.
function gerarCodigo() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

// HMAC impede que alguém consiga testar facilmente os códigos
// apenas com acesso à base de dados.
function hashCodigo(codigo, segredo) {
  return crypto
    .createHmac('sha256', segredo)
    .update(`FRETEX_EMAIL_VERIFICATION:${codigo}`)
    .digest('hex');
}

function compararCodigo(codigo, hashGuardado, segredo) {
  if (!/^\d{6}$/.test(codigo)) return false;
  if (!hashGuardado || !/^[a-f0-9]{64}$/i.test(hashGuardado)) {
    return false;
  }

  const hashRecebido = Buffer.from(hashCodigo(codigo, segredo), 'hex');
  const hashOriginal = Buffer.from(hashGuardado, 'hex');

  return crypto.timingSafeEqual(hashRecebido, hashOriginal);
}

function criarRotasAuth({ auth, limiteAuth, email, config }) {
  const router = express.Router();
  const segredo = config?.jwtSecret;

  if (!segredo) {
    throw new Error('O segredo de autenticação é obrigatório nas rotas de autenticação.');
  }

  const camposCodigo = [
    '+codigoVerificacaoHash',
    '+codigoVerificacaoExpira',
    '+codigoVerificacaoTentativas',
    '+ultimoEnvioCodigoEm'
  ].join(' ');

  const validaRegisto = [
    body('email')
      .isString().withMessage('Email inválido')
      .trim().toLowerCase()
      .isEmail().withMessage('Email inválido')
      .isLength({ max: 254 }).withMessage('Email inválido'),

    body('password')
      .isString().withMessage('Password obrigatória')
      .isLength({ min: 8, max: 128 })
      .withMessage('A password deve ter entre 8 e 128 caracteres'),

    body('nome')
      .isString().trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Nome inválido'),

    body('telefone')
      .isString().trim()
      .isLength({ min: 6, max: 30 })
      .withMessage('Telefone inválido'),

    body('tipo')
      .isIn(['cliente', 'motorista'])
      .withMessage('Tipo de utilizador inválido'),

    body('veiculo')
      .if(body('tipo').equals('motorista'))
      .isString().trim().notEmpty().isLength({ max: 50 })
      .withMessage('Seleciona o tipo de veículo'),

    body('distrito')
      .optional({ nullable: true })
      .isString().trim().isLength({ max: 60 })
      .withMessage('Distrito inválido')
  ];

  // REGISTO
  router.post(
    '/registrar',
    limiteAuth,
    validaRegisto,
    validar,
    async (req, res, next) => {
      try {
        if (!email) {
          return falha(
            res,
            503,
            'O serviço de email não está disponível. Tenta novamente mais tarde.'
          );
        }

        const {
          email: enderecoEmail,
          password,
          nome,
          tipo,
          telefone,
          veiculo,
          distrito
        } = req.body;

        if (await Usuario.findOne({ email: enderecoEmail })) {
          return falha(res, 400, 'Email já registado');
        }

        const codigo = gerarCodigo();

        const novoUsuario = new Usuario({
          email: enderecoEmail,
          password,
          nome,
          tipo,
          telefone,
          veiculo: tipo === 'motorista' ? veiculo : null,
          distrito: tipo === 'motorista' ? (distrito || null) : null,
          emailVerificado: false,
          codigoVerificacaoHash: hashCodigo(codigo, segredo),
          codigoVerificacaoExpira: new Date(Date.now() + TEMPO_VALIDADE_CODIGO),
          codigoVerificacaoTentativas: 0,
          ultimoEnvioCodigoEm: new Date()
        });

        await novoUsuario.save();

        try {
          await email.enviarCodigoVerificacao(
            novoUsuario.email,
            novoUsuario.nome,
            codigo
          );
        } catch (erroEmail) {
          console.error('Falha no envio do email de verificação.');
          return falha(
            res,
            503,
            'A conta foi criada, mas não foi possível enviar o código. Tenta reenviá-lo mais tarde.'
          );
        }

        return res.status(201).json({
          success: true,
          mensagem: 'Conta criada! Enviámos um código de confirmação para o teu email.',
          requerVerificacao: true,
          usuario: respostaUsuario(novoUsuario)
        });
      } catch (error) {
        if (error && error.code === 11000) {
          return falha(res, 400, 'Email já registado');
        }

        console.error('Erro no registo:', error);
        next(error);
      }
    }
  );

  // CONFIRMAR EMAIL
  router.post(
    '/verificar-email',
    limiteAuth,
    [
      body('email').isString().trim().toLowerCase().isEmail()
        .withMessage('Email inválido'),
      body('codigo').isString().trim().matches(/^\d{6}$/)
        .withMessage('O código deve ter seis algarismos')
    ],
    validar,
    async (req, res, next) => {
      try {
        const enderecoEmail = req.body.email;
        const codigo = req.body.codigo.trim();

        const usuario = await Usuario.findOne({
          email: enderecoEmail
        }).select(camposCodigo);

        if (!usuario) {
          return falha(res, 400, 'Código inválido ou expirado.');
        }

        if (usuario.emailVerificado) {
          return res.json({
            success: true,
            mensagem: 'Este email já está confirmado.'
          });
        }

        if (
          !usuario.codigoVerificacaoHash ||
          !usuario.codigoVerificacaoExpira ||
          usuario.codigoVerificacaoExpira.getTime() < Date.now()
        ) {
          return falha(
            res,
            400,
            'Código inválido ou expirado. Solicita um novo código.'
          );
        }

        if (usuario.codigoVerificacaoTentativas >= MAX_TENTATIVAS) {
          return falha(
            res,
            429,
            'Atingiste o limite de tentativas. Solicita um novo código.'
          );
        }

        const correto = compararCodigo(
          codigo,
          usuario.codigoVerificacaoHash,
          segredo
        );

        if (!correto) {
          usuario.codigoVerificacaoTentativas += 1;

          if (usuario.codigoVerificacaoTentativas >= MAX_TENTATIVAS) {
            usuario.codigoVerificacaoHash = undefined;
            usuario.codigoVerificacaoExpira = undefined;
          }

          await usuario.save();

          return falha(
            res,
            400,
            usuario.codigoVerificacaoTentativas >= MAX_TENTATIVAS
              ? 'Atingiste o limite de tentativas. Solicita um novo código.'
              : 'Código incorreto.'
          );
        }

        usuario.emailVerificado = true;
        usuario.codigoVerificacaoHash = undefined;
        usuario.codigoVerificacaoExpira = undefined;
        usuario.codigoVerificacaoTentativas = 0;
        usuario.ultimoEnvioCodigoEm = undefined;

        await usuario.save();

        return res.json({
          success: true,
          mensagem: 'Email confirmado com sucesso! Já podes iniciar sessão.',
          usuario: respostaUsuario(usuario)
        });
      } catch (error) {
        console.error('Erro na confirmação do email:', error);
        next(error);
      }
    }
  );

  // REENVIAR CÓDIGO
  router.post(
    '/reenviar-codigo',
    limiteAuth,
    [
      body('email').isString().trim().toLowerCase().isEmail()
        .withMessage('Email inválido')
    ],
    validar,
    async (req, res, next) => {
      try {
        if (!email) {
          return falha(res, 503, 'O serviço de email não está disponível.');
        }

        const enderecoEmail = req.body.email;

        const usuario = await Usuario.findOne({
          email: enderecoEmail
        }).select(camposCodigo);

        // Resposta genérica para não revelar se uma conta existe.
        const respostaGenerica = {
          success: true,
          mensagem: 'Se existir uma conta por confirmar, receberás um código quando for possível enviá-lo.'
        };

        if (!usuario || usuario.emailVerificado) {
          return res.json(respostaGenerica);
        }

        const agora = Date.now();
        const ultimoEnvio = usuario.ultimoEnvioCodigoEm
          ? usuario.ultimoEnvioCodigoEm.getTime()
          : 0;

        if (agora - ultimoEnvio < INTERVALO_REENVIO) {
          return res.json(respostaGenerica);
        }

        const codigo = gerarCodigo();

        usuario.codigoVerificacaoHash = hashCodigo(codigo, segredo);
        usuario.codigoVerificacaoExpira = new Date(
          agora + TEMPO_VALIDADE_CODIGO
        );
        usuario.codigoVerificacaoTentativas = 0;
        usuario.ultimoEnvioCodigoEm = new Date(agora);

        await usuario.save();

        try {
          await email.enviarCodigoVerificacao(
            usuario.email,
            usuario.nome,
            codigo
          );
        } catch (erroEmail) {
          console.error('Falha no reenvio do email de verificação.');
          return falha(res, 503, 'Não foi possível enviar o código. Tenta novamente mais tarde.');
        }

        return res.json(respostaGenerica);
      } catch (error) {
        console.error('Erro no reenvio do código:', error);
        next(error);
      }
    }
  );

  // LOGIN
  const validaLogin = [
    body('email')
      .isString().trim().notEmpty()
      .withMessage('Email e password obrigatórios'),

    body('password')
      .isString().notEmpty()
      .withMessage('Email e password obrigatórios')
  ];

  router.post(
    '/login',
    limiteAuth,
    validaLogin,
    validar,
    async (req, res, next) => {
      try {
        const emailNormalizado = String(req.body.email).trim().toLowerCase();
        const usuario = await Usuario.findOne({ email: emailNormalizado });

        if (
          !usuario ||
          !(await usuario.compararPassword(req.body.password))
        ) {
          return falha(res, 401, 'Email ou password incorretos');
        }

        if (!usuario.emailVerificado) {
          return falha(
            res,
            403,
            'Tens de confirmar o teu email antes de iniciar sessão.',
            { requerVerificacao: true }
          );
        }

        return res.json({
          success: true,
          token: auth.assinarToken(usuario),
          usuario: respostaUsuario(usuario)
        });
      } catch (error) {
        console.error('Erro no login:', error);
        next(error);
      }
    }
  );

  // PERFIL
  router.get('/perfil', auth.exigirAutenticacao, (req, res) => {
    res.json({ usuario: respostaUsuario(req.usuario.doc) });
  });

  return router;
}

module.exports = { criarRotasAuth };
