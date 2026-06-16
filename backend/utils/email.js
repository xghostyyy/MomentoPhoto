const nodemailer = require('nodemailer');

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
    const info = await transport.sendMail({ from, to, subject, html });
    console.log(`[email] отправлено на ${to}: ${subject} (messageId: ${info.messageId})`);
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
  if (!recipientEmail) {
    console.log(`[email] no recipient found for booking #${booking.id}, service="${booking.service}"`);
    return;
  }
  const html = `
    <h2>Новая заявка #${booking.id}</h2>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td><b>Клиент:</b></td><td>${booking.client_name}</td></tr>
      <tr><td><b>Телефон:</b></td><td>${booking.client_phone}</td></tr>
      <tr><td><b>Услуга:</b></td><td>${booking.service}</td></tr>
    </table>
    <p style="margin-top:16px;color:#888">Войдите в панель для подтверждения заявки.</p>
  `;
  await sendEmail(recipientEmail, `Новая заявка #${booking.id} — ${booking.service}`, html, smtpOverride);
}

async function sendConfirmationToClient(booking) {
  if (!booking.client_email) {
    console.log(`[email] no client_email for booking #${booking.id} — skipping client confirmation`);
    return;
  }
  const html = `
    <h2>Ваша запись подтверждена!</h2>
    <p>Здравствуйте, <b>${booking.client_name}</b>!</p>
    <p>Ваша заявка на <b>${booking.service}</b> подтверждена. Ждём вас в нашей студии.</p>
    <p>По вопросам звоните нам. Спасибо, что выбрали Momento!</p>
  `;
  await sendEmail(booking.client_email, `Подтверждение записи — ${booking.service}`, html);
}

async function sendFeedbackEmail({ name, email, message }, recipientEmail) {
  if (!recipientEmail) {
    console.log('[email] no manager found — feedback not forwarded');
    return;
  }
  const html = `
    <h2>Новое сообщение с сайта</h2>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td><b>Имя:</b></td><td>${name}</td></tr>
      <tr><td><b>Email:</b></td><td>${email || '—'}</td></tr>
    </table>
    <p style="margin-top:16px"><b>Сообщение:</b><br>${message.replace(/\n/g, '<br>')}</p>
  `;
  await sendEmail(recipientEmail, `Обратная связь от ${name}`, html);
}

module.exports = { sendEmail, verifySmtp, sendBookingNotification, sendConfirmationToClient, sendFeedbackEmail };
