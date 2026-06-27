// src/providers/email/templates.js — templates HTML dos e-mails transacionais.
// Funções puras: recebem dados, retornam { subject, html, text }.
// Mantidos simples e inline (sem engine de template) por legibilidade.

const env = require('../../config/env');

function layout(title, bodyHtml) {
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
      <tr><td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px;">
          <tr><td>
            <h1 style="font-size:20px;margin:0 0 16px;">${title}</h1>
            ${bodyHtml}
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
            <p style="font-size:12px;color:#9ca3af;margin:0;">
              Este é um e-mail automático. Se você não reconhece esta ação, ignore esta mensagem.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

const button = (href, label) =>
  `<a href="${href}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;">${label}</a>`;

// Boas-vindas (após registro).
function welcome({ name }) {
  const subject = 'Bem-vindo(a)!';
  const html = layout(
    `Olá, ${name}!`,
    `<p style="font-size:14px;line-height:1.6;">Sua conta foi criada com sucesso. Você já pode acessar a plataforma e começar a usar os recursos.</p>
     <p style="margin:24px 0;">${button(env.APP_WEB_URL, 'Acessar a plataforma')}</p>`,
  );
  const text = `Olá, ${name}! Sua conta foi criada com sucesso. Acesse: ${env.APP_WEB_URL}`;
  return { subject, html, text };
}

// Recuperação de senha.
function passwordReset({ name, resetUrl, expiresInMin }) {
  const subject = 'Recuperação de senha';
  const html = layout(
    'Redefinir sua senha',
    `<p style="font-size:14px;line-height:1.6;">Olá${name ? `, ${name}` : ''}. Recebemos um pedido para redefinir sua senha. O link abaixo é válido por <strong>${expiresInMin} minutos</strong>.</p>
     <p style="margin:24px 0;">${button(resetUrl, 'Redefinir senha')}</p>
     <p style="font-size:12px;color:#6b7280;word-break:break-all;">Ou copie e cole esta URL no navegador:<br/>${resetUrl}</p>`,
  );
  const text = `Redefina sua senha (válido por ${expiresInMin} min): ${resetUrl}`;
  return { subject, html, text };
}

// Confirmação de senha alterada.
function passwordChanged({ name }) {
  const subject = 'Sua senha foi alterada';
  const html = layout(
    'Senha alterada',
    `<p style="font-size:14px;line-height:1.6;">Olá${name ? `, ${name}` : ''}. Sua senha foi alterada com sucesso. Se não foi você, entre em contato com o suporte imediatamente.</p>`,
  );
  const text = 'Sua senha foi alterada com sucesso. Se não foi você, contate o suporte.';
  return { subject, html, text };
}

// Convite de paciente provisionado pela nutricionista (com credenciais temporárias).
function patientInvite({ name, nutritionistName, email, tempPassword }) {
  const subject = 'Você foi convidado(a) para a plataforma';
  const html = layout(
    `Olá, ${name}!`,
    `<p style="font-size:14px;line-height:1.6;">${nutritionistName ? `<strong>${nutritionistName}</strong> criou` : 'Foi criado'} um acesso para você na plataforma.</p>
     <p style="font-size:14px;line-height:1.6;">Use as credenciais abaixo no primeiro acesso e altere sua senha em seguida:</p>
     <p style="font-size:14px;background:#f3f4f6;border-radius:8px;padding:12px;">
       E-mail: <strong>${email}</strong><br/>
       Senha temporária: <strong>${tempPassword}</strong>
     </p>
     <p style="margin:24px 0;">${button(env.APP_WEB_URL, 'Acessar agora')}</p>`,
  );
  const text = `Acesso criado. E-mail: ${email} / Senha temporária: ${tempPassword}. Acesse: ${env.APP_WEB_URL}`;
  return { subject, html, text };
}

module.exports = { welcome, passwordReset, passwordChanged, patientInvite };
