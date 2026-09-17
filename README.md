# 🚚 FRETEX — Plataforma de Logística e Fretes em Tempo Real

Aplicação web de fretes (estilo "Uber para cargas") com registo de cliente/motorista, criação e aceitação de fretes em tempo real via **Socket.IO**, chat integrado, rastreamento GPS e notificações por email (EmailJS).

- **Backend:** Node.js + Express + Socket.IO
- **Base de dados:** MongoDB (via Mongoose)
- **Autenticação:** JWT + bcrypt
- **Uploads:** Multer
- **Email transacional:** Nodemailer / EmailJS
- **Frontend:** HTML5 + CSS3 + JavaScript puro
- **Idioma:** Português (Portugal)
- **Licença:** MIT — © 2026 Pedro Firmino e José Bruno

---

## ✅ Nota sobre a origem do projeto

O `.zip` original tinha um **merge do Git por resolver**: vários ficheiros (`server.js`, `package.json`, `README.md` e todos os HTML/JS em `public/`) continham marcadores de conflito (`<<<<<<<`/`=======`/`>>>>>>>`) misturando duas versões — uma em **MongoDB** e outra em **MySQL/XAMPP** — o que impedia `npm start` de funcionar (`EJSONPARSE` no `package.json`, código duplicado no `server.js`, etc.).

Isso já foi corrigido nesta versão (`fretex-corrigido.zip`): mantive a versão **MongoDB/Mongoose**, que é a que corresponde aos `models/` (`Usuario.js`, `Frete.js`, `Mensagem.js`, `GPSTrajetoria.js`) e ao `.env`. O nome da pasta (`fretex-xampp-mysql`) é um resquício de uma tentativa de migração para MySQL que ficou incompleta — o backend atual usa MongoDB, não MySQL/XAMPP.

O `node_modules/` e o `.git/` (que estava com o merge a meio) não foram incluídos neste zip; basta correr `npm install` depois de extrair.

---

## 🚀 Instalação e arranque

### Pré-requisitos
- [Node.js](https://nodejs.org) ≥ 16
- Uma instância MongoDB (local, via `mongod`, ou um cluster gratuito no [MongoDB Atlas](https://www.mongodb.com/atlas))
- (Opcional) Conta gratuita em [EmailJS](https://www.emailjs.com) para notificações por email

### Passos

```bash
# 1. Extrair o projeto e entrar na pasta
cd fretex-xampp-mysql

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
```

Editar o `.env` com os seus valores:

```env
MONGODB_URI=mongodb://localhost:27017/fretex_db
PORT=3000
NODE_ENV=development
JWT_SECRET=uma_chave_secreta_longa_e_unica

# EmailJS (opcional, para emails de verificação/notificação)
EMAILJS_PUBLIC_KEY=...
EMAILJS_SERVICE_ID=...
```

```bash
# 4. Iniciar o servidor
npm start        # produção
npm run dev       # desenvolvimento, com nodemon
```

### Aceder à aplicação

- App: `http://localhost:3000/FRETEX.html`
- Login: `http://localhost:3000/login.html`
- API de teste: `http://localhost:3000/api/test`

---

## 📂 Estrutura do projeto

```
fretex-xampp-mysql/
├── server.js                     Backend (Express + Socket.IO + Mongoose)
├── package.json                  Dependências e scripts
├── .env / .env.example           Configuração de ambiente
├── models/
│   ├── Usuario.js                Schema de utilizadores (cliente/motorista)
│   ├── Frete.js                  Schema de fretes
│   ├── Mensagem.js                Schema de mensagens de chat
│   └── GPSTrajetoria.js           Schema de trajetórias GPS
├── public/
│   ├── FRETEX.html               Landing page + login
│   ├── login.html                Página de autenticação
│   ├── cliente-dashboard.html    Dashboard do cliente
│   ├── motorista-dashboard.html  Dashboard do motorista
│   ├── estilo.css                Estilos globais
│   ├── uploads/                  Ficheiros enviados (fotos, documentos)
│   └── js/
│       ├── auth.js               Lógica de login/registo
│       ├── cliente-socket.js     Eventos Socket.IO do cliente
│       ├── motorista-socket.js   Eventos Socket.IO do motorista
│       └── emailjs-fretex.js     Integração com EmailJS
└── docs/
    ├── GUIA_XAMPP_MYSQL.md       Guia da variante MySQL/XAMPP
    ├── QUICK_START.md            Resumo rápido
    └── TESTES.md                 Plano de testes
```

---

## 📋 Funcionalidades

- ✅ Registo e login de **clientes** e **motoristas** (JWT)
- ✅ Criação e aceitação de fretes em tempo real (Socket.IO)
- ✅ Chat instantâneo entre cliente e motorista
- ✅ Rastreamento GPS da entrega (trajetória guardada em `GPSTrajetoria`)
- ✅ Notificações por email (novo frete, frete aceite, entrega, etc.)
- ✅ Upload de fotos/documentos (Multer)
- ✅ Interface responsiva (mobile-friendly)

## 📡 Principais eventos Socket.IO

| Evento | Descrição |
|---|---|
| `user_join` | Regista a ligação do utilizador (sala pessoal) |
| `frete_criar` | Cliente cria um novo pedido de frete |
| `frete_aceitar` | Motorista aceita um frete disponível |
| `entrega_iniciar` / `entrega_finalizar` | Início e fim da entrega |
| `localizacao_motorista` | Atualização de coordenadas GPS |
| `mensagem_enviar` | Envio de mensagem de chat |

---

## 🧪 Testar o fluxo completo

1. Abrir dois navegadores/abas.
2. Aba 1: registar como **cliente** e criar um frete.
3. Aba 2: registar como **motorista** e aceitar o frete recebido.
4. Confirmar troca de mensagens no chat e atualização de estado do frete.

---

## 📖 Documentação adicional

- [`docs/QUICK_START.md`](docs/QUICK_START.md)
- [`docs/TESTES.md`](docs/TESTES.md)
- [`FLUXO_COMPLETO.md`](FLUXO_COMPLETO.md)
- [`docs/GUIA_XAMPP_MYSQL.md`](docs/GUIA_XAMPP_MYSQL.md) — guia para quem preferir migrar de facto para MySQL/XAMPP

---

**FRETEX** — desenvolvido para Portugal 🇵🇹
