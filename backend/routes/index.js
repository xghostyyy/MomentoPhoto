const express = require('express');

const router = express.Router();
const User = require('../models/User');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const Service = require('../models/Service');
const GalleryPhoto = require('../models/GalleryPhoto');
const { authenticate, requireRole, optionalAuth } = require('../middleware/auth');
const { sendBookingNotification, sendConfirmationToClient, sendFeedbackEmail } = require('../utils/email');
const Feedback = require('../models/Feedback');
const { broadcast } = require('../utils/sse');

// ── Health check ────────────────────────────────────────────────────
router.get('/test', (_req, res) => res.json({ status: 'ok' }));

// ── Services ─────────────────────────────────────────────────────────
router.get('/services', async (_req, res) => {
  try {
    res.json(await Service.findAll());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ── Bookings ──────────────────────────────────────────────────────────
router.post('/bookings', optionalAuth, async (req, res) => {
  try {
    const { client_name, client_phone, service, employee_id, booking_date, booking_time } = req.body;
    if (!client_name || !client_phone || !service) {
      return res.status(400).json({ error: 'Обязательны: имя клиента, телефон и услуга' });
    }
    if (!booking_date || !booking_time) {
      return res.status(400).json({ error: 'Укажите желаемую дату и время' });
    }

    // Fetch authenticated user's email if logged in
    let client_email = null;
    if (req.user) {
      const me = await User.findById(req.user.id);
      client_email = me ? me.email : null;
    }

    const result = await Booking.create({ client_name, client_phone, service, employee_id, client_email, booking_date, booking_time });
    const booking = await Booking.findById(result.id);

    // Route notification to the employee whose type matches the service
    const [serviceRecord, employees, resendKey] = await Promise.all([
      Service.findByName(service),
      User.findAllEmployees({ includeEmail: true, includeMail: true }),
      User.findResendKey(),
    ]);
    const targetType = serviceRecord?.employee_type || 'photographer';
    const employee   = employees.find((e) => e.employee_type === targetType);
    const recipientEmail = employee?.mail_user || employee?.email;
    const smtpOverride = resendKey
      ? { resend_api_key: resendKey }
      : (employee?.mail_user && employee?.mail_pass
          ? { mail_host: 'smtp.yandex.ru', mail_port: 587, mail_user: employee.mail_user, mail_pass: employee.mail_pass }
          : {});
    sendBookingNotification(booking, recipientEmail, smtpOverride).catch(console.error);

    // Real-time notification to all connected employee dashboards
    broadcast('new-booking', {
      id: booking.id,
      client_name: booking.client_name,
      service: booking.service,
      booking_date: booking.booking_date,
      booking_time: booking.booking_time,
    });

    res.status(201).json({ ...result, emailSent: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/bookings', authenticate, requireRole('admin', 'employee'), async (_req, res) => {
  try {
    res.json(await Booking.findAll());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.patch('/bookings/:id/status', authenticate, requireRole('admin', 'employee'), async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'confirmed', 'done', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }
    const { changes } = await Booking.updateStatus(req.params.id, status);
    if (changes === 0) return res.status(404).json({ error: 'Заявка не найдена' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.patch('/bookings/:id/call-status', authenticate, requireRole('admin', 'employee'), async (req, res) => {
  try {
    const { call_status } = req.body;
    if (!['needed', 'called'].includes(call_status)) {
      return res.status(400).json({ error: 'call_status должен быть needed или called' });
    }
    const { changes } = await Booking.updateCallStatus(req.params.id, call_status);
    if (changes === 0) return res.status(404).json({ error: 'Заявка не найдена' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.put('/bookings/:id/confirm', authenticate, requireRole('admin', 'employee'), async (req, res) => {
  try {
    const { id } = req.params;
    await Booking.updateStatus(id, 'confirmed');
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ error: 'Заявка не найдена' });

    sendConfirmationToClient(booking).catch(console.error);

    res.json({ success: true, clientNotified: !!booking.client_email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ── Reviews ───────────────────────────────────────────────────────────
router.get('/reviews', async (_req, res) => {
  try {
    res.json(await Review.findPublished());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.post('/reviews', authenticate, async (req, res) => {
  try {
    const { booking_id, rating, text } = req.body;
    if (!booking_id || !rating) {
      return res.status(400).json({ error: 'Обязательны: booking_id и оценка' });
    }
    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'Оценка должна быть целым числом от 1 до 5' });
    }
    const booking = await Booking.findById(booking_id);
    if (!booking) return res.status(404).json({ error: 'Заявка не найдена' });

    // Verify booking belongs to current user
    const me = await User.findById(req.user.id);
    if (booking.client_email !== me.email) {
      return res.status(403).json({ error: 'Эта заявка вам не принадлежит' });
    }
    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: 'Оставить отзыв можно только по подтверждённой заявке' });
    }

    // Prevent duplicate reviews
    const existing = await Review.findByBookingId(booking_id);
    if (existing) return res.status(409).json({ error: 'Отзыв на эту заявку уже существует' });

    const result = await Review.create({ booking_id, rating: ratingNum, text });
    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ── User: confirmed bookings ──────────────────────────────────────────
router.get('/user/confirmed-bookings', authenticate, async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ error: 'Пользователь не найден' });
    const bookings = await Booking.findByClientEmail(me.email, 'confirmed');
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.patch('/reviews/:id/publish', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { is_published } = req.body;
    const { changes } = await Review.setPublished(req.params.id, is_published);
    if (changes === 0) return res.status(404).json({ error: 'Отзыв не найден' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ── Employees ─────────────────────────────────────────────────────────
router.get('/employees', async (_req, res) => {
  try {
    res.json(await User.findAllEmployees());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ── Team (public — employees + admin, ordered admin first) ────────────
router.get('/team', async (_req, res) => {
  try {
    res.json(await User.findTeam());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ── Gallery (public) ──────────────────────────────────────────────────
router.get('/gallery', async (_req, res) => {
  try {
    res.json(await GalleryPhoto.findAll());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ── Feedback (saves to DB + emails manager) ───────────────────────────
router.post('/feedback', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !message) return res.status(400).json({ error: 'name и message обязательны' });

    const entry = await Feedback.create({ name, email: email || null, message });

    const employees = await User.findAllEmployees({ includeEmail: true });
    const manager = employees.find(e => e.employee_type === 'manager') || employees[0];
    sendFeedbackEmail({ name, email, message }, manager?.email).catch(console.error);

    res.status(201).json({ id: entry.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ── Contact (footer form — only emails, no DB) ────────────────────────
router.post('/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !message) return res.status(400).json({ error: 'name и message обязательны' });

    const employees = await User.findAllEmployees({ includeEmail: true });
    const manager = employees.find(e => e.employee_type === 'manager') || employees[0];
    sendFeedbackEmail({ name, email, message }, manager?.email).catch(console.error);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
