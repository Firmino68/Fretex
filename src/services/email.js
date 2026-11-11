
'use strict';

const nodemailer = require('nodemailer');

function criarServicoEmail(config) {
  if (!config.smtp || !config.smtp.user || !config.smtp.pass) {
    throw new Error('Configuração SMTP incompleta.');
  }

  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass
    }
  });

  async function enviarCodigoVerificacao(email, nome, codigo) {
    if (!email || !codigo || !/^\d{6}$/.test(String(codigo))) {
      throw new Error('Dados inválidos para envio do código.');
    }

    return transporter.sendMail({
      from: {
        name: 'FRETEX',
        address: config.smtp.from
      },
      to: email,
      subject: 'Confirmação do teu email - FRETEX',
      text: `Olá ${nome || ''},

O teu código de confirmação do FRETEX é: ${codigo}

Este código é válido durante 10 minutos.

Se não solicitaste esta confirmação, ignora esta mensagem.

Equipa FRETEX`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px">
          <h2 style="color:#2563eb">Bem-vindo ao FRETEX!</h2>
          <p>Olá ${String(nome || 'utilizador').replace(/[&<>"']/g, c => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
          })[c])},</p>
          <p>Utiliza este código para confirmar o teu endereço de email:</p>
          <div style="font-size:30px;font-weight:bold;letter-spacing:8px;padding:18px;background:#f1f5f9;text-align:center">
            ${codigo}
          </div>
          <p>O código é válido durante <strong>10 minutos</strong>.</p>
          <p>Se não solicitaste esta confirmação, ignora esta mensagem.</p>
          <hr>
          <small>Equipa FRETEX</small>
        </div>
      `
    });
  }

  async function verificarLigacao() {
    await transporter.verify();
    return true;
  }

  return {
    enviarCodigoVerificacao,
    verificarLigacao
  };
}

module.exports = { criarServicoEmail };
