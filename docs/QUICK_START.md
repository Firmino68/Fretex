# ⚡ QUICK START - 5 MINUTOS

## 0. Copiar Arquivos

```bash
# Copiar os 13 arquivos públicos
cp FINAL_10_cliente-dashboard.html public/cliente-dashboard.html
cp FINAL_11_motorista-dashboard.html public/motorista-dashboard.html
cp FINAL_12_FRETEX.html public/FRETEX.html
cp FINAL_13_estilo.css public/estilo.css

# Copiar JS
cp FINAL_02_cliente-socket.js public/js/cliente-socket.js
cp FINAL_03_motorista-socket.js public/js/motorista-socket.js
cp FINAL_04_emailjs-fretex.js public/js/emailjs-fretex.js
cp FINAL_05_auth.js public/js/auth.js

# Criar pasta js se não existir
mkdir -p public/js

# Copiar server
cp FINAL_01_server.js server.js

# Copiar config
cp FINAL_06_package.json package.json
cp FINAL_07_.env.example .env
```

---

## 1. Instalar

```bash
npm install
```

(2 minutos - depende da internet)

---

## 2. Configurar Email

**Abrir conta EmailJS:**

1. Ir a https://emailjs.com
2. Registar (gratuito)
3. Copiar **Public Key** (Settings > API Keys)
4. Copiar **Service ID** (Email Services)

**Atualizar `public/js/emailjs-fretex.js`:**

```javascript
const EMAILJS_CONFIG = {
  publicKey: 'COLE_AQUI_SUA_PUBLIC_KEY',
  serviceId: 'COLE_AQUI_SEU_SERVICE_ID',
  // ...
};
```

**Criar 7 Templates (5 min):**

[Ver instruções em FINAL_14_GUIA_INSTALACAO.md]

---

## 3. Configurar MongoDB

### Opção A: Local

```bash
# macOS
brew install mongodb-community
brew services start mongodb-community

# Ou Docker
docker run -d -p 27017:27017 --name fretex-mongo mongo:7.0
```

### Opção B: Atlas (Cloud)

1. Ir a https://www.mongodb.com/cloud/atlas
2. Criar cluster gratuito
3. Copiar connection string
4. Editar `.env`:

```env
MONGODB_URI=mongodb+srv://usuario:senha@cluster.mongodb.net/fretex
```

---

## 4. Iniciar

```bash
npm start
```

Deverá ver:

```
╔══════════════════════════════════════════╗
║        🚚 FRETEX Backend Iniciado        ║
╠══════════════════════════════════════════╣
║  Server: http://localhost:3000           ║
║  WebSocket: ws://localhost:3000          ║
║  Database: fretex                        ║
╚══════════════════════════════════════════╝
```

---

## 5. Testar

### Abrir em 2 Navegadores

1. **Cliente:** http://localhost:3000/FRETEX.html
   - Registar como Cliente
   - Usar email real para testar

2. **Motorista:** http://localhost:3000/FRETEX.html (outra aba/janela)
   - Registar como Motorista
   - Usar email diferente

### Testar Flow Completo

1. **Cliente** → Novo Frete → Preencher → Solicitar
2. **Motorista** → Ver notificação → Aceitar
3. **Cliente** → Receber email → Ver motorista aceitar
4. **Motorista** → Iniciar entrega → Finalizar
5. **Ambos** → Receber emails

---

## Folder Structure (Rápido)

```
.
├── server.js                    # Backend
├── package.json
├── .env                         # Sua config
├── public/
│   ├── FRETEX.html
│   ├── cliente-dashboard.html
│   ├── motorista-dashboard.html
│   ├── estilo.css
│   └── js/
│       ├── auth.js
│       ├── emailjs-fretex.js
│       ├── cliente-socket.js
│       └── motorista-socket.js
└── logs/
```

---

## Endpoints Principais

```
POST   /api/auth/registrar       Registar novo utilizador
POST   /api/auth/login           Fazer login
GET    /api/fretes/disponiveis   Listar fretes disponíveis
GET    /api/fretes/cliente/:id   Fretes do cliente
GET    /api/fretes/motorista/:id Fretes do motorista
```

---

## Socket.IO Events

```
CLIENT → SERVER:
  user_join              Utilizador conecta
  frete_criar            Criar novo frete
  frete_aceitar          Aceitar frete
  entrega_iniciar        Iniciar entrega
  entrega_finalizar      Finalizar entrega
  mensagem_enviar        Enviar mensagem
  localizacao_atualizar  Enviar GPS

SERVER → CLIENT:
  frete_novo             Novo frete disponível
  frete_aceito           Motorista aceitou
  frete_indisponivel     Outro aceitar primeiro
  entrega_iniciada       Entrega começou
  entrega_concluida      Entrega terminou
  mensagem_nova          Mensagem recebida
  localizacao_motorista  GPS atualizado
  email_event            Trigger de email
```

---

## Troubleshooting Rápido

### Erro: "MongoDB connection refused"

```bash
# Iniciar MongoDB
mongod

# Ou com Docker
docker run -d -p 27017:27017 mongo:7.0
```

### Erro: "Port 3000 already in use"

```bash
# Mudar porta no .env
PORT=3001 npm start
```

### Erro: "EmailJS not initialized"

```javascript
// console do navegador
testarEmailJS()  // Testa conexão
```

### Erro: Socket.IO não conecta

```bash
# Verificar CORS no .env
SOCKET_IO_ORIGINS=http://localhost:3000,http://localhost:5500
```

---

## Próximos Passos

1. ✅ **Testar completamente:** Ver `FINAL_16_TESTES.md`
2. ✅ **Entender fluxo:** Ver `FINAL_15_GUIA_INTEGRACAO.md`
3. ✅ **Problema?:** Ver `FINAL_14_GUIA_INSTALACAO.md`
4. ✅ **Deploy:** Ver `FINAL_18_INDICE_FINAL.md`

---

## Comandos Úteis

```bash
# Desenvolvimento
npm start                  # Iniciar backend
npm run dev               # Com nodemon (auto-reload)

# Docker
docker-compose up -d      # Iniciar tudo
docker-compose logs -f    # Ver logs
docker-compose down       # Parar tudo

# Email
node -e "require('emailjs-com')"  # Testar dependência

# Database
mongosh                   # Conectar MongoDB
db.usuarios.find()        # Ver utilizadores
db.fretes.find()          # Ver fretes
```

---

## Sucesso! 🎉

Se tudo funcionou:

1. ✅ Backend rodando
2. ✅ MongoDB conectado
3. ✅ Email funcionando
4. ✅ Socket.IO em tempo real
5. ✅ Fretes a aparecer
6. ✅ Emails a ser enviados

**Próximo:** Customizar para sua empresa!

---

