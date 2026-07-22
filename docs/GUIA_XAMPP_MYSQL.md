# 📖 GUIA: FRETEX com XAMPP + MySQL

## ✅ Usando MySQL em vez de MongoDB

Este guia mostra como configurar FRETEX com **XAMPP e MySQL** em vez de MongoDB.

---

## 🚀 Passo 1: Instalar XAMPP

### 1.1 Descarregar

https://www.apachefriends.org/

Escolha: **XAMPP for Windows**

### 1.2 Instalar

1. Execute `xampp-windows-x64-installer.exe`
2. Deixe em `C:\xampp` (padrão)
3. Clique **Next** → **Install**
4. Finish

### 1.3 Iniciar XAMPP

Após instalar, abra: **XAMPP Control Panel** (ícone no Desktop ou Menu)

Verá janela com vários serviços.

---

## 🗄️ Passo 2: Iniciar MySQL

Na **XAMPP Control Panel**:

1. Procure **MySQL**
2. Clique em **Start** (botão verde)
3. Espere aparecer "running" (verde)

✅ **MySQL está agora rodando em localhost:3306**

---

## 📊 Passo 3: Criar Database

### 3.1 Abrir phpMyAdmin

No navegador, vá para:

```
http://localhost/phpmyadmin
```

### 3.2 Criar Base de Dados

1. No topo, clique em **"New"** ou **"Novo"**
2. **Database name:** `fretex`
3. **Collation:** deixe `utf8mb4_unicode_ci`
4. Clique **Create**

✅ **Database `fretex` criada!**

---

## 📝 Passo 4: Copiar Ficheiros do Projeto

### 4.1 Preparar Pasta

1. Crie pasta: `C:\fretex-backend`
2. Extraia o ZIP nela

### 4.2 Substituir server.js

**Substituir:**
```
server.js (versão MongoDB)
```

**Por:**
```
server-mysql.js (versão MySQL)
```

E renomeie para `server.js`

---

## ⚙️ Passo 5: Configurar .env

### 5.1 Copiar Template

```
cp .env-mysql.example .env
```

### 5.2 Editar .env

Abra `.env` e verifique:

```env
# MYSQL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=fretex

# EMAIL (adicione suas credenciais)
EMAILJS_PUBLIC_KEY=sua_public_key
EMAILJS_SERVICE_ID=seu_service_id
```

⚠️ **Importante:**
- `DB_PASSWORD` está vazio (padrão XAMPP)
- Se mudou a senha no XAMPP, atualize aqui
- Adicione suas credenciais EmailJS

---

## 📦 Passo 6: Instalar Dependências

```bash
npm install
```

Vai instalar:
- express
- socket.io
- mysql2 ← **NOVO** (para MySQL)
- emailjs
- etc.

---

## ▶️ Passo 7: Iniciar Backend

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
║  Database: MySQL (XAMPP)                 ║
║  phpMyAdmin: http://localhost/phpmyadmin ║
╚══════════════════════════════════════════╝
```

✅ **Backend rodando com MySQL!**

---

## 🌐 Passo 8: Verificar no phpMyAdmin

Volte para:

```
http://localhost/phpmyadmin
```

Na esquerda, procure: **fretex** → expanda

Deverá ver 3 tabelas:
- ✅ `usuarios`
- ✅ `fretes`
- ✅ `mensagens`

**Tabelas criadas automaticamente!** 🎉

---

## 🧪 Passo 9: Testar Aplicação

Abra no navegador:

```
http://localhost:3000/FRETEX.html
```

### Teste Fluxo Completo

1. **Aba 1 (Cliente):**
   - Registar como Cliente
   - Email real
   - Password: 123456

2. **Aba 2 (Motorista):**
   - Registar como Motorista
   - Email diferente
   - Password: 123456

3. **phpMyAdmin:**
   - Vá para `usuarios` → clique **Browse**
   - Deverá ver os 2 utilizadores registados! ✅

---

## 📊 Visualizar Dados em phpMyAdmin

### Ver Utilizadores

1. phpMyAdmin: http://localhost/phpmyadmin
2. Esquerda: `fretex` → `usuarios`
3. Clique **Browse**

Verá tabela com todos os utilizadores registados!

### Ver Fretes

1. Esquerda: `fretex` → `fretes`
2. Clique **Browse**

Verá todos os fretes criados!

### Ver Mensagens

1. Esquerda: `fretex` → `mensagens`
2. Clique **Browse**

---

## 🔧 Troubleshooting

### ❌ "Connection refused" (3306)

**Solução:**
- XAMPP Control Panel → MySQL → Start
- Verificar Status (deve estar verde)

### ❌ "Database fretex not found"

**Solução:**
1. Abra phpMyAdmin: http://localhost/phpmyadmin
2. Crie database `fretex`
3. Reinicie backend: `npm start`

### ❌ "Access denied for user 'root'@'localhost'"

**Solução:**
- Se mudou password XAMPP → MySQL, atualize `.env`:
  ```env
  DB_PASSWORD=sua_nova_senha
  ```

### ❌ "Port 3000 already in use"

**Solução:**
- Edite `.env`: `PORT=3001`
- Ou feche outro processo em 3000

---

## 📚 Estrutura de Dados

### Tabela: usuarios

```sql
id          INT (primary key)
nome        VARCHAR(255)
email       VARCHAR(255) UNIQUE
telefone    VARCHAR(20)
password    VARCHAR(255)
tipo        ENUM('cliente', 'motorista')
veiculo     VARCHAR(100)
avaliacao   DECIMAL(3,1)
online      BOOLEAN
dataCriacao TIMESTAMP
```

### Tabela: fretes

```sql
id              INT (primary key)
freteId         VARCHAR(50) UNIQUE
clienteId       INT (FK usuarios)
clienteNome     VARCHAR(255)
clienteEmail    VARCHAR(255)
motoristaId     INT (FK usuarios)
motoristaNome   VARCHAR(255)
motoristaEmail  VARCHAR(255)
origem          VARCHAR(255)
destino         VARCHAR(255)
item            VARCHAR(255)
preco           DECIMAL(10,2)
dist            DECIMAL(10,2)
status          ENUM('pendente', 'aceito', 'em_andamento', 'entregue', 'cancelado')
createdAt       TIMESTAMP
updatedAt       TIMESTAMP
```

### Tabela: mensagens

```sql
id              INT (primary key)
freteId         INT (FK fretes)
remetenteId     INT (FK usuarios)
remetenteNome   VARCHAR(255)
destinatarioId  INT (FK usuarios)
texto           TEXT
timestamp       TIMESTAMP
```

---

## 🎯 Diferenças MongoDB ↔ MySQL

| Aspecto | MongoDB | MySQL |
|---------|---------|-------|
| **Instalação** | Complexa | Simples (XAMPP) |
| **Iniciação** | `mongod` | XAMPP Control Panel |
| **Padrão** | NoSQL | SQL |
| **Ferramentas** | MongoDB Compass | phpMyAdmin |
| **Performance** | Rápido | Rápido |
| **Flexibilidade** | Muito (schema-less) | Menos (schema fixo) |

---

## ✅ Próximos Passos

1. ✓ Instalar XAMPP
2. ✓ Iniciar MySQL
3. ✓ Criar database `fretex`
4. ✓ Configurar `.env`
5. ✓ `npm install`
6. ✓ `npm start`
7. ✓ Testar em navegador
8. ✓ Ver dados em phpMyAdmin

---

## 📞 Suporte

### Documentação Completa

- [GUIA_INSTALACAO.md](GUIA_INSTALACAO.md)
- [GUIA_INTEGRACAO.md](GUIA_INTEGRACAO.md)
- [TESTES.md](TESTES.md)

### Ficheiros MySQL

- `server-mysql.js` ← Backend MySQL
- `.env-mysql.example` ← Configuração MySQL

---

## 🎉 Pronto!

Agora tem FRETEX rodando com **MySQL** em vez de MongoDB!

**Vantagens:**
- ✅ Mais fácil instalar (XAMPP)
- ✅ Menos dependências
- ✅ phpMyAdmin familiar (se conhece PHP)
- ✅ Mesma funcionalidade

**Próximo:** Testar e customizar! 🚀

