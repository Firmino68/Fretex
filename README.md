# 🚚 FRETEX - Plataforma de Logística em Tempo Real
## Versão XAMPP/MySQL

Aplicação web de fretes com Socket.IO em tempo real, **MySQL (XAMPP)** e EmailJS.

**Versão:** 2.0  
**Database:** MySQL (XAMPP)  
**Linguagem:** Português (Portugal)  
**Status:** ✅ Pronto para Produção

---

## 🚀 Quick Start (10 minutos)

### 1. Instalar XAMPP

https://www.apachefriends.org/

Escolha: **XAMPP for Windows** (ou seu SO)

### 2. Iniciar XAMPP

Abra: **XAMPP Control Panel**
- Clique **Start** em **MySQL**

### 3. Criar Database

Abra: http://localhost/phpmyadmin
- Clique **New**
- Database name: `fretex`
- Clique **Create**

### 4. Instalar Dependências

```bash
npm install
```

### 5. Configurar .env

Edite `.env`:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=fretex

EMAILJS_PUBLIC_KEY=sua_public_key
EMAILJS_SERVICE_ID=seu_service_id
```

### 6. Iniciar Backend

```bash
npm start
```

### 7. Abrir no Navegador

```
http://localhost:3000/FRETEX.html
```

---

## 📖 Documentação

- **[GUIA_XAMPP_MYSQL.md](docs/GUIA_XAMPP_MYSQL.md)** - Setup XAMPP/MySQL detalhado
- **[QUICK_START.md](docs/QUICK_START.md)** - Resumo rápido
- **[TESTES.md](docs/TESTES.md)** - Plano de testes

---

## 📂 Estrutura do Projeto

```
fretex-xampp-mysql/
├── server.js                    Backend (MySQL)
├── package.json                 Dependências
├── .env                        Configuração
├── README.md                   Este arquivo
│
├── public/
│   ├── FRETEX.html            Landing + Login
│   ├── cliente-dashboard.html Dashboard Cliente
│   ├── motorista-dashboard.html Dashboard Motorista
│   ├── estilo.css             Estilos
│   ├── js/
│   │   ├── auth.js
│   │   ├── emailjs-fretex.js
│   │   ├── cliente-socket.js
│   │   └── motorista-socket.js
│   └── uploads/
│       ├── fotos/
│       └── documentos/
│
├── logs/                      Logs
└── docs/
    ├── GUIA_XAMPP_MYSQL.md
    ├── QUICK_START.md
    └── TESTES.md
```

---

## 🛠️ Tecnologias

- **Backend:** Node.js + Express.js
- **Database:** MySQL (via XAMPP)
- **Real-time:** Socket.IO
- **Frontend:** HTML5 + CSS3 + JavaScript
- **Email:** EmailJS

---

## 📋 Funcionalidades

✅ Autenticação com Email Verificado  
✅ Criar & Aceitar Fretes em Tempo Real  
✅ Chat Instantâneo  
✅ Rastreamento GPS  
✅ Notificações por Email  
✅ Responsivo (Mobile-friendly)  

---

## 🧪 Testes

Abrir 2 navegadores:

1. **Browser 1:** Cliente
2. **Browser 2:** Motorista

Testar fluxo:
- Cliente → Novo Frete
- Motorista → Notificação
- Motorista → Aceita
- Cliente → Recebe email

Ver dados em **phpMyAdmin**: http://localhost/phpmyadmin

---

## 🌐 Acessos Úteis

- **App:** http://localhost:3000/FRETEX.html
- **phpMyAdmin:** http://localhost/phpmyadmin
- **Backend:** http://localhost:3000

---

## ✅ Checklist

- [ ] Instalar XAMPP
- [ ] Iniciar MySQL
- [ ] Criar database `fretex`
- [ ] `npm install`
- [ ] Editar `.env`
- [ ] `npm start`
- [ ] Abrir http://localhost:3000/FRETEX.html
- [ ] Testar com 2 navegadores

---

**Desenvolvido com ❤️ para Portugal**  
**Versão 2.0 - Junho 2024**
