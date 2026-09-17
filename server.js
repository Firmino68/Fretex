const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const jwt = require('jsonwebtoken');
// Carregar variáveis de ambiente
dotenv.config();
// Importar models
const Usuario = require('./models/Usuario');
const Frete = require('./models/Frete');
const Mensagem = require('./models/Mensagem');
const GPSTrajetoria = require('./models/GPSTrajetoria');
// Inicializar Express e Socket.IO
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Conectar ao MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fretex_db')
  .then(() => {
    console.log('🗄️ MongoDB conectado!');
    console.log(`📍 Base de dados: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/fretex_db'}`);
  })
  .catch(err => {
    console.error('❌ Erro ao conectar MongoDB:', err);
    process.exit(1);
  });

// ============================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ============================================

const verificarToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ erro: 'Token não fornecido' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'troque_esta_chave_por_uma_chave_longa_e_secreta');
    req.usuario = decoded;
    next();
  } catch (error) {
    res.status(401).json({ erro: 'Token inválido' });
  }
};

// ============================================
// ROTAS HTTP - AUTENTICAÇÃO
// ============================================

// Rota de teste
app.get('/api/test', (req, res) => {
  res.json({ status: 'MongoDB conectado!', timestamp: new Date() });
});

// Rota de REGISTO
app.post('/api/auth/registrar', async (req, res) => {
  try {
    const { email, password, nome, tipo, telefone, veiculo, distrito } = req.body;

    // Validar dados
    if (!email || !password || !nome || !tipo || !telefone) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios' });
    }

    if (tipo === 'motorista' && !veiculo) {
      return res.status(400).json({ error: 'Seleciona o tipo de veículo' });
    }

    if (!['cliente', 'motorista'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de utilizador inválido' });
    }

    // Verificar se email já existe
    const emailNormalizado = String(email).trim().toLowerCase();
    const usuarioExistente = await Usuario.findOne({ email: emailNormalizado });
    if (usuarioExistente) {
      return res.status(400).json({ error: 'Email já registado' });
    }

    // Criar novo usuário
    const novoUsuario = new Usuario({
      email: emailNormalizado,
      password,
      nome: String(nome).trim(),
      tipo,
      telefone: String(telefone).trim(),
      veiculo: tipo === 'motorista' ? veiculo : null,
      distrito: tipo === 'motorista' ? (distrito || null) : null
    });

    await novoUsuario.save();

    // Gerar token JWT
    const token = jwt.sign(
      { id: novoUsuario._id, email: novoUsuario.email },
      process.env.JWT_SECRET || 'troque_esta_chave_por_uma_chave_longa_e_secreta',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      mensagem: 'Utilizador registado com sucesso!',
      token,
      usuario: {
        id: novoUsuario._id,
        email: novoUsuario.email,
        nome: novoUsuario.nome,
        tipo: novoUsuario.tipo,
        telefone: novoUsuario.telefone,
        tel: novoUsuario.telefone,
        veiculo: novoUsuario.veiculo,
        distrito: novoUsuario.distrito
      }
    });
  } catch (error) {
    console.error('Erro no registo:', error);
    res.status(500).json({ error: 'Erro ao registar utilizador', details: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

// Rota de LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ erro: 'Email e password obrigatórios' });
    }

    const usuario = await Usuario.findOne({ email: String(email).trim().toLowerCase() });
    if (!usuario) {
      return res.status(400).json({ erro: 'Email ou password incorretos' });
    }

    const passwordCorreta = await usuario.compararPassword(password);
    if (!passwordCorreta) {
      return res.status(400).json({ erro: 'Email ou password incorretos' });
    }

    // Gerar token JWT
    const token = jwt.sign(
      { id: usuario._id, email: usuario.email },
      process.env.JWT_SECRET || 'troque_esta_chave_por_uma_chave_longa_e_secreta',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      usuario: {
        id: usuario._id,
        email: usuario.email,
        nome: usuario.nome,
        tipo: usuario.tipo,
        telefone: usuario.telefone,
        tel: usuario.telefone,
        veiculo: usuario.veiculo,
        distrito: usuario.distrito
      }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ erro: 'Erro ao fazer login' });
  }
});

// Rota de perfil (autenticado)
app.get('/api/auth/perfil', verificarToken, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.usuario.id);
    res.json({
      usuario: {
        id: usuario._id,
        email: usuario.email,
        nome: usuario.nome,
        tipo: usuario.tipo,
        telefone: usuario.telefone,
        tel: usuario.telefone,
        veiculo: usuario.veiculo,
        distrito: usuario.distrito
      }
    });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao obter perfil' });
  }
});

// ============================================
// ROTAS HTTP - FRETES
// ============================================

// Listar fretes disponíveis (compatível com o frontend)
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

app.get('/api/fretes/disponivel', async (req, res) => {
  try {
    const fretes = await obterFretesDisponiveis();
    res.json(fretes.map(formatarFrete));
  } catch (error) {
    console.error('Erro ao listar fretes:', error);
    res.status(500).json({ erro: 'Erro ao listar fretes', error: error.message });
  }
});

// Alias usado pelo motorista-socket.js
app.get('/api/fretes/disponiveis', async (req, res) => {
  try {
    const fretes = await obterFretesDisponiveis();
    res.json({ fretes: fretes.map(formatarFrete) });
  } catch (error) {
    console.error('Erro ao listar fretes:', error);
    res.status(500).json({ fretes: [], erro: 'Erro ao listar fretes', error: error.message });
  }
});

// Criar novo frete
app.post('/api/fretes/criar', verificarToken, async (req, res) => {
  try {
    const { origem, destino, preco, peso, dimensoes, descricao } = req.body;

    const novoFrete = new Frete({
      clienteId: req.usuario.id,
      codigoFrete: req.body.freteId || `FR-${Date.now()}`,
      origem,
      destino,
      preco,
      peso,
      dimensoes,
      descricao
    });

    await novoFrete.save();
    res.status(201).json({ success: true, freteId: novoFrete._id });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar frete' });
  }
});

// Obter frete específico
app.get('/api/fretes/meus', async (req, res) => {
  try {
    const usuarioId = req.query.usuarioId;
    if (!usuarioId || !mongoose.isValidObjectId(usuarioId)) {
      return res.status(400).json({ fretes: [], erro: 'Utilizador inválido' });
    }
    const usuario = await Usuario.findById(usuarioId).select('tipo');
    if (!usuario) return res.status(404).json({ fretes: [], erro: 'Utilizador não encontrado' });

    const filtro = usuario.tipo === 'motorista'
      ? { motoristaId: usuarioId }
      : { clienteId: usuarioId };

    const fretes = await Frete.find(filtro)
      .populate('clienteId', 'nome telefone email')
      .populate('motoristaId', 'nome telefone email veiculo distrito')
      .sort({ criadoEm: -1 });

    res.json({ fretes: fretes.map(formatarFrete) });
  } catch (error) {
    console.error('Erro ao carregar meus fretes:', error);
    res.status(500).json({ fretes: [], erro: 'Erro ao carregar fretes', error: error.message });
  }
});

app.get('/api/fretes/:id', async (req, res) => {
  try {
    const frete = await Frete.findById(req.params.id)
      .populate('clienteId', 'nome telefone email')
      .populate('motoristaId', 'nome telefone email');
    
    if (!frete) {
      return res.status(404).json({ erro: 'Frete não encontrado' });
    }

    res.json(frete);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao obter frete' });
  }
});

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

// ============================================
// SOCKET.IO EVENTS
// ============================================

const usuariosConectados = new Map();

io.on('connection', (socket) => {
  console.log(`🔌 Socket conectado: ${socket.id}`);

  // User join
  socket.on('user_join', async (data) => {
    try {
      const usuario = await Usuario.findById(data.usuarioId || data.userId);
      if (usuario) {
        usuariosConectados.set(socket.id, {
          socketId: socket.id,
          usuarioId: usuario._id,
          nome: usuario.nome,
          tipo: usuario.tipo
        });

        console.log(`👤 ${usuario.nome} | Tipo: ${usuario.tipo} | Socket: ${socket.id}`);
        
        // Enviar fretes disponíveis para motoristas
        if (usuario.tipo === 'motorista') {
          const fretesDisp = await Frete.find({ status: 'disponivel' })
            .populate('clienteId', 'nome telefone email')
            .sort({ criadoEm: -1 });
          socket.emit('fretes_disponiveis', fretesDisp.map(formatarFrete));
        }
      }
    } catch (error) {
      console.error('Erro em user_join:', error);
    }
  });

  // Recuperação de estado após reconexão.
  // Permite ao cliente/motorista recuperar do MongoDB os fretes que
  // foram alterados enquanto o socket estava desligado.
  socket.on('sincronizar_fretes', async () => {
    try {
      const info = usuariosConectados.get(socket.id);
      if (!info) return socket.emit('sincronizacao_erro', { message: 'Utilizador não autenticado no socket' });

      const filtro = info.tipo === 'motorista'
        ? { motoristaId: info.usuarioId }
        : { clienteId: info.usuarioId };

      const fretes = await Frete.find(filtro)
        .populate('clienteId', 'nome telefone email')
        .populate('motoristaId', 'nome telefone email veiculo distrito')
        .sort({ criadoEm: -1 })
        .limit(100);

      socket.emit('fretes_sincronizados', fretes.map(formatarFrete));
    } catch (error) {
      console.error('Erro ao sincronizar fretes:', error);
      socket.emit('sincronizacao_erro', { message: 'Erro ao sincronizar fretes', details: error.message });
    }
  });

  // Criar frete
  socket.on('frete_criar', async (data) => {
    try {
      const info = usuariosConectados.get(socket.id);
      const clienteId = info?.tipo === 'cliente' ? info.usuarioId : data.clienteId;

      if (!clienteId) {
        return socket.emit('erro', { mensagem: 'Cliente não autenticado' });
      }

      const origem = typeof data.origem === 'object'
        ? data.origem
        : {
            endereco: data.origem || '',
            latitude: Number(data.origemLat) || null,
            longitude: Number(data.origemLon) || null
          };

      const destino = typeof data.destino === 'object'
        ? data.destino
        : {
            endereco: data.destino || '',
            latitude: Number(data.destLat) || null,
            longitude: Number(data.destLon) || null
          };

      const novoFrete = new Frete({
        clienteId,
        codigoFrete: data.freteId || `FR-${Date.now()}`,
        origem,
        destino,
        preco: Number(data.preco ?? data.precoTotal) || 0,
        peso: data.peso != null ? String(data.peso) : '',
        dimensoes: data.dimensoes || '',
        descricao: data.descricao || data.item || ''
      });

      await novoFrete.save();

      const freteCompleto = await Frete.findById(novoFrete._id)
        .populate('clienteId', 'nome telefone email');

      const fretePayload = formatarFrete(freteCompleto);

      // Enviar o novo frete APENAS aos motoristas autenticados.
      for (const [socketId, userInfo] of usuariosConectados.entries()) {
        if (userInfo.tipo === 'motorista') {
          io.to(socketId).emit('frete_novo', fretePayload);
        }
      }

      console.log(`📦 Novo frete criado: ${novoFrete._id} pelo cliente ${clienteId}`);
      socket.emit('frete_criado', {
        success: true,
        freteId: String(novoFrete._id),
        status: 'disponivel'
      });
    } catch (error) {
      console.error('Erro ao criar frete:', error);
      socket.emit('erro', { mensagem: 'Erro ao criar frete', error: error.message });
    }
  });

  // Motorista aceita frete
  socket.on('frete_aceitar', async (data) => {
    try {
      const info = usuariosConectados.get(socket.id);

      if (!info || info.tipo !== 'motorista') {
        return socket.emit('frete_aceitar_erro', { message: 'Apenas motoristas podem aceitar fretes' });
      }

      if (!data?.freteId) {
        return socket.emit('frete_aceitar_erro', { message: 'ID do frete em falta' });
      }

      // Operação atómica: apenas o primeiro motorista pode aceitar.
      const frete = await Frete.findOneAndUpdate(
        { ...consultaFreteId(data.freteId), status: 'disponivel' },
        {
          motoristaId: info.usuarioId,
          status: 'aceito',
          atualizadoEm: new Date()
        },
        { returnDocument: 'after' }
      )
      .populate('clienteId', 'nome telefone email')
      .populate('motoristaId', 'nome telefone email veiculo');

      if (!frete) {
        return socket.emit('frete_aceitar_erro', {
          message: 'Frete já foi aceite ou não está disponível'
        });
      }

      const payload = formatarFrete(frete);

      // O motorista que aceitou recebe confirmação própria.
      socket.emit('frete_aceito_sucesso', {
        success: true,
        freteId: String(frete._id),
        frete: payload,
        ...payload
      });

      // O cliente dono recebe a confirmação com os dados do motorista.
      // Os outros motoristas são avisados para remover o pedido da lista.
      for (const [socketId, userInfo] of usuariosConectados.entries()) {
        if (String(userInfo.usuarioId) === String(frete.clienteId?._id || frete.clienteId)) {
          io.to(socketId).emit('frete_aceito', payload);
        } else if (userInfo.tipo === 'motorista' && socketId !== socket.id) {
          io.to(socketId).emit('frete_removido', {
            freteId: String(frete._id),
            motivo: 'Frete aceite por outro motorista'
          });
        }
      }

      console.log(`✅ Frete ${data.freteId} aceite pelo motorista ${info.nome}`);
    } catch (error) {
      console.error('Erro ao aceitar frete:', error);
      socket.emit('frete_aceitar_erro', {
        message: 'Erro ao aceitar frete',
        details: error.message
      });
    }
  });

  // Motorista inicia entrega
  socket.on('entrega_iniciar', async (data) => {
    try {
      const info = usuariosConectados.get(socket.id);
      if (!info || info.tipo !== 'motorista') {
        return socket.emit('entrega_iniciar_erro', { message: 'Apenas motoristas podem iniciar entregas' });
      }

      const freteAtual = await obterFreteCompleto(data.freteId);
      if (!freteAtual) {
        return socket.emit('entrega_iniciar_erro', { message: 'Frete não encontrado' });
      }
      if (String(freteAtual.motoristaId?._id || freteAtual.motoristaId) !== String(info.usuarioId)) {
        return socket.emit('entrega_iniciar_erro', { message: 'Este frete não pertence a este motorista' });
      }
      if (freteAtual.status !== 'aceito') {
        return socket.emit('entrega_iniciar_erro', { message: 'O frete não está no estado aceite' });
      }

      freteAtual.status = 'em_andamento';
      freteAtual.dataInicio = new Date();
      await freteAtual.save();

      const payload = formatarFrete(await obterFreteCompleto(data.freteId));

      socket.emit('entrega_iniciada_sucesso', { success: true, freteId: payload.freteId, frete: payload, ...payload });

      for (const [socketId, userInfo] of usuariosConectados.entries()) {
        if (
          String(userInfo.usuarioId) === String(freteAtual.clienteId?._id || freteAtual.clienteId) ||
          String(userInfo.usuarioId) === String(freteAtual.motoristaId?._id || freteAtual.motoristaId)
        ) {
          io.to(socketId).emit('entrega_iniciada', payload);
        }
      }

      console.log(`🚚 Entrega iniciada: ${payload.freteId} pelo motorista ${info.nome}`);
    } catch (error) {
      console.error('Erro ao iniciar entrega:', error);
      socket.emit('entrega_iniciar_erro', { message: 'Erro ao iniciar entrega', details: error.message });
    }
  });

  // Receber localização do motorista
  socket.on('localizacao_motorista', async (data) => {
    try {
      const info = usuariosConectados.get(socket.id);
      if (!info || info.tipo !== 'motorista') return;

      const { freteId, latitude, longitude, accuracy, speed, heading } = data;
      if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
          latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        console.warn('⚠️ Coordenadas inválidas:', { latitude, longitude });
        return;
      }

      const freteAtual = await Frete.findOne(consultaFreteId(freteId)).select('clienteId motoristaId status');
      if (!freteAtual) return;
      if (String(freteAtual.motoristaId) !== String(info.usuarioId)) return;
      if (freteAtual.status !== 'em_andamento') return;

      const trajetoria = new GPSTrajetoria({
        freteId: freteAtual._id,
        motoristaId: info.usuarioId,
        latitude,
        longitude,
        accuracy,
        speed,
        heading,
        capturedAt: data.capturedAt ? new Date(data.capturedAt) : new Date(),
        source: data.simulado ? 'simulacao' : 'real'
      });

      await trajetoria.save();

      const gpsPayload = {
        freteId: String(freteId),
        motoristaId: String(info.usuarioId),
        latitude,
        longitude,
        accuracy,
        speed,
        heading,
        capturedAt: trajetoria.capturedAt,
        simulado: data.simulado || false
      };

      for (const [socketId, userInfo] of usuariosConectados.entries()) {
        if (
          String(userInfo.usuarioId) === String(info.usuarioId) ||
          String(userInfo.usuarioId) === String(freteAtual.clienteId)
        ) {
          io.to(socketId).emit('localizacao_motorista', gpsPayload);
          io.to(socketId).emit('localizacao_motorista_atualizada', gpsPayload);
        }
      }
    } catch (error) {
      console.error('Erro ao receber localização:', error);
    }
  });

  // Pedir trajetória (histórico)
  socket.on('pedir_trajetoria', async (data) => {
    try {
      const freteTrajetoria = await Frete.findOne(consultaFreteId(data.freteId)).select('_id clienteId motoristaId');
      if (!freteTrajetoria) return;
      const info = usuariosConectados.get(socket.id);
      if (!info) return;
      if (
        String(info.usuarioId) !== String(freteTrajetoria.clienteId) &&
        String(info.usuarioId) !== String(freteTrajetoria.motoristaId)
      ) return;
      const pontos = await GPSTrajetoria.find({ freteId: freteTrajetoria._id })
        .sort({ capturedAt: 1 })
        .limit(1000);

      socket.emit('trajetoria_frete', {
        freteId: data.freteId,
        pontos: pontos.map(p => ({
          latitude: p.latitude,
          longitude: p.longitude,
          capturedAt: p.capturedAt
        }))
      });
    } catch (error) {
      console.error('Erro ao pedir trajetória:', error);
    }
  });

  // Caixa de entrada do motorista: últimas mensagens por frete.
  socket.on('mensagens_inbox', async () => {
    try {
      const info = usuariosConectados.get(socket.id);
      if (!info) return socket.emit('mensagens_inbox_result', { conversas: [] });

      const filtro = info.tipo === 'motorista'
        ? { motoristaId: info.usuarioId }
        : { clienteId: info.usuarioId };

      const fretes = await Frete.find(filtro)
        .select('_id clienteId motoristaId status')
        .populate('clienteId', 'nome telefone')
        .populate('motoristaId', 'nome telefone veiculo');

      const conversas = [];
      for (const frete of fretes) {
        const ultima = await Mensagem.findOne({ freteId: frete._id })
          .sort({ dataEnvio: -1 })
          .populate('senderId', 'nome');
        if (!ultima) continue;

        conversas.push({
          freteId: String(frete._id),
          clienteId: String(frete.clienteId?._id || frete.clienteId || ''),
          motoristaId: String(frete.motoristaId?._id || frete.motoristaId || ''),
          clienteNome: frete.clienteId?.nome || 'Cliente',
          motoristaNome: frete.motoristaId?.nome || 'Motorista',
          motoristaVeiculo: frete.motoristaId?.veiculo || '',
          status: frete.status,
          ultimaMensagem: {
            id: String(ultima._id),
            senderId: String(ultima.senderId?._id || ultima.senderId),
            remetenteNome: ultima.senderId?.nome || 'Utilizador',
            texto: ultima.conteudo,
            dataEnvio: ultima.dataEnvio
          }
        });
      }

      conversas.sort((a,b) => new Date(b.ultimaMensagem.dataEnvio) - new Date(a.ultimaMensagem.dataEnvio));
      socket.emit('mensagens_inbox_result', { conversas });
    } catch (error) {
      console.error('Erro ao carregar caixa de mensagens:', error);
      socket.emit('mensagens_inbox_result', { conversas: [], error: error.message });
    }
  });

  // Chat - Enviar mensagem
  socket.on('mensagem_enviar', async (data) => {
    try {
      const info = usuariosConectados.get(socket.id);
      if (!info) return;

      const frete = await Frete.findOne(consultaFreteId(data.freteId)).select('clienteId motoristaId');
      if (!frete) return;
      const clienteId = String(frete.clienteId);
      const motoristaId = String(frete.motoristaId);
      const senderId = String(info.usuarioId);

      if (senderId !== clienteId && senderId !== motoristaId) {
        return socket.emit('mensagem_erro', { message: 'Não participa deste frete' });
      }

      const texto = String(data.texto ?? data.conteudo ?? '').trim();
      if (!texto) return;

      const novaMsg = new Mensagem({
        freteId: frete._id,
        senderId: info.usuarioId,
        conteudo: texto
      });
      await novaMsg.save();

      const payload = {
        id: String(novaMsg._id),
        freteId: String(data.freteId),
        senderId,
        remetenteId: senderId,
        remetenteNome: info.nome,
        sender: info.nome,
        texto,
        conteudo: texto,
        destinatarioId: senderId === clienteId ? motoristaId : clienteId,
        dataEnvio: novaMsg.dataEnvio,
        timestamp: novaMsg.dataEnvio
      };

      for (const [socketId, userInfo] of usuariosConectados.entries()) {
        if (String(userInfo.usuarioId) === clienteId || String(userInfo.usuarioId) === motoristaId) {
          io.to(socketId).emit('mensagem_nova', payload);
        }
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      socket.emit('mensagem_erro', { message: 'Erro ao enviar mensagem', details: error.message });
    }
  });

  // Carregar histórico de mensagens
  socket.on('mensagens_carregar', async (data) => {
    try {
      const freteChat = await Frete.findOne(consultaFreteId(data.freteId)).select('_id');
      if (!freteChat) return;
      const mensagens = await Mensagem.find({ freteId: freteChat._id })
        .sort({ dataEnvio: -1 })
        .limit(50)
        .populate('senderId', 'nome');

      socket.emit('mensagens_historico', {
        freteId: String(data.freteId),
        mensagens: mensagens.reverse().map(msg => ({
          id: String(msg._id),
          freteId: String(data.freteId),
          senderId: String(msg.senderId?._id || msg.senderId),
          remetenteId: String(msg.senderId?._id || msg.senderId),
          remetenteNome: msg.senderId?.nome || 'Utilizador',
          sender: msg.senderId?.nome || 'Utilizador',
          texto: msg.conteudo,
          conteudo: msg.conteudo,
          dataEnvio: msg.dataEnvio,
          timestamp: msg.dataEnvio
        }))
      });
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  });

  // Motorista finaliza entrega
  socket.on('entrega_finalizar', async (data) => {
    try {
      const info = usuariosConectados.get(socket.id);
      if (!info || info.tipo !== 'motorista') {
        return socket.emit('entrega_finalizar_erro', { message: 'Apenas motoristas podem finalizar entregas' });
      }

      const freteAtual = await obterFreteCompleto(data.freteId);
      if (!freteAtual) return socket.emit('entrega_finalizar_erro', { message: 'Frete não encontrado' });
      if (String(freteAtual.motoristaId?._id || freteAtual.motoristaId) !== String(info.usuarioId)) {
        return socket.emit('entrega_finalizar_erro', { message: 'Este frete não pertence a este motorista' });
      }
      if (freteAtual.status !== 'em_andamento') {
        return socket.emit('entrega_finalizar_erro', { message: 'A entrega ainda não está em andamento' });
      }

      freteAtual.status = 'entregue';
      freteAtual.dataFim = new Date();
      await freteAtual.save();

      const payload = formatarFrete(await obterFreteCompleto(data.freteId));
      const evento = { success: true, freteId: payload.freteId, frete: payload, ...payload };

      socket.emit('entrega_finalizada_sucesso', evento);

      for (const [socketId, userInfo] of usuariosConectados.entries()) {
        if (
          String(userInfo.usuarioId) === String(freteAtual.clienteId?._id || freteAtual.clienteId) ||
          String(userInfo.usuarioId) === String(freteAtual.motoristaId?._id || freteAtual.motoristaId)
        ) {
          io.to(socketId).emit('entrega_finalizada', payload);
        }
      }

      console.log(`✅ Entrega finalizada: ${payload.freteId}`);
    } catch (error) {
      console.error('Erro ao finalizar entrega:', error);
      socket.emit('entrega_finalizar_erro', { message: 'Erro ao finalizar entrega', details: error.message });
    }
  });

  // User disconnect
  socket.on('disconnect', () => {
    const usuario = usuariosConectados.get(socket.id);
    if (usuario) {
      console.log(`❌ ${usuario.nome} desconectado`);
      usuariosConectados.delete(socket.id);
    }
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log('\n');
  console.log('╔════════════════════════════════════════╗');
  console.log('║        🚚 FRETEX + MongoDB 🚚         ║');
  console.log('╠════════════════════════════════════════╣');
  console.log(`║ Server: http://localhost:${PORT}${' '.repeat(20 - PORT.toString().length)}║`);
  console.log(`║ Socket.IO: ws://localhost:${PORT}${' '.repeat(18 - PORT.toString().length)}║`);
  console.log('║ Database: MongoDB (Local)              ║');
  console.log('╠════════════════════════════════════════╣');
  console.log('║ Rotas de Autenticação:                 ║');
  console.log('║  POST /api/auth/registrar              ║');
  console.log('║  POST /api/auth/login                  ║');
  console.log('║  GET  /api/auth/perfil                 ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('\n🟢 Servidor aguardando conexões...\n');
});
