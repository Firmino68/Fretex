'use strict';

const Usuario = require('../../models/Usuario');
const Frete = require('../../models/Frete');
const Mensagem = require('../../models/Mensagem');
const GPSTrajetoria = require('../../models/GPSTrajetoria');
const {
  formatarFrete,
  consultaFreteId,
  obterFreteCompleto,
  detalheErro
} = require('../services/fretes');

/**
 * Regista o Socket.IO. Cada ligação tem de trazer um JWT válido em
 * `auth.token` (handshake); caso contrário é recusada.
 */
function registarSockets(io, auth) {
  io.use(async (socket, next) => {
    try {
      const usuario = await auth.utilizadorDoToken(socket.handshake.auth && socket.handshake.auth.token);
      if (!usuario) return next(new Error('Não autenticado'));
      socket.data.usuario = { id: String(usuario._id), tipo: usuario.tipo, nome: usuario.nome, _id: usuario._id };
      next();
    } catch (err) {
      next(new Error('Não autenticado'));
    }
  });

  const usuariosConectados = new Map();

  function registarUtilizador(socket, usuario) {
    usuariosConectados.set(socket.id, {
      socketId: socket.id,
      usuarioId: usuario._id,
      nome: usuario.nome,
      tipo: usuario.tipo
    });
  }

  io.on('connection', (socket) => {
    // Já autenticado pelo io.use: regista logo o utilizador para os eventos seguintes.
    registarUtilizador(socket, socket.data.usuario);
    console.log(`🔌 Socket conectado: ${socket.id}`);

    // User join: a identidade é a do token validado no handshake (io.use).
    // O 'usuarioId' enviado pelo cliente é ignorado.
    socket.on('user_join', async () => {
      try {
        const usuario = await Usuario.findById(socket.data.usuario.id);
        if (!usuario) return socket.disconnect(true);
        registarUtilizador(socket, usuario);
        console.log(`👤 ${usuario.nome} | Tipo: ${usuario.tipo} | Socket: ${socket.id}`);

        // Enviar fretes disponíveis para motoristas
        if (usuario.tipo === 'motorista') {
          const fretesDisp = await Frete.find({ status: 'disponivel' })
            .populate('clienteId', 'nome telefone email')
            .sort({ criadoEm: -1 });
          socket.emit('fretes_disponiveis', fretesDisp.map(formatarFrete));
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
        socket.emit('sincronizacao_erro', { message: 'Erro ao sincronizar fretes', details: detalheErro(error) });
      }
    });

    // Criar frete
    socket.on('frete_criar', async (data) => {
      try {
        const info = usuariosConectados.get(socket.id);
        if (!info || info.tipo !== 'cliente') {
          return socket.emit('erro', { mensagem: 'Apenas clientes podem criar fretes' });
        }
        const clienteId = info.usuarioId;

        const origem = typeof data.origem === 'object'
          ? data.origem
          : {
              endereco: String(data.origem || '').slice(0, 300),
              latitude: Number(data.origemLat) || null,
              longitude: Number(data.origemLon) || null
            };

        const destino = typeof data.destino === 'object'
          ? data.destino
          : {
              endereco: String(data.destino || '').slice(0, 300),
              latitude: Number(data.destLat) || null,
              longitude: Number(data.destLon) || null
            };

        const novoFrete = new Frete({
          clienteId,
          codigoFrete: /^FR-\d{10,15}$/.test(String(data.freteId || '')) ? String(data.freteId) : `FR-${Date.now()}`,
          origem,
          destino,
          preco: Math.min(Math.max(Number(data.preco ?? data.precoTotal) || 0, 0), 1000000),
          peso: data.peso != null ? String(data.peso) : '',
          dimensoes: String(data.dimensoes || '').slice(0, 100),
          descricao: String(data.descricao || data.item || '').slice(0, 1000)
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
        socket.emit('erro', { mensagem: 'Erro ao criar frete', error: detalheErro(error) });
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
          details: detalheErro(error)
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
        socket.emit('entrega_iniciar_erro', { message: 'Erro ao iniciar entrega', details: detalheErro(error) });
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
        socket.emit('mensagens_inbox_result', { conversas: [], error: detalheErro(error) });
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

        const texto = String(data.texto ?? data.conteudo ?? '').trim().slice(0, 2000);
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
        socket.emit('mensagem_erro', { message: 'Erro ao enviar mensagem', details: detalheErro(error) });
      }
    });

    // Carregar histórico de mensagens
    socket.on('mensagens_carregar', async (data) => {
      try {
        const info = usuariosConectados.get(socket.id);
        if (!info) return;
        const freteChat = await Frete.findOne(consultaFreteId(data.freteId)).select('_id clienteId motoristaId');
        if (!freteChat) return;
        if (
          String(info.usuarioId) !== String(freteChat.clienteId) &&
          String(info.usuarioId) !== String(freteChat.motoristaId)
        ) return;
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
        socket.emit('entrega_finalizar_erro', { message: 'Erro ao finalizar entrega', details: detalheErro(error) });
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
}

module.exports = { registarSockets };
