# 🧪 GUIA DE TESTES - FRETEX

## Pre-requisitos

- ✅ Backend iniciado (`npm start`)
- ✅ MongoDB rodando
- ✅ EmailJS configurado
- ✅ 2 navegadores/abas (um cliente, um motorista)

---

## Checklist de Testes

### 1. ✅ Servidor Iniciado

```bash
npm start
```

Verificar:
- [ ] Mensagem "FRETEX Backend Iniciado"
- [ ] Servidor em http://localhost:3000
- [ ] MongoDB conectado
- [ ] Sem erros no console

---

### 2. ✅ HTML/CSS Carregam

Abrir: http://localhost:3000/FRETEX.html

Verificar:
- [ ] Página carrega sem erros
- [ ] Layout é responsivo
- [ ] Cores são corretas
- [ ] Botões funcionam

---

### 3. ✅ Registro e Email

1. Clique "Registar"
2. Preencha formulário:
   - Nome: "João Silva"
   - Email: seu@email.com
   - Tipo: Cliente
   - Password: 123456

Verificar:
- [ ] Botão "Registar" não está disabled
- [ ] Painel de verificação aparece
- [ ] Email recebido em seu@email.com
- [ ] Código aparece no email

---

### 4. ✅ Verificação de Email

1. Copie código do email
2. Digite nos 6 campos
3. Clique "Verificar"

Verificar:
- [ ] Código aceito
- [ ] "Email verificado com sucesso!"
- [ ] Redireciona para cliente-dashboard.html
- [ ] Email de boas-vindas recebido

---

### 5. ✅ Dashboard Cliente

Verificar na URL: cliente-dashboard.html

- [ ] Sidebar com menu
- [ ] Header com avatar
- [ ] Stats mostrando 0 fretes
- [ ] Seção "Novo Frete"
- [ ] Seção "Acompanhar"
- [ ] Seção "Histórico"

---

### 6. ✅ Registar Motorista

1. Abra nova aba/janela
2. Vá para http://localhost:3000/FRETEX.html
3. Registre como motorista:
   - Nome: "Carlos Teixeira"
   - Email: motorista@email.com
   - Tipo: Motorista
   - Veículo: Van
   - Password: 123456

Verificar:
- [ ] Campo "Veículo" aparece quando seleciona "Motorista"
- [ ] Código recebido
- [ ] Email de boas-vindas recebido
- [ ] Redireciona para motorista-dashboard.html

---

### 7. ✅ Login

1. Faça logout em ambas abas
2. Tente fazer login com email/password errados

Verificar:
- [ ] Mensagem "Email ou password incorretos"

3. Faça login correto

Verificar:
- [ ] Redireciona para dashboard correto
- [ ] Utilizador correto aparece no header

---

### 8. ✅ Socket.IO Connection

Abra console (F12) em ambas abas

Verificar:
- [ ] Nenhum erro de Socket.IO
- [ ] Mensagem "Socket conectado" ou similar

No servidor:
- [ ] "Cliente conectado: socket-id"
- [ ] "✅ cliente/motorista conectado"

---

### 9. ✅ Criar Frete

1. Na aba **Cliente**, clique "Novo Frete"
2. Preencha:
   - De: "Rua da Paz, Lisboa"
   - Para: "Avenida Brasil, Porto"
   - Item: "Documentos"
   - Peso: 2
   - Veículo: Van
   - Clique "Solicitar Frete"

Verificar:
- [ ] Formulário valida campos vazios
- [ ] Botão mostra loading "⏳ A enviar…"
- [ ] Muda para seção "Acompanhar"

No servidor:
- [ ] "📦 Novo frete criado: FR-..."

---

### 10. ✅ Motorista Recebe Notificação

Na aba **Motorista**:

Verificar:
- [ ] Toast "🚚 Novo frete de João Silva!"
- [ ] Frete aparece em "Pedidos Disponíveis"
- [ ] Card mostra: cliente, origem, destino, preço
- [ ] Botão "Aceitar" presente

Email:
- [ ] Motorista recebe email: "NOVO FRETE DISPONÍVEL"

---

### 11. ✅ Motorista Aceita

Na aba **Motorista**:
1. Clique "Aceitar" no frete

Verificar:
- [ ] Frete desaparece de "Disponíveis"
- [ ] Frete aparece em "Pedidos Ativos"
- [ ] Status muda para "Aceito"
- [ ] Botões de ação aparecem

No servidor:
- [ ] "✅ Motorista Carlos aceitou frete..."

Email:
- [ ] Cliente recebe: "MOTORISTA ENCONTRADO"

---

### 12. ✅ Cliente Recebe Notificação

Na aba **Cliente**:

Verificar:
- [ ] Toast "🎉 Carlos Teixeira aceitou seu frete!"
- [ ] Seção "Acompanhar" ativa
- [ ] Dados do motorista aparecem
- [ ] Botão "Chat" disponível

Email:
- [ ] Confirmação que motorista aceitou

---

### 13. ✅ Chat

Cliente clica "💬 Chat":

1. Digita mensagem: "Olá, tudo bem?"
2. Clica "Enviar"

Verificar:
- [ ] Mensagem aparece na bolha direita
- [ ] Motorista recebe
- [ ] Motorista responde
- [ ] Chat mostra ambas mensagens

---

### 14. ✅ GPS (Localização)

Motorista clica "Começou":

Verificar:
- [ ] Status muda para "Em andamento"
- [ ] Cliente vê mapa (se Leaflet está carregado)
- [ ] Marcador de motorista aparece
- [ ] ETA estimada mostra

No servidor:
- [ ] "📍 Localização enviada" a cada 3 segundos

---

### 15. ✅ Entrega Completa

Motorista clica "Finalizar":

Verificar:
- [ ] Status muda para "Entregue"
- [ ] Toast "🎉 Entrega concluída!"
- [ ] Cliente vê "Entrega Concluída!"

Emails:
- [ ] Cliente: "ENTREGA CONCLUÍDA"
- [ ] Motorista: "PAGAMENTO PROCESSADO" + Recibo

Recibo do Motorista deve incluir:
- [ ] Frete ID
- [ ] Cliente
- [ ] Origem → Destino
- [ ] Preço total
- [ ] Comissão (20%)
- [ ] **Ganho Motorista (80%)**

---

### 16. ✅ Histórico

Cliente clica "Histórico":

Verificar:
- [ ] Frete marcado como "Entregue"
- [ ] Card mostra informações completas
- [ ] Histórico é persistido (mesmo depois de refresh)

Motorista clica "Histórico":

Verificar:
- [ ] Frete aparece
- [ ] Ganho é mostrado
- [ ] Stats "Concluídas" incrementa

---

### 17. ✅ Persistência de Dados

Refresh na página (F5):

Verificar Cliente:
- [ ] Ainda está autenticado
- [ ] Histórico mantém fretes
- [ ] Dados carregam do localStorage

Verificar Motorista:
- [ ] Ainda está autenticado
- [ ] Stats mantêm valores
- [ ] Histórico mantém entregas

---

### 18. ✅ Logout

Cliente clica "Sair":

Verificar:
- [ ] Pede confirmação
- [ ] Redireciona para FRETEX.html
- [ ] localStorage limpo

---

## Testes de Erro

### 1. Email Inválido

```
Email: test
Password: 123456
```

Verificar:
- [ ] Aviso "Email inválido"

### 2. Password Fraca

```
Email: test@email.com
Password: 123
```

Verificar:
- [ ] Aviso "Password muito fraca"

### 3. Campos Vazios

Clique "Registar" sem preencher nada:

Verificar:
- [ ] Aviso "Preenche todos os campos"

### 4. Falha de Rede

Desconecte WiFi após clicar "Novo Frete":

Verificar:
- [ ] Mensagem de erro clara
- [ ] Não fica preso a carregar

---

## Testes de Performance

### 1. Muitos Fretes

Criar 10+ fretes simultaneamente:

Verificar:
- [ ] Sem lag
- [ ] Sem crashes
- [ ] Todos aparecem em real-time

### 2. Chat com Muitas Mensagens

Enviar 50+ mensagens:

Verificar:
- [ ] Scroll funciona
- [ ] Sem lag
- [ ] Mensagens carregam rápido

### 3. GPS Contínuo

Motorista enviando GPS por 5 minutos:

Verificar:
- [ ] Mapa atualiza sem lag
- [ ] Sem sobrecarga de bandwidth

---

## Testes com Browser DevTools

### Console (F12)

Verificar:
- [ ] Sem erros vermelhos
- [ ] Sem warnings críticas
- [ ] Socket.IO messages aparecem

### Network

Verificar:
- [ ] Requisições a /api/* são rápidas
- [ ] WebSocket conectado (status 101)
- [ ] Sem 404 ou 500 errors

### Storage

LocalStorage deve ter:
- [ ] `usuarioAtual` (user data)
- [ ] `pedidos_*` (histórico)
- [ ] `pedidosMotorista_*` (histórico motorista)

---

## Checklist Final

- [ ] Todas as 18 seções testadas
- [ ] Nenhum erro na console
- [ ] Email funciona
- [ ] Socket.IO funciona
- [ ] Dados persistem
- [ ] Performance aceitável
- [ ] Layout responsivo
- [ ] Logout funciona

---

## Relatório de Testes

Se algum teste falhar:

1. **Anotar o erro**
2. **Verificar console (F12)**
3. **Verificar server logs**
4. **Consultar GUIA_INTEGRACAO.md**
5. **Reportar issue com:**
   - Passo exato que falhou
   - Erro na console
   - Screenshot
   - Versão do Node.js

---

## Testes Automáticos (Futuro)

Quando tiver mais experiência, considere:

```bash
npm install --save-dev jest supertest
```

Então criar:
- `tests/auth.test.js`
- `tests/socket.test.js`
- `tests/email.test.js`

---

