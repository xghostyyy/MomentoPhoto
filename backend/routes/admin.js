const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Review = require('../models/Review');
const { authenticate, requireRole } = require('../middleware/auth');

const adminOnly = [authenticate, requireRole('admin')];

// GET /api/admin/users
router.get('/users', ...adminOnly, async (_req, res) => {
  try {
    res.json(await User.getAllUsers());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/users/change-role  { userId, newRole }
router.post('/users/change-role', ...adminOnly, async (req, res) => {
  try {
    const { userId, newRole } = req.body;
    const allowed = ['client', 'employee', 'admin'];
    if (!userId || !allowed.includes(newRole)) {
      return res.status(400).json({ error: `newRole must be one of: ${allowed.join(', ')}` });
    }
    const { changes } = await User.updateRole(userId, newRole);
    if (changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', ...adminOnly, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    const { changes } = await User.deleteById(targetId);
    if (changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/reviews
router.get('/reviews', ...adminOnly, async (_req, res) => {
  try {
    res.json(await Review.findAll());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/reviews/publish  { reviewId, is_published }
router.post('/reviews/publish', ...adminOnly, async (req, res) => {
  try {
    const { reviewId, is_published = true } = req.body;
    if (!reviewId) return res.status(400).json({ error: 'reviewId is required' });
    const { changes } = await Review.setPublished(reviewId, is_published);
    if (changes === 0) return res.status(404).json({ error: 'Review not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
