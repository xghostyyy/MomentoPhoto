const nodemailer = require('nodemailer');

function createTransport() {
  const { MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS } = process.env;
  if (!MAIL_HOST || !MAIL_USER || !MAIL_PASS) return null;

  return nodemailer.createTransport({
    host: MAIL_HOST,
    port: Number(MAIL_PORT) || 2525,
    auth: { user: MAIL_USER, pass: MAIL_PASS },
  });
}

async function sendEmail(to, subject, html) {
  const transport = createTransport();
  if (!transport) {
    console.log(`[email] transport not configured — skipping send to ${to}: ${subject}`);
    return;
  }
  const from = process.env.MAIL_FROM || `"Momento Studio" <${process.env.MAIL_USER}>`;
  await transport.sendMail({ from, to, subject, html });
  console.log(`[email] sent to ${to}: ${subject}`);
}

async function sendBookingNotification(booking, recipientEmail) {
  if (!recipientEmail) {
    console.log(`[email] no recipient found for booking #${booking.id}, service="${booking.service}"`);
    return;
  }
  const html = `
    <h2>Новая заявка #${booking.id}</h2>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td><b>Клиент:</b></td><td>${booking.client_name}</td></tr>
      <tr><td><b>Телефон:</b></td><td>${booking.client_phone}</td></tr>
      <tr><td><b>Email:</b></td><td>${booking.client_email || '—'}</td></tr>
      <tr><td><b>Услуга:</b></td><td>${booking.service}</td></tr>
    </table>
    <p style="margin-top:16px;color:#888">Войдите в панель для подтверждения заявки.</p>
  `;
  await sendEmail(recipientEmail, `Новая заявка #${booking.id} — ${booking.service}`, html);
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

async function sendVerificationCode(to, code, name) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#b35a36">Подтверждение регистрации</h2>
      <p>Здравствуйте${name ? ', <b>' + name + '</b>' : ''}!</p>
      <p>Ваш код подтверждения для входа в Momento:</p>
      <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#b35a36;
                  background:#ffe0cc;border-radius:14px;padding:18px;text-align:center;margin:18px 0">
        ${code}
      </div>
      <p style="color:#999;font-size:13px">Код действует 15 минут. Если вы не регистрировались — просто проигнорируйте это письмо.</p>
    </div>
  `;
  await sendEmail(to, `Код подтверждения Momento: ${code}`, html);
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

module.exports = { sendEmail, sendBookingNotification, sendConfirmationToClient, sendFeedbackEmail, sendVerificationCode };
