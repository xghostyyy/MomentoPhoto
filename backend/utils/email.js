const nodemailer = require('nodemailer');
const { Resend } = require('resend');

// ── Resend (HTTPS API — works even when SMTP ports are blocked) ─────────
async function sendViaResend(to, subject, html, apiKey) {
  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM || 'Momento Studio <onboarding@resend.dev>';
  const result = await resend.emails.send({ from, to, subject, html });
  if (result.error) throw new Error(result.error.message || 'Resend error');
  console.log(`[resend] отправлено на ${to}: ${subject} (id: ${result.data?.id})`);
}

// ── SMTP (Yandex / custom) ──────────────────────────────────────────────
function createSmtpTransport(override = {}) {
  const host = override.mail_host || process.env.MAIL_HOST;
  const port = Number(override.mail_port || process.env.MAIL_PORT) || 587;
  const user = override.mail_user || process.env.MAIL_USER;
  const pass = override.mail_pass || process.env.MAIL_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    tls: { rejectUnauthorized: false },
  });
}

async function sendViaSmtp(to, subject, html, override = {}) {
  const transport = createSmtpTransport(override);
  if (!transport) throw new Error('SMTP не настроен');
  const senderUser = override.mail_user || process.env.MAIL_USER;
  await transport.sendMail({ from: `"Momento Studio" <${senderUser}>`, to, subject, html });
  console.log(`[smtp] отправлено на ${to}: ${subject}`);
}

// ── Universal sender: Resend → SMTP ────────────────────────────────────
async function sendEmail(to, subject, html, override = {}) {
  const resendKey = override.resend_api_key || process.env.RESEND_API_KEY;
  if (resendKey) {
    await sendViaResend(to, subject, html, resendKey);
    return;
  }
  const transport = createSmtpTransport(override);
  if (!transport) {
    console.warn(`[email] не настроен ни Resend, ни SMTP — письмо пропущено: ${to}`);
    return;
  }
  await sendViaSmtp(to, subject, html, override);
}

// ── Verify: test connectivity ───────────────────────────────────────────
async function verifySmtp(override = {}) {
  const transport = createSmtpTransport(override);
  if (!transport) throw new Error('SMTP не настроен');
  await transport.verify();
}

async function verifyResend(apiKey) {
  const resend = new Resend(apiKey);
  // Send a real test email to confirm key works
  const from = process.env.RESEND_FROM || 'Momento Studio <onboarding@resend.dev>';
  const result = await resend.emails.send({
    from,
    to: 'delivered@resend.dev', // Resend's test sink
    subject: 'Momento — проверка подключения',
    html: '<p>Тест Resend успешен.</p>',
  });
  if (result.error) throw new Error(result.error.message || 'Resend error');
}

// ── Domain-specific senders ─────────────────────────────────────────────
async function sendBookingNotification(booking, recipientEmail, smtpOverride = {}) {
  if (!recipientEmail) {
    console.log(`[email] нет получателя для заявки #${booking.id}`);
    return;
  }
  const dateStr = booking.booking_date
    ? `<tr><td><b>Дата:</b></td><td>${booking.booking_date}</td></tr>` : '';
  const timeStr = booking.booking_time
    ? `<tr><td><b>Время:</b></td><td>${booking.booking_time}</td></tr>` : '';
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px">
      <h2 style="color:#b35a36">Новая заявка #${booking.id}</h2>
      <table cellpadding="6" style="border-collapse:collapse">
        <tr><td><b>Клиент:</b></td><td>${booking.client_name}</td></tr>
        <tr><td><b>Телефон:</b></td><td>${booking.client_phone}</td></tr>
        <tr><td><b>Услуга:</b></td><td>${booking.service}</td></tr>
        ${dateStr}${timeStr}
      </table>
      <p style="margin-top:16px;color:#888">Войдите в <a href="/dashboard">панель управления</a> для подтверждения.</p>
    </div>`;
  await sendEmail(recipientEmail, `Новая заявка #${booking.id} — ${booking.service}`, html, smtpOverride);
}

async function sendConfirmationToClient(booking) {
  if (!booking.client_email) return;
  const dateStr = booking.booking_date ? ` на ${booking.booking_date}${booking.booking_time ? ' в ' + booking.booking_time : ''}` : '';
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px">
      <h2 style="color:#b35a36">Ваша запись подтверждена!</h2>
      <p>Здравствуйте, <b>${booking.client_name}</b>!</p>
      <p>Ваша заявка на <b>${booking.service}</b>${dateStr} подтверждена. Ждём вас!</p>
      <p style="color:#888">По вопросам обращайтесь к нам. Спасибо, что выбрали Momento!</p>
    </div>`;
  await sendEmail(booking.client_email, `Запись подтверждена — ${booking.service}`, html);
}

async function sendFeedbackEmail({ name, email, message }, recipientEmail) {
  if (!recipientEmail) return;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px">
      <h2 style="color:#b35a36">Новое сообщение с сайта</h2>
      <table cellpadding="6" style="border-collapse:collapse">
        <tr><td><b>Имя:</b></td><td>${name}</td></tr>
        <tr><td><b>Email:</b></td><td>${email || '—'}</td></tr>
      </table>
      <p style="margin-top:16px"><b>Сообщение:</b><br>${message.replace(/\n/g, '<br>')}</p>
    </div>`;
  await sendEmail(recipientEmail, `Обратная связь от ${name}`, html);
}

module.exports = {
  sendEmail, verifySmtp, verifyResend,
  sendBookingNotification, sendConfirmationToClient, sendFeedbackEmail,
};
