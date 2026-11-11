'use strict';

const jwt = require('jsonwebtoken');
const Usuario = require('../../models/Usuario');

/** Cria o middleware/ funções de autenticação ligadas à configuração. */
function criarAuth(config) {
  function assinarToken(usuario) {
    return jwt.sign(
      { id: String(usuario._id), email: usuario.email, tipo: usuario.tipo },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn, algorithm: 'HS256' }
    );
  }

  /** Valida o token e devolve o utilizador atual da BD (ou null). */
  async function utilizadorDoToken(token) {
    if (!token) return null;
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    } catch (_) {
      return null;
    }
    const usuario = await Usuario.findById(decoded.id).select('nome email tipo telefone veiculo distrito');
    return usuario || null;
  }

  function extrairBearer(req) {
    const h = req.headers.authorization || '';
    const [scheme, token] = h.split(' ');
    return scheme === 'Bearer' ? token : null;
  }

  async function exigirAutenticacao(req, res, next) {
    try {
      const token = extrairBearer(req);
      if (!token) return res.status(401).json({ erro: 'Token não fornecido', error: 'Token não fornecido' });
      const usuario = await utilizadorDoToken(token);
      if (!usuario) return res.status(401).json({ erro: 'Token inválido ou expirado', error: 'Token inválido ou expirado' });
      req.usuario = { id: String(usuario._id), email: usuario.email, tipo: usuario.tipo, doc: usuario };
      next();
    } catch (err) {
      next(err);
    }
  }

  /** Autorização por perfil: exigirTipo('motorista'). Usar depois de exigirAutenticacao. */
  function exigirTipo(...tipos) {
    return (req, res, next) => {
      if (!req.usuario || !tipos.includes(req.usuario.tipo)) {
        return res.status(403).json({ erro: 'Sem permissão para esta operação', error: 'Sem permissão para esta operação' });
      }
      next();
    };
  }

  return { assinarToken, utilizadorDoToken, exigirAutenticacao, exigirTipo };
}

module.exports = { criarAuth };
