const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/dashboard/bookings
// Admin → all bookings, employee → bookings matching their service type
router.get('/bookings', authenticate, requireRole('admin', 'employee'), async (req, res) => {
  try {
    const employeeType = req.user.role === 'admin' ? null : req.user.employeeType;
    const bookings = await Booking.findForDashboard(employeeType);
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
