const nodemailer = require('nodemailer');

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function createTransport(override = {}) {
  const host = override.mail_host || process.env.MAIL_HOST;
  const port = Number(override.mail_port || process.env.MAIL_PORT) || 465;
  const user = override.mail_user || process.env.MAIL_USER;
  const pass = override.mail_pass || process.env.MAIL_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

async function sendEmail(to, subject, html, override = {}) {
  const transport = createTransport(override);
  if (!transport) {
    console.warn(`[email] SMTP не настроен — письмо не отправлено. Получатель: ${to}, Тема: ${subject}`);
    return;
  }
  const senderUser = override.mail_user || process.env.MAIL_USER;
  const from = `"Momento Studio" <${senderUser}>`;
  try {
    await transport.sendMail({ from, to, subject, html });
  } catch (err) {
    console.error(`[email] ошибка отправки на ${to}: ${err.message}`);
    throw err;
  }
}

async function verifySmtp(override = {}) {
  const transport = createTransport(override);
  if (!transport) throw new Error('SMTP не настроен');
  await transport.verify();
}

async function sendBookingNotification(booking, recipientEmail, smtpOverride = {}) {
  if (!recipientEmail) return;
  const html = `
    <h2>Новая заявка #${booking.id}</h2>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td><b>Клиент:</b></td><td>${escHtml(booking.client_name)}</td></tr>
      <tr><td><b>Телефон:</b></td><td>${escHtml(booking.client_phone)}</td></tr>
      <tr><td><b>Услуга:</b></td><td>${escHtml(booking.service)}</td></tr>
    </table>
    <p style="margin-top:16px;color:#888">Войдите в панель для подтверждения заявки.</p>
  `;
  await sendEmail(recipientEmail, `Новая заявка #${booking.id} — ${escHtml(booking.service)}`, html, smtpOverride);
}

async function sendConfirmationToClient(booking, smtpOverride = {}) {
  if (!booking.client_email) return;
  const html = `
    <h2>Ваша запись подтверждена!</h2>
    <p>Здравствуйте, <b>${escHtml(booking.client_name)}</b>!</p>
    <p>Ваша заявка на <b>${escHtml(booking.service)}</b> подтверждена. Ждём вас в нашей студии.</p>
    <p>По вопросам звоните нам. Спасибо, что выбрали Momento!</p>
  `;
  await sendEmail(booking.client_email, `Подтверждение записи — ${escHtml(booking.service)}`, html, smtpOverride);
}

async function sendFeedbackEmail({ name, email, message }, recipientEmail, smtpOverride = {}) {
  if (!recipientEmail) return;
  const html = `
    <h2>Новое сообщение с сайта</h2>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td><b>Имя:</b></td><td>${escHtml(name)}</td></tr>
      <tr><td><b>Email:</b></td><td>${escHtml(email) || '—'}</td></tr>
    </table>
    <p style="margin-top:16px"><b>Сообщение:</b><br>${escHtml(message).replace(/\n/g, '<br>')}</p>
  `;
  await sendEmail(recipientEmail, `Обратная связь от ${escHtml(name)}`, html, smtpOverride);
}

module.exports = { sendEmail, verifySmtp, sendBookingNotification, sendConfirmationToClient, sendFeedbackEmail };
