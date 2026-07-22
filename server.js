/**
 * ============================================================
 * server-mysql.js
 * FRETEX - Backend com MySQL em vez de MongoDB
 * ============================================================
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.SOCKET_IO_ORIGINS?.split(',') || ['*'],
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ============================================================
// POOL DE CONEXÃO MYSQL
// ============================================================

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fretex',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ============================================================
// CRIAR TABELAS (Se não existirem)
// ============================================================

async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();

    // Tabela Usuarios
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        telefone VARCHAR(20),
        password VARCHAR(255) NOT NULL,
        tipo ENUM('cliente', 'motorista') NOT NULL,
        veiculo VARCHAR(100),
        avaliacao DECIMAL(3,1) DEFAULT 5.0,
        online BOOLEAN DEFAULT FALSE,
        dataCriacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela Fretes
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS fretes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        freteId VARCHAR(50) UNIQUE,
        clienteId INT NOT NULL,
        clienteNome VARCHAR(255),
        clienteEmail VARCHAR(255),
        motoristaId INT,
        motoristaNome VARCHAR(255),
        motoristaEmail VARCHAR(255),
        motoristaVeiculo VARCHAR(100),
        motoristaTelefone VARCHAR(20),
        motoristaAvaliacao DECIMAL(3,1),
        origem VARCHAR(255) NOT NULL,
        destino VARCHAR(255) NOT NULL,
        origemApt VARCHAR(100),
        destinoApt VARCHAR(100),
        item VARCHAR(255) NOT NULL,
        veiculo VARCHAR(100),
        peso DECIMAL(10,2),
        qtd INT DEFAULT 1,
        descricao TEXT,
        photo VARCHAR(255),
        preco DECIMAL(10,2),
        dist DECIMAL(10,2),
        schedule ENUM('now', 'later') DEFAULT 'now',
        agendado DATETIME,
        status ENUM('pendente', 'aceito', 'em_andamento', 'entregue', 'cancelado') DEFAULT 'pendente',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (clienteId) REFERENCES usuarios(id),
        FOREIGN KEY (motoristaId) REFERENCES usuarios(id)
      )
    `);

    // Tabela Mensagens
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS mensagens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        freteId INT NOT NULL,
        remetenteId INT NOT NULL,
        remetenteNome VARCHAR(255),
        destinatarioId INT NOT NULL,
        texto TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (freteId) REFERENCES fretes(id),
        FOREIGN KEY (remetenteId) REFERENCES usuarios(id),
        FOREIGN KEY (destinatarioId) REFERENCES usuarios(id)
      )
    `);

    connection.release();
    console.log('✅ Tabelas MySQL criadas/verificadas');
  } catch (error) {
    console.error('❌ Erro ao criar tabelas:', error);
  }
}

// Inicializar database
initializeDatabase();

// ============================================================
// HTTP ROUTES - AUTENTICAÇÃO
// ============================================================

app.post('/api/auth/registrar', async (req, res) => {
  try {
    const { nome, email, telefone, password, tipo, veiculo } = req.body;

    if (!nome || !email || !password || !tipo) {
      return res.status(400).json({ error: 'Campos obrigatórios faltam' });
    }

    const connection = await pool.getConnection();

    // Verificar se email já existe
    const [existing] = await connection.execute(
      'SELECT id FROM usuarios WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      connection.release();
      return res.status(400).json({ error: 'Email já registado' });
    }

    // Inserir novo utilizador
    const [result] = await connection.execute(
      'INSERT INTO usuarios (nome, email, telefone, password, tipo, veiculo) VALUES (?, ?, ?, ?, ?, ?)',
      [nome, email, telefone, password, tipo, veiculo || null]
    );

    connection.release();

    res.json({
      success: true,
      usuario: {
        id: result.insertId,
        nome,
        email,
        tipo
      }
    });
  } catch (error) {
    console.error('Erro registar:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const connection = await pool.getConnection();

    const [users] = await connection.execute(
      'SELECT * FROM usuarios WHERE email = ? AND password = ?',
      [email, password]
    );

    connection.release();

    if (users.length === 0) {
      return res.status(401).json({ error: 'Email ou password incorretos' });
    }

    const usuario = users[0];
    res.json({
      success: true,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo,
        veiculo: usuario.veiculo,
        avaliacao: usuario.avaliacao
      }
    });
  } catch (error) {
    console.error('Erro login:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// HTTP ROUTES - FRETES
// ============================================================

app.get('/api/fretes/disponiveis', async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [fretes] = await connection.execute(
      'SELECT * FROM fretes WHERE status = "pendente" ORDER BY createdAt DESC'
    );

    connection.release();

    res.json({ fretes });
  } catch (error) {
    console.error('Erro fretes:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/fretes/cliente/:clienteId', async (req, res) => {
  try {
    const { clienteId } = req.params;
    const connection = await pool.getConnection();

    const [fretes] = await connection.execute(
      'SELECT * FROM fretes WHERE clienteId = ? ORDER BY createdAt DESC',
      [clienteId]
    );

    connection.release();

    res.json({ fretes });
  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/fretes/motorista/:motoristaId', async (req, res) => {
  try {
    const { motoristaId } = req.params;
    const connection = await pool.getConnection();

    const [fretes] = await connection.execute(
      'SELECT * FROM fretes WHERE motoristaId = ? ORDER BY createdAt DESC',
      [motoristaId]
    );

    connection.release();

    res.json({ fretes });
  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// SOCKET.IO - EVENTOS
// ============================================================

const usuariosConectados = {};

io.on('connection', (socket) => {
  console.log('✅ Cliente conectado:', socket.id);

  socket.on('user_join', (data) => {
    usuariosConectados[data.usuarioId] = socket.id;
    console.log(`👤 Utilizador ${data.usuarioId} entrou na sala`);
  });

  socket.on('frete_criar', async (data) => {
    try {
      const connection = await pool.getConnection();
      const freteId = 'FR-' + Date.now();

      const [result] = await connection.execute(
        `INSERT INTO fretes (
          freteId, clienteId, clienteNome, clienteEmail, origem, destino,
          origemApt, destinoApt, item, veiculo, peso, qtd, descricao, preco, dist,
          schedule, agendado, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          freteId, data.clienteId, data.clienteNome, data.clienteEmail,
          data.origem, data.destino, data.origemApt, data.destinoApt,
          data.item, data.veiculo, data.peso, data.qtd, data.descricao,
          data.preco, data.dist, data.schedule, data.agendado || null, 'pendente'
        ]
      );

      connection.release();

      console.log('📦 Novo frete:', freteId);

      // Notificar todos os motoristas online
      io.emit('frete_novo', {
        freteId: freteId,
        clienteName: data.clienteNome,
        origin: data.origem,
        destination: data.destino,
        price: data.preco,
        description: data.descricao
      });

      // Email event
      io.emit('email_event', {
        tipo: 'frete_novo',
        freteId: freteId,
        clientName: data.clienteNome,
        origin: data.origem,
        destination: data.destino,
        price: data.preco
      });

    } catch (error) {
      console.error('Erro criar frete:', error);
      socket.emit('erro', { message: 'Erro ao criar frete' });
    }
  });

  socket.on('frete_aceitar', async (data) => {
    try {
      const connection = await pool.getConnection();

      const [fretes] = await connection.execute(
        'SELECT * FROM fretes WHERE freteId = ?',
        [data.freteId]
      );

      if (fretes.length === 0) {
        connection.release();
        return socket.emit('erro', { message: 'Frete não encontrado' });
      }

      const frete = fretes[0];

      // Atualizar frete
      await connection.execute(
        `UPDATE fretes SET status = 'aceito', motoristaId = ?, motoristaNome = ?, 
         motoristaEmail = ? WHERE freteId = ?`,
        [data.motoristaId, data.motoristaNome, data.motoristaEmail, data.freteId]
      );

      connection.release();

      console.log('✅ Frete aceito:', data.freteId);

      // Notificar cliente
      io.emit('frete_aceito', {
        freteId: data.freteId,
        motorista: {
          id: data.motoristaId,
          nome: data.motoristaNome,
          email: data.motoristaEmail,
          veiculo: data.motoristaVeiculo
        }
      });

      // Email event
      io.emit('email_event', {
        tipo: 'frete_aceito',
        freteId: data.freteId,
        motoristaNome: data.motoristaNome,
        clienteEmail: frete.clienteEmail
      });

    } catch (error) {
      console.error('Erro aceitar frete:', error);
      socket.emit('erro', { message: 'Erro ao aceitar frete' });
    }
  });

  socket.on('entrega_finalizar', async (data) => {
    try {
      const connection = await pool.getConnection();

      // Atualizar frete
      const [fretes] = await connection.execute(
        'SELECT * FROM fretes WHERE freteId = ?',
        [data.freteId]
      );

      const frete = fretes[0];

      await connection.execute(
        'UPDATE fretes SET status = "entregue" WHERE freteId = ?',
        [data.freteId]
      );

      connection.release();

      console.log('🎉 Entrega finalizada:', data.freteId);

      // Email events
      io.emit('email_event', {
        tipo: 'entrega_cliente',
        freteId: data.freteId,
        clienteEmail: frete.clienteEmail
      });

      io.emit('email_event', {
        tipo: 'entrega_motorista',
        freteId: data.freteId,
        motoristaEmail: frete.motoristaEmail,
        ganho: (frete.preco * 0.8).toFixed(2)
      });

    } catch (error) {
      console.error('Erro finalizar entrega:', error);
      socket.emit('erro', { message: 'Erro ao finalizar entrega' });
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Cliente desconectado:', socket.id);
  });
});

// ============================================================
// INICIAR SERVIDOR
// ============================================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║        🚚 FRETEX Backend Iniciado        ║
╠══════════════════════════════════════════╣
║  Server: http://localhost:${PORT}           ║
║  WebSocket: ws://localhost:${PORT}          ║
║  Database: MySQL (XAMPP)                 ║
║  phpMyAdmin: http://localhost/phpmyadmin ║
╚══════════════════════════════════════════╝
  `);
});

module.exports = server;