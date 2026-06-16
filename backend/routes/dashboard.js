const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { authenticate, requireRole } = require('../middleware/auth');
const { verifySmtp, verifyResend, sendEmail } = require('../utils/email');
const { addClient, removeClient } = require('../utils/sse');

// GET /api/dashboard/stream — SSE for real-time booking notifications
// Auth via ?token= query param because EventSource doesn't support custom headers
router.get('/stream', (req, res) => {
  let user;
  try {
    user = jwt.verify(req.query.token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).end();
  }
  if (user.role !== 'admin' && user.role !== 'employee') return res.status(403).end();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('event: connected\ndata: {}\n\n');

  addClient(user.id, res);
  req.on('close', () => removeClient(user.id, res));
});

// GET /api/dashboard/bookings
// Admin → all bookings, employee → bookings matching their service type
router.get('/bookings', authenticate, requireRole('admin', 'employee'), async (req, res) => {
  try {
    const employeeType = req.user.role === 'admin' ? null : req.user.employeeType;
    const bookings = await Booking.findForDashboard(employeeType);
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/dashboard/new-bookings-count?lastCheck=<unix ms>
router.get('/new-bookings-count', authenticate, requireRole('admin', 'employee'), async (req, res) => {
  try {
    const { lastCheck } = req.query;
    const since = lastCheck
      ? new Date(Number(lastCheck)).toISOString().replace('T', ' ').slice(0, 19)
      : new Date(0).toISOString().replace('T', ' ').slice(0, 19);

    const employeeType = req.user.role === 'admin' ? null : req.user.employeeType;
    const count = await Booking.countSince(since, employeeType);
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ── Mail settings ──────────────────────────────────────────────────────
router.get('/mail-settings', authenticate, requireRole('admin', 'employee'), async (req, res) => {
  try {
    const row = await User.getMailSettings(req.user.id);
    res.json({
      mail_user: row?.mail_user || null,
      has_password: !!row?.mail_pass,
      has_resend: !!row?.resend_api_key,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ── Resend settings ────────────────────────────────────────────────────
router.post('/resend-settings', authenticate, requireRole('admin', 'employee'), async (req, res) => {
  try {
    const { resend_api_key } = req.body;
    await User.updateResendKey(req.user.id, resend_api_key || null);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.post('/resend-settings/test', authenticate, requireRole('admin', 'employee'), async (req, res) => {
  try {
    const { resend_api_key } = req.body;
    const existing = await User.getResendKey(req.user.id);
    const key = resend_api_key || existing;
    if (!key) return res.status(400).json({ error: 'Введите API-ключ Resend' });
    await verifyResend(key);
    await User.updateResendKey(req.user.id, key);
    res.json({ ok: true, message: 'Resend подключён успешно! Письма будут доставляться через HTTPS.' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

router.post('/mail-settings', authenticate, requireRole('admin', 'employee'), async (req, res) => {
  try {
    const { mail_user, mail_pass } = req.body;
    if (!mail_user) return res.status(400).json({ error: 'Укажите email' });

    // If no new password provided, keep the existing one
    let passToSave = mail_pass || null;
    if (!mail_pass) {
      const existing = await User.getMailSettings(req.user.id);
      passToSave = existing?.mail_pass || null;
    }

    await User.updateMailSettings(req.user.id, mail_user, passToSave);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.post('/mail-settings/test', authenticate, requireRole('admin', 'employee'), async (req, res) => {
  try {
    const existing = await User.getMailSettings(req.user.id);
    const { mail_user, mail_pass } = req.body;

    const user = mail_user || existing?.mail_user;
    const pass = mail_pass || existing?.mail_pass;

    if (!user || !pass) {
      return res.status(400).json({ error: 'Сохраните email и пароль перед проверкой' });
    }

    const override = { mail_host: 'smtp.yandex.ru', mail_port: 587, mail_user: user, mail_pass: pass };

    await verifySmtp(override);

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px">
        <h2 style="color:#b35a36">Тест подключения Momento</h2>
        <p>Это тестовое письмо. SMTP успешно настроен.</p>
        <p style="color:#999;font-size:13px">Вы будете получать уведомления о новых заявках на этот адрес.</p>
      </div>`;
    await sendEmail(user, 'Тест подключения — Momento', html, override);

    res.json({ ok: true, message: 'Тестовое письмо отправлено на ' + user });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
