const express = require('express');

const router = express.Router();
const User = require('../models/User');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const Service = require('../models/Service');
const { authenticate, requireRole, optionalAuth } = require('../middleware/auth');
const { sendBookingNotification, sendConfirmationToClient } = require('../utils/email');

// ── Health check ────────────────────────────────────────────────────
router.get('/test', (_req, res) => res.json({ status: 'ok' }));

// ── Services ─────────────────────────────────────────────────────────
router.get('/services', async (_req, res) => {
  try {
    res.json(await Service.findAll());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Bookings ──────────────────────────────────────────────────────────
router.post('/bookings', optionalAuth, async (req, res) => {
  try {
    const { client_name, client_phone, service, employee_id } = req.body;
    if (!client_name || !client_phone || !service) {
      return res.status(400).json({ error: 'client_name, client_phone and service are required' });
    }

    // Fetch authenticated user's email if logged in
    let client_email = null;
    if (req.user) {
      const me = await User.findById(req.user.id);
      client_email = me ? me.email : null;
    }

    const result = await Booking.create({ client_name, client_phone, service, employee_id, client_email });
    const booking = await Booking.findById(result.id);

    // Notify employees asynchronously — don't block the response
    const employees = await User.findAllEmployees();
    const photographerEmail = employees.find((e) => e.employee_type === 'photographer')?.email;
    const managerEmail      = employees.find((e) => e.employee_type === 'manager')?.email;
    sendBookingNotification(booking, photographerEmail, managerEmail).catch(console.error);

    res.status(201).json({ ...result, emailSent: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/bookings', authenticate, requireRole('admin', 'employee'), async (_req, res) => {
  try {
    res.json(await Booking.findAll());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/bookings/:id/status', authenticate, requireRole('admin', 'employee'), async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'confirmed', 'done', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }
    await Booking.updateStatus(req.params.id, status);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/bookings/:id/confirm', authenticate, requireRole('admin', 'employee'), async (req, res) => {
  try {
    const { id } = req.params;
    await Booking.updateStatus(id, 'confirmed');
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    sendConfirmationToClient(booking).catch(console.error);

    res.json({ success: true, clientNotified: !!booking.client_email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Reviews ───────────────────────────────────────────────────────────
router.get('/reviews', async (_req, res) => {
  try {
    res.json(await Review.findPublished());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reviews', async (req, res) => {
  try {
    const { booking_id, rating, text } = req.body;
    if (!booking_id || !rating) {
      return res.status(400).json({ error: 'booking_id and rating are required' });
    }
    const result = await Review.create({ booking_id, rating, text });
    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/reviews/:id/publish', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { is_published } = req.body;
    await Review.setPublished(req.params.id, is_published);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Employees ─────────────────────────────────────────────────────────
router.get('/employees', async (_req, res) => {
  try {
    res.json(await User.findAllEmployees());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
