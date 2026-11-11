# 🚚 FRETEX

Aplicação web full-stack para **gestão e acompanhamento de fretes em tempo real**. Os clientes pedem transportes, os motoristas aceitam-nos, e ambos comunicam por chat e seguem a trajetória GPS da entrega.

> Projeto de portefólio · Node.js · Express · MongoDB · Socket.IO

## Funcionalidades

- Registo e login de **clientes** e **motoristas** (JWT, palavras-passe com hash `bcrypt`)
- Cliente cria pedidos de frete (origem, destino, preço, carga) com mapa (Leaflet / OpenStreetMap)
- Motoristas veem os pedidos disponíveis em tempo real e aceitam-nos (aceitação atómica: só um motorista ganha o frete)
- Estados do frete: `disponivel → aceito → em_andamento → entregue`
- Chat entre cliente e motorista por frete
- Trajetória GPS do motorista, guardada e mostrada ao cliente
- Notificações por email via EmailJS (no navegador)

## Arquitetura

Um único processo Node.js. **Não é necessário Apache/XAMPP.**

```
Browser ──► http://localhost:3000
              │
              ├─ Express ── frontend estático (public/)  →  "/" serve FRETEX.html
              ├─ Express ── API REST (/api/auth, /api/fretes)
              ├─ Socket.IO (mesmo servidor e mesma origem)
              └─ Mongoose ─► MongoDB
```

```
server.js            arranque: HTTP + Socket.IO + ligação à BD + encerramento limpo
src/config/env.js    leitura e validação das variáveis de ambiente
src/app.js           aplicação Express (helmet, rate limit, rotas, erros)
src/middleware/      autenticação JWT e autorização por perfil
src/routes/          auth.js, fretes.js
src/services/        utilitários de fretes
src/sockets/         eventos Socket.IO (autenticados por JWT)
models/              Usuario, Frete, Mensagem, GPSTrajetoria (Mongoose)
public/              HTML, CSS e JavaScript do frontend
tests/               testes automáticos (node:test + supertest)
```

## Requisitos

- **Node.js 20.19 ou superior** (testado com 22; desenvolvido em 24)
- **MongoDB** local (Community Server) ou uma conta gratuita no MongoDB Atlas

## Executar localmente (Windows)

```powershell
git clone https://github.com/Firmino68/Fretex.git
cd Fretex
npm install
copy .env.example .env
```

Edita o `.env` e define, no mínimo, `MONGODB_URI` e `JWT_SECRET`. Para gerar uma chave:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Arranca (com o MongoDB ativo):

```powershell
npm start        # produção/normal
npm run dev      # com reinício automático (nodemon)
```

Abre **http://localhost:3000**. Se faltar uma variável obrigatória, o servidor termina com uma mensagem a indicar qual.

### Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `MONGODB_URI` | sim | Ligação ao MongoDB |
| `JWT_SECRET` | sim | Chave dos tokens (mín. 32 caracteres) |
| `PORT` | não | Porta (defeito `3000`) |
| `NODE_ENV` | não | `development` ou `production` |
| `JWT_EXPIRES_IN` | não | Duração do token (defeito `7d`) |
| `CORS_ORIGINS` | não | Só se o frontend for servido de outra origem |

## API

| Método e rota | Acesso | Descrição |
|---|---|---|
| `POST /api/auth/registrar` | público | Cria conta e devolve token |
| `POST /api/auth/login` | público | Autentica e devolve token |
| `GET /api/auth/perfil` | autenticado | Perfil do utilizador |
| `GET /api/fretes/disponiveis` | motorista | Fretes à espera de motorista |
| `POST /api/fretes/criar` | cliente | Cria um frete |
| `GET /api/fretes/meus` | autenticado | Fretes do próprio utilizador |
| `GET /api/fretes/:id` | cliente dono / motorista atribuído | Detalhe de um frete |

Os pedidos autenticados usam o cabeçalho `Authorization: Bearer <token>`. O Socket.IO envia o token em `auth.token` no handshake; ligações sem token válido são recusadas.

## Testes

```powershell
npm test
```

Cobrem validação da configuração, rotas e autorização da API, e o fluxo em tempo real por Socket.IO (criar → aceitar → iniciar → chat → finalizar, incluindo tentativas de falsificação de identidade).

Os testes com base de dados precisam de MongoDB acessível em `mongodb://127.0.0.1:27017` (usam bases `fretex_test_*`, apagadas no fim). Para outro endereço:

```powershell
$env:TEST_MONGODB_URI="mongodb://127.0.0.1:27018"; npm test
```

Sem MongoDB, esses testes aparecem como *skipped*.

## Segurança

- JWT obrigatório em todas as rotas privadas e no Socket.IO; a identidade vem sempre do token, nunca do pedido
- Autorização por perfil (cliente/motorista) e por posse do frete
- Palavras-passe com `bcryptjs`; mensagens de login iguais para email inexistente e password errada
- `helmet`, limite de tentativas no login/registo, limite de tamanho do corpo dos pedidos
- Sem CORS aberto (mesma origem); sem segredos no código; erros internos não são enviados ao cliente em produção
- Texto de outros utilizadores é escapado antes de ser inserido no HTML

## Limitações conhecidas

- A **verificação de email** é feita no navegador (código gerado e validado no cliente, enviado por EmailJS). Serve de demonstração, não é uma verificação segura; o servidor não a impõe.
- O token JWT fica no `localStorage`.
- Geocodificação e rotas dependem de serviços públicos (Nominatim e OSRM).
- A Content-Security-Policy está desligada porque as páginas usam scripts inline.

## Licença

MIT — ver [LICENSE](LICENSE).
