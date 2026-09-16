# 🚚 FRETEX - Plataforma de Logística em Tempo Real

## Versão MongoDB

Aplicação web de gestão de fretes com comunicação em tempo real através de **Socket.IO**, base de dados **MongoDB** e integração com **EmailJS**.

**Versão:** 2.0  
**Base de Dados:** MongoDB  
**Linguagem:** Português (Portugal)  
**Backend:** Node.js + Express.js  
**Comunicação em tempo real:** Socket.IO  
**Status:** ✅ Pronto para Produção

---

## 📋 Índice

- [Sobre o Projeto](#-sobre-o-projeto)
- [Funcionalidades](#-funcionalidades)
- [Tecnologias](#-tecnologias)
- [Requisitos](#-requisitos)
- [Instalação](#-instalação)
- [Configuração do MongoDB](#-configuração-do-mongodb)
- [Configuração do Ambiente](#-configuração-do-ambiente)
- [Executar o Projeto](#-executar-o-projeto)
- [Acessos Úteis](#-acessos-úteis)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Modelos MongoDB](#-modelos-mongodb)
- [Testes](#-testes)
- [Rastreamento GPS](#-rastreamento-gps)
- [Comunicação em Tempo Real](#-comunicação-em-tempo-real)
- [EmailJS](#-emailjs)
- [Segurança](#-segurança)
- [Resolução de Problemas](#-resolução-de-problemas)
- [Desenvolvimento](#-desenvolvimento)
- [Licença](#-licença)

---

## 📌 Sobre o Projeto

O **FRETEX** é uma plataforma web de logística desenvolvida para facilitar a criação, gestão e acompanhamento de fretes em tempo real.

A plataforma permite a comunicação entre **clientes** e **motoristas**, disponibilizando funcionalidades como:

- Criação de fretes
- Aceitação de fretes
- Comunicação em tempo real
- Chat entre utilizadores
- Rastreamento GPS
- Registo de trajetórias
- Notificações
- Gestão de utilizadores
- Integração com EmailJS

O sistema utiliza **MongoDB** como base de dados e **MongoDB Compass** como ferramenta opcional para visualizar e administrar os dados.

---

# 🚀 Funcionalidades

### 👤 Autenticação

- Registo de utilizadores
- Login
- Diferenciação entre Cliente e Motorista
- Validação de email
- Gestão de sessão

### 📦 Gestão de Fretes

- Criar novos fretes
- Consultar fretes disponíveis
- Aceitar fretes
- Acompanhar o estado do frete
- Atualização em tempo real

### 💬 Chat

- Comunicação entre cliente e motorista
- Mensagens em tempo real
- Histórico de mensagens armazenado na base de dados

### 📍 Rastreamento GPS

- Obtenção da localização do motorista
- Atualização da posição em tempo real
- Acompanhamento da trajetória
- Registo de pontos GPS
- Visualização da evolução do percurso

### 📧 Email

Integração com **EmailJS** para envio de notificações por email.

### 📱 Interface

- Interface responsiva
- Compatível com dispositivos móveis
- Dashboard para clientes
- Dashboard para motoristas

---

# 🛠️ Tecnologias

## Backend

- **Node.js**
- **Express.js**
- **Socket.IO**
- **MongoDB**
- **Mongoose**

## Frontend

- **HTML5**
- **CSS3**
- **JavaScript**
- **Socket.IO Client**

## Serviços

- **MongoDB**
- **MongoDB Compass**
- **EmailJS**

---

# 💻 Requisitos

Antes de executar o projeto, instala os seguintes componentes:

### Node.js

É necessário ter o Node.js instalado.

Verificar a instalação:

```bash
node --version
