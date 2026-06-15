const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();
const User = require('../models/User');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const Service = require('../models/Service');
const { authenticate, requireRole } = require('../middleware/auth');

// ── Health check ────────────────────────────────────────────────────
router.get('/test', (_req, res) => res.json({ status: 'ok' }));

// ── Auth ─────────────────────────────────────────────────────────────
router.post('/auth/register', async (req, res) => {
  try {
    const { email, password, full_name, role = 'client', employee_type } = req.body;
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'email, password and full_name are required' });
    }

    const existing = await User.findByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, 10);
    const { id } = await User.create({ email, password_hash, role, full_name, employee_type });

    const token = jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, id, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, id: user.id, role: user.role, full_name: user.full_name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
router.post('/bookings', async (req, res) => {
  try {
    const { client_name, client_phone, service, employee_id } = req.body;
    if (!client_name || !client_phone || !service) {
      return res.status(400).json({ error: 'client_name, client_phone and service are required' });
    }
    const result = await Booking.create({ client_name, client_phone, service, employee_id });
    res.status(201).json(result);
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
